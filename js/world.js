// LANTLIV — world: ground tiles, decorations, collision, camera-aware rendering
import { TILE, ZOOM, MAP_W, MAP_H, T_GRASS, T_GRASS_DETAIL, T_DIRT, T_WATER, DIRT_AUTOTILE } from './config.js';
import { A, drawTile } from './assets.js';

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

// Decoration stamps: whole pre-extracted image (never clipped) + collision footprint (bw tiles)
const DECOR = {
  tree:    { img: 'd_tree',    bw: 2, solid: true },
  pine:    { img: 'd_pine',    bw: 1, solid: true },
  treebig: { img: 'd_treebig', bw: 3, solid: true },
  bush:    { img: 'd_bush',    bw: 1, solid: false },
  boulder: { img: 'd_boulder', bw: 2, solid: true },
  rock:    { img: 'd_rock',    bw: 1, solid: false },
  stump:   { img: 'd_stump',   bw: 1, solid: true },
  log:     { img: 'd_log',     bw: 1, solid: false },
  well:    { img: 'd_well',    bw: 1, solid: true },
  lamp:    { img: 'd_lamp',    bw: 1, solid: true },
  fence:   { img: 'd_fence',   bw: 3, solid: true },
  pond:    { img: 'd_pond',    bw: 2, solid: true },
  house:   { img: 'house_built', bw: 5, solid: true },
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
    // a real bordered dirt farm-plot (autotiled) near the homestead
    this.plot = { x: cx - 6, y: cy - 1, w: 6, h: 4 };
    for (let y = this.plot.y; y < this.plot.y + this.plot.h; y++)
      for (let x = this.plot.x; x < this.plot.x + this.plot.w; x++) this.ground[y][x] = 1;

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

    // Pond (top-right quadrant) — self-contained sprite with its own stone border
    place('pond', this.w - 8, 5);

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

  // Is this tile farmable (grass or the dirt plot, nothing on it)?
  isFarmable(tx, ty) {
    if (!this.inBounds(tx, ty) || this.solid[ty][tx]) return false;
    const g = this.ground[ty][tx];
    return g === 0 || g === 1;
  }

  // pick the correct autotile dirt tile based on which orthogonal neighbours are non-dirt
  _dirtTile(tx, ty) {
    const isDirt = (x, y) => this.inBounds(x, y) && this.ground[y][x] === 1;
    const gN = !isDirt(tx, ty - 1), gS = !isDirt(tx, ty + 1);
    const gW = !isDirt(tx - 1, ty), gE = !isDirt(tx + 1, ty);
    const D = DIRT_AUTOTILE;
    if (gN && gW) return D.tl; if (gN && gE) return D.tr;
    if (gS && gW) return D.bl; if (gS && gE) return D.br;
    if (gN) return D.t; if (gS) return D.b; if (gW) return D.l; if (gE) return D.r;
    return D.c;
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
        let t = g === 2 ? T_WATER : g === 1 ? this._dirtTile(tx, ty) : T_GRASS;
        if (g === 0) { const hsh = hash2(tx, ty) % 100; if (hsh < 14) t = T_GRASS_DETAIL[hsh % T_GRASS_DETAIL.length]; }
        const dx = Math.round((tx * TILE - cam.x) * ZOOM);
        const dy = Math.round((ty * TILE - cam.y) * ZOOM);
        drawTile(ctx, 'grass', t.col, t.row, dx, dy, TILE * ZOOM + 1);
      }
    }
  }

  // Push decoration sprites into the y-sorted render list (whole images, bottom-centred)
  collectSprites(list, cam) {
    for (const o of this.decor) {
      const d = DECOR[o.type];
      const img = A[d.img];
      if (!img) continue;
      const iw = img.width, ih = img.height;
      const centerX = (o.tx + d.bw / 2) * TILE;
      const bottomY = (o.ty + 1) * TILE;
      const dx = Math.round((centerX - iw / 2 - cam.x) * ZOOM);
      const dy = Math.round((bottomY - ih - cam.y) * ZOOM);
      list.push({
        sortY: bottomY,
        draw: (ctx) => ctx.drawImage(img, dx, dy, iw * ZOOM, ih * ZOOM),
      });
    }
  }
}
