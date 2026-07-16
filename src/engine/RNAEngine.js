/**
 * RNA Engine - Realistic Navigation & Atmosphere Engine
 * Raycasting renderer for Backrooms
 */
export class RNAEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.halfH = this.height / 2;

    // Rendering config
    this.FOV = Math.PI / 3;
    this.numRays = this.width;
    this.maxDepth = 20;
    this.textureSize = 64;

    // Atmosphere
    this.flickerTimer = 0;
    this.flickerIntensity = 1.0;
    this.vignetteAlpha = 0.0;
    this.noiseCanvas = this._buildNoiseCanvas();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.halfH = h / 2;
    this.numRays = w;
  }

  _buildNoiseCanvas() {
    const nc = document.createElement('canvas');
    nc.width = 256;
    nc.height = 256;
    const nctx = nc.getContext('2d');
    const img = nctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 40 | 0;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 30;
    }
    nctx.putImageData(img, 0, 0);
    return nc;
  }

  render(map, player, level) {
    const ctx = this.ctx;
    const W = this.width, H = this.height;

    // Flicker effect
    this._updateFlicker(level.flickerRate);

    // Floor & ceiling
    this._drawFloorCeiling(level, W, H);

    // Raycast walls
    const zbuffer = this._raycastWalls(map, player, level, W, H);

    // Sprites / entities
    if (level.entities) {
      this._drawSprites(map, player, level, zbuffer, W, H);
    }

    // Post-process: noise grain
    ctx.drawImage(this.noiseCanvas, 0, 0, W, H);

    // Vignette
    this._drawVignette(W, H, level.vignetteStrength);

    // HUD overlay
    this._drawHUD(player, level, W, H);
  }

  _updateFlicker(rate = 0.02) {
    this.flickerTimer += rate;
    const base = 0.85 + Math.sin(this.flickerTimer * 7.3) * 0.05;
    const spike = Math.random() < 0.01 ? Math.random() * 0.4 : 0;
    this.flickerIntensity = Math.max(0.3, Math.min(1.0, base - spike));
  }

  _drawFloorCeiling(level, W, H) {
    const ctx = this.ctx;
    // Ceiling
    const cg = ctx.createLinearGradient(0, 0, 0, H / 2);
    cg.addColorStop(0, level.ceilingColorTop);
    cg.addColorStop(1, level.ceilingColorBottom);
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H / 2);
    // Floor
    const fg = ctx.createLinearGradient(0, H / 2, 0, H);
    fg.addColorStop(0, level.floorColorTop);
    fg.addColorStop(1, level.floorColorBottom);
    ctx.fillStyle = fg;
    ctx.fillRect(0, H / 2, W, H / 2);
  }

  _raycastWalls(map, player, level, W, H) {
    const ctx = this.ctx;
    const zbuffer = new Float32Array(W);

    for (let x = 0; x < W; x++) {
      const rayAngle = player.angle - this.FOV / 2 + (x / W) * this.FOV;
      const cosA = Math.cos(rayAngle);
      const sinA = Math.sin(rayAngle);

      let dist = 0;
      let hit = false;
      let hitType = 0;
      let wallX = 0;
      let side = 0; // 0=horizontal, 1=vertical

      // DDA
      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);
      const stepX = cosA > 0 ? 1 : -1;
      const stepY = sinA > 0 ? 1 : -1;
      const deltaDX = Math.abs(1 / cosA);
      const deltaDY = Math.abs(1 / sinA);
      let sideDistX = (cosA > 0 ? mapX + 1 - player.x : player.x - mapX) * deltaDX;
      let sideDistY = (sinA > 0 ? mapY + 1 - player.y : player.y - mapY) * deltaDY;

      for (let i = 0; i < this.maxDepth * 4 && !hit; i++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDY;
          mapY += stepY;
          side = 1;
        }
        const cell = map.getCell(mapX, mapY);
        if (cell > 0) {
          hit = true;
          hitType = cell;
          dist = side === 0
            ? (mapX - player.x + (1 - stepX) / 2) / cosA
            : (mapY - player.y + (1 - stepY) / 2) / sinA;
          wallX = side === 0
            ? player.y + dist * sinA
            : player.x + dist * cosA;
          wallX -= Math.floor(wallX);
        }
      }

      // Fish-eye correction
      const corrDist = Math.max(0.1, dist * Math.cos(rayAngle - player.angle));
      zbuffer[x] = corrDist;

      if (hit) {
        const wallH = Math.min(H * 2, H / corrDist);
        const wallTop = H / 2 - wallH / 2;
        const shade = this._getShade(corrDist, side, level) * this.flickerIntensity;
        const col = level.getWallColor(hitType, wallX, shade);
        ctx.fillStyle = col;
        ctx.fillRect(x, wallTop, 1, wallH);
      }
    }

    return zbuffer;
  }

  _getShade(dist, side, level) {
    const maxDist = level.fogDistance || 12;
    let shade = 1 - Math.min(1, dist / maxDist);
    if (side === 1) shade *= 0.7;
    return Math.max(0.05, shade);
  }

  _drawSprites(map, player, level, zbuffer, W, H) {
    const ctx = this.ctx;
    const sprites = level.entities
      .map(e => ({
        ...e,
        dist: Math.hypot(e.x - player.x, e.y - player.y),
        angle: Math.atan2(e.y - player.y, e.x - player.x) - player.angle,
      }))
      .sort((a, b) => b.dist - a.dist);

    for (const sp of sprites) {
      let ang = sp.angle;
      while (ang > Math.PI) ang -= 2 * Math.PI;
      while (ang < -Math.PI) ang += 2 * Math.PI;
      if (Math.abs(ang) > this.FOV) continue;

      const screenX = Math.floor((0.5 + ang / this.FOV) * W);
      const dist = Math.max(0.5, sp.dist);
      const sprH = Math.min(H * 2, H / dist);
      const sprTop = H / 2 - sprH / 2;
      const sprW = sprH;
      const startX = screenX - sprW / 2;

      for (let sx = 0; sx < sprW; sx++) {
        const col = startX + sx;
        if (col < 0 || col >= W) continue;
        if (zbuffer[col] <= dist) continue;
        const shade = Math.max(0.1, 1 - dist / (level.fogDistance || 12));
        ctx.fillStyle = sp.getColor ? sp.getColor(shade) : `rgba(255,255,0,${shade})`;
        ctx.fillRect(col, sprTop, 1, sprH);
      }
    }
  }

  _drawVignette(W, H, strength = 0.6) {
    const ctx = this.ctx;
    const grd = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.8);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  _drawHUD(player, level, W, H) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,220,120,${0.7 * this.flickerIntensity})`;
    ctx.font = '14px monospace';
    ctx.fillText(`Level: ${level.name}`, 10, 20);
    ctx.fillText(`Pos: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`, 10, 38);
    if (level.showSanity && player.sanity !== undefined) {
      ctx.fillText(`Sanity: ${player.sanity.toFixed(0)}%`, 10, 56);
    }
  }
}
