// LANTLIV — farming: tilled soil, crops, growth logic, harvest
import {
  TILE, ZOOM, STAGE_TIME, WET_TIME, WITHER_TIME,
  CROPS, CROP_KEYS, GROW_ROWS, WITHER_ROWS,
} from './config.js';
import { A, drawTile } from './assets.js';

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

  // returns { type } on a good harvest (crop goes to storage), { withered:true } if
  // clearing a dead crop, or null if nothing to do.
  harvest(tx, ty) {
    const t = this.get(tx, ty);
    if (!t || !t.crop) return null;
    const c = t.crop;
    if (c.withered) { t.crop = null; return { withered: true }; }
    if (c.stage < 5) return null;
    const type = c.type;
    t.crop = null; // soil stays tilled, ready to replant
    return { type };
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

  // is this tile tilled farm soil? (world renders unified dirt from this)
  isTilled(tx, ty) { return this.tiles.has(key(tx, ty)); }

  // --- rendering: the soil itself is drawn by the world layer (unified dirt +
  // grass fringe autotile); here we only add watered darkening + the crop ---
  draw(ctx, cam, vw, vh) {
    const s = TILE * ZOOM + 1;
    const P = TILE * ZOOM;
    for (const [k, t] of this.tiles) {
      const [tx, ty] = k.split(',').map(Number);
      const dx = Math.round((tx * TILE - cam.x) * ZOOM);
      const dy = Math.round((ty * TILE - cam.y) * ZOOM);
      if (dx < -s || dy < -2 * s || dx > vw || dy > vh) continue; // crops reach one tile above their soil
      if (t.wet) { ctx.fillStyle = 'rgba(45,28,12,0.30)'; ctx.fillRect(dx, dy, s, s); } // watered = darker
      const c = t.crop;
      if (c) {
        const col = CROPS[c.type].col;
        const row = c.withered ? (WITHER_ROWS[c.stage] ?? GROW_ROWS[c.stage - 1]) : GROW_ROWS[c.stage - 1];
        // Crops are 2 tiles tall from stage 2 on — draw the tile-row above too so the plant top
        // isn't clipped. Stage 1 stays single-tile (the row above it holds the seed-packet art).
        if (c.stage >= 2 && A.crops) {
          ctx.drawImage(A.crops, col * TILE, (row - 1) * TILE, TILE, TILE * 2, dx, dy - P, s, P * 2 + 1);
        } else {
          drawTile(ctx, 'crops', col, row, dx, dy, s);
        }
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
