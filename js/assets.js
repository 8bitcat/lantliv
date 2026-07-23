// LANTLIV — asset loading + draw helpers
import { TILE } from './config.js';

// Playable characters (paid pack) — each has the same 5 action sheets, 48px, 4 dirs.
export const CHARACTERS = [
  { key: 'bunny',  label: 'Kanin' },
  { key: 'duck',   label: 'Anka' },
  { key: 'lion',   label: 'Lejon' },
  { key: 'monkey', label: 'Apa' },
  { key: 'base',   label: 'Bonde' },
];
const CHAR_ACTS = ['idle', 'run', 'hoe', 'watering', 'scythe'];

// Animals — key = file name in assets/animals/
export const ANIMAL_KEYS = ['chicken', 'chick', 'cow', 'calf', 'goat', 'babygoat', 'sheep', 'lamb', 'mallard', 'duckling'];

const FILES = {
  crops:    'assets/tiles/crops.png',
  grass:    'assets/tiles/grass.png',
  grassedge: 'assets/tiles/grassedge.png',
  nature:   'assets/tiles/nature.png',
  exterior: 'assets/tiles/exterior.png',
  house:    'assets/tiles/house.png',
  floor:    'assets/tiles/floor.png',
  chest:    'assets/obj/chest.png',
  campfire: 'assets/obj/campfire.png',
  shadow:   'assets/obj/shadow.png',
  house_built: 'assets/obj/house_built.png',
};
// decorations (clean pre-extracted PNGs)
for (const d of ['tree', 'pine', 'treebig', 'bush', 'boulder', 'rock', 'stump', 'log', 'well', 'lamp',
  'fence', 'pond', 'stall', 'chest', 'mushroom', 'deadtree', 'bench', 'barrel', 'crate', 'campfire',
  'fountain', 'hay', 'trough', 'box']) {
  FILES['d_' + d] = 'assets/decor/' + d + '.png';
}
// character sheets: <char>_<act>
for (const c of CHARACTERS) for (const a of CHAR_ACTS) FILES[`${c.key}_${a}`] = `assets/char/${c.key}_${a}.png`;
// animal idle sheets
for (const k of ANIMAL_KEYS) FILES[k] = `assets/animals/${k}.png`;

export const A = {}; // name -> HTMLImageElement

// Grass "outer corner" overlays (convex dirt corners). The grass.png 3×3 dirt blob has
// artist-drawn corner tiles; we knock the dirt pixels out so they composite as transparent
// grass wraps on top of the straight edge fringes — rounding the otherwise boxy corners.
export const GRASS_CORNERS = {}; // 'tl'|'tr'|'bl'|'br' -> 16×16 canvas

function buildGrassCorners() {
  const src = A.grass;
  if (!src || !src.width) return;
  try {
    const read = document.createElement('canvas'); read.width = src.width; read.height = src.height;
    const rc = read.getContext('2d'); rc.imageSmoothingEnabled = false;
    rc.drawImage(src, 0, 0);
    const dirt = rc.getImageData(16 * 16 + 8, 2 * 16 + 8, 1, 1).data;   // blob centre = plain dirt
    const grass = rc.getImageData(10 * 16 + 8, 3 * 16 + 8, 1, 1).data;  // plain grass
    const d2 = (p, i, r) => (p[i] - r[0]) ** 2 + (p[i + 1] - r[1]) ** 2 + (p[i + 2] - r[2]) ** 2;
    const src4 = { tl: [15, 1], tr: [17, 1], bl: [15, 3], br: [17, 3] };
    for (const k in src4) {
      const [cx, cy] = src4[k];
      const im = rc.getImageData(cx * 16, cy * 16, 16, 16);
      const p = im.data;
      for (let i = 0; i < p.length; i += 4) {
        if (d2(p, i, dirt) < d2(p, i, grass)) p[i + 3] = 0; // dirt pixel -> transparent
      }
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').putImageData(im, 0, 0);
      GRASS_CORNERS[k] = c;
    }
  } catch (e) { console.warn('grass-corner overlays unavailable', e); }
}

export function loadAssets() {
  const names = Object.keys(FILES);
  return Promise.all(names.map((n) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { A[n] = img; res(); };
    img.onerror = () => { console.warn('kunde inte ladda', FILES[n]); res(); }; // tolerate missing optional decor
    img.src = FILES[n];
  }))).then(() => { buildGrassCorners(); });
}

// Direction -> sprite-sheet row.
// The pack ships two row conventions: the movement sheets (idle/run) and the
// animal sheets use [up, down, left, right]; the TOOL sheets (hoe/watering/scythe)
// use [up, right, left, down] — i.e. down & right are swapped. Each anim carries its map.
export const DIR_ROW = { up: 0, down: 1, left: 2, right: 3 };        // idle/run/animals
export const ACTION_DIR_ROW = { up: 0, right: 1, left: 2, down: 3 }; // hoe/watering/scythe

// Character animation defs — sheet = `${charKey}_${suffix}`
export const CHAR_ANIM = {
  idle:     { suffix: 'idle',     frames: 5, fps: 5,  rows: DIR_ROW },
  run:      { suffix: 'run',      frames: 8, fps: 12, rows: DIR_ROW },
  hoe:      { suffix: 'hoe',      frames: 9, fps: 14, rows: ACTION_DIR_ROW },
  watering: { suffix: 'watering', frames: 9, fps: 14, rows: ACTION_DIR_ROW },
  scythe:   { suffix: 'scythe',   frames: 9, fps: 14, rows: ACTION_DIR_ROW },
};

// Draw one 48px character frame. dx,dy = top-left on screen, size = dest size.
export function drawChar(ctx, sheetName, dirRow, frame, dx, dy, size) {
  const img = A[sheetName];
  if (!img) return;
  ctx.drawImage(img, frame * 48, dirRow * 48, 48, 48, dx, dy, size, size);
}

// Draw a 16px tile from a tileset by (col,row).
export function drawTile(ctx, sheetName, col, row, dx, dy, dsize) {
  const img = A[sheetName];
  if (!img) return;
  ctx.drawImage(img, col * TILE, row * TILE, TILE, TILE, dx, dy, dsize, dsize);
}
