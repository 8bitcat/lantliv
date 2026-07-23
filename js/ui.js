// LANTLIV — HUD, hotbar, menu, floating text, on-screen touch controls
import { ZOOM } from './config.js';
import { A, CHARACTERS } from './assets.js';

export const HOTBAR = [
  { id: 'hoe',                icon: '⛏️', label: 'Hacka' },
  { id: 'watering',           icon: '💧', label: 'Vattna' },
  { id: 'seed_carrot',        icon: '🥕', label: 'Morot' },
  { id: 'seed_cauliflower',   icon: '🥦', label: 'Blomkål' },
  { id: 'seed_pumpkin',       icon: '🎃', label: 'Pumpa' },
  { id: 'seed_strawberry',    icon: '🍓', label: 'Jordgubbe' },
];

const $ = (id) => document.getElementById(id);

class UI {
  constructor() { this.floats = []; this.selected = 1; this.selectedChar = 'bunny'; }

  // built after assets load so we can draw each character's sprite thumbnail
  buildCharPicker() {
    const wrap = $('charPick');
    wrap.innerHTML = '';
    CHARACTERS.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'charOpt' + (i === 0 ? ' active' : '');
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
      const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
      const img = A[c.key + '_idle'];
      if (img) cx.drawImage(img, 0, 48, 48, 48, -4, -6, 52, 52); // down-facing frame 0, cropped a bit
      const lb = document.createElement('div'); lb.className = 'cl'; lb.textContent = c.label;
      el.appendChild(cv); el.appendChild(lb);
      el.addEventListener('click', () => {
        this.selectedChar = c.key;
        document.querySelectorAll('#charPick .charOpt').forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
      });
      wrap.appendChild(el);
    });
  }

  build(handlers) {
    this.handlers = handlers;
    // hotbar slots
    const bar = $('hotbar');
    HOTBAR.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.slot = i + 1;
      el.innerHTML = `<span class="num">${i + 1}</span><span class="ic">${t.icon}</span><span class="lb">${t.label}</span>`;
      el.addEventListener('click', () => handlers.onSelectTool(i + 1));
      bar.appendChild(el);
    });
    // menu buttons
    $('btnSolo').addEventListener('click', () => handlers.onSolo(this._name()));
    $('btnHost').addEventListener('click', () => handlers.onHost(this._name()));
    $('btnJoinShow').addEventListener('click', () => { $('joinRow').classList.toggle('hidden'); $('codeInput').focus(); });
    $('btnJoin').addEventListener('click', () => {
      const code = $('codeInput').value.trim().toUpperCase();
      if (code.length === 4) handlers.onJoin(this._name(), code);
    });
    $('btnEditor').addEventListener('click', () => { location.href = 'editor.html'; });
    // action button (touch)
    $('actionBtn').addEventListener('click', () => handlers.onAction());
    this.setTool(1);
  }

  _name() {
    const n = $('nameInput').value.trim();
    return n || 'Bonde';
  }

  setTool(n) {
    this.selected = n;
    document.querySelectorAll('#hotbar .slot').forEach((el) => {
      el.classList.toggle('active', +el.dataset.slot === n);
    });
    const t = HOTBAR[n - 1];
    $('actionLabel').textContent = t.label;
  }

  currentTool() { return HOTBAR[this.selected - 1].id; }

  setCoins(c) { $('coins').textContent = c; }
  setDay(d) { $('day').textContent = d; }

  setRoom(code, count) {
    const badge = $('roomBadge');
    if (!code) { badge.classList.add('hidden'); return; }
    badge.classList.remove('hidden');
    $('roomCode').textContent = code;
    $('roomCount').textContent = count;
  }

  toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), ms);
  }

  showMenu(show) { $('menu').classList.toggle('hidden', !show); }
  setMenuStatus(msg) { $('menuStatus').textContent = msg || ''; }

  addFloat(wx, wy, text, color = '#fff') {
    this.floats.push({ wx, wy, text, color, t: 0, ttl: 1.3 });
  }

  drawFloats(ctx, cam, dt) {
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(9 * ZOOM)}px monospace`;
    ctx.lineWidth = 3;
    for (const f of this.floats) {
      f.t += dt;
      const a = Math.max(0, 1 - f.t / f.ttl);
      const sx = Math.round((f.wx - cam.x) * ZOOM);
      const sy = Math.round((f.wy - cam.y) * ZOOM) - f.t * 40;
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.fillStyle = f.color;
      ctx.strokeText(f.text, sx, sy);
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    this.floats = this.floats.filter((f) => f.t < f.ttl);
  }
}

export const ui = new UI();
