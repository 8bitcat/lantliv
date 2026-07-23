// LANTLIV — unified input: keyboard (desktop) + virtual joystick / buttons (mobile)

class InputManager {
  constructor() {
    this.keys = new Set();
    this._action = false;      // edge-triggered action queue
    this._tool = null;         // queued tool-slot select (1-6) or null
    // touch joystick
    this.joyId = null;
    this.joyBase = { x: 0, y: 0 };
    this.joyVec = { x: 0, y: 0 };
    this.joyActive = false;
  }

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === ' ' || k === 'e' || k === 'enter') { this._action = true; e.preventDefault(); }
      if (k >= '1' && k <= '6') this._tool = parseInt(k, 10);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    // Floating joystick on the left half of the canvas (touch/pointer)
    const half = () => canvas.clientWidth / 2;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.clientX < half() && this.joyId === null) {
        this.joyId = e.pointerId;
        this.joyBase = { x: e.clientX, y: e.clientY };
        this.joyVec = { x: 0, y: 0 };
        this.joyActive = true;
        canvas.setPointerCapture?.(e.pointerId);
      } else if (e.clientX >= half()) {
        this._action = true; // tap right half = action
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyId) return;
      const dx = e.clientX - this.joyBase.x;
      const dy = e.clientY - this.joyBase.y;
      const max = 46;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, max);
      this.joyVec = { x: (dx / len) * (cl / max), y: (dy / len) * (cl / max) };
    });
    const end = (e) => {
      if (e.pointerId === this.joyId) { this.joyId = null; this.joyActive = false; this.joyVec = { x: 0, y: 0 }; }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // movement vector, magnitude <= 1
  moveVec() {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    if (this.joyActive && (Math.abs(this.joyVec.x) > 0.2 || Math.abs(this.joyVec.y) > 0.2)) {
      return { x: this.joyVec.x, y: this.joyVec.y };
    }
    return { x: 0, y: 0 };
  }

  takeAction() { const a = this._action; this._action = false; return a; }
  takeTool() { const t = this._tool; this._tool = null; return t; }

  // called by on-screen DOM buttons
  pressAction() { this._action = true; }
  selectTool(n) { this._tool = n; }
}

export const Input = new InputManager();
