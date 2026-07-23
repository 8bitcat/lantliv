// LANTLIV — game entry: loop, camera, rendering, tool actions, multiplayer glue
import { TILE, ZOOM, DAY_LENGTH } from './config.js';
import { loadAssets } from './assets.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Farm } from './farm.js';
import { Player } from './player.js';
import { Herd } from './animals.js';
import { Net } from './net.js';
import { ui } from './ui.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');

let vw = 0, vh = 0, dpr = 1;
const cam = { x: 0, y: 0 };
const net = new Net();
const others = new Map(); // id -> Player (remote)

let world, farm, herd, me;
const game = {
  running: false, isHost: false, myName: 'Bonde',
  coins: 0, day: 1, dayTime: DAY_LENGTH * 0.25, roomCode: null,
  stateDirty: false, _tPlayers: 0, _tState: 0, _tHud: 0,
};

// ---------- setup ----------
function resize() {
  dpr = window.devicePixelRatio || 1;
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

// ---------- tool intent ----------
function getIntent(tool, tx, ty) {
  const t = farm.get(tx, ty);
  if (t && t.crop && (t.crop.stage >= 5 || t.crop.withered)) return { kind: 'harvest', anim: 'scythe' };
  if (tool === 'hoe') { if (world.isFarmable(tx, ty) && !t) return { kind: 'till', anim: 'hoe' }; }
  else if (tool === 'watering') { if (t) return { kind: 'water', anim: 'watering' }; }
  else if (tool.startsWith('seed_')) { if (t && !t.crop) return { kind: 'plant', anim: 'hoe', seed: tool.slice(5) }; }
  return null;
}

function doAction() {
  if (me.actionLock) return;
  const tool = ui.currentTool();
  const { tx, ty } = me.frontTile();
  const intent = getIntent(tool, tx, ty);
  if (!intent) return;
  me.startAction(intent.anim, () => {
    if (game.isHost) hostApply(intent, tx, ty);
    else net.send('act', { kind: intent.kind, tx, ty, seed: intent.seed });
  });
}

function hostApply(intent, tx, ty) {
  if (intent.kind === 'till') farm.till(tx, ty);
  else if (intent.kind === 'water') farm.water(tx, ty);
  else if (intent.kind === 'plant') farm.plant(tx, ty, intent.seed);
  else if (intent.kind === 'harvest') {
    const r = farm.harvest(tx, ty);
    const wx = tx * TILE + 8, wy = ty * TILE;
    if (r && r.coins) {
      game.coins += r.coins;
      const txt = `+${r.coins}🪙${r.label ? ' ' + r.label : ''}`;
      ui.addFloat(wx, wy, txt, '#ffe08a');
      net.broadcast('fx', { wx, wy, text: txt, color: '#ffe08a' });
    } else if (r && r.withered) {
      ui.addFloat(wx, wy, 'vissnat', '#c9a15a');
      net.broadcast('fx', { wx, wy, text: 'vissnat', color: '#c9a15a' });
    }
  }
  game.stateDirty = true;
}

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
  if (game.dayTime >= DAY_LENGTH) { game.dayTime -= DAY_LENGTH; if (game.isHost) game.day++; }

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
    ui.setCoins(game.coins); ui.setDay(game.day);
    if (net.mode) ui.setRoom(net.code || game.roomCode || '—', game.isHost ? net.playerCount : others.size + 1);
  }

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
    f: farm.serialize(), h: herd.serialize(),
    c: game.coins, d: game.day, t: Math.round(game.dayTime),
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
    } else {
      if (t === 'state') {
        farm.apply(d.f); herd.apply(d.h);
        game.coins = d.c; game.day = d.d; game.dayTime = d.t;
        ui.setCoins(d.c); ui.setDay(d.d);
      } else if (t === 'players') {
        for (const id in d) { if (id === net.myId) continue; ensurePlayer(id).applySnapshot(d[id]); }
        for (const id of [...others.keys()]) if (!(id in d)) others.delete(id);
      } else if (t === 'fx') ui.addFloat(d.wx, d.wy, d.text, d.color);
    }
  },
  peerOpen: (id) => { ensurePlayer(id); net.sendTo(id, 'state', stateMsg()); },
  peerLeave: (id) => { others.delete(id); ui.toast('En bonde lämnade gården'); },
  hostLost: () => { ui.toast('Tappade kontakten med värden'); backToMenu(); },
  netError: (e) => ui.setMenuStatus('Nätverksfel: ' + e),
});

function stateMsg() {
  return { f: farm.serialize(), h: herd.serialize(), c: game.coins, d: game.day, t: Math.round(game.dayTime) };
}

// ---------- game start / menu ----------
function newGame(isHost) {
  game.isHost = isHost;
  world = new World();
  farm = new Farm(world);
  herd = new Herd();
  me = new Player({ isLocal: true, name: game.myName, x: world.spawn.x, y: world.spawn.y });
  me.tool = ui.currentTool();
  others.clear();
  game.coins = 0; game.day = 1; game.dayTime = DAY_LENGTH * 0.25;
  if (isHost) herd.spawn(world.pasture);
  ui.setCoins(0); ui.setDay(1);
  ui.showMenu(false);
  game.running = true;
}

function backToMenu() {
  game.running = false;
  net.destroy();
  others.clear();
  game.roomCode = null;
  ui.setRoom(null);
  ui.showMenu(true);
  ui.setMenuStatus('');
}

function startSolo(name) { game.myName = name; ui.setRoom(null); newGame(true); ui.toast('Välkommen till din gård, ' + name + '!'); }

function startHost(name) {
  game.myName = name;
  ui.setMenuStatus('Skapar rum…');
  net.host((code) => {
    newGame(true);
    game.roomCode = code;
    ui.setRoom(code, 1);
    ui.toast('Rumskod: ' + code + ' — dela med familjen!');
  });
}

function startJoin(name, code) {
  game.myName = name;
  ui.setMenuStatus('Ansluter till ' + code + '…');
  net.join(code,
    () => { newGame(false); game.roomCode = code; ui.setRoom(code, 1); net.send('hello', { name }); ui.toast('Ansluten till ' + code + '!'); },
    (reason) => ui.setMenuStatus('Kunde inte ansluta (' + reason + '). Kolla koden och försök igen.')
  );
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
  });
  Input.init(canvas);
  ui.setMenuStatus('Laddar sprites…');
  try { await loadAssets(); } catch (e) { ui.setMenuStatus('Fel: ' + e.message); return; }
  ui.setMenuStatus('');
  $('menuButtons').classList.remove('hidden');
  requestAnimationFrame(frame);
}
boot();
