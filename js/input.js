// Touch (9:16):
//   LEFT  = floating joystick. Push it all the way forward and hold → sprint. Double-flick forward → instant sprint.
//   RIGHT = drag to look (smoothed, slight acceleration) · tap / swipe → shank · double tap → finisher (or heavy)
//           double swipe ← → ↓ ↑ → dash in that direction
//   Buttons: JUMP, DASH, INSPECT, FINISH
// Desktop: WASD + mouse · LMB shank · double-click/E finisher · RMB heavy · Space jump
//   Shift (hold) or double-tap W sprint · double-tap A/S/D or Q dash · Ctrl walk · F inspect
const SWIPE_MIN = 30, SWIPE_MAX_MS = 260, TAP_MAX = 16, DOUBLE_MS = 320, DOUBLE_SWIPE_MS = 480, LOOK_HOLD_MS = 70;
const LOOK_X = 0.0088, LOOK_Y = 0.0068;

export class Input {
  constructor(el, ui) {
    this.el = el; this.ui = ui; this.enabled = false; this.sens = 1;
    this.move = { x: 0, y: 0 }; this.walk = false; this.sprintHeld = false; this.keySprint = false; this.look = { x: 0, y: 0 }; this.lookAcc = { x: 0, y: 0 };
    this.events = []; this.keys = new Set(); this.touch = matchMedia('(pointer: coarse)').matches;
    this.joy = null; this.lookT = null; this.lastTap = 0; this.lastSwipe = { dir: null, t: 0 }; this.lastKey = {}; this.lastClick = 0;
    this.fwdHold = 0; this.lastJoyFlick = 0;
    el.addEventListener('touchstart', e => this.ts(e), { passive: false });
    el.addEventListener('touchmove', e => this.tm(e), { passive: false });
    el.addEventListener('touchend', e => this.te(e), { passive: false });
    el.addEventListener('touchcancel', e => this.te(e), { passive: false });
    el.addEventListener('mousedown', e => this.md(e));
    addEventListener('mousemove', e => { if (this.enabled && document.pointerLockElement === el) { this.look.x += e.movementX * 0.0022 * this.sens; this.look.y += e.movementY * 0.0022 * this.sens; } });
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
        this.joy = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: now, maxUp: 0, dbl: now - this.lastJoyFlick < 420 };
        this.ui.joy(this.joy, 0, 0);
      } else if (!this.lookT) {
        this.lookT = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now(), tl: performance.now(), held: { x: 0, y: 0 }, live: false };
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
        J.maxUp = Math.max(J.maxUp, J.y0 - t.clientY);
        if (J.dbl && J.y0 - t.clientY > 22 && performance.now() - J.t0 < 300) { J.dbl = false; this.emit('sprint'); }
        const k = d < 8 ? 0 : 1;
        this.move.x = dx / R * k; this.move.y = -dy / R * k; this.walk = d < R * 0.45;
        this.ui.joy(J, dx, dy, this.sprintHeld);
      } else if (this.lookT && t.identifier === this.lookT.id) {
        const L = this.lookT, now = performance.now();
        const px = t.clientX - L.x, py = t.clientY - L.y, dtm = Math.max(4, now - L.tl);
        const speed = Math.hypot(px, py) / dtm; // px per ms
        const gain = 1 + Math.min(0.9, Math.max(0, speed - 0.35) * 0.7); // flick faster → turn faster
        const dx = px * LOOK_X * this.sens * gain, dy = py * LOOK_Y * this.sens * gain;
        L.x = t.clientX; L.y = t.clientY; L.tl = now;
        if (!L.live && now - L.t0 > LOOK_HOLD_MS) { L.live = true; this.lookAcc.x += L.held.x; this.lookAcc.y += L.held.y; }
        if (L.live) { this.lookAcc.x += dx; this.lookAcc.y += dy; } else { L.held.x += dx; L.held.y += dy; }
      }
    }
  }
  te(e) {
    if (!this.enabled) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        const J = this.joy;
        // a short upward flick arms the double-flick sprint
        this.lastJoyFlick = performance.now() - J.t0 < 280 && J.maxUp > 16 ? performance.now() : 0;
        this.joy = null; this.move.x = this.move.y = 0; this.fwdHold = 0; this.sprintHeld = false; this.ui.joy(null);
      } else if (this.lookT && t.identifier === this.lookT.id) {
        const L = this.lookT, dt = performance.now() - L.t0, dx = t.clientX - L.x0, dy = t.clientY - L.y0, dist = Math.hypot(dx, dy);
        this.lookT = null;
        if (dt < SWIPE_MAX_MS && dist < TAP_MAX) this.tap();
        else if (dt < SWIPE_MAX_MS + 80 && dist >= SWIPE_MIN) {
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'forward' : 'back');
          this.swipe(dir);
        } else if (!L.live) { this.lookAcc.x += L.held.x; this.lookAcc.y += L.held.y; }
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
    if (this.lastSwipe.dir === dir && t - this.lastSwipe.t < DOUBLE_SWIPE_MS) { this.lastSwipe = { dir: null, t: 0 }; this.emit('dash', { dir }); }
    else { this.lastSwipe = { dir, t }; this.emit('attack', { swipe: dir }); }
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
    const t = performance.now(), map = { KeyA: 'left', KeyD: 'right', KeyS: 'back', KeyW: 'forward', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'back', ArrowUp: 'forward' };
    if (map[e.code]) {
      if (t - (this.lastKey[e.code] || 0) < 260) { this.lastKey[e.code] = 0; if (map[e.code] === 'forward') this.emit('sprint'); else this.emit('dash', { dir: map[e.code] }); }
      else this.lastKey[e.code] = t;
    }
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
