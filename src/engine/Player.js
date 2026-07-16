export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = 0.04;
    this.rotSpeed = 0.035;
    this.sanity = 100;
    this.sanityDrainRate = 0.002;
    this.radius = 0.25;
    this.isMoving = false;
  }

  update(input, map, dt = 1) {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    let dx = 0, dy = 0;
    const spd = this.speed * dt;

    if (input.forward)  { dx += cos * spd; dy += sin * spd; }
    if (input.backward) { dx -= cos * spd; dy -= sin * spd; }
    if (input.strafeL)  { dx += sin * spd; dy -= cos * spd; }
    if (input.strafeR)  { dx -= sin * spd; dy += cos * spd; }

    this.isMoving = (dx !== 0 || dy !== 0);

    this._move(dx, 0, map);
    this._move(0, dy, map);

    if (input.left)  this.angle -= this.rotSpeed * dt;
    if (input.right) this.angle += this.rotSpeed * dt;

    if (input.mouseDx) {
      this.angle += input.mouseDx * 0.002;
      input.mouseDx = 0;
    }

    this.sanity = Math.max(0, this.sanity - this.sanityDrainRate * dt);
  }

  _move(dx, dy, map) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    const r = this.radius;
    const clear = (x, y) => map.getCell(Math.floor(x), Math.floor(y)) === 0;
    if (clear(nx-r, this.y) && clear(nx+r, this.y) &&
        clear(nx-r, this.y+r) && clear(nx+r, this.y+r) &&
        clear(nx-r, this.y-r) && clear(nx+r, this.y-r)) this.x = nx;
    if (clear(this.x, ny-r) && clear(this.x, ny+r) &&
        clear(this.x+r, ny-r) && clear(this.x+r, ny+r) &&
        clear(this.x-r, ny-r) && clear(this.x-r, ny+r)) this.y = ny;
  }
}
