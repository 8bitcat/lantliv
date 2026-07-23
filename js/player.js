// LANTLIV — player entity (local + remote), movement, animation, tool actions
import { TILE, ZOOM, CHAR, PLAYER_SPEED, MAP_W, MAP_H } from './config.js';
import { A, CHAR_ANIM, DIR_ROW, drawChar } from './assets.js';

const HALF_W = 5, HALF_H = 4; // feet collision box (world px)

export class Player {
  constructor(opts = {}) {
    this.x = opts.x ?? (MAP_W / 2) * TILE;
    this.y = opts.y ?? (MAP_H / 2) * TILE;
    this.dir = 'down';
    this.act = 'idle';
    this.frame = 0;
    this.animTimer = 0;
    this.isLocal = !!opts.isLocal;
    this.name = opts.name || 'Bonde';
    this.tool = 'hoe';
    // action lock (one-shot tool animation)
    this.actionLock = false;
    this.onImpact = null;
    this.impactFired = false;
    // remote interpolation target
    this.netX = this.x; this.netY = this.y;
  }

  // tile the player stands on
  tile() { return { tx: Math.floor(this.x / TILE), ty: Math.floor(this.y / TILE) }; }

  // tile directly in front of the player (the interaction target)
  frontTile() {
    const { tx, ty } = this.tile();
    const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
    return { tx: tx + off[0], ty: ty + off[1] };
  }

  startAction(act, onImpact) {
    if (this.actionLock) return false;
    this.act = act; this.frame = 0; this.animTimer = 0;
    this.actionLock = true; this.onImpact = onImpact; this.impactFired = false;
    return true;
  }

  // LOCAL update: input-driven movement + animation
  update(dt, input, world) {
    const anim = CHAR_ANIM[this.act] || CHAR_ANIM.idle;

    if (this.actionLock) {
      // advance one-shot action animation
      this.animTimer += dt;
      const step = 1 / anim.fps;
      while (this.animTimer >= step) {
        this.animTimer -= step;
        this.frame++;
        const impactFrame = Math.floor(anim.frames * 0.55);
        if (this.frame >= impactFrame && !this.impactFired) {
          this.impactFired = true;
          this.onImpact?.();
        }
        if (this.frame >= anim.frames - 1) {
          this.actionLock = false; this.act = 'idle'; this.frame = 0; this.animTimer = 0;
          this.onImpact = null;
          return;
        }
      }
      return;
    }

    const v = input.moveVec();
    if (v.x || v.y) {
      if (Math.abs(v.x) > Math.abs(v.y)) this.dir = v.x < 0 ? 'left' : 'right';
      else this.dir = v.y < 0 ? 'up' : 'down';
      const nx = this.x + v.x * PLAYER_SPEED * dt;
      const ny = this.y + v.y * PLAYER_SPEED * dt;
      if (!world.collides(nx, this.y, HALF_W, HALF_H)) this.x = nx;
      if (!world.collides(this.x, ny, HALF_W, HALF_H)) this.y = ny;
      this.x = Math.max(TILE, Math.min((MAP_W - 1) * TILE, this.x));
      this.y = Math.max(TILE * 2, Math.min((MAP_H - 1) * TILE, this.y));
      this.act = 'run';
    } else {
      this.act = 'idle';
    }
    this._animate(dt, true);
  }

  // REMOTE update: interpolate toward last networked position, animate from net act
  updateRemote(dt) {
    this.x += (this.netX - this.x) * Math.min(1, dt * 12);
    this.y += (this.netY - this.y) * Math.min(1, dt * 12);
    this._animate(dt, true);
  }

  _animate(dt, loop) {
    const anim = CHAR_ANIM[this.act] || CHAR_ANIM.idle;
    this.animTimer += dt;
    const step = 1 / anim.fps;
    while (this.animTimer >= step) {
      this.animTimer -= step;
      this.frame = loop ? (this.frame + 1) % anim.frames : Math.min(this.frame + 1, anim.frames - 1);
    }
  }

  get sortY() { return this.y; }

  draw(ctx, cam) {
    const anim = CHAR_ANIM[this.act] || CHAR_ANIM.idle;
    const frame = Math.min(this.frame, anim.frames - 1);
    const row = DIR_ROW[this.dir] ?? 1;
    // shadow — ellipse centred under the feet (feet sit at this.y)
    if (A.shadow) {
      const sx = Math.round((this.x - 9 - cam.x) * ZOOM);
      const sy = Math.round((this.y - 4 - cam.y) * ZOOM);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(A.shadow, 0, 0, 16, 16, sx, sy, 18 * ZOOM, 8 * ZOOM);
      ctx.globalAlpha = 1;
    }
    // character — feet (sprite frame row 32) anchored at this.y
    const dx = Math.round((this.x - CHAR / 2 - cam.x) * ZOOM);
    const dy = Math.round((this.y - 32 - cam.y) * ZOOM);
    drawChar(ctx, anim.sheet, row, frame, dx, dy, CHAR * ZOOM);
    // name label above the head
    if (this.name) {
      ctx.font = `${Math.round(8 * ZOOM)}px monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.fillStyle = this.isLocal ? '#ffe08a' : '#cdeffd';
      const lx = Math.round((this.x - cam.x) * ZOOM);
      const ly = Math.round((this.y - 22 - cam.y) * ZOOM);
      ctx.strokeText(this.name, lx, ly);
      ctx.fillText(this.name, lx, ly);
      ctx.textAlign = 'left';
    }
  }

  // network snapshot (local -> others)
  snapshot() {
    return { x: Math.round(this.x), y: Math.round(this.y), d: this.dir, a: this.act, f: this.frame, n: this.name };
  }
  applySnapshot(s) {
    this.netX = s.x; this.netY = s.y; this.dir = s.d; this.act = s.a; this.frame = s.f; this.name = s.n;
  }
}
