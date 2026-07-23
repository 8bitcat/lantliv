// LANTLIV — global config & constants
export const TILE = 16;          // source art px per tile
export const ZOOM = 3;           // screen px per source px
export const PX = TILE * ZOOM;   // screen px per tile (48)
export const CHAR = 48;          // character frame size (source px)

export const MAP_W = 46;         // world width in tiles
export const MAP_H = 36;         // world height in tiles

export const PLAYER_SPEED = 74;  // world px / second

// Farming timing (seconds)
export const STAGE_TIME = 15;    // watered seconds needed per growth stage
export const WET_TIME = 60;      // how long soil stays wet after watering
export const WITHER_TIME = 240;  // unwatered seconds before a growing crop withers

export const DAY_LENGTH = 240;   // seconds per in-game day (cosmetic day/night)

// Crop definitions — column in crops.png, display name, base coin value
export const CROPS = {
  carrot:      { col: 1, name: 'Morot',     price: 12, color: '#e8873a' },
  cauliflower: { col: 2, name: 'Blomkål',   price: 22, color: '#e9f0d8' },
  pumpkin:     { col: 3, name: 'Pumpa',     price: 34, color: '#e07b2e' },
  strawberry:  { col: 4, name: 'Jordgubbe', price: 16, color: '#e0455e' },
};
export const CROP_KEYS = ['carrot', 'cauliflower', 'pumpkin', 'strawberry'];

// crops.png tile coordinates (col, row) @ 16px
export const GROW_ROWS = [2, 4, 6, 8, 10];              // stage 1..5 plant rows
export const WITHER_ROWS = { 2: 18, 3: 20, 4: 22, 5: 24 }; // stage -> withered row
export const SOIL_DRY = { col: 1, row: 26 };
export const SOIL_WET = { col: 2, row: 26 };
export const HARVEST_ICON_ROW = 13;                    // harvested crop icon (no star)
export const STAR_ROWS = { silver: 14, gold: 15, purple: 16 };

// grass.png solid fill tiles (col,row) @16px — measured, variance 0
export const T_GRASS = { col: 10, row: 3 };                 // plain grass base
export const T_GRASS_DETAIL = [{ col: 6, row: 2 }, { col: 6, row: 7 }]; // occasional tufts
export const T_DIRT  = { col: 16, row: 2 };                 // plain dirt center
export const T_WATER = { col: 13, row: 1 };

// Dirt-path autotile (grass border wraps the dirt). 3×3 blob from grass.png.
export const DIRT_AUTOTILE = {
  tl: { col: 15, row: 1 }, t: { col: 16, row: 1 }, tr: { col: 17, row: 1 },
  l:  { col: 15, row: 2 }, c: { col: 16, row: 2 }, r:  { col: 17, row: 2 },
  bl: { col: 15, row: 3 }, b: { col: 16, row: 3 }, br: { col: 17, row: 3 },
};

// Quality roll: checked in order, `chance` is the CUMULATIVE upper threshold.
export const QUALITY = [
  { key: 'purple', chance: 0.05, mult: 3.0, label: '★★★' },
  { key: 'gold',   chance: 0.20, mult: 2.0, label: '★★'  },
  { key: 'silver', chance: 0.50, mult: 1.4, label: '★'   },
  { key: 'none',   chance: 1.00, mult: 1.0, label: ''    },
];
