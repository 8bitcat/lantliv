// LANTLIV — Fas C: förädling. Workshops turn raw crops/products into refined goods over time.
// Deterministic positions (part of the world); only processing state is networked.
import { TILE, ZOOM, WORKSHOPS, WORKSHOP_TIME, GOODS } from './config.js';
import { A } from './assets.js';

const BW = 3; // stall footprint width (tiles)
const STATES = ['idle', 'working', 'ready'];

class Workshop {
  constructor(type, tx, ty) {
    this.type = type; this.tx = tx; this.ty = ty;
    this.def = WORKSHOPS[type];
    this.state = 'idle'; this.timer = 0;
  }

  // what pressing action here would do, given the player's inventory
  intent(inv) {
    if (this.state === 'ready') return 'collect';
    if (this.state === 'idle' && inv.hasInput(this.def.in)) return 'deposit';
    return null;
  }
  deposit() { if (this.state !== 'idle') return false; this.state = 'working'; this.timer = 0; return true; }
  collect() { if (this.state !== 'ready') return null; this.state = 'idle'; this.timer = 0; return this.def.out; }

  updateHost(dt) {
    if (this.state === 'working') {
      this.timer += dt;
      if (this.timer >= WORKSHOP_TIME) { this.state = 'ready'; this.timer = WORKSHOP_TIME; }
    }
  }

  cx() { return (this.tx + BW / 2) * TILE; }
  get sortY() { return (this.ty + 1) * TILE; }

  draw(ctx, cam) {
    const img = A.d_stall;
    let topScreenY;
    if (img) {
      const iw = img.width, ih = img.height;
      const dx = Math.round((this.cx() - iw / 2 - cam.x) * ZOOM);
      const dy = Math.round(((this.ty + 1) * TILE - ih - cam.y) * ZOOM);
      ctx.drawImage(img, dx, dy, iw * ZOOM, ih * ZOOM);
      topScreenY = dy;
    } else {
      topScreenY = Math.round(((this.ty + 1) * TILE - 22 - cam.y) * ZOOM);
    }
    const sx = Math.round((this.cx() - cam.x) * ZOOM);
    // recipe sign hanging above the roof
    ctx.font = `${Math.round(9 * ZOOM)}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.def.sign, sx, topScreenY - 4 * ZOOM);
    // status
    if (this.state === 'ready') {
      const bob = Math.sin(this.timer + this.tx) * 2;
      ctx.font = `${Math.round(12 * ZOOM)}px serif`;
      ctx.fillText(GOODS[this.def.out].emoji, sx, topScreenY - 16 * ZOOM + bob);
    } else if (this.state === 'working') {
      const w = 30 * ZOOM, h = 5 * ZOOM, bx = sx - w / 2, by = topScreenY - 14 * ZOOM;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = '#8fd66b'; ctx.fillRect(bx + 1, by + 1, (w - 2) * (this.timer / WORKSHOP_TIME), h - 2);
    }
    ctx.textAlign = 'left';
  }
}

export class Workshops {
  constructor() { this.list = []; }

  // (re)build the fixed workshops for a world; marks their footprints solid.
  build(world) {
    this.list = [];
    const spots = (world && world.workshopSpots) || [];
    for (const [type, tx, ty] of spots) {
      if (!WORKSHOPS[type]) continue;
      this.list.push(new Workshop(type, tx, ty));
      if (world) for (let i = 0; i < BW; i++) if (world.inBounds(tx + i, ty)) world.solid[ty][tx + i] = true;
    }
  }

  findAt(tx, ty) {
    for (const w of this.list) if (ty === w.ty && tx >= w.tx && tx < w.tx + BW) return w;
    return null;
  }

  updateHost(dt) { for (const w of this.list) w.updateHost(dt); }
  collectSprites(list) { for (const w of this.list) list.push(w); }

  serialize() { return this.list.map((w) => [STATES.indexOf(w.state), Math.round(w.timer)]); }
  apply(data) {
    if (!data) return;
    data.forEach(([st, tm], i) => { const w = this.list[i]; if (!w) return; w.state = STATES[st] || 'idle'; w.timer = tm; });
  }
}
