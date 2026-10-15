// Touch (9:16) — kept deliberately simple so nothing fires by accident:
//   LEFT  = floating joystick (analog speed). Push it all the way forward and hold → sprint.
//   RIGHT = drag to look (always, immediately) · tap → shank · double tap → finisher (or heavy stab)
//   Buttons: DASH (the only way to dash), JUMP, INSPECT, FINISH
// Desktop: WASD + mouse · LMB shank · double-click/E finisher · RMB heavy · Space jump · Shift sprint · Q dash · Ctrl walk · F inspect
const TAP_MAX = 14, TAP_MS = 230, DOUBLE_MS = 320;
const LOOK_X = 0.0064, LOOK_Y = 0.005;

export class Input {
  constructor(el, ui) {
    this.el = el; this.ui = ui; this.enabled = false; this.sens = 1;
    this.move = { x: 0, y: 0 }; this.walk = false; this.sprintHeld = false; this.keySprint = false; this.look = { x: 0, y: 0 }; this.lookAcc = { x: 0, y: 0 };
    this.events = []; this.keys = new Set(); this.touch = matchMedia('(pointer: coarse)').matches;
    this.joy = null; this.lookT = null; this.lastTap = 0; this.lastClick = 0; this.fwdHold = 0;
    el.addEventListener('touchstart', e => this.ts(e), { passive: false });
    el.addEventListener('touchmove', e => this.tm(e), { passive: false });
    el.addEventListener('touchend', e => this.te(e), { passive: false });
    el.addEventListener('touchcancel', e => this.te(e), { passive: false });
    el.addEventListener('mousedown', e => this.md(e));
    addEventListener('mousemove', e => { if (this.enabled && document.pointerLockElement === el) { this.look.x += e.movementX * 0.0019 * this.sens; this.look.y += e.movementY * 0.0019 * this.sens; } });
    addEventListener('keydown', e => this.kd(e));
    addEventListener('keyup', e => { this.keys.delete(e.code); if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keySprint = false; });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  emit(type, data) { if (this.enabled) this.events.push({ type, ...data }); }
  drain() { const e = this.events; this.events = []; return e; }
  // Touch look is spread over a few frames so it feels smooth rather than steppy; mouse look stays raw.
  takeLook(dt = 1 / 60) {
    const k = 1 - Math.exp(-dt * 38);
    const out = { x: this.look.x + this.lookAcc.x * k, y: this.look.y + this.lookAcc.y * k };
    this.lookAcc.x *= 1 - k; this.lookAcc.y *= 1 - k; this.look.x = this.look.y = 0;
    return out;
  }
  reset() { this.move.x = this.move.y = 0; this.keys.clear(); this.joy = null; this.lookT = null; this.events = []; this.sprintHeld = this.keySprint = false; this.lookAcc.x = this.lookAcc.y = 0; this.fwdHold = 0; this.ui.joy(null); }

  // ---------- touch ----------
  ts(e) {
    if (!this.enabled) return; e.preventDefault(); this.touch = true;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.5 && t.clientY > innerHeight * 0.3 && !this.joy) {
        const now = performance.now();
        this.joy = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: now };
        this.ui.joy(this.joy, 0, 0);
      } else if (!this.lookT) {
        this.lookT = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now(), tl: performance.now(), moved: 0 };
      }
    }
  }
  tm(e) {
    if (!this.enabled) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        const J = this.joy;
        let dx = t.clientX - J.x, dy = t.clientY - J.y; const R = 58, d = Math.hypot(dx, dy);
        if (d > R) { J.x += dx * (1 - R / d); J.y += dy * (1 - R / d); dx *= R / d; dy *= R / d; }
        const k = d < 6 ? 0 : 1;
        this.move.x = dx / R * k; this.move.y = -dy / R * k; this.walk = false;
        this.ui.joy(J, dx, dy, this.sprintHeld);
      } else if (this.lookT && t.identifier === this.lookT.id) {
        const L = this.lookT, now = performance.now();
        const px = t.clientX - L.x, py = t.clientY - L.y, dtm = Math.max(4, now - L.tl);
        const speed = Math.hypot(px, py) / dtm; // px per ms
        const gain = 1 + Math.min(0.45, Math.max(0, speed - 0.6) * 0.4); // fast flicks turn a little further
        L.moved += Math.hypot(px, py);
        L.x = t.clientX; L.y = t.clientY; L.tl = now;
        this.lookAcc.x += px * LOOK_X * this.sens * gain; this.lookAcc.y += py * LOOK_Y * this.sens * gain;
      }
    }
  }
  te(e) {
    if (e.cancelable) e.preventDefault(); // always release fingers, even if the match paused mid-touch
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        this.joy = null; this.move.x = this.move.y = 0; this.fwdHold = 0; this.sprintHeld = false; this.ui.joy(null);
      } else if (this.lookT && t.identifier === this.lookT.id) {
        const L = this.lookT, dt = performance.now() - L.t0;
        this.lookT = null;
        if (dt < TAP_MS && L.moved < TAP_MAX && Math.hypot(t.clientX - L.x0, t.clientY - L.y0) < TAP_MAX) this.tap(); // a look drag never attacks
      }
    }
  }
  tap() {
    const t = performance.now();
    if (t - this.lastTap < DOUBLE_MS) { this.emit('double'); this.lastTap = 0; }
    else { this.emit('attack'); this.lastTap = t; }
  }
  // ---------- mouse / keys ----------
  md(e) {
    if (!this.enabled || (this.touch && e.sourceCapabilities?.firesTouchEvents)) return;
    if (document.pointerLockElement !== this.el) { this.el.requestPointerLock?.()?.catch?.(() => {}); return; }
    if (e.button === 2) { this.emit('heavy'); return; }
    if (e.button !== 0) return;
    const t = performance.now();
    if (t - this.lastClick < 280) { this.emit('double'); this.lastClick = 0; } else { this.emit('attack'); this.lastClick = t; }
  }
  kd(e) {
    if (!this.enabled || e.repeat) return;
    this.keys.add(e.code); this.touch = false;
    if (e.code === 'Space') { e.preventDefault(); this.emit('jump'); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keySprint = true;
    if (e.code === 'KeyQ') this.emit('dash', { dir: 'auto' });
    if (e.code === 'KeyF') this.emit('inspect');
    if (e.code === 'KeyE') this.emit('double');
  }
  update(dt = 1 / 60) {
    if (this.joy) {
      // push the stick fully forward and hold → sprint (CoD-mobile style)
      if (this.move.y > 0.88 && Math.abs(this.move.x) < 0.5) this.fwdHold += dt; else if (this.move.y < 0.6) this.fwdHold = 0;
      const was = this.sprintHeld; this.sprintHeld = this.fwdHold > 0.45;
      if (this.sprintHeld !== was) this.ui.joy(this.joy, this.move.x * 58, -this.move.y * 58, this.sprintHeld);
      return;
    }
    if (this.touch && !this.keys.size) { this.move.x = this.move.y = 0; this.sprintHeld = false; return; }
    const k = this.keys;
    this.move.x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    this.move.y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    this.walk = k.has('ControlLeft') || k.has('KeyC');
    this.sprintHeld = this.keySprint;
  }
}
