// LANTLIV — livestock: owned animals that wander, get fed, make products, grow up and breed.
import { TILE, ZOOM, CHAR, LIVESTOCK, BABY_OF, PRODUCTS, PRODUCT_TIME, GROW_TIME, BREED_CHANCE } from './config.js';
import { A, DIR_ROW, drawChar, ANIMAL_KEYS } from './assets.js';

// per-species: display label, idle-sheet frame count, wander speed (px/s)
export const ANIMAL_DEFS = {
  chicken:  { label: 'Höna',     frames: 8, speed: 20 },
  chick:    { label: 'Kyckling', frames: 5, speed: 22 },
  cow:      { label: 'Ko',       frames: 8, speed: 12 },
  calf:     { label: 'Kalv',     frames: 8, speed: 15 },
  goat:     { label: 'Get',      frames: 8, speed: 15 },
  babygoat: { label: 'Killing',  frames: 8, speed: 18 },
  sheep:    { label: 'Får',      frames: 8, speed: 13 },
  lamb:     { label: 'Lamm',     frames: 8, speed: 16 },
  mallard:  { label: 'Anka',     frames: 8, speed: 18 },
  duckling: { label: 'Ankunge',  frames: 5, speed: 20 },
};

const DIRS = ['up', 'down', 'left', 'right'];

class Animal {
  constructor(kind, x, y) {
    this.setKind(kind);
    this.x = x; this.y = y;
    this.netX = x; this.netY = y;
    this.dir = 'down';
    this.frame = 0; this.animTimer = 0;
    this.state = 'idle'; this.stateTimer = 1 + Math.random() * 2;
    // husbandry
    this.baby = !!BABY_OF[kind];
    this.growth = 0;         // seconds toward adulthood (babies)
    this.fed = false;        // fed since last product / dawn
    this.productReady = false;
    this.prodTimer = 0;      // seconds since being fed (adults)
  }

  setKind(kind) {
    this.kind = kind;
    this.def = ANIMAL_DEFS[kind] || ANIMAL_DEFS.chicken;
    this.live = LIVESTOCK[kind] || null; // adult definition (product) or null for babies
  }

  isAdult() { return !this.baby; }
  product() { return this.live ? this.live.product : null; }

  // player interaction — returns 'collect' | 'feed' | null (what pressing action would do)
  intent(hasFeed) {
    if (this.productReady) return 'collect';
    if (hasFeed && !this.fed) return 'feed';
    return null;
  }
  feed() {
    this.fed = true;
    if (this.baby) this.growth += GROW_TIME * 0.15; // feeding a baby speeds it up
    else this.prodTimer = 0;
  }
  collect() {
    if (!this.productReady) return null;
    this.productReady = false; this.fed = false; this.prodTimer = 0;
    return this.product();
  }

  updateHost(dt, bounds) {
    // wander
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = Math.random() < 0.45 ? 'walk' : 'idle';
      this.dir = DIRS[Math.floor(Math.random() * 4)];
      this.stateTimer = 1 + Math.random() * 2.5;
    }
    if (this.state === 'walk') {
      const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
      const sp = this.def.speed * dt;
      let nx = this.x + off[0] * sp, ny = this.y + off[1] * sp;
      if (nx < bounds.x0 || nx > bounds.x1) { this.dir = off[0] < 0 ? 'right' : 'left'; nx = this.x; }
      if (ny < bounds.y0 || ny > bounds.y1) { this.dir = off[1] < 0 ? 'down' : 'up'; ny = this.y; }
      this.x = Math.max(bounds.x0, Math.min(bounds.x1, nx));
      this.y = Math.max(bounds.y0, Math.min(bounds.y1, ny));
    }
    // husbandry sim
    if (this.baby) {
      this.growth += dt;
      if (this.growth >= GROW_TIME) { this.baby = false; this.growth = 0; this.setKind(BABY_OF[this.kind]); }
    } else if (this.fed && !this.productReady && this.product()) {
      this.prodTimer += dt;
      if (this.prodTimer >= PRODUCT_TIME) this.productReady = true;
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
    while (this.animTimer >= step) { this.animTimer -= step; this.frame = (this.frame + 1) % this.def.frames; }
  }

  get sortY() { return this.y; }

  draw(ctx, cam) {
    const big = ['cow', 'goat', 'sheep', 'calf'].includes(this.kind);
    if (A.shadow) {
      const sw = big ? 24 : 15;
      const sx = Math.round((this.x - sw / 2 - cam.x) * ZOOM);
      const sy = Math.round((this.y - 4 - cam.y) * ZOOM);
      ctx.globalAlpha = 0.45;
      ctx.drawImage(A.shadow, 0, 0, 16, 16, sx, sy, sw * ZOOM, 7 * ZOOM);
      ctx.globalAlpha = 1;
    }
    const row = DIR_ROW[this.dir] ?? 1;
    const dx = Math.round((this.x - CHAR / 2 - cam.x) * ZOOM);
    const dy = Math.round((this.y - 32 - cam.y) * ZOOM); // feet at frame row 32 -> this.y
    drawChar(ctx, this.kind, row, Math.min(this.frame, this.def.frames - 1), dx, dy, CHAR * ZOOM);
    // product-ready bubble above the animal
    if (this.productReady && this.product()) {
      const bob = Math.sin(this.animTimer * 6 + this.x) * 2;
      const icx = Math.round((this.x - cam.x) * ZOOM);
      const icy = Math.round((this.y - 30 - cam.y) * ZOOM + bob);
      ctx.font = `${Math.round(11 * ZOOM)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(PRODUCTS[this.product()].emoji, icx, icy);
      ctx.textAlign = 'left';
    }
  }
}

export class Herd {
  constructor() { this.animals = []; this.bounds = null; }

  _rndPos() {
    const b = this.bounds || { x0: TILE, y0: TILE, x1: 4 * TILE, y1: 4 * TILE };
    return { x: b.x0 + Math.random() * (b.x1 - b.x0), y: b.y0 + Math.random() * (b.y1 - b.y0) };
  }

  spawn(pasture) {
    const x0 = (pasture.x + 1) * TILE, x1 = (pasture.x + pasture.w - 1) * TILE;
    const y0 = (pasture.y + 1) * TILE, y1 = (pasture.y + pasture.h - 1) * TILE;
    this.bounds = { x0, y0, x1, y1 };
    const rnd = (a, b) => a + Math.random() * (b - a);
    // starter adults so the feed→collect loop works from day one
    for (let i = 0; i < 2; i++) this.animals.push(new Animal('chicken', rnd(x0, x1), rnd(y0, y1)));
    this.animals.push(new Animal('cow', rnd(x0, x1), rnd(y0, y1)));
  }

  spawnAt(list, worldW, worldH) {
    this.bounds = { x0: TILE, y0: TILE, x1: (worldW - 1) * TILE, y1: (worldH - 1) * TILE };
    for (const a of list) if (ANIMAL_DEFS[a.kind]) this.animals.push(new Animal(a.kind, a.tx * TILE + 8, a.ty * TILE + 8));
  }

  // spawn a bought/bred baby into the pasture
  addBaby(babyKind) {
    if (!BABY_OF[babyKind]) return null;
    const p = this._rndPos();
    const a = new Animal(babyKind, p.x, p.y);
    this.animals.push(a);
    return a;
  }

  // nearest animal within reach of a world point (for player interaction)
  findNear(wx, wy, reach) {
    let best = null, bd = reach * reach;
    for (const a of this.animals) {
      const d = (a.x - wx) ** 2 + (a.y - wy) ** 2;
      if (d <= bd) { bd = d; best = a; }
    }
    return best;
  }

  // new-day breeding: each adult species with ≥2 members has a chance of a baby
  dayTick() {
    const born = [];
    const adults = {};
    for (const a of this.animals) if (a.isAdult()) adults[a.kind] = (adults[a.kind] || 0) + 1;
    for (const kind in adults) {
      if (adults[kind] >= 2 && Math.random() < BREED_CHANCE) {
        const baby = LIVESTOCK[kind].baby;
        if (this.addBaby(baby)) born.push(baby);
      }
    }
    // a fresh day: animals must be fed again to keep producing
    for (const a of this.animals) if (a.isAdult()) a.fed = false;
    return born;
  }

  updateHost(dt) { for (const a of this.animals) a.updateHost(dt, this.bounds); }
  updateRemote(dt) { for (const a of this.animals) a.updateRemote(dt); }
  collectSprites(list) { for (const a of this.animals) list.push(a); }

  serialize() {
    return this.animals.map((a) => [
      ANIMAL_KEYS.indexOf(a.kind), Math.round(a.x), Math.round(a.y),
      DIRS.indexOf(a.dir), a.frame, a.productReady ? 1 : 0,
    ]);
  }
  apply(list) {
    if (this.animals.length !== list.length) {
      this.animals = list.map(([k, x, y]) => new Animal(ANIMAL_KEYS[k] || 'chicken', x, y));
    }
    list.forEach(([k, x, y, d, f, pr], i) => {
      const a = this.animals[i]; if (!a) return;
      const kind = ANIMAL_KEYS[k] || 'chicken';
      if (a.kind !== kind) { a.setKind(kind); a.baby = !!BABY_OF[kind]; }
      a.netX = x; a.netY = y; a.dir = DIRS[d] || 'down'; a.frame = f; a.productReady = !!pr;
    });
  }
}
