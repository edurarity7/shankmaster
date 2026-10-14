// Touch: left thumb = floating joystick, right thumb = look (drag) + gestures.
//   tap / swipe → shank · double tap → finisher (or heavy stab)
//   double swipe left/right/back → dash · double swipe forward → sprint
// Desktop: WASD + mouse, LMB shank, double-click finisher, RMB heavy, double-tap A/D/S dash, double-tap W sprint, Space dash, Shift walk, F inspect.
const SWIPE_MIN = 34, SWIPE_MAX_MS = 230, TAP_MAX = 14, DOUBLE_MS = 320, DOUBLE_SWIPE_MS = 450, LOOK_HOLD_MS = 120;

export class Input {
  constructor(el, ui) {
    this.el = el; this.ui = ui; this.enabled = false; this.sens = 1;
    this.move = { x: 0, y: 0 }; this.walk = false; this.look = { x: 0, y: 0 };
    this.events = []; this.keys = new Set(); this.touch = matchMedia('(pointer: coarse)').matches;
    this.joy = null; this.lookT = null; this.lastTap = 0; this.lastSwipe = { dir: null, t: 0 }; this.lastKey = {}; this.lastClick = 0;
    el.addEventListener('touchstart', e => this.ts(e), { passive: false });
    el.addEventListener('touchmove', e => this.tm(e), { passive: false });
    el.addEventListener('touchend', e => this.te(e), { passive: false });
    el.addEventListener('touchcancel', e => this.te(e), { passive: false });
    el.addEventListener('mousedown', e => this.md(e));
    addEventListener('mousemove', e => { if (this.enabled && document.pointerLockElement === el) { this.look.x += e.movementX * 0.0022 * this.sens; this.look.y += e.movementY * 0.0022 * this.sens; } });
    addEventListener('keydown', e => this.kd(e)); addEventListener('keyup', e => this.keys.delete(e.code));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  emit(type, data) { if (this.enabled) this.events.push({ type, ...data }); }
  drain() { const e = this.events; this.events = []; return e; }
  takeLook() { const l = { ...this.look }; this.look.x = this.look.y = 0; return l; }
  reset() { this.move.x = this.move.y = 0; this.keys.clear(); this.joy = null; this.lookT = null; this.events = []; this.ui.joy(null); }

  // ---------- touch ----------
  ts(e) {
    if (!this.enabled) return; e.preventDefault(); this.touch = true;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && !this.joy) {
        this.joy = { id: t.identifier, x: t.clientX, y: t.clientY }; this.ui.joy(this.joy, 0, 0);
      } else if (!this.lookT) {
        this.lookT = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now(), held: { x: 0, y: 0 }, live: false };
      }
    }
  }
  tm(e) {
    if (!this.enabled) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.x, dy = t.clientY - this.joy.y; const R = 62, d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        this.move.x = dx / R; this.move.y = -dy / R; this.walk = d < R * 0.55;
        this.ui.joy(this.joy, dx, dy);
      } else if (this.lookT && t.identifier === this.lookT.id) {
        const L = this.lookT, dx = (t.clientX - L.x) * 0.0052 * this.sens, dy = (t.clientY - L.y) * 0.0042 * this.sens;
        L.x = t.clientX; L.y = t.clientY;
        // Hold look input briefly so a quick flick reads as a swipe instead of spinning the camera.
        if (!L.live && performance.now() - L.t0 > LOOK_HOLD_MS) { L.live = true; this.look.x += L.held.x; this.look.y += L.held.y; }
        if (L.live) { this.look.x += dx; this.look.y += dy; } else { L.held.x += dx; L.held.y += dy; }
      }
    }
  }
  te(e) {
    if (!this.enabled) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.move.x = this.move.y = 0; this.ui.joy(null); }
      else if (this.lookT && t.identifier === this.lookT.id) {
        const L = this.lookT, dt = performance.now() - L.t0, dx = t.clientX - L.x0, dy = t.clientY - L.y0, dist = Math.hypot(dx, dy);
        this.lookT = null;
        if (dt < SWIPE_MAX_MS && dist < TAP_MAX) this.tap();
        else if (dt < SWIPE_MAX_MS + 60 && dist >= SWIPE_MIN) {
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'forward' : 'back');
          this.swipe(dir);
        } else if (!L.live) { this.look.x += L.held.x; this.look.y += L.held.y; }
      }
    }
  }
  tap() {
    const t = performance.now();
    if (t - this.lastTap < DOUBLE_MS) { this.emit('double'); this.lastTap = 0; }
    else { this.emit('attack'); this.lastTap = t; }
  }
  swipe(dir) {
    const t = performance.now();
    if (this.lastSwipe.dir === dir && t - this.lastSwipe.t < DOUBLE_SWIPE_MS) {
      this.lastSwipe = { dir: null, t: 0 };
      if (dir === 'forward') this.emit('sprint'); else this.emit('dash', { dir });
    } else { this.lastSwipe = { dir, t }; this.emit('attack', { swipe: dir }); }
  }

  // ---------- mouse / keys ----------
  md(e) {
    if (!this.enabled) return;
    if (document.pointerLockElement !== this.el) { this.el.requestPointerLock?.()?.catch?.(() => {}); return; }
    if (e.button === 2) { this.emit('heavy'); return; }
    if (e.button !== 0) return;
    const t = performance.now();
    if (t - this.lastClick < 280) { this.emit('double'); this.lastClick = 0; } else { this.emit('attack'); this.lastClick = t; }
  }
  kd(e) {
    if (!this.enabled) return;
    if (e.repeat) return;
    this.keys.add(e.code);
    const t = performance.now(), map = { KeyA: 'left', KeyD: 'right', KeyS: 'back', KeyW: 'forward', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'back', ArrowUp: 'forward' };
    if (map[e.code]) {
      if (t - (this.lastKey[e.code] || 0) < 260) { this.lastKey[e.code] = 0; if (map[e.code] === 'forward') this.emit('sprint'); else this.emit('dash', { dir: map[e.code] }); }
      else this.lastKey[e.code] = t;
    }
    if (e.code === 'Space') { e.preventDefault(); const dir = this.keys.has('KeyA') ? 'left' : this.keys.has('KeyD') ? 'right' : 'back'; this.emit('dash', { dir }); }
    if (e.code === 'KeyF') this.emit('inspect');
    if (e.code === 'KeyE') this.emit('double');
  }
  update() {
    if (this.joy || this.touch && !this.keys.size) { if (!this.joy) { this.move.x = this.move.y = 0; } return; }
    const k = this.keys;
    this.move.x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    this.move.y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.walk = k.has('ShiftLeft') || k.has('ShiftRight');
  }
}
