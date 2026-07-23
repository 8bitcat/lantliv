// LANTLIV — world: ground tiles, decorations, collision, camera-aware rendering
import { TILE, ZOOM, MAP_W, MAP_H, T_GRASS, T_GRASS_DETAIL, T_DIRT, T_WATER } from './config.js';
import { A, drawTile, drawRect } from './assets.js';

const WORLD_SEED = 20260723; // fixed -> every player generates an identical map

function hash2(x, y) {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Decoration stamps: source rect (px) in a tileset + footprint (tiles blocked at base)
const DECOR = {
  tree:    { sheet: 'nature', sx: 16,  sy: 16,  sw: 32, sh: 48, bw: 2, solid: true },
  tree2:   { sheet: 'nature', sx: 96,  sy: 16,  sw: 64, sh: 48, bw: 4, solid: true },
  bush:    { sheet: 'nature', sx: 176, sy: 16,  sw: 16, sh: 16, bw: 1, solid: false },
  boulder: { sheet: 'nature', sx: 224, sy: 16,  sw: 32, sh: 32, bw: 2, solid: true },
  rock:    { sheet: 'nature', sx: 256, sy: 16,  sw: 16, sh: 16, bw: 1, solid: false },
  stump:   { sheet: 'nature', sx: 16,  sy: 112, sw: 16, sh: 16, bw: 1, solid: true },
  log:     { sheet: 'nature', sx: 96,  sy: 144, sw: 32, sh: 16, bw: 2, solid: false },
  well:    { sheet: 'exterior',sx: 160, sy: 16,  sw: 32, sh: 48, bw: 2, solid: true },
  lamp:    { sheet: 'exterior',sx: 224, sy: 16,  sw: 16, sh: 64, bw: 1, solid: true },
  fence:   { sheet: 'exterior',sx: 256, sy: 48,  sw: 48, sh: 32, bw: 3, solid: true },
  pond:    { sheet: 'crops',   sx: 48,  sy: 416, sw: 32, sh: 32, bw: 2, solid: true }, // 2x2 pond
  house:   { sheet: 'house_built', sx: 0, sy: 0, sw: 80, sh: 65, bw: 5, solid: true },
};

export class World {
  constructor() {
    this.w = MAP_W; this.h = MAP_H;
    this.ground = [];      // [y][x] = 0 grass, 1 dirt, 2 water
    this.solid = [];       // [y][x] bool
    this.decor = [];       // { type, tx, ty }  (ty = base/bottom tile row)
    this.pasture = { x: 4, y: MAP_H - 9, w: 9, h: 6 }; // fenced animal area (tiles)
    // spawn on grass just off the central path (not on dirt), near the homestead
    this.spawn = { x: (Math.floor(MAP_W / 2) - 4) * TILE + 8, y: (Math.floor(MAP_H / 2) - 3) * TILE + 8 };
    this._generate();
  }

  _generate() {
    const rng = mulberry32(WORLD_SEED);
    // ground: grass everywhere, a dirt cross path
    for (let y = 0; y < this.h; y++) {
      this.ground[y] = [];
      this.solid[y] = [];
      for (let x = 0; x < this.w; x++) {
        this.ground[y][x] = 0;
        this.solid[y][x] = false;
      }
    }
    const cx = Math.floor(this.w / 2), cy = Math.floor(this.h / 2);
    for (let x = 2; x < this.w - 2; x++) { this.ground[cy][x] = 1; this.ground[cy + 1][x] = 1; }
    for (let y = 2; y < this.h - 2; y++) { this.ground[y][cx] = 1; this.ground[y][cx + 1] = 1; }

    const place = (type, tx, ty) => {
      const d = DECOR[type];
      this.decor.push({ type, tx, ty });
      if (d.solid) for (let i = 0; i < d.bw; i++) {
        const gx = tx + i, gy = ty;
        if (gx >= 0 && gx < this.w && gy >= 0 && gy < this.h) this.solid[gy][gx] = true;
      }
    };

    // Tree border around the whole map (leaves a walkable interior)
    for (let x = 1; x < this.w - 2; x += 2) {
      if (rng() < 0.85) place('tree', x, 1);
      if (rng() < 0.85) place('tree', x, this.h - 2);
    }
    for (let y = 3; y < this.h - 3; y += 2) {
      if (rng() < 0.85) place('tree', 0, y);
      if (rng() < 0.85) place('tree', this.w - 2, y);
    }

    // Pond (top-right quadrant)
    place('pond', this.w - 8, 5);
    // A few water tiles around the pond for a shoreline feel
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      this.ground[5 + dy][this.w - 8 + dx] = 2;
    }

    // Homestead cluster near center-spawn
    place('house', cx - 8, cy - 6);
    place('well', cx + 5, cy - 3);
    place('lamp', cx + 3, cy - 4);

    // Fenced pasture (bottom-left) for animals
    const p = this.pasture;
    for (let x = p.x; x < p.x + p.w; x += 3) {
      place('fence', x, p.y);           // top rail
      place('fence', x, p.y + p.h);     // bottom rail
    }

    // Scattered nature detail
    const scatterTypes = ['bush', 'rock', 'stump', 'log', 'boulder'];
    for (let i = 0; i < 26; i++) {
      const tx = 2 + Math.floor(rng() * (this.w - 6));
      const ty = 3 + Math.floor(rng() * (this.h - 8));
      if (this.ground[ty][tx] !== 0 || this.solid[ty][tx]) continue;
      // keep the central farm area clear
      if (Math.abs(tx - cx) < 7 && Math.abs(ty - cy) < 5) continue;
      const t = scatterTypes[Math.floor(rng() * scatterTypes.length)];
      place(t, tx, ty);
    }
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

  isSolid(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;
    if (this.ground[ty][tx] === 2) return true; // water
    return this.solid[ty][tx];
  }

  // Is this tile farmable (plain grass, nothing on it)?
  isFarmable(tx, ty) {
    return this.inBounds(tx, ty) && this.ground[ty][tx] === 0 && !this.solid[ty][tx];
  }

  // pixel-rect collision for a moving body (feet box)
  collides(px, py, halfW, halfH) {
    const x0 = Math.floor((px - halfW) / TILE), x1 = Math.floor((px + halfW) / TILE);
    const y0 = Math.floor((py - halfH) / TILE), y1 = Math.floor((py + halfH) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (this.isSolid(tx, ty)) return true;
    return false;
  }

  drawGround(ctx, cam, vw, vh) {
    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(this.w - 1, Math.ceil((cam.x + vw / ZOOM) / TILE));
    const y1 = Math.min(this.h - 1, Math.ceil((cam.y + vh / ZOOM) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const g = this.ground[ty][tx];
        let t = g === 1 ? T_DIRT : g === 2 ? T_WATER : T_GRASS;
        if (g === 0) { const hsh = hash2(tx, ty) % 100; if (hsh < 14) t = T_GRASS_DETAIL[hsh % T_GRASS_DETAIL.length]; }
        const dx = Math.round((tx * TILE - cam.x) * ZOOM);
        const dy = Math.round((ty * TILE - cam.y) * ZOOM);
        drawTile(ctx, 'grass', t.col, t.row, dx, dy, TILE * ZOOM + 1);
      }
    }
  }

  // Push decoration sprites into the y-sorted render list
  collectSprites(list, cam) {
    for (const o of this.decor) {
      const d = DECOR[o.type];
      if (!A[d.sheet]) continue;
      const centerX = (o.tx + d.bw / 2) * TILE;
      const bottomY = (o.ty + 1) * TILE;
      const dw = d.sw * ZOOM, dh = d.sh * ZOOM;
      const dx = Math.round((centerX - d.sw / 2 - cam.x) * ZOOM);
      const dy = Math.round((bottomY - d.sh - cam.y) * ZOOM);
      list.push({
        sortY: bottomY,
        draw: (ctx) => drawRect(ctx, d.sheet, d.sx, d.sy, d.sw, d.sh, dx, dy, dw, dh),
      });
    }
  }
}
