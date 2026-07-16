/**
 * Procedural map with BSP-style room+corridor generation
 */
export class GameMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height);
    this.rooms = [];
  }

  getCell(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 1;
    return this.cells[y * this.width + x];
  }

  setCell(x, y, val) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.cells[y * this.width + x] = val;
  }

  /**
   * Generate a backrooms-style map:
   * Endless office/warehouse maze with pillars and corridors
   */
  generateBackrooms(seed, levelId) {
    const rng = mulberry32(seed);

    // Fill with walls
    this.cells.fill(1);

    if (levelId === 0) {
      this._genLevel0(rng);
    } else if (levelId === 1) {
      this._genLevel1(rng);
    } else if (levelId === 2) {
      this._genLevel2(rng);
    } else {
      this._genLevelGeneric(rng, levelId);
    }
  }

  /** Level 0: Mono-yellow office maze */
  _genLevel0(rng) {
    const W = this.width, H = this.height;
    // Carve entire space
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        this.setCell(x, y, 0);

    // Place pillars in a grid with variation
    for (let py = 3; py < H-3; py += 4) {
      for (let px = 3; px < W-3; px += 4) {
        if (rng() > 0.25) {
          this.setCell(px, py, 2);
          if (rng() > 0.6) this.setCell(px+1, py, 2);
          if (rng() > 0.6) this.setCell(px, py+1, 2);
        }
      }
    }

    // Random thin walls
    for (let i = 0; i < W * H * 0.02; i++) {
      const x = 2 + (rng() * (W-4) | 0);
      const y = 2 + (rng() * (H-4) | 0);
      const len = 2 + (rng() * 4 | 0);
      const horiz = rng() > 0.5;
      for (let d = 0; d < len; d++) {
        if (horiz) this.setCell(x+d, y, 1);
        else this.setCell(x, y+d, 1);
      }
    }
  }

  /** Level 1: Fluorescent warehouse rooms */
  _genLevel1(rng) {
    this._genLevelGeneric(rng, 1);
    // Extra large open areas
    for (let i = 0; i < 4; i++) {
      const rx = 2 + (rng() * (this.width - 20) | 0);
      const ry = 2 + (rng() * (this.height - 20) | 0);
      const rw = 8 + (rng() * 10 | 0);
      const rh = 8 + (rng() * 10 | 0);
      for (let y = ry; y < ry+rh && y < this.height-1; y++)
        for (let x = rx; x < rx+rw && x < this.width-1; x++)
          this.setCell(x, y, 0);
    }
  }

  /** Level 2: Pipe maintenance dark tunnels */
  _genLevel2(rng) {
    const W = this.width, H = this.height;
    this._genLevelGeneric(rng, 2);
    // Narrower corridors (add more walls)
    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        if (this.getCell(x,y) === 0 && rng() < 0.08) {
          this.setCell(x, y, 3); // pipe obstacle
        }
      }
    }
  }

  _genLevelGeneric(rng, levelId) {
    const W = this.width, H = this.height;
    this.rooms = [];

    // BSP room generation
    const minRoom = 5, maxRoom = 14;
    const attempts = 60;

    for (let i = 0; i < attempts; i++) {
      const rw = minRoom + (rng() * (maxRoom - minRoom) | 0);
      const rh = minRoom + (rng() * (maxRoom - minRoom) | 0);
      const rx = 1 + (rng() * (W - rw - 2) | 0);
      const ry = 1 + (rng() * (H - rh - 2) | 0);
      if (this._roomOverlaps(rx, ry, rw, rh)) continue;
      this._carveRoom(rx, ry, rw, rh);
      this.rooms.push({ x: rx, y: ry, w: rw, h: rh });
    }

    // Connect rooms with corridors
    for (let i = 1; i < this.rooms.length; i++) {
      const a = this.rooms[i-1];
      const b = this.rooms[i];
      const ax = a.x + (a.w/2|0), ay = a.y + (a.h/2|0);
      const bx = b.x + (b.w/2|0), by = b.y + (b.h/2|0);
      this._carveCorridor(ax, ay, bx, by);
    }

    // Some dead-end corridors for atmosphere
    for (let i = 0; i < 8; i++) {
      if (this.rooms.length < 1) break;
      const r = this.rooms[rng() * this.rooms.length | 0];
      const sx = r.x + (r.w/2|0), sy = r.y + (r.h/2|0);
      const dx = (rng() * 10 | 0) - 5;
      const dy = (rng() * 10 | 0) - 5;
      this._carveCorridor(sx, sy, sx+dx, sy+dy, 1);
    }
  }

  _roomOverlaps(rx, ry, rw, rh) {
    for (const r of this.rooms) {
      if (rx < r.x+r.w+1 && rx+rw+1 > r.x && ry < r.y+r.h+1 && ry+rh+1 > r.y) return true;
    }
    return false;
  }

  _carveRoom(x, y, w, h) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        this.setCell(x+dx, y+dy, 0);
  }

  _carveCorridor(x1, y1, x2, y2, wallType = 0) {
    let x = x1, y = y1;
    while (x !== x2) {
      this.setCell(x, y, 0);
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      this.setCell(x, y, 0);
      y += y < y2 ? 1 : -1;
    }
  }

  getSpawnPoint() {
    if (this.rooms.length > 0) {
      const r = this.rooms[0];
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    // fallback: scan for open cell
    for (let y = 1; y < this.height; y++)
      for (let x = 1; x < this.width; x++)
        if (this.getCell(x, y) === 0) return { x: x + 0.5, y: y + 0.5 };
    return { x: 2, y: 2 };
  }

  getExitPoint() {
    if (this.rooms.length > 1) {
      const r = this.rooms[this.rooms.length - 1];
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    return { x: this.width - 3, y: this.height - 3 };
  }
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
