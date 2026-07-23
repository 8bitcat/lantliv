// LANTLIV — map editor. Paint ground, place decorations/animals/spawn, save to the game.
import { TILE, CHAR, T_GRASS, T_WATER, DIRT_AUTOTILE } from './config.js';
import { A, loadAssets, drawTile, drawChar } from './assets.js';
import { DECOR } from './world.js';
import { setActiveMap, saveMap } from './maps.js';

const $ = (id) => document.getElementById(id);
const canvas = $('ed');
const ctx = canvas.getContext('2d');

const GROUND = [{ v: 0, label: 'Gräs' }, { v: 1, label: 'Jord' }, { v: 2, label: 'Vatten' }];
const ANIMALS = [{ kind: 'chicken', label: 'Höna' }, { kind: 'cow', label: 'Ko' }];

let map;
let cam = { x: 0, y: 0 };
let ez = 2;                       // editor zoom
let tool = { kind: 'decor', value: 'tree' };
let painting = false, strokeErase = false, panning = false, panLast = null;
let hover = null;
const keys = new Set();
let vw = 0, vh = 0, dpr = 1;

// ---------- map model ----------
function newMap(w, h) {
  const ground = [];
  for (let y = 0; y < h; y++) { ground[y] = []; for (let x = 0; x < w; x++) ground[y][x] = 0; }
  return { w, h, ground, decor: [], animals: [], spawn: { tx: Math.floor(w / 2), ty: Math.floor(h / 2) }, name: '' };
}
function resizeMap(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) { g[y] = []; for (let x = 0; x < w; x++) g[y][x] = (map.ground[y] && map.ground[y][x]) || 0; }
  map.w = w; map.h = h; map.ground = g;
  map.decor = map.decor.filter((d) => d.tx < w && d.ty < h);
  map.animals = map.animals.filter((a) => a.tx < w && a.ty < h);
  if (map.spawn.tx >= w) map.spawn.tx = w - 1;
  if (map.spawn.ty >= h) map.spawn.ty = h - 1;
}

// dirt autotile (grass border) — mirrors World._dirtTile
function dirtTileAt(tx, ty) {
  const isDirt = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && map.ground[y][x] === 1;
  const gN = !isDirt(tx, ty - 1), gS = !isDirt(tx, ty + 1), gW = !isDirt(tx - 1, ty), gE = !isDirt(tx + 1, ty);
  const D = DIRT_AUTOTILE;
  if (gN && gW) return D.tl; if (gN && gE) return D.tr;
  if (gS && gW) return D.bl; if (gS && gE) return D.br;
  if (gN) return D.t; if (gS) return D.b; if (gW) return D.l; if (gE) return D.r;
  return D.c;
}

// ---------- editing ----------
function decorCovering(tx, ty) {
  return map.decor.filter((o) => { const bw = DECOR[o.type]?.bw || 1; return o.ty === ty && tx >= o.tx && tx < o.tx + bw; });
}
function inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < map.w && ty < map.h; }

function paintTile(tx, ty) {
  if (!inBounds(tx, ty)) return;
  if (strokeErase || tool.kind === 'erase') {
    map.decor = map.decor.filter((o) => !decorCovering(tx, ty).includes(o));
    map.animals = map.animals.filter((a) => !(a.tx === tx && a.ty === ty));
    return;
  }
  if (tool.kind === 'ground') { map.ground[ty][tx] = tool.value; return; }
  if (tool.kind === 'spawn') { map.spawn = { tx, ty }; return; }
  if (tool.kind === 'animal') {
    map.animals = map.animals.filter((a) => !(a.tx === tx && a.ty === ty));
    map.animals.push({ kind: tool.value, tx, ty });
    return;
  }
  if (tool.kind === 'decor') {
    map.decor = map.decor.filter((o) => !(o.tx === tx && o.ty === ty));
    map.decor.push({ type: tool.value, tx, ty });
  }
}

// ---------- rendering ----------
function resize() {
  dpr = window.devicePixelRatio || 1;
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

function render() {
  // pan from held keys
  const step = 6 / ez;
  if (keys.has('arrowleft') || keys.has('a')) cam.x -= step * 3;
  if (keys.has('arrowright') || keys.has('d')) cam.x += step * 3;
  if (keys.has('arrowup') || keys.has('w')) cam.y -= step * 3;
  if (keys.has('arrowdown') || keys.has('s')) cam.y += step * 3;
  clampCam();

  ctx.fillStyle = '#1c2a16';
  ctx.fillRect(0, 0, vw, vh);

  const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(map.w - 1, Math.ceil((cam.x + vw / ez) / TILE));
  const y1 = Math.min(map.h - 1, Math.ceil((cam.y + vh / ez) / TILE));
  const s = TILE * ez;

  // ground
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const g = map.ground[ty][tx];
    const t = g === 2 ? T_WATER : g === 1 ? dirtTileAt(tx, ty) : T_GRASS;
    drawTile(ctx, 'grass', t.col, t.row, Math.round((tx * TILE - cam.x) * ez), Math.round((ty * TILE - cam.y) * ez), s + 1);
  }
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (let tx = x0; tx <= x1 + 1; tx++) { const sx = Math.round((tx * TILE - cam.x) * ez); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, vh); ctx.stroke(); }
  for (let ty = y0; ty <= y1 + 1; ty++) { const sy = Math.round((ty * TILE - cam.y) * ez); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(vw, sy); ctx.stroke(); }

  // decor (y-sorted) + animals + spawn together
  const sprites = [];
  for (const o of map.decor) {
    const d = DECOR[o.type], img = A[d.img];
    if (!img) continue;
    sprites.push({ sy: (o.ty + 1) * TILE, img, tx: o.tx, ty: o.ty, bw: d.bw });
  }
  for (const a of map.animals) sprites.push({ sy: (a.ty + 1) * TILE, animal: a });
  sprites.sort((p, q) => p.sy - q.sy);
  for (const sp of sprites) {
    if (sp.img) {
      const iw = sp.img.width, ih = sp.img.height;
      const centerX = (sp.tx + sp.bw / 2) * TILE, bottomY = (sp.ty + 1) * TILE;
      ctx.drawImage(sp.img, Math.round((centerX - iw / 2 - cam.x) * ez), Math.round((bottomY - ih - cam.y) * ez), iw * ez, ih * ez);
    } else {
      const a = sp.animal;
      const dx = Math.round(((a.tx + 0.5) * TILE - CHAR / 2 - cam.x) * ez);
      const dy = Math.round(((a.ty + 1) * TILE - 32 - cam.y) * ez);
      drawChar(ctx, a.kind, 1, 0, dx, dy, CHAR * ez);
    }
  }
  // spawn marker
  {
    const sp = map.spawn;
    const dx = Math.round(((sp.tx + 0.5) * TILE - CHAR / 2 - cam.x) * ez);
    const dy = Math.round(((sp.ty + 1) * TILE - 32 - cam.y) * ez);
    drawChar(ctx, 'bunny_idle', 1, 0, dx, dy, CHAR * ez);
    ctx.fillStyle = '#ffe08a'; ctx.font = `bold ${Math.round(7 * ez)}px monospace`; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
    const lx = Math.round(((sp.tx + 0.5) * TILE - cam.x) * ez), ly = Math.round((sp.ty * TILE - cam.y) * ez);
    ctx.strokeText('START', lx, ly); ctx.fillText('START', lx, ly); ctx.textAlign = 'left';
  }
  // hover highlight
  if (hover && inBounds(hover.tx, hover.ty)) {
    const bw = tool.kind === 'decor' ? (DECOR[tool.value]?.bw || 1) : 1;
    ctx.strokeStyle = (strokeErase || tool.kind === 'erase') ? 'rgba(255,90,90,0.95)' : 'rgba(130,255,150,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round((hover.tx * TILE - cam.x) * ez) + 1, Math.round((hover.ty * TILE - cam.y) * ez) + 1, s * bw - 2, s - 2);
  }
  requestAnimationFrame(render);
}

function clampCam() {
  const maxX = Math.max(0, map.w * TILE - vw / ez), maxY = Math.max(0, map.h * TILE - vh / ez);
  cam.x = Math.max(-40, Math.min(maxX + 40, cam.x));
  cam.y = Math.max(-40, Math.min(maxY + 40, cam.y));
}

// ---------- input ----------
function tileAt(clientX, clientY) {
  return { tx: Math.floor((clientX / ez + cam.x) / TILE), ty: Math.floor((clientY / ez + cam.y) / TILE) };
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  if (tool.kind === 'pan' || e.button === 1) { panning = true; panLast = { x: e.clientX, y: e.clientY }; return; }
  painting = true; strokeErase = (e.button === 2);
  const { tx, ty } = tileAt(e.clientX, e.clientY); hover = { tx, ty }; paintTile(tx, ty);
});
canvas.addEventListener('pointermove', (e) => {
  const { tx, ty } = tileAt(e.clientX, e.clientY); hover = { tx, ty };
  if (panning) { cam.x -= (e.clientX - panLast.x) / ez; cam.y -= (e.clientY - panLast.y) / ez; panLast = { x: e.clientX, y: e.clientY }; clampCam(); return; }
  if (painting) paintTile(tx, ty);
});
const endStroke = () => { painting = false; panning = false; strokeErase = false; };
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(ez * (e.deltaY < 0 ? 1.15 : 0.87)); }, { passive: false });
window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowleft','arrowright','arrowup','arrowdown'].includes(k)) e.preventDefault(); keys.add(k); });
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function setZoom(z) { ez = Math.max(1, Math.min(5, z)); }

// ---------- palette ----------
function thumbCanvas(draw) {
  const c = document.createElement('canvas'); c.width = 40; c.height = 40;
  const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; draw(cx); return c;
}
function drawGroundThumb(cx, v) {
  const t = v === 2 ? T_WATER : v === 1 ? DIRT_AUTOTILE.c : T_GRASS;
  drawTile(cx, 'grass', t.col, t.row, 0, 0, 40);
}
function drawDecorThumb(cx, img) {
  if (!img) return; const sc = Math.min(38 / img.width, 38 / img.height);
  const w = img.width * sc, h = img.height * sc; cx.drawImage(img, (40 - w) / 2, (40 - h) / 2, w, h);
}
function drawSheetThumb(cx, sheet) {
  const img = A[sheet]; if (!img) return;
  cx.drawImage(img, 0, 48, 48, 48, 2, 2, 36, 36); // row1 (down), frame 0
}

function paletteItem(section, opts) {
  const el = document.createElement('div');
  el.className = 'pi';
  if (opts.emoji) { const e = document.createElement('div'); e.className = 'emoji'; e.textContent = opts.emoji; el.appendChild(e); }
  else el.appendChild(thumbCanvas(opts.draw));
  const lb = document.createElement('div'); lb.className = 'lbl'; lb.textContent = opts.label; el.appendChild(lb);
  el.addEventListener('click', () => {
    tool = opts.tool;
    document.querySelectorAll('.pi').forEach((p) => p.classList.remove('active'));
    el.classList.add('active');
  });
  if (opts.selected) el.classList.add('active');
  section.appendChild(el);
  return el;
}

function buildPalette() {
  const pal = $('palette');
  const addSection = (title) => { const t = document.createElement('div'); t.className = 'secTitle'; t.textContent = title; pal.appendChild(t); const g = document.createElement('div'); g.className = 'items'; pal.appendChild(g); return g; };

  let s = addSection('Verktyg');
  paletteItem(s, { emoji: '✋', label: 'Flytta vy', tool: { kind: 'pan' } });
  paletteItem(s, { emoji: '🚩', label: 'Startplats', tool: { kind: 'spawn' } });
  paletteItem(s, { emoji: '✖', label: 'Radera', tool: { kind: 'erase' } });

  s = addSection('Mark');
  for (const g of GROUND) paletteItem(s, { draw: (cx) => drawGroundThumb(cx, g.v), label: g.label, tool: { kind: 'ground', value: g.v } });

  s = addSection('Natur');
  for (const [k, d] of Object.entries(DECOR)) if (d.cat === 'natur')
    paletteItem(s, { draw: (cx) => drawDecorThumb(cx, A[d.img]), label: d.label, tool: { kind: 'decor', value: k }, selected: k === 'tree' });

  s = addSection('Bygg');
  for (const [k, d] of Object.entries(DECOR)) if (d.cat === 'bygg')
    paletteItem(s, { draw: (cx) => drawDecorThumb(cx, A[d.img]), label: d.label, tool: { kind: 'decor', value: k } });

  s = addSection('Djur');
  for (const a of ANIMALS) paletteItem(s, { draw: (cx) => drawSheetThumb(cx, a.kind), label: a.label, tool: { kind: 'animal', value: a.kind } });
}

// ---------- toolbar ----------
function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', 2200); }

function currentName() { return ($('mapName').value.trim() || 'Min karta'); }

function wireToolbar() {
  $('savePlay').addEventListener('click', () => { commit(); setActiveMap(map); location.href = 'index.html'; });
  $('saveOnly').addEventListener('click', () => { commit(); setActiveMap(map); toast('Sparad! Den laddas när du spelar.'); });
  $('download').addEventListener('click', () => {
    commit();
    const blob = new Blob([JSON.stringify(map)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = currentName().replace(/[^\w-]+/g, '_') + '.json'; a.click();
  });
  $('openBtn').addEventListener('click', () => $('fileIn').click());
  $('fileIn').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const m = JSON.parse(r.result); if (!m.ground) throw 0; map = normalize(m); syncSizeInputs(); $('mapName').value = map.name || ''; toast('Karta öppnad'); } catch { toast('Kunde inte läsa filen'); } };
    r.readAsText(f);
  });
  $('resize').addEventListener('click', () => {
    const w = clampN($('mapW').value, 16, 100), h = clampN($('mapH').value, 16, 100);
    resizeMap(w, h); toast(`Storlek ${w}×${h}`);
  });
  $('clearAll').addEventListener('click', () => { if (confirm('Töm hela kartan?')) { map = newMap(map.w, map.h); toast('Tömd'); } });
  $('back').addEventListener('click', () => { location.href = 'index.html'; });
  $('zoomIn').addEventListener('click', () => setZoom(ez * 1.2));
  $('zoomOut').addEventListener('click', () => setZoom(ez * 0.83));
}
function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, parseInt(v, 10) || lo)); }
function commit() { map.name = currentName(); }
function syncSizeInputs() { $('mapW').value = map.w; $('mapH').value = map.h; }
function normalize(m) {
  return { w: m.w, h: m.h, ground: m.ground, decor: m.decor || [], animals: m.animals || [], spawn: m.spawn || { tx: Math.floor(m.w / 2), ty: Math.floor(m.h / 2) }, name: m.name || '' };
}

// ---------- boot ----------
async function boot() {
  resize();
  try { await loadAssets(); } catch (e) { toast('Fel: ' + e.message); return; }
  // continue editing the map you're building, else a fresh 46×36 grass map
  const active = (() => { try { return JSON.parse(localStorage.getItem('lantliv_active_map')); } catch { return null; } })();
  map = active && active.ground ? normalize(active) : newMap(46, 36);
  $('mapName').value = map.name || '';
  syncSizeInputs();
  buildPalette();
  wireToolbar();
  // centre camera on spawn
  cam.x = map.spawn.tx * TILE - vw / ez / 2; cam.y = map.spawn.ty * TILE - vh / ez / 2; clampCam();
  requestAnimationFrame(render);
}
boot();
