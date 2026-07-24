// LANTLIV — HUD, hotbar, bag & shop panels, menu, floating text, touch controls
import { ZOOM, CROPS, CROP_KEYS, PRODUCTS, GOODS, ANIMAL_SHOP, FODER_COST } from './config.js';
import { A, CHARACTERS } from './assets.js';

// hotbar: 3 tools + 2 panel buttons
export const HOTBAR = [
  { id: 'hoe',      icon: '⛏️', label: 'Hacka' },
  { id: 'watering', icon: '💧', label: 'Vattna' },
  { id: 'seed',     icon: '🌱', label: 'Frö', dynamic: true },
  { id: 'bag',      icon: '🎒', label: 'Väska', action: 'bag' },
  { id: 'shop',     icon: '🛒', label: 'Butik', action: 'shop' },
];

const $ = (id) => document.getElementById(id);

class UI {
  constructor() { this.floats = []; this.selected = 1; this.selectedChar = 'bunny'; }

  buildCharPicker() {
    const wrap = $('charPick');
    wrap.innerHTML = '';
    CHARACTERS.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'charOpt' + (i === 0 ? ' active' : '');
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
      const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
      const img = A[c.key + '_idle'];
      if (img) cx.drawImage(img, 0, 48, 48, 48, -4, -6, 52, 52);
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
    const bar = $('hotbar');
    HOTBAR.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'slot' + (t.action ? ' actionslot' : '');
      el.dataset.slot = i + 1;
      el.innerHTML = `<span class="num">${i + 1}</span><span class="ic">${t.icon}</span><span class="lb">${t.label}</span>`;
      el.addEventListener('click', () => {
        if (t.action) this.openPanel(t.action);
        else handlers.onSelectTool(i + 1);
      });
      bar.appendChild(el);
    });
    // menu
    $('btnSolo').addEventListener('click', () => handlers.onSolo(this._name()));
    $('btnHost').addEventListener('click', () => handlers.onHost(this._name()));
    $('btnJoinShow').addEventListener('click', () => { $('joinRow').classList.toggle('hidden'); $('codeInput').focus(); });
    $('btnJoin').addEventListener('click', () => {
      const code = $('codeInput').value.trim().toUpperCase();
      if (code.length === 4) handlers.onJoin(this._name(), code);
    });
    $('btnEditor').addEventListener('click', () => { location.href = 'editor.html'; });
    $('actionBtn').addEventListener('click', () => handlers.onAction());
    // panels
    $('bagClose').addEventListener('click', () => this.closePanels());
    $('shopClose').addEventListener('click', () => this.closePanels());
    $('sellAll').addEventListener('click', () => handlers.onSellAll());
    this.setTool(1);
  }

  _name() { return $('nameInput').value.trim() || 'Bonde'; }

  setTool(n) {
    const t = HOTBAR[n - 1];
    if (!t || t.action) { this.openPanel(t?.action); return; }
    this.selected = n;
    document.querySelectorAll('#hotbar .slot').forEach((el) => el.classList.toggle('active', +el.dataset.slot === n));
    $('actionLabel').textContent = t.label;
  }
  currentTool() { return HOTBAR[this.selected - 1].id; }

  // seed slot shows the active seed (emoji + name + count)
  setSeedSlot(crop, count) {
    const el = document.querySelector('#hotbar .slot[data-slot="3"]');
    if (!el) return;
    el.querySelector('.ic').textContent = crop.emoji;
    el.querySelector('.lb').textContent = crop.name;
    let badge = el.querySelector('.cnt');
    if (!badge) { badge = document.createElement('span'); badge.className = 'cnt'; el.appendChild(badge); }
    badge.textContent = '×' + count;
    if (this.selected === 3) $('actionLabel').textContent = crop.name;
  }
  setToolBySeed() { this.setTool(3); }

  // ---------- panels ----------
  openPanel(which) {
    if (!which) return;
    this.closePanels();
    if (which === 'bag') { $('bagPanel').classList.remove('hidden'); this.handlers.onOpenBag?.(); }
    if (which === 'shop') { $('shopPanel').classList.remove('hidden'); this.handlers.onOpenShop?.(); }
  }
  closePanels() { $('bagPanel').classList.add('hidden'); $('shopPanel').classList.add('hidden'); }

  updateBag(inv, activeSeed) {
    const sg = $('bagSeeds'); if (!sg) return;
    sg.innerHTML = '';
    const owned = CROP_KEYS.filter((k) => inv.seedCount(k) > 0);
    if (!owned.length) sg.innerHTML = '<div class="empty">Inga frön — köp i butiken 🛒</div>';
    for (const k of owned) {
      const c = CROPS[k];
      const el = document.createElement('div');
      el.className = 'invtile' + (k === activeSeed ? ' active' : '');
      el.innerHTML = `<span class="e">${c.emoji}</span><span class="c">×${inv.seedCount(k)}</span><span class="n">${c.name}</span>`;
      el.addEventListener('click', () => { this.handlers.onSelectSeed(k); this.closePanels(); });
      sg.appendChild(el);
    }
    const hg = $('bagHarvest'); hg.innerHTML = '';
    const held = CROP_KEYS.filter((k) => inv.harvestCount(k) > 0);
    if (!held.length) hg.innerHTML = '<div class="empty">Inget skördat än</div>';
    for (const k of held) {
      const c = CROPS[k];
      const el = document.createElement('div');
      el.className = 'invtile';
      el.innerHTML = `<span class="e">${c.emoji}</span><span class="c">×${inv.harvestCount(k)}</span><span class="n">${c.name}</span>`;
      hg.appendChild(el);
    }

    const pg = $('bagProducts'); if (pg) {
      pg.innerHTML = '';
      const tiles = [];
      if (inv.foder > 0) tiles.push({ e: '🌾', c: inv.foder, n: 'Foder' });
      for (const k in PRODUCTS) if (inv.productCount(k) > 0) tiles.push({ e: PRODUCTS[k].emoji, c: inv.productCount(k), n: PRODUCTS[k].name });
      for (const k in GOODS) if (inv.goodCount(k) > 0) tiles.push({ e: GOODS[k].emoji, c: inv.goodCount(k), n: GOODS[k].name });
      if (!tiles.length) pg.innerHTML = '<div class="empty">Inga produkter — mata djuren 🐔 eller förädla 🏭</div>';
      for (const t of tiles) {
        const el = document.createElement('div');
        el.className = 'invtile';
        el.innerHTML = `<span class="e">${t.e}</span><span class="c">×${t.c}</span><span class="n">${t.n}</span>`;
        pg.appendChild(el);
      }
    }
  }

  updateShop(inv) {
    $('shopCoins').textContent = inv.coins;
    const buy = $('shopBuy'); if (!buy) return;
    buy.innerHTML = '';
    for (const k of CROP_KEYS) {
      const c = CROPS[k];
      const el = document.createElement('div');
      el.className = 'shoptile' + (inv.coins < c.seed ? ' poor' : '');
      el.innerHTML = `<span class="e">${c.emoji}</span><span class="n">${c.name}</span><span class="p">🪙${c.seed}</span>`;
      el.addEventListener('click', () => this.handlers.onBuy(k));
      buy.appendChild(el);
    }
    // buy foder + baby animals
    const an = $('shopAnimals');
    if (an) {
      an.innerHTML = '';
      const foder = document.createElement('div');
      foder.className = 'shoptile' + (inv.coins < FODER_COST ? ' poor' : '');
      foder.innerHTML = `<span class="e">🌾</span><span class="n">Foder</span><span class="p">🪙${FODER_COST}</span>`;
      foder.addEventListener('click', () => this.handlers.onBuyFoder());
      an.appendChild(foder);
      for (const k in ANIMAL_SHOP) {
        const a = ANIMAL_SHOP[k];
        const el = document.createElement('div');
        el.className = 'shoptile' + (inv.coins < a.price ? ' poor' : '');
        el.innerHTML = `<span class="e">${a.emoji}</span><span class="n">${a.name}</span><span class="p">🪙${a.price}</span>`;
        el.addEventListener('click', () => this.handlers.onBuyAnimal(k));
        an.appendChild(el);
      }
    }

    const sell = $('shopSell'); sell.innerHTML = '';
    const held = CROP_KEYS.filter((k) => inv.harvestCount(k) > 0);
    const prods = Object.keys(PRODUCTS).filter((k) => inv.productCount(k) > 0);
    const goods = Object.keys(GOODS).filter((k) => inv.goodCount(k) > 0);
    if (!held.length && !prods.length && !goods.length) sell.innerHTML = '<div class="empty">Inget att sälja — skörda, mjölka eller förädla först!</div>';
    for (const k of held) {
      const c = CROPS[k];
      const el = document.createElement('div');
      el.className = 'shoptile sellable';
      el.innerHTML = `<span class="e">${c.emoji}</span><span class="n">${c.name} ×${inv.harvestCount(k)}</span><span class="p">🪙${c.price}</span>`;
      el.addEventListener('click', () => this.handlers.onSellOne(k));
      sell.appendChild(el);
    }
    for (const k of prods) {
      const c = PRODUCTS[k];
      const el = document.createElement('div');
      el.className = 'shoptile sellable';
      el.innerHTML = `<span class="e">${c.emoji}</span><span class="n">${c.name} ×${inv.productCount(k)}</span><span class="p">🪙${c.price}</span>`;
      el.addEventListener('click', () => this.handlers.onSellProduct(k));
      sell.appendChild(el);
    }
    for (const k of goods) {
      const c = GOODS[k];
      const el = document.createElement('div');
      el.className = 'shoptile sellable';
      el.innerHTML = `<span class="e">${c.emoji}</span><span class="n">${c.name} ×${inv.goodCount(k)}</span><span class="p">🪙${c.price}</span>`;
      el.addEventListener('click', () => this.handlers.onSellGood(k));
      sell.appendChild(el);
    }
  }

  setCoins(c) { $('coins').textContent = c; }
  setDay(d) { $('day').textContent = d; }

  setRoom(code, count) {
    const badge = $('roomBadge');
    if (!code) { badge.classList.add('hidden'); return; }
    badge.classList.remove('hidden');
    $('roomCode').textContent = code; $('roomCount').textContent = count;
  }

  toast(msg, ms = 2400) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), ms);
  }

  showMenu(show) { $('menu').classList.toggle('hidden', !show); }
  setMenuStatus(msg) { $('menuStatus').textContent = msg || ''; }

  addFloat(wx, wy, text, color = '#fff') { this.floats.push({ wx, wy, text, color, t: 0, ttl: 1.3 }); }

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
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = f.color;
      ctx.strokeText(f.text, sx, sy); ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    this.floats = this.floats.filter((f) => f.t < f.ttl);
  }
}

export const ui = new UI();
