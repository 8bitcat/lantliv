// LANTLIV — ambient animals (chickens + cows) wandering the pasture
import { TILE, ZOOM, CHAR } from './config.js';
import { A, DIR_ROW, drawChar } from './assets.js';

const KINDS = ['chicken', 'cow'];
const DIRS = ['up', 'down', 'left', 'right'];
const SPEED = { chicken: 20, cow: 12 };

class Animal {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x; this.y = y;
    this.netX = x; this.netY = y;
    this.dir = 'down';
    this.frame = 0; this.animTimer = 0;
    this.state = 'idle'; this.stateTimer = 1 + Math.random() * 2;
  }

  updateHost(dt, bounds) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = Math.random() < 0.45 ? 'walk' : 'idle';
      this.dir = DIRS[Math.floor(Math.random() * 4)];
      this.stateTimer = 1 + Math.random() * 2.5;
    }
    if (this.state === 'walk') {
      const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
      const sp = SPEED[this.kind] * dt;
      let nx = this.x + off[0] * sp, ny = this.y + off[1] * sp;
      if (nx < bounds.x0 || nx > bounds.x1) { off[0] *= -1; this.dir = off[0] < 0 ? 'left' : 'right'; nx = this.x; }
      if (ny < bounds.y0 || ny > bounds.y1) { off[1] *= -1; this.dir = off[1] < 0 ? 'up' : 'down'; ny = this.y; }
      this.x = Math.max(bounds.x0, Math.min(bounds.x1, nx));
      this.y = Math.max(bounds.y0, Math.min(bounds.y1, ny));
    }
    this._animate(dt);
  }

  updateRemote(dt) {
    this.x += (this.netX - this.x) * Math.min(1, dt * 10);
    this.y += (this.netY - this.y) * Math.min(1, dt * 10);
    this._animate(dt);
  }

  _animate(dt) {
    this.animTimer += dt;
    const step = 1 / 6;
    while (this.animTimer >= step) { this.animTimer -= step; this.frame = (this.frame + 1) % 8; }
  }

  get sortY() { return this.y; }

  draw(ctx, cam) {
    if (A.shadow) {
      const sw = (this.kind === 'cow' ? 24 : 16);
      const sx = Math.round((this.x - sw / 2 - cam.x) * ZOOM);
      const sy = Math.round((this.y - 4 - cam.y) * ZOOM);
      ctx.globalAlpha = 0.45;
      ctx.drawImage(A.shadow, 0, 0, 16, 16, sx, sy, sw * ZOOM, 7 * ZOOM);
      ctx.globalAlpha = 1;
    }
    const row = DIR_ROW[this.dir] ?? 1;
    const dx = Math.round((this.x - CHAR / 2 - cam.x) * ZOOM);
    const dy = Math.round((this.y - 32 - cam.y) * ZOOM); // feet at frame row 32 -> this.y
    drawChar(ctx, this.kind, row, this.frame, dx, dy, CHAR * ZOOM);
  }
}

export class Herd {
  constructor() { this.animals = []; }

  spawn(pasture) {
    const x0 = (pasture.x + 1) * TILE, x1 = (pasture.x + pasture.w - 1) * TILE;
    const y0 = (pasture.y + 1) * TILE, y1 = (pasture.y + pasture.h - 1) * TILE;
    this.bounds = { x0, y0, x1, y1 };
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 3; i++) this.animals.push(new Animal('chicken', rnd(x0, x1), rnd(y0, y1)));
    for (let i = 0; i < 2; i++) this.animals.push(new Animal('cow', rnd(x0, x1), rnd(y0, y1)));
  }

  updateHost(dt) { for (const a of this.animals) a.updateHost(dt, this.bounds); }
  updateRemote(dt) { for (const a of this.animals) a.updateRemote(dt); }
  collectSprites(list) { for (const a of this.animals) list.push(a); }

  serialize() {
    return this.animals.map((a) => [KINDS.indexOf(a.kind), Math.round(a.x), Math.round(a.y), DIRS.indexOf(a.dir), a.frame]);
  }
  apply(list) {
    if (this.animals.length !== list.length) {
      this.animals = list.map(([k, x, y]) => new Animal(KINDS[k], x, y));
    }
    list.forEach(([k, x, y, d, f], i) => {
      const a = this.animals[i];
      a.netX = x; a.netY = y; a.dir = DIRS[d] || 'down'; a.frame = f;
    });
  }
}
