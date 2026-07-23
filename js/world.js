// LANTLIV — world: ground tiles, decorations, collision, camera-aware rendering
import { TILE, ZOOM, MAP_W, MAP_H, T_GRASS, T_GRASS_DETAIL, T_DIRT, T_WATER } from './config.js';
import { A, drawTile, GRASS_CORNERS } from './assets.js';

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
// label/cat drive the map-editor palette.
export const DECOR = {
  tree:     { img: 'd_tree',     bw: 2, solid: true,  label: 'Träd',        cat: 'natur' },
  pine:     { img: 'd_pine',     bw: 1, solid: true,  label: 'Gran',        cat: 'natur' },
  treebig:  { img: 'd_treebig',  bw: 3, solid: true,  label: 'Stort träd',  cat: 'natur' },
  deadtree: { img: 'd_deadtree', bw: 1, solid: true,  label: 'Dött träd',   cat: 'natur' },
  bush:     { img: 'd_bush',     bw: 1, solid: false, label: 'Buske',       cat: 'natur' },
  boulder:  { img: 'd_boulder',  bw: 2, solid: true,  label: 'Stenblock',   cat: 'natur' },
  rock:     { img: 'd_rock',     bw: 1, solid: false, label: 'Sten',        cat: 'natur' },
  stump:    { img: 'd_stump',    bw: 1, solid: true,  label: 'Stubbe',      cat: 'natur' },
  log:      { img: 'd_log',      bw: 1, solid: false, label: 'Stock',       cat: 'natur' },
  mushroom: { img: 'd_mushroom', bw: 1, solid: false, label: 'Svamp',       cat: 'natur' },
  pond:     { img: 'd_pond',     bw: 2, solid: true,  label: 'Damm',        cat: 'natur' },
  house:    { img: 'house_built',bw: 5, solid: true,  label: 'Hus',         cat: 'bygg'  },
  well:     { img: 'd_well',     bw: 1, solid: true,  label: 'Brunn',       cat: 'bygg'  },
  lamp:     { img: 'd_lamp',     bw: 1, solid: true,  label: 'Lykta',       cat: 'bygg'  },
  fence:    { img: 'd_fence',    bw: 3, solid: true,  label: 'Staket',      cat: 'bygg'  },
  stall:    { img: 'd_stall',    bw: 3, solid: true,  label: 'Marknadsstånd',cat: 'bygg' },
  bench:    { img: 'd_bench',    bw: 2, solid: true,  label: 'Bänk',        cat: 'bygg'  },
  crate:    { img: 'd_crate',    bw: 1, solid: true,  label: 'Låda',        cat: 'bygg'  },
  barrel:   { img: 'd_barrel',   bw: 1, solid: true,  label: 'Tunna',       cat: 'bygg'  },
  chest:    { img: 'd_chest',    bw: 1, solid: true,  label: 'Kista',       cat: 'bygg'  },
  campfire: { img: 'd_campfire', bw: 1, solid: true,  label: 'Lägereld',    cat: 'bygg'  },
  fountain: { img: 'd_fountain', bw: 2, solid: true,  label: 'Fontän',      cat: 'bygg'  },
  hay:      { img: 'd_hay',      bw: 3, solid: true,  label: 'Höbal',       cat: 'bygg'  },
  trough:   { img: 'd_trough',   bw: 2, solid: false, label: 'Tråg',        cat: 'bygg'  },
  box:      { img: 'd_box',      bw: 2, solid: true,  label: 'Trälåda',     cat: 'bygg'  },
};

export class World {
  constructor(mapData) {
    this.ground = [];      // [y][x] = 0 grass, 1 dirt, 2 water
    this.solid = [];       // [y][x] bool
    this.decor = [];       // { type, tx, ty }  (ty = base/bottom tile row)
    this.animalSpawns = []; // [{ kind, tx, ty }] (custom maps)
    this.pasture = null;
    if (mapData) { this._loadMap(mapData); return; }
    this.w = MAP_W; this.h = MAP_H;
    this.pasture = { x: 4, y: MAP_H - 9, w: 9, h: 6 }; // fenced animal area (tiles)
    // spawn on grass just off the central path (not on dirt), near the homestead
    this.spawn = { x: (Math.floor(MAP_W / 2) - 4) * TILE + 8, y: (Math.floor(MAP_H / 2) - 3) * TILE + 8 };
    this._generate();
  }

  // place a decoration + mark its footprint solid (shared by generate/load/editor)
  place(type, tx, ty) {
    const d = DECOR[type];
    if (!d) return;
    this.decor.push({ type, tx, ty });
    if (d.solid) for (let i = 0; i < d.bw; i++) {
      const gx = tx + i, gy = ty;
      if (this.inBounds(gx, gy)) this.solid[gy][gx] = true;
    }
  }

  // build the world from a saved map (see editor format)
  _loadMap(m) {
    this.w = m.w; this.h = m.h;
    for (let y = 0; y < this.h; y++) {
      this.ground[y] = []; this.solid[y] = [];
      for (let x = 0; x < this.w; x++) {
        this.ground[y][x] = (m.ground && m.ground[y] && m.ground[y][x]) || 0;
        this.solid[y][x] = false;
      }
    }
    for (const o of (m.decor || [])) this.place(o.type, o.tx, o.ty);
    this.animalSpawns = (m.animals || []).slice();
    const sp = m.spawn || { tx: Math.floor(this.w / 2), ty: Math.floor(this.h / 2) };
    this.spawn = { x: sp.tx * TILE + 8, y: sp.ty * TILE + 8 };
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

    const place = (type, tx, ty) => this.place(type, tx, ty);

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

  // A tile is "dirt" if it's the world dirt-plot OR the player has tilled it.
  // Unified so the two never fight over borders. (this.farm set by main.)
  isDirtAt(tx, ty) {
    return this.inBounds(tx, ty) && (this.ground[ty][tx] === 1 || (this.farm && this.farm.isTilled(tx, ty)));
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
    const s = TILE * ZOOM + 1;
    const edge = A.grassedge;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const dx = Math.round((tx * TILE - cam.x) * ZOOM);
        const dy = Math.round((ty * TILE - cam.y) * ZOOM);
        if (this.ground[ty][tx] === 2) { drawTile(ctx, 'grass', T_WATER.col, T_WATER.row, dx, dy, s); continue; }
        if (this.isDirtAt(tx, ty)) {
          drawTile(ctx, 'grass', T_DIRT.col, T_DIRT.row, dx, dy, s); // flat dirt base
          if (edge) {                                                // grass fringe overlays
            const D = (x, y) => this.isDirtAt(x, y);
            const N = D(tx, ty - 1), So = D(tx, ty + 1), We = D(tx - 1, ty), Ea = D(tx + 1, ty);
            const ov = (f) => ctx.drawImage(edge, f * 16, 0, 16, 16, dx, dy, s, s);
            const gc = (im) => im && ctx.drawImage(im, 0, 0, 16, 16, dx, dy, s, s);
            // convex (outer) corners — a single artist-drawn wrap tile carries both fringes and
            // wraps the corner cleanly (no boxy doubled outline where two straight edges collide).
            const hasC = !!GRASS_CORNERS.tl;
            const TL = !N && !We, TR = !N && !Ea, BL = !So && !We, BR = !So && !Ea;
            // straight edges — skip the stretch a corner tile already covers (only when we have corners)
            if (!N && !(hasC && (TL || TR))) ov(0);
            if (!So && !(hasC && (BL || BR))) ov(1);
            if (!We && !(hasC && (TL || BL))) ov(2);
            if (!Ea && !(hasC && (TR || BR))) ov(3);
            if (TL) gc(GRASS_CORNERS.tl);
            if (TR) gc(GRASS_CORNERS.tr);
            if (BL) gc(GRASS_CORNERS.bl);
            if (BR) gc(GRASS_CORNERS.br);
            if (N && We && !D(tx - 1, ty - 1)) ov(4);                        // inner (concave) corners
            if (N && Ea && !D(tx + 1, ty - 1)) ov(5);
            if (So && We && !D(tx - 1, ty + 1)) ov(6);
            if (So && Ea && !D(tx + 1, ty + 1)) ov(7);
          }
          continue;
        }
        let t = T_GRASS;
        const hsh = hash2(tx, ty) % 100;
        if (hsh < 14) t = T_GRASS_DETAIL[hsh % T_GRASS_DETAIL.length];
        drawTile(ctx, 'grass', t.col, t.row, dx, dy, s);
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
