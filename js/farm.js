// LANTLIV — farming: tilled soil, crops, growth logic, harvest
import {
  TILE, ZOOM, STAGE_TIME, WET_TIME, WITHER_TIME,
  CROPS, CROP_KEYS, GROW_ROWS, WITHER_ROWS, SOIL_DRY, SOIL_WET, QUALITY,
} from './config.js';
import { drawTile } from './assets.js';

const key = (tx, ty) => tx + ',' + ty;

export class Farm {
  constructor(world) {
    this.world = world;
    this.tiles = new Map(); // "tx,ty" -> { wet, wetTimer, crop }
  }

  get(tx, ty) { return this.tiles.get(key(tx, ty)); }

  // --- host-authoritative actions (return true if something changed) ---
  till(tx, ty) {
    if (this.tiles.has(key(tx, ty))) return false;
    if (!this.world.isFarmable(tx, ty)) return false;
    this.tiles.set(key(tx, ty), { wet: false, wetTimer: 0, crop: null });
    return true;
  }

  water(tx, ty) {
    const t = this.get(tx, ty);
    if (!t) return false;
    t.wet = true; t.wetTimer = WET_TIME;
    if (t.crop) t.crop.dryTimer = 0;
    return true;
  }

  plant(tx, ty, type) {
    const t = this.get(tx, ty);
    if (!t || t.crop || !CROPS[type]) return false;
    t.crop = { type, stage: 1, timer: 0, dryTimer: 0, withered: false };
    return true;
  }

  // returns { type, quality, coins } on a good harvest, { withered:true } if clearing a
  // dead crop, or null if nothing to do.
  harvest(tx, ty) {
    const t = this.get(tx, ty);
    if (!t || !t.crop) return null;
    const c = t.crop;
    if (c.withered) { t.crop = null; return { withered: true }; }
    if (c.stage < 5) return null;
    const quality = rollQuality();
    const base = CROPS[c.type].price;
    const coins = Math.round(base * quality.mult);
    const type = c.type;
    t.crop = null; // soil stays tilled, ready to replant
    return { type, quality: quality.key, label: quality.label, coins };
  }

  // host-only growth simulation
  update(dt) {
    for (const t of this.tiles.values()) {
      if (t.wet) { t.wetTimer -= dt; if (t.wetTimer <= 0) { t.wet = false; t.wetTimer = 0; } }
      const c = t.crop;
      if (!c || c.withered) continue;
      if (t.wet && c.stage < 5) {
        c.timer += dt;
        if (c.timer >= STAGE_TIME) { c.stage++; c.timer = 0; }
      }
      if (!t.wet) {
        c.dryTimer += dt;
        if (c.dryTimer >= WITHER_TIME && c.stage > 1) c.withered = true;
      } else {
        c.dryTimer = 0;
      }
    }
  }

  // --- rendering (soil + crops are short; drawn on the ground layer) ---
  draw(ctx, cam, vw, vh) {
    for (const [k, t] of this.tiles) {
      const [tx, ty] = k.split(',').map(Number);
      const wx = tx * TILE, wy = ty * TILE;
      const dx = Math.round((wx - cam.x) * ZOOM);
      const dy = Math.round((wy - cam.y) * ZOOM);
      if (dx < -TILE * ZOOM || dy < -TILE * ZOOM || dx > vw || dy > vh) continue;
      const soil = t.wet ? SOIL_WET : SOIL_DRY;
      drawTile(ctx, 'crops', soil.col, soil.row, dx, dy, TILE * ZOOM + 1);
      const c = t.crop;
      if (c) {
        const col = CROPS[c.type].col;
        const row = c.withered ? (WITHER_ROWS[c.stage] ?? GROW_ROWS[c.stage - 1]) : GROW_ROWS[c.stage - 1];
        drawTile(ctx, 'crops', col, row, dx, dy, TILE * ZOOM + 1);
      }
    }
  }

  // --- network serialization (compact; render-only fields) ---
  serialize() {
    const out = [];
    for (const [k, t] of this.tiles) {
      const [tx, ty] = k.split(',').map(Number);
      const ci = t.crop ? CROP_KEYS.indexOf(t.crop.type) : -1;
      out.push([tx, ty, t.wet ? 1 : 0, ci, t.crop ? t.crop.stage : 0, t.crop && t.crop.withered ? 1 : 0]);
    }
    return out;
  }

  apply(list) {
    this.tiles.clear();
    for (const [tx, ty, wet, ci, stage, wither] of list) {
      const crop = ci >= 0 ? { type: CROP_KEYS[ci], stage, timer: 0, dryTimer: 0, withered: !!wither } : null;
      this.tiles.set(key(tx, ty), { wet: !!wet, wetTimer: 0, crop });
    }
  }
}

function rollQuality() {
  const r = Math.random();
  for (const q of QUALITY) if (r < q.chance) return q;
  return QUALITY[QUALITY.length - 1];
}
