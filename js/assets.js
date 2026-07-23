// LANTLIV — asset loading + draw helpers
import { TILE } from './config.js';

const FILES = {
  bunny_idle:    'assets/char/bunny_idle.png',
  bunny_run:     'assets/char/bunny_run.png',
  bunny_hoe:     'assets/char/bunny_hoe.png',
  bunny_watering:'assets/char/bunny_watering.png',
  bunny_scythe:  'assets/char/bunny_scythe.png',
  crops:         'assets/tiles/crops.png',
  grass:         'assets/tiles/grass.png',
  nature:        'assets/tiles/nature.png',
  exterior:      'assets/tiles/exterior.png',
  house:         'assets/tiles/house.png',
  floor:         'assets/tiles/floor.png',
  chicken:       'assets/animals/chicken.png',
  cow:           'assets/animals/cow.png',
  chest:         'assets/obj/chest.png',
  campfire:      'assets/obj/campfire.png',
  shadow:        'assets/obj/shadow.png',
  house_built:   'assets/obj/house_built.png',
};

export const A = {}; // name -> HTMLImageElement

export function loadAssets() {
  const names = Object.keys(FILES);
  return Promise.all(names.map((n) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { A[n] = img; res(); };
    img.onerror = () => rej(new Error('kunde inte ladda ' + FILES[n]));
    img.src = FILES[n];
  })));
}

// Character animation frame counts (48px frames, 4 direction rows)
export const CHAR_ANIM = {
  idle:     { sheet: 'bunny_idle',     frames: 5, fps: 5 },
  run:      { sheet: 'bunny_run',      frames: 8, fps: 12 },
  hoe:      { sheet: 'bunny_hoe',      frames: 9, fps: 14 },
  watering: { sheet: 'bunny_watering', frames: 9, fps: 14 },
  scythe:   { sheet: 'bunny_scythe',   frames: 9, fps: 14 },
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

// Draw an arbitrary sub-rect of a sheet (for multi-tile objects), source in px.
export function drawRect(ctx, sheetName, sx, sy, sw, sh, dx, dy, dw, dh) {
  const img = A[sheetName];
  if (!img) return;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
