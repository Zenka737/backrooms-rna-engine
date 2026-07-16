/**
 * RNA Engine - Realistic Navigation & Atmosphere Engine
 * v2 — flashlight, head bob, ambient darkness, breath effect
 */
export class RNAEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.FOV = Math.PI / 3;
    this.maxDepth = 24;

    // Flicker
    this.flickerTimer = 0;
    this.flickerIntensity = 1.0;

    // Head bob
    this.bobTimer = 0;
    this.bobOffset = 0;
    this.bobAmount = 0;

    // Breath / camera sway
    this.breathTimer = 0;

    // Flashlight
    this.flashlightOn = true;
    this.flashlightBattery = 100; // %
    this.flashlightDrain = 0.004; // per frame

    // Noise
    this.noiseCanvas = this._buildNoiseCanvas();

    // Darkness overlay (ambient level)
    this.ambientDark = 0.0;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  toggleFlashlight() {
    if (this.flashlightBattery > 0) this.flashlightOn = !this.flashlightOn;
  }

  _buildNoiseCanvas() {
    const nc = document.createElement('canvas');
    nc.width = 256; nc.height = 256;
    const nctx = nc.getContext('2d');
    const img = nctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 18 | 0;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 12;
    }
    nctx.putImageData(img, 0, 0);
    return nc;
  }

  render(map, player, level, isMoving) {
    const ctx = this.ctx;
    const W = this.width, H = this.height;

    this._updateFlicker(level.flickerRate);
    this._updateBob(isMoving);
    this._updateFlashlight();

    this.breathTimer += 0.008;
    const breathX = Math.sin(this.breathTimer * 1.1) * 1.2;
    const breathY = Math.sin(this.breathTimer * 0.7) * 0.8;

    const horizonShift = this.bobOffset * 6 + breathY;

    ctx.save();
    ctx.translate(breathX, 0);

    this._drawFloorCeiling(level, W, H, horizonShift);
    const zbuffer = this._raycastWalls(map, player, level, W, H, horizonShift);
    if (level.entities) this._drawSprites(map, player, level, zbuffer, W, H, horizonShift);
    if (level.lights) this._drawCeilingLights(level.lights, level, player, W, H, horizonShift);

    ctx.restore();

    // Flashlight cone on top
    if (this.flashlightOn && this.flashlightBattery > 0) {
      this._drawFlashlight(W, H);
    } else {
      this._drawDarkness(W, H);
    }

    // Film grain
    ctx.drawImage(this.noiseCanvas, 0, 0, W, H);

    // Vignette
    this._drawVignette(W, H, level.vignetteStrength);

    // HUD
    this._drawHUD(player, level, W, H);
  }

  _updateFlicker(rate = 0.02) {
    this.flickerTimer += rate;
    const base = 0.88 + Math.sin(this.flickerTimer * 7.3) * 0.04;
    const spike = Math.random() < 0.008 ? Math.random() * 0.5 : 0;
    this.flickerIntensity = Math.max(0.25, Math.min(1.0, base - spike));
  }

  _updateBob(isMoving) {
    if (isMoving) {
      this.bobTimer += 0.12;
      this.bobAmount = Math.min(1, this.bobAmount + 0.08);
    } else {
      this.bobAmount = Math.max(0, this.bobAmount - 0.05);
    }
    this.bobOffset = Math.sin(this.bobTimer) * this.bobAmount;
  }

  _updateFlashlight() {
    if (this.flashlightOn && this.flashlightBattery > 0) {
      this.flashlightBattery = Math.max(0, this.flashlightBattery - this.flashlightDrain);
      if (this.flashlightBattery <= 0) this.flashlightOn = false;
    }
  }

  _drawFloorCeiling(level, W, H, shift) {
    const ctx = this.ctx;
    const mid = H / 2 + shift;

    const cg = ctx.createLinearGradient(0, 0, 0, mid);
    cg.addColorStop(0, level.ceilingColorTop);
    cg.addColorStop(1, level.ceilingColorBottom);
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, mid);

    const fg = ctx.createLinearGradient(0, mid, 0, H);
    fg.addColorStop(0, level.floorColorTop);
    fg.addColorStop(1, level.floorColorBottom);
    ctx.fillStyle = fg;
    ctx.fillRect(0, mid, W, H - mid);
  }

  _raycastWalls(map, player, level, W, H, horizonShift) {
    const ctx = this.ctx;
    const zbuffer = new Float32Array(W);
    const mid = H / 2 + horizonShift;

    for (let x = 0; x < W; x++) {
      const rayAngle = player.angle - this.FOV / 2 + (x / W) * this.FOV;
      const cosA = Math.cos(rayAngle), sinA = Math.sin(rayAngle);
      let dist = 0, hit = false, hitType = 0, wallX = 0, side = 0;
      let mapX = Math.floor(player.x), mapY = Math.floor(player.y);
      const stepX = cosA > 0 ? 1 : -1, stepY = sinA > 0 ? 1 : -1;
      const deltaDX = Math.abs(1 / cosA), deltaDY = Math.abs(1 / sinA);
      let sideDistX = (cosA > 0 ? mapX + 1 - player.x : player.x - mapX) * deltaDX;
      let sideDistY = (sinA > 0 ? mapY + 1 - player.y : player.y - mapY) * deltaDY;

      for (let i = 0; i < this.maxDepth * 4 && !hit; i++) {
        if (sideDistX < sideDistY) { sideDistX += deltaDX; mapX += stepX; side = 0; }
        else { sideDistY += deltaDY; mapY += stepY; side = 1; }
        const cell = map.getCell(mapX, mapY);
        if (cell > 0) {
          hit = true; hitType = cell;
          dist = side === 0
            ? (mapX - player.x + (1 - stepX) / 2) / cosA
            : (mapY - player.y + (1 - stepY) / 2) / sinA;
          wallX = side === 0 ? player.y + dist * sinA : player.x + dist * cosA;
          wallX -= Math.floor(wallX);
        }
      }

      const corrDist = Math.max(0.1, dist * Math.cos(rayAngle - player.angle));
      zbuffer[x] = corrDist;

      if (hit) {
        const wallH = Math.min(H * 2, H / corrDist);
        const wallTop = mid - wallH / 2;

        // Base shade from fog + flashlight cone influence
        let shade = this._getShade(corrDist, side, level);
        const flashShade = this._flashlightShade(x, W, corrDist);
        shade = shade * (0.15 + 0.85 * flashShade) * this.flickerIntensity;

        ctx.fillStyle = level.getWallColor(hitType, wallX, shade);
        ctx.fillRect(x, wallTop, 1, wallH);
      }
    }
    return zbuffer;
  }

  // How much the flashlight illuminates column x at distance d
  _flashlightShade(x, W, dist) {
    if (!this.flashlightOn || this.flashlightBattery <= 0) return 0;

    const center = W / 2;
    const spread = W * 0.28; // cone width
    const dx = x - center;
    const angleFactor = Math.max(0, 1 - (dx * dx) / (spread * spread));

    // Flicker for low battery
    const batteryFlicker = this.flashlightBattery < 20
      ? 0.5 + Math.random() * 0.5
      : 1.0;

    // Distance falloff
    const distFactor = Math.max(0, 1 - dist / 14);

    return angleFactor * distFactor * batteryFlicker;
  }

  _getShade(dist, side, level) {
    const maxDist = level.fogDistance || 12;
    let shade = 1 - Math.min(1, dist / maxDist);
    if (side === 1) shade *= 0.78;
    return Math.max(0.14, shade);
  }

  _drawSprites(map, player, level, zbuffer, W, H, horizonShift) {
    const ctx = this.ctx;
    const mid = H / 2 + horizonShift;
    const sprites = level.entities
      .map(e => ({ ...e, dist: Math.hypot(e.x - player.x, e.y - player.y), angle: Math.atan2(e.y - player.y, e.x - player.x) - player.angle }))
      .sort((a, b) => b.dist - a.dist);

    for (const sp of sprites) {
      let ang = sp.angle;
      while (ang > Math.PI) ang -= 2 * Math.PI;
      while (ang < -Math.PI) ang += 2 * Math.PI;
      if (Math.abs(ang) > this.FOV) continue;
      const screenX = Math.floor((0.5 + ang / this.FOV) * W);
      const dist = Math.max(0.5, sp.dist);
      // Монстр выше стены — страшнее
      const sprH = Math.min(H * 2, H / dist * 1.4);
      const sprW = sprH * 0.55;
      const startX = screenX - sprW / 2;
      const topY = mid - sprH * 0.72; // смещён вверх (голова выше горизонта)

      for (let sx = 0; sx < sprW; sx++) {
        const col = Math.floor(startX + sx);
        if (col < 0 || col >= W || zbuffer[col] <= dist) continue;
        const flashShade = this._flashlightShade(col, W, dist);
        const shade = Math.max(0.05, (1 - dist / (level.fogDistance || 12)) * (0.15 + 0.85 * flashShade));
        const u = sx / sprW; // позиция по ширине спрайта 0..1

        for (let sy = 0; sy < sprH; sy++) {
          const v = sy / sprH; // позиция по высоте 0..1
          const py = Math.floor(topY + sy);
          if (py < 0 || py >= H) continue;

          // Силуэт монстра: узкий снизу, шире в плечах, круглая голова
          const bodyFactor = v < 0.18
            ? (1 - Math.pow((u - 0.5) * 3.5, 2))   // голова
            : v < 0.55
            ? (1 - Math.pow((u - 0.5) * 1.8, 2))   // торс широкий
            : (1 - Math.pow((u - 0.5) * 2.8, 2));  // ноги

          if (bodyFactor < 0) continue;

          // Цвет: красное тело с тёмными прожилками
          const stripe = Math.sin(v * 18) > 0.6 ? 0.55 : 1.0;
          const glow = v < 0.2 ? 0.8 + Math.sin(Date.now() * 0.005) * 0.2 : 1.0; // глаза светятся
          const r = Math.floor(200 * shade * stripe * glow);
          const g = Math.floor(8 * shade * stripe);
          const b = Math.floor(8 * shade * stripe);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(col, py, 1, 1);
        }
      }

      // Светящиеся глаза (два ярких пятна)
      if (dist < 10) {
        const eyeY = Math.floor(topY + sprH * 0.12);
        const eyeAlpha = Math.min(0.9, (1 - dist / 10) * this.flickerIntensity);
        ctx.fillStyle = `rgba(255,80,0,${eyeAlpha})`;
        ctx.fillRect(Math.floor(screenX - sprW * 0.15), eyeY, 2, 2);
        ctx.fillRect(Math.floor(screenX + sprW * 0.08), eyeY, 2, 2);
      }
    }
  }

  // Realistic flashlight: bright central cone, dark outside
  _drawFlashlight(W, H) {
    const ctx = this.ctx;
    const cx = W / 2, cy = H / 2;

    // Ambient darkness layer
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, W, H);

    // Flashlight cone — cut out the darkness
    const battery = this.flashlightBattery;
    const flicker = battery < 20 ? 0.6 + Math.random() * 0.4 : 1.0;
    const warmth = battery < 30 ? `rgba(180,120,40,${0.18 * flicker})` : `rgba(255,240,200,${0.12 * flicker})`;

    // Outer glow
    const outerR = Math.min(W, H) * 0.55 * flicker;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    grd.addColorStop(0,   `rgba(0,0,0,0)`);
    grd.addColorStop(0.35, `rgba(0,0,0,0)`);
    grd.addColorStop(0.7,  `rgba(0,0,0,0.55)`);
    grd.addColorStop(1,    `rgba(0,0,0,0.95)`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Warm tint in cone center
    const warmGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR * 0.5);
    warmGrd.addColorStop(0, warmth);
    warmGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = warmGrd;
    ctx.fillRect(0, 0, W, H);

    // Battery low: red tint warning
    if (battery < 15) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.fillStyle = `rgba(80,0,0,${0.25 * pulse})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Pure darkness when flashlight is off
  _drawDarkness(W, H) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, W, H);
  }

  _drawVignette(W, H, strength = 0.5) {
    const ctx = this.ctx;
    const grd = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.85);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  _drawHUD(player, level, W, H) {
    const ctx = this.ctx;
    const fi = this.flickerIntensity;

    // Level name
    ctx.fillStyle = `rgba(255,220,120,${0.65 * fi})`;
    ctx.font = '13px monospace';
    ctx.fillText(`Level: ${level.name}`, 10, 20);

    // Sanity bar
    if (level.showSanity && player.sanity !== undefined) {
      const s = player.sanity;
      const barW = 120, barH = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 30, barW, barH);
      const col = s > 50 ? `rgba(80,220,80,0.8)` : s > 25 ? `rgba(220,180,0,0.8)` : `rgba(220,40,40,0.8)`;
      ctx.fillStyle = col;
      ctx.fillRect(10, 30, barW * s / 100, barH);
      ctx.fillStyle = `rgba(200,200,200,0.5)`;
      ctx.font = '10px monospace';
      ctx.fillText(`SANITY`, 10, 52);
    }

    // Flashlight battery bar
    const bat = this.flashlightBattery;
    const bx = 10, by = 60, bw = 80, bh = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    const batCol = bat > 40 ? 'rgba(180,220,255,0.8)' : bat > 15 ? 'rgba(220,160,40,0.8)' : 'rgba(220,40,40,0.8)';
    ctx.fillStyle = batCol;
    ctx.fillRect(bx, by, bw * bat / 100, bh);
    ctx.fillStyle = `rgba(180,200,255,${this.flashlightOn ? 0.7 : 0.3})`;
    ctx.font = '10px monospace';
    ctx.fillText(this.flashlightOn ? `LIGHT [F]` : `LIGHT OFF [F]`, bx, by + 18);

    // Crosshair
    const cx = W / 2, cy = H / 2;
    ctx.strokeStyle = `rgba(255,255,255,0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // Hearts
    if (player.hearts !== undefined) {
      ctx.font = '22px serif';
      for (let i = 0; i < player.maxHearts; i++) {
        const filled = i < player.hearts;
        // Мигание при неуязвимости
        if (!filled || (player.invincible > 0 && Math.floor(player.invincible / 8) % 2 === 0)) {
          ctx.fillStyle = 'rgba(60,10,10,0.6)';
        } else {
          ctx.fillStyle = `rgba(220,40,40,${0.9 * fi})`;
        }
        ctx.fillText('♥', 10 + i * 26, H - 12);
      }
    }
  }

  // Проекция потолочных ламп в мировом пространстве
  _drawCeilingLights(lights, level, player, W, H, horizonShift) {
    const ctx = this.ctx;
    const mid = H / 2 + horizonShift;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    const [lr, lg, lb] = level.lightColor || [220, 200, 120];
    const flicker = this.flickerIntensity;

    for (const light of lights) {
      const rdx = light.x - player.x;
      const rdy = light.y - player.y;

      // Трансформация в пространство камеры
      const camZ = rdx * cos + rdy * sin;
      const camX = -rdx * sin + rdy * cos;

      if (camZ <= 0.1) continue;

      const screenX = Math.floor(W / 2 * (1 + camX / camZ));
      // Y позиция лампы на потолке (потолок выше горизонта)
      const screenY = Math.floor(mid - (H * 0.5) / camZ);

      if (screenX < -50 || screenX > W + 50 || screenY > mid) continue;

      const size = Math.min(80, Math.max(4, W * 0.06 / camZ));
      const alpha = Math.max(0, Math.min(0.85, 1.2 / camZ)) * flicker;

      // Светящееся пятно на потолке
      const grd = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size * 2.5);
      grd.addColorStop(0,   `rgba(${lr},${lg},${lb},${alpha})`);
      grd.addColorStop(0.3, `rgba(${lr},${lg},${lb},${alpha * 0.5})`);
      grd.addColorStop(1,   `rgba(${lr},${lg},${lb},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(screenX - size * 2.5, screenY - size * 2.5, size * 5, size * 5);

      // Яркое ядро лампы
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, alpha * 1.5)})`;
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, Math.max(1, size * 0.4), Math.max(1, size * 0.15), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
