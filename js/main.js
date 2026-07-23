// LANTLIV — game entry: loop, camera, rendering, tool actions, multiplayer glue
import { TILE, ZOOM, DAY_LENGTH, CROPS, CROP_KEYS, PRODUCTS, ANIMAL_SHOP, ANIMAL_REACH } from './config.js';
import { loadAssets } from './assets.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Farm } from './farm.js';
import { Player } from './player.js';
import { Herd } from './animals.js';
import { Net } from './net.js';
import { ui } from './ui.js';
import { getActiveMap, clearActiveMap } from './maps.js';
import { Inventory } from './economy.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');

let vw = 0, vh = 0, dpr = 1;
const cam = { x: 0, y: 0 };
const net = new Net();
const others = new Map(); // id -> Player (remote)

let world, farm, herd, me;
let inv = new Inventory();
const game = {
  running: false, isHost: false, myName: 'Bonde',
  day: 1, dayTime: DAY_LENGTH * 0.25, roomCode: null, activeSeed: 'carrot',
  stateDirty: false, _tPlayers: 0, _tState: 0, _tHud: 0, _tSave: 0,
};

// ---------- setup ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w <= 0 || h <= 0) return; // minimised/occluded: keep the last backing store, don't blank it
  dpr = window.devicePixelRatio || 1;
  vw = w; vh = h;
  canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

// When the tab/window loses then regains focus, the browser compositor can leave a stale/blank
// (grey) canvas until the next paint. Force an immediate re-render on return so colours come back.
function forceRepaint() {
  if (!document.hidden && game.running && world) { resize(); render(0); }
}
document.addEventListener('visibilitychange', forceRepaint);
window.addEventListener('focus', forceRepaint);
window.addEventListener('pageshow', forceRepaint);

// ---------- tool intent ----------
function getIntent(tool, tx, ty) {
  // an animal in front of you takes priority — collect its product or feed it
  const a = herd && herd.findNear(tx * TILE + TILE / 2, ty * TILE + TILE / 2, ANIMAL_REACH);
  if (a) {
    const act = a.intent(inv.hasFeed());
    if (act === 'collect') return { kind: 'collectAnimal', anim: null };
    if (act === 'feed') return { kind: 'feedAnimal', anim: null };
  }
  const t = farm.get(tx, ty);
  if (t && t.crop && (t.crop.stage >= 5 || t.crop.withered)) return { kind: 'harvest', anim: 'scythe' };
  if (tool === 'hoe') { if (world.isFarmable(tx, ty) && !t) return { kind: 'till', anim: 'hoe' }; }
  else if (tool === 'watering') { if (t) return { kind: 'water', anim: 'watering' }; }
  else if (tool === 'seed') { if (t && !t.crop && inv.seedCount(game.activeSeed) > 0) return { kind: 'plant', anim: 'hoe', seed: game.activeSeed }; }
  return null;
}

function doAction() {
  if (me.actionLock) return;
  const tool = ui.currentTool();
  const { tx, ty } = me.frontTile();
  const intent = getIntent(tool, tx, ty);
  if (!intent) return;
  // animal interactions are instant (no tool swing) — apply/send right away
  if (intent.kind === 'feedAnimal' || intent.kind === 'collectAnimal') {
    if (game.isHost) hostApply(intent, tx, ty);
    else net.send('act', { kind: intent.kind, tx, ty });
    return;
  }
  me.startAction(intent.anim, () => {
    if (game.isHost) hostApply(intent, tx, ty);
    else net.send('act', { kind: intent.kind, tx, ty, seed: intent.seed });
  });
}

function hostApply(intent, tx, ty) {
  if (intent.kind === 'till') farm.till(tx, ty);
  else if (intent.kind === 'water') farm.water(tx, ty);
  else if (intent.kind === 'plant') { if (inv.useSeed(intent.seed)) farm.plant(tx, ty, intent.seed); }
  else if (intent.kind === 'harvest') {
    const r = farm.harvest(tx, ty);
    const wx = tx * TILE + 8, wy = ty * TILE;
    if (r && r.type) {
      inv.addHarvest(r.type);
      const txt = `+1 ${CROPS[r.type].emoji}`;
      ui.addFloat(wx, wy, txt, '#cdeffd');
      net.broadcast('fx', { wx, wy, text: txt, color: '#cdeffd' });
    } else if (r && r.withered) {
      ui.addFloat(wx, wy, 'vissnat', '#c9a15a');
      net.broadcast('fx', { wx, wy, text: 'vissnat', color: '#c9a15a' });
    }
  } else if (intent.kind === 'feedAnimal' || intent.kind === 'collectAnimal') {
    const a = herd.findNear(tx * TILE + TILE / 2, ty * TILE + TILE / 2, ANIMAL_REACH);
    if (a) {
      if (intent.kind === 'collectAnimal') {
        const prod = a.collect();
        if (prod) {
          inv.addProduct(prod);
          const txt = `+1 ${PRODUCTS[prod].emoji}`;
          ui.addFloat(a.x, a.y - 20, txt, '#fff6c9');
          net.broadcast('fx', { wx: a.x, wy: a.y - 20, text: txt, color: '#fff6c9' });
          refreshEconomyUI();
        }
      } else if (a.intent(inv.hasFeed()) === 'feed' && inv.useFeed()) {
        a.feed();
        ui.addFloat(a.x, a.y - 20, '🌾', '#d8f0a0');
        net.broadcast('fx', { wx: a.x, wy: a.y - 20, text: '🌾', color: '#d8f0a0' });
        refreshEconomyUI();
      }
    }
  }
  game.stateDirty = true;
}

// ---------- shop / inventory actions (host-authoritative) ----------
function shopAction(kind, key) {
  if (game.isHost) hostShop(kind, key);
  else net.send('shop', { kind, key });
}
function hostShop(kind, key) {
  if (kind === 'buy') { if (inv.buySeed(key)) ui.toast('Köpte ' + CROPS[key].name + '-frö'); else ui.toast('Inte råd!'); }
  else if (kind === 'sellAll') { const g = inv.sellAll(); ui.toast(g > 0 ? 'Sålde för ' + g + ' 🪙' : 'Inget att sälja'); }
  else if (kind === 'sellOne') inv.sellOne(key);
  else if (kind === 'sellProduct') inv.sellProduct(key);
  else if (kind === 'buyFoder') { if (inv.buyFoder()) ui.toast('Köpte foder 🌾'); else ui.toast('Inte råd!'); }
  else if (kind === 'buyAnimal') {
    if (inv.buyAnimal(key)) { herd.addBaby(key); ui.toast('Köpte ' + ANIMAL_SHOP[key].name + '! 🐣'); }
    else ui.toast('Inte råd!');
  }
  game.stateDirty = true;
  refreshEconomyUI();
}
function refreshEconomyUI() {
  ui.setCoins(inv.coins);
  ui.setSeedSlot(CROPS[game.activeSeed], inv.seedCount(game.activeSeed));
  ui.updateBag(inv, game.activeSeed);
  ui.updateShop(inv);
}
function setActiveSeed(key) { game.activeSeed = key; me.tool = 'seed'; ui.setSeedSlot(CROPS[key], inv.seedCount(key)); ui.setToolBySeed(); }

function selectTool(n) { ui.setTool(n); me.tool = ui.currentTool(); }

// ---------- update ----------
function update(dt) {
  const ts = Input.takeTool(); if (ts) selectTool(ts);
  if (Input.takeAction()) doAction();

  me.update(dt, Input, world);
  for (const p of others.values()) p.updateRemote(dt);

  if (game.isHost) { farm.update(dt); herd.updateHost(dt); }
  else herd.updateRemote(dt);

  // day/night clock (host authoritative, both advance for smoothness)
  game.dayTime += dt;
  if (game.dayTime >= DAY_LENGTH) {
    game.dayTime -= DAY_LENGTH;
    if (game.isHost) {
      game.day++;
      const born = herd.dayTick(); // breeding + reset "fed today"
      if (born.length) ui.toast(born.length === 1 ? 'En bebis föddes på gården! 🐣' : born.length + ' bebisar föddes! 🐣');
      game.stateDirty = true;
    }
  }

  // networking
  if (net.mode) {
    game._tPlayers += dt;
    if (game._tPlayers >= 1 / 12) {
      game._tPlayers = 0;
      if (game.isHost) broadcastPlayers();
      else net.send('xf', me.snapshot());
    }
    if (game.isHost) {
      game._tState += dt;
      if (game._tState >= 1 / 3 || game.stateDirty) { game._tState = 0; game.stateDirty = false; broadcastState(); }
    }
  }

  // HUD refresh (throttled)
  game._tHud += dt;
  if (game._tHud >= 0.25) {
    game._tHud = 0;
    ui.setCoins(inv.coins); ui.setDay(game.day);
    if (net.mode) ui.setRoom(net.code || game.roomCode || '—', game.isHost ? net.playerCount : others.size + 1);
  }

  // autosave (host)
  if (game.isHost) { game._tSave += dt; if (game._tSave >= 10) { game._tSave = 0; saveGame(); } }

  updateCamera();
}

function updateCamera() {
  const halfW = vw / ZOOM / 2, halfH = vh / ZOOM / 2;
  const maxX = world.w * TILE - vw / ZOOM, maxY = world.h * TILE - vh / ZOOM;
  cam.x = maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, me.x - halfW));
  cam.y = maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, me.y - halfH));
}

// ---------- render ----------
function render(dt) {
  ctx.fillStyle = '#7db046';
  ctx.fillRect(0, 0, vw, vh);
  world.drawGround(ctx, cam, vw, vh);
  farm.draw(ctx, cam, vw, vh);
  drawTargetHighlight();

  const list = [];
  world.collectSprites(list, cam);
  list.push(me);
  for (const p of others.values()) list.push(p);
  herd.collectSprites(list);
  list.sort((a, b) => a.sortY - b.sortY);
  for (const s of list) s.draw(ctx, cam);

  drawDayTint();
  ui.drawFloats(ctx, cam, dt);
}

function drawTargetHighlight() {
  if (me.actionLock) return;
  const { tx, ty } = me.frontTile();
  const intent = getIntent(ui.currentTool(), tx, ty);
  const dx = Math.round((tx * TILE - cam.x) * ZOOM);
  const dy = Math.round((ty * TILE - cam.y) * ZOOM);
  const s = TILE * ZOOM;
  ctx.lineWidth = 2;
  ctx.strokeStyle = intent ? 'rgba(130,255,150,0.9)' : 'rgba(255,255,255,0.35)';
  ctx.strokeRect(dx + 1.5, dy + 1.5, s - 3, s - 3);
}

function drawDayTint() {
  const p = game.dayTime / DAY_LENGTH;
  let dark = 0;
  if (p < 0.10) dark = (0.10 - p) / 0.10;
  else if (p > 0.72) dark = Math.min(1, (p - 0.72) / 0.16);
  dark *= 0.5;
  if (dark > 0.01) { ctx.fillStyle = `rgba(18,22,58,${dark.toFixed(3)})`; ctx.fillRect(0, 0, vw, vh); }
}

// ---------- networking ----------
function broadcastPlayers() {
  const map = { host: me.snapshot() };
  for (const [id, p] of others) map[id] = p.raw || p.snapshot();
  net.broadcast('players', map);
}
function broadcastState() {
  net.broadcast('state', {
    f: farm.serialize(), h: herd.serialize(), i: inv.serialize(),
    d: game.day, t: Math.round(game.dayTime),
  });
}

function ensurePlayer(id, name) {
  let p = others.get(id);
  if (!p) { p = new Player({ isLocal: false, name: name || 'Bonde' }); others.set(id, p); }
  else if (name) p.name = name;
  return p;
}

net.on({
  msg: (fromId, t, d) => {
    if (game.isHost) {
      if (t === 'hello') { ensurePlayer(fromId, d.name); net.sendTo(fromId, 'state', stateMsg()); broadcastPlayers(); }
      else if (t === 'xf') { const p = ensurePlayer(fromId, d.n); p.applySnapshot(d); }
      else if (t === 'act') hostApply({ kind: d.kind, seed: d.seed }, d.tx, d.ty);
      else if (t === 'shop') hostShop(d.kind, d.key);
    } else {
      if (t === 'map') {
        rebuildWorld(d);
      } else if (t === 'state') {
        farm.apply(d.f); herd.apply(d.h); inv.apply(d.i);
        game.day = d.d; game.dayTime = d.t;
        ui.setDay(d.d); refreshEconomyUI();
      } else if (t === 'players') {
        for (const id in d) { if (id === net.myId) continue; ensurePlayer(id).applySnapshot(d[id]); }
        for (const id of [...others.keys()]) if (!(id in d)) others.delete(id);
      } else if (t === 'fx') ui.addFloat(d.wx, d.wy, d.text, d.color);
    }
  },
  peerOpen: (id) => { ensurePlayer(id); net.sendTo(id, 'map', game.mapData || null); net.sendTo(id, 'state', stateMsg()); },
  peerLeave: (id) => { others.delete(id); ui.toast('En bonde lämnade gården'); },
  hostLost: () => { ui.toast('Tappade kontakten med värden'); backToMenu(); },
  netError: (e) => ui.setMenuStatus('Nätverksfel: ' + e),
});

function stateMsg() {
  return { f: farm.serialize(), h: herd.serialize(), i: inv.serialize(), d: game.day, t: Math.round(game.dayTime) };
}

// ---------- save / load (host only, localStorage) ----------
function saveKey() { return 'lantliv_save' + (game.mapData ? '_custom' : ''); }
function saveGame() {
  if (!game.isHost) return;
  try { localStorage.setItem(saveKey(), JSON.stringify({ inv: inv.serialize(), farm: farm.serialize(), herd: herd.serialize(), day: game.day, t: Math.round(game.dayTime) })); } catch {}
}
function loadGame() {
  try {
    const s = localStorage.getItem(saveKey()); if (!s) return false;
    const d = JSON.parse(s);
    inv.apply(d.inv); farm.apply(d.farm);
    if (d.herd) herd.apply(d.herd);
    game.day = d.day || 1; game.dayTime = d.t ?? DAY_LENGTH * 0.25;
    return true;
  } catch { return false; }
}

// ---------- game start / menu ----------
function newGame(isHost, mapData) {
  game.isHost = isHost;
  game.mapData = mapData || null;
  world = new World(game.mapData);
  farm = new Farm(world);
  world.farm = farm; // world renders unified dirt (world plots + tilled soil)
  herd = new Herd();
  me = new Player({ isLocal: true, name: game.myName, char: ui.selectedChar, x: world.spawn.x, y: world.spawn.y });
  me.tool = ui.currentTool();
  others.clear();
  inv = new Inventory();
  game.day = 1; game.dayTime = DAY_LENGTH * 0.25; game.activeSeed = 'carrot';
  if (isHost) { spawnHerd(); if (loadGame()) ui.toast('Laddade din sparade gård 🌾'); }
  ui.setDay(game.day);
  refreshEconomyUI();
  ui.setSeedSlot(CROPS[game.activeSeed], inv.seedCount(game.activeSeed));
  ui.showMenu(false);
  game.running = true;
}

function spawnHerd() {
  if (world.animalSpawns && world.animalSpawns.length) herd.spawnAt(world.animalSpawns, world.w, world.h);
  else if (world.pasture) herd.spawn(world.pasture);
}

function backToMenu() {
  saveGame();
  game.running = false;
  net.destroy();
  others.clear();
  game.roomCode = null;
  ui.setRoom(null);
  ui.showMenu(true);
  ui.setMenuStatus('');
}

function startSolo(name) { game.myName = name; ui.setRoom(null); newGame(true, getActiveMap()); ui.toast('Välkommen till din gård, ' + name + '!'); }

function startHost(name) {
  game.myName = name;
  ui.setMenuStatus('Skapar rum…');
  net.host((code) => {
    newGame(true, getActiveMap());
    game.roomCode = code;
    ui.setRoom(code, 1);
    ui.toast('Rumskod: ' + code + ' — dela med familjen!');
  });
}

function startJoin(name, code) {
  game.myName = name;
  ui.setMenuStatus('Ansluter till ' + code + '…');
  net.join(code,
    () => { newGame(false, null); game.roomCode = code; ui.setRoom(code, 1); net.send('hello', { name }); ui.toast('Ansluten till ' + code + '!'); },
    (reason) => ui.setMenuStatus('Kunde inte ansluta (' + reason + '). Kolla koden och försök igen.')
  );
}

// client: rebuild the world when the host sends its map (null = procedural default)
function rebuildWorld(mapData) {
  game.mapData = mapData || null;
  world = new World(game.mapData);
  farm = new Farm(world);
  world.farm = farm; // world renders unified dirt (world plots + tilled soil)
  me.x = Math.min(Math.max(me.x, TILE), (world.w - 1) * TILE);
  me.y = Math.min(Math.max(me.y, TILE * 2), (world.h - 1) * TILE);
}

// ---------- boot ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (game.running && world) { update(dt); render(dt); }
  requestAnimationFrame(frame);
}

async function boot() {
  resize();
  ui.build({
    onSelectTool: (n) => { if (game.running) selectTool(n); },
    onSolo: startSolo, onHost: startHost, onJoin: startJoin,
    onAction: () => { if (game.running) doAction(); },
    onSelectSeed: (k) => { if (game.running) setActiveSeed(k); },
    onBuy: (k) => { if (game.running) shopAction('buy', k); },
    onSellAll: () => { if (game.running) shopAction('sellAll'); },
    onSellOne: (k) => { if (game.running) shopAction('sellOne', k); },
    onSellProduct: (k) => { if (game.running) shopAction('sellProduct', k); },
    onBuyFoder: () => { if (game.running) shopAction('buyFoder'); },
    onBuyAnimal: (k) => { if (game.running) shopAction('buyAnimal', k); },
    onOpenBag: () => refreshEconomyUI(),
    onOpenShop: () => refreshEconomyUI(),
  });
  window.addEventListener('beforeunload', saveGame);
  Input.init(canvas);
  ui.setMenuStatus('Laddar sprites…');
  try { await loadAssets(); } catch (e) { ui.setMenuStatus('Fel: ' + e.message); return; }
  ui.setMenuStatus('');
  ui.buildCharPicker();
  $('menuButtons').classList.remove('hidden');
  // show which map will load
  const md = getActiveMap();
  const info = $('mapInfo');
  if (md && info) {
    info.innerHTML = '🗺️ Spelar din egna karta. <a href="#" id="useDefault" style="color:#ffe08a">Spela standardkarta istället</a>';
    $('useDefault')?.addEventListener('click', (e) => { e.preventDefault(); clearActiveMap(); location.reload(); });
  }
  requestAnimationFrame(frame);
}
boot();
