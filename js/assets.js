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

export function loadAssets() {
  const names = Object.keys(FILES);
  return Promise.all(names.map((n) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { A[n] = img; res(); };
    img.onerror = () => { console.warn('kunde inte ladda', FILES[n]); res(); }; // tolerate missing optional decor
    img.src = FILES[n];
  })));
}

// Character animation defs — sheet = `${charKey}_${suffix}`
export const CHAR_ANIM = {
  idle:     { suffix: 'idle',     frames: 5, fps: 5 },
  run:      { suffix: 'run',      frames: 8, fps: 12 },
  hoe:      { suffix: 'hoe',      frames: 9, fps: 14 },
  watering: { suffix: 'watering', frames: 9, fps: 14 },
  scythe:   { suffix: 'scythe',   frames: 9, fps: 14 },
};

// Direction -> sprite-sheet row
export const DIR_ROW = { up: 0, down: 1, left: 2, right: 3 };

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
