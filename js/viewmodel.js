// First-person arm + knife, rendered in its own scene on top of the world (like CS viewmodels).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildKnife, setKnifeBlood } from './knives.js';
import * as A from './audio.js';
import { toon, outfitLook, outlineMat } from './characters.js';

// Keyframes: [time 0..1, pos[x,y,z], rot[x,y,z]] for the arm pivot (right shoulder-ish, in camera space).
const REST = { p: [0.2, -0.22, -0.36], r: [0.05, 0.12, 0.0] };
const K = {
  slash1: [ // right → left
    [0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
    [0.22, [0.34, -0.06, -0.3], [0.5, 0.9, -0.9]],
    [0.45, [0.05, -0.2, -0.42], [0.1, -0.3, 0.6]],
    [0.62, [-0.24, -0.3, -0.34], [-0.2, -1.1, 1.3]],
    [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
  ],
  slash2: [ // left → right (backhand)
    [0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
    [0.22, [-0.14, -0.06, -0.3], [0.5, -0.8, 1.2]],
    [0.45, [0.06, -0.18, -0.44], [0.2, 0.2, -0.4]],
    [0.62, [0.36, -0.3, -0.32], [-0.1, 1.0, -1.4]],
    [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
  ],
  stab: [
    [0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
    [0.3, [0.22, -0.2, -0.18], [-0.3, 0.2, 0.2]],
    [0.48, [0.06, -0.12, -0.62], [0.12, 0.05, 0.0]],
    [0.62, [0.06, -0.12, -0.6], [0.16, 0.05, 0.3]],
    [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
  ],
  heavy: [
    [0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
    [0.4, [0.26, 0.02, -0.12], [1.3, 0.3, 0.2]],
    [0.55, [0.05, -0.16, -0.6], [-0.4, 0.0, 0.1]],
    [0.7, [0.05, -0.18, -0.58], [-0.45, 0.0, 0.1]],
    [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
  ],
  inspect: [[0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]], [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]]],
  draw: [
    [0, [0.3, -0.6, -0.2], [1.2, 0.5, 0.5]],
    [0.6, [0.18, -0.2, -0.36], [-0.2, 0.2, -0.3]],
    [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
  ],
};
// Finisher styles: chained slashes
const FIN = {
  stitch: ['slash1', 'slash2', 'stab'],
  spin: ['spin', 'stab'],
  gut: ['stab', 'twist', 'slash1'],
  bread: ['slash1', 'slash2', 'slash1', 'slash2', 'slash1', 'stab'],
};
K.spin = [[0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]], [0.5, [0.3, -0.1, -0.4], [0.3, 1.5, -1.5]], [1, [-0.3, -0.25, -0.35], [-0.2, -1.4, 1.5]]];
K.twist = [[0, [0.06, -0.12, -0.6], [0.12, 0.05, 0]], [0.5, [0.06, -0.12, -0.6], [0.12, 0.05, 1.6]], [1, [0.06, -0.14, -0.55], [0.12, 0.05, -0.4]]];

function sample(keys, t) {
  t = Math.max(0, Math.min(1, t));
  let i = 1; while (i < keys.length - 1 && keys[i][0] < t) i++;
  const [t0, p0, r0] = keys[i - 1], [t1, p1, r1] = keys[i];
  let k = (t - t0) / (t1 - t0 || 1); k = k * k * (3 - 2 * k);
  return { p: p0.map((v, j) => v + (p1[j] - v) * k), r: r0.map((v, j) => v + (r1[j] - v) * k) };
}

// ---------- hand rig helpers ----------
const thinInk = outlineMat.clone(); thinInk.uniforms = { thickness: { value: 0.0022 }, color: { value: new THREE.Color(0x0a0f2e) } };
function ink(geo, mat, parent, pos = [0, 0, 0], rot, scale) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); if (scale) m.scale.set(...scale);
  const o = new THREE.Mesh(geo, thinInk); m.add(o); parent.add(m); return m;
}
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (t, a, b) => Math.sin(Math.PI * seg(t, a, b));
const ease = x => x * x * (3 - 2 * x);
const backEase = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
// Handle half-thickness per knife: the fingers wrap a circle just outside it.
const HANDLE_R = { shank: 0.0145, karambit: 0.016, talon: 0.018, butterfly: 0.0125, bayonet: 0.0135, huntsman: 0.0175, skeleton: 0.0125, flip: 0.0145 };
const FINGERS = [ // index → pinky: x along the handle, length scale
  { x: 0.033, k: 1.0, spread: -0.12 }, { x: 0.011, k: 1.08, spread: -0.04 }, { x: -0.011, k: 1.0, spread: 0.04 }, { x: -0.032, k: 0.82, spread: 0.12 },
];
const SEG_L = [0.03, 0.022, 0.018], SEG_R = [0.0098, 0.0092, 0.0086];
const OPEN = [0.28, -0.16, -0.1];

export class ViewModel {
  constructor(aspect) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x30304a, 1.5));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.4); key.position.set(1, 2, 1); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fa8ff, 1.6); rim.position.set(-2, 0.5, -1); this.scene.add(rim);
    this.hitLight = new THREE.PointLight(0xff0000, 0, 2); this.hitLight.position.set(0, 0, -0.4); this.scene.add(this.hitLight);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    this.anim = null; this.bob = 0; this.sway = { x: 0, y: 0 }; this.blood = 0; this.dashTilt = 0; this.airK = 0; this.time = 0;
    this.curl = [1, 1, 1, 1]; this.thumb = 1; this.flick = 0; this.wrist = new THREE.Euler();
  }
  setEnv(env) { this.scene.environment = env; }
  setLoadout(outfit, item) {
    this.pivot.clear();
    const L = outfitLook(outfit), top = L.top, gl = L.gloves, puff = top.kind === 'puffer';
    const arm = new THREE.Group(); this.pivot.add(arm);
    const shiny = top.shiny ? { emissive: 0x1a1000, rim: 2, metal: 0.85, rough: 0.28 } : { rough: puff ? 0.3 : 0.6, bump: !puff };
    const handC = gl.kind === 'glove' ? gl.c : L.skin;
    const hm = toon(handC, gl.shiny ? { emissive: 0x1a1000, rim: 2, metal: 0.85, rough: 0.25 } : gl.kind === 'glove' ? { rough: 0.55, bump: true } : { rough: 0.55 });
    const nailM = toon(new THREE.Color(handC).lerp(new THREE.Color(0xffe6dc), 0.3).getHex(), { rough: 0.3 });

    // grip frame H: the handle runs along X through the origin (blade +X, edge -Y), palm sits behind it (+Z)
    const R = (HANDLE_R[item.knife] || 0.014) + 0.0112, phi0 = 0.9;
    const Ky = R * Math.sin(phi0), Kz = R * Math.cos(phi0);
    this.gripR = R; this.phi0 = phi0;
    const X = new THREE.Vector3(-0.22, 0.42, -0.88).normalize();
    const Y = new THREE.Vector3(0.15, 1, 0.35); Y.addScaledVector(X, -Y.dot(X)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    this.baseQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const PX = new THREE.Vector3(-0.9, 0.3, -0.28).normalize(), PY = new THREE.Vector3(0.1, 1, -0.15); PY.addScaledVector(PX, -PY.dot(PX)).normalize();
    this.presentQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(PX, PY, new THREE.Vector3().crossVectors(PX, PY)));
    this.present = 0;
    const w = new THREE.Vector3(0, Ky - 0.082, Kz + 0.006); // wrist, in the grip frame
    const wristPos = new THREE.Vector3(-0.01, 0, 0).add(w.clone().applyQuaternion(this.baseQ));

    // forearm + sleeve, coming in from the bottom-right of the screen
    const dir = new THREE.Vector3(0.24, -0.8, 0.55).normalize();
    const fore = new THREE.Group(); fore.position.copy(wristPos); fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); arm.add(fore);
    ink(new THREE.CapsuleGeometry(0.026, 0.06, 6, 14), hm, fore, [0, 0.04, 0]);
    ink(new THREE.SphereGeometry(0.03, 16, 12), hm, fore, [0, 0.0, 0], null, [1.15, 0.8, 0.9]);
    const sl = toon(top.c, shiny);
    ink(new THREE.CapsuleGeometry(puff ? 0.056 : 0.046, 0.3, 8, 18), sl, fore, [0, 0.24, 0]);
    if (puff) [0.14, 0.24, 0.34].forEach(y => ink(new THREE.TorusGeometry(0.054, 0.011, 8, 22), sl, fore, [0, y, 0], [Math.PI / 2, 0, 0]));
    if (top.kind === 'track') ink(new THREE.BoxGeometry(0.01, 0.3, 0.01), toon(top.a), fore, [0.047, 0.24, 0]);
    ink(new THREE.TorusGeometry(puff ? 0.052 : 0.044, 0.014, 8, 20), toon(top.a ?? top.c, { rough: 0.6 }), fore, [0, 0.085, 0], [Math.PI / 2, 0, 0]);
    if (gl.kind === 'glove' && gl.a) ink(new THREE.TorusGeometry(0.03, 0.008, 6, 18), toon(gl.a), fore, [0, 0.03, 0], [Math.PI / 2, 0, 0]);
    if (gl.kind === 'wraps') [0.015, 0.045].forEach(y => ink(new THREE.TorusGeometry(0.029, 0.006, 6, 18), toon(gl.c), fore, [0, y, 0], [Math.PI / 2, 0, 0]));

    // wrist joint → hand
    const wristG = this.wristG = new THREE.Group(); wristG.position.copy(wristPos); wristG.quaternion.copy(this.baseQ); arm.add(wristG);
    const handG = this.handG = new THREE.Group(); handG.position.copy(w).negate(); wristG.add(handG);
    // palm + back of the hand + heel
    ink(new RoundedBoxGeometry(0.09, 0.084, 0.03, 4, 0.013), hm, handG, [0, Ky - 0.036, Kz + 0.009]);
    ink(new THREE.SphereGeometry(0.03, 16, 12), hm, handG, [0.026, Ky - 0.06, Kz + 0.01], null, [1, 1.1, 0.75]); // thumb pad
    ink(new THREE.SphereGeometry(0.028, 16, 12), hm, handG, [-0.03, Ky - 0.064, Kz + 0.012], null, [1, 0.9, 0.7]); // heel
    if (gl.kind === 'wraps') ink(new RoundedBoxGeometry(0.092, 0.03, 0.032, 3, 0.01), toon(gl.c), handG, [0, Ky - 0.012, Kz + 0.009]);
    // fingers: knuckle → proximal → middle → distal, each joint a pivot
    this.fingers = FINGERS.map(f => {
      const root = new THREE.Group(); root.position.set(f.x, Ky, Kz); root.rotation.order = 'YXZ'; handG.add(root);
      ink(new THREE.SphereGeometry(SEG_R[0] * 1.08, 12, 10), hm, root); // knuckle
      const joints = []; let parent = root;
      SEG_L.forEach((l, i) => {
        const j = new THREE.Group(); if (i > 0) j.position.z = -SEG_L[i - 1] * f.k; parent.add(j);
        const len = l * f.k;
        ink(new THREE.CapsuleGeometry(SEG_R[i], len - SEG_R[i] * 1.2, 4, 10), hm, j, [0, 0, -len / 2], [Math.PI / 2, 0, 0]);
        if (i === 2 && gl.kind !== 'glove') ink(new THREE.SphereGeometry(1, 10, 8), nailM, j, [0, SEG_R[i] * 0.78, -len * 0.62], null, [0.0068, 0.0028, 0.0085]);
        joints.push(j); parent = j;
      });
      // grip pose: chain wrapped around the handle circle
      const d = SEG_L.map(l => 2 * Math.asin(Math.min(0.98, l * f.k / (2 * R))));
      const grip = [Math.PI - (phi0 + d[0] / 2 + Math.PI / 2), -(d[0] + d[1]) / 2 - 0.12, -(d[1] + d[2]) / 2 - 0.55]; // tips tuck back toward the palm
      return { root, joints, grip, spread: f.spread };
    });
    // thumb
    const tr = this.thumbRoot = new THREE.Group(); tr.position.set(0.043, Ky - 0.036, Kz + 0.002); tr.rotation.order = 'YXZ'; handG.add(tr);
    ink(new THREE.CapsuleGeometry(0.0115, 0.022, 4, 10), hm, tr, [0, 0, -0.016], [Math.PI / 2, 0, 0]);
    const tj = this.thumbTip = new THREE.Group(); tj.position.z = -0.032; tr.add(tj);
    ink(new THREE.CapsuleGeometry(0.0104, 0.017, 4, 10), hm, tj, [0, 0, -0.013], [Math.PI / 2, 0, 0]);
    if (gl.kind !== 'glove') ink(new THREE.SphereGeometry(1, 10, 8), nailM, tj, [0, 0.0085, -0.018], null, [0.0075, 0.003, 0.009]);

    // knife sits in the grip frame
    if (this.knife) this.knife.parent?.remove(this.knife);
    this.knife = buildKnife(item, { hi: true });
    handG.add(this.knife);
    this.arm = arm; this.item = item; this.blood = 0; setKnifeBlood(this.knife, 0);
    this.curl = [0, 0, 0, 0]; this.thumb = 0;
    this.play('draw', 0.75);
  }
  play(name, dur, onHit, hitAt = 0.45) {
    if (name === 'inspect' && this.anim) return; // don't restart / don't interrupt attacks
    this.anim = { name, t: 0, dur, onHit, hitAt, fired: false };
  }
  cancel() { if (this.anim && this.anim.name !== 'fin') this.anim = null; } // the knife and hand blend back on their own
  setTrak(n) { this.knife.userData.setTrak?.(n); }
  playFinisher(style, dur, onHit, hits) {
    const seq = FIN[style] || FIN.stitch;
    this.anim = { name: 'fin', seq, t: 0, dur, onHit, hits, fired: 0 };
  }
  get busy() { return !!this.anim && this.anim.name !== 'inspect'; }
  addBlood(a = 0.25) { this.blood = Math.min(1, this.blood + a); setKnifeBlood(this.knife, this.blood); }
  flashHit() { this.hitLight.color.setHex(0xff0000); this.hitLight.intensity = 6; }
  flashColor(c) { this.hitLight.color.setHex(c); this.hitLight.intensity = 5; }

  // ---------- choreography ----------
  // Returns everything the hand + knife should be doing right now. Tricks never spin the knife inside a closed
  // fist: the fingers open, the knife is tossed clear of the hand (or held out in front for ring spins),
  // and the fingers snap shut on the catch — like CS inspects.
  choreo() {
    const a = this.anim, T = this.time, type = this.item.knife, Q = new THREE.Quaternion(), E = new THREE.Euler();
    const out = { curl: [1, 1, 1, 1], thumb: 1, flick: 0, w: [Math.sin(T * 1.3) * 0.03, 0, Math.sin(T * 0.9) * 0.02], kp: new THREE.Vector3(), kq: Q, rig: { bite: 0, safe: 0, flip: 0 }, sounds: [], live: false };
    const ph = T % 4.2; // idle: a little pinky→index re-grip every few seconds
    if (ph < 0.6) out.curl = out.curl.map((c, i) => c - 0.2 * bump(ph, 0.05 + (3 - i) * 0.08, 0.3 + (3 - i) * 0.08));
    if (!a) return out;
    const t = Math.min(1, a.t);
    const toss = (s, height, axis, turns, pivot) => { // knife in the air, clear of the fingers
      const k = Math.sin(Math.PI * s);
      out.kp.set(0, height * k, -0.04 * k);
      E.set(axis === 'x' ? turns * 2 * Math.PI * ease(s) : 0, 0, axis === 'z' ? turns * 2 * Math.PI * ease(s) : 0); Q.setFromEuler(E);
      if (pivot) out.kp.add(pivot.clone().sub(pivot.clone().applyQuaternion(Q)));
    };
    const release = (o) => { out.curl = out.curl.map((c, i) => Math.min(c, 1 - 0.95 * o + 0.05 * i * o)); out.thumb = Math.min(out.thumb, 1 - 0.8 * o); };
    const catchSnap = (t0) => { out.curl = out.curl.map((c, i) => c + 0.14 * bump(t, t0 + (3 - i) * 0.01, t0 + 0.07 + (3 - i) * 0.01)); out.w[0] += 0.22 * bump(t, t0, t0 + 0.1); };
    if (a.name === 'draw') {
      out.live = true;
      out.curl = out.curl.map((_, i) => ease(seg(t, 0.15 + (3 - i) * 0.07, 0.45 + (3 - i) * 0.07)));
      out.thumb = ease(seg(t, 0.3, 0.7)); out.w[1] = -0.8 * bump(t, 0, 0.8); out.w[0] -= 0.35 * bump(t, 0, 0.6);
      if (type === 'flip') { out.rig.flip = Math.PI * 0.97 * (1 - backEase(seg(t, 0.35, 0.62))); out.flick = 1.1 * bump(t, 0.35, 0.65); }
      if (type === 'butterfly') { const o = 1 - backEase(seg(t, 0.2, 0.62)); out.rig.bite = o * Math.PI; out.rig.safe = -o * Math.PI; }
      return out;
    }
    if (a.name !== 'inspect') {
      if (a.name === 'stab' || a.name === 'heavy') { out.curl = out.curl.map(() => 1.12); out.w[0] -= 0.35 * bump(t, 0.25, 0.7); }
      else if (a.name === 'slash1' || a.name === 'slash2' || a.name === 'fin') { out.curl = out.curl.map(() => 1.1); const d = a.name === 'slash2' ? -1 : 1; out.w[2] += 0.45 * d * (bump(t, 0.15, 0.4) - bump(t, 0.4, 0.75)); }
      return out;
    }
    out.live = true;
    const ev = (...ts) => ts.forEach(([tt, kind]) => out.sounds.push([tt, kind]));
    if (type === 'butterfly') {
      // in hand: show it · toss 1: rolls with the handles flapping · catch · toss 2: end-over-end · catch
      const s1 = seg(t, 0.15, 0.42), s2 = seg(t, 0.55, 0.83);
      if (s1 > 0 && s1 < 1) toss(s1, 0.1, 'x', 1);
      if (s2 > 0 && s2 < 1) toss(s2, 0.14, 'z', -1);
      out.rig.bite = 2 * Math.PI * (ease(s1) + ease(s2)); out.rig.safe = -Math.PI * (Math.sin(Math.PI * s1) + Math.sin(Math.PI * s2));
      release(Math.max(seg(t, 0.12, 0.16) * (1 - seg(t, 0.41, 0.45)), seg(t, 0.52, 0.56) * (1 - seg(t, 0.82, 0.86))));
      catchSnap(0.42); catchSnap(0.83);
      out.w[0] += 0.7 * bump(t, 0.43, 0.56); out.w[2] += 0.2 * bump(t, 0.05, 0.16);
      ev([0.15, 'whoosh'], [0.28, 'click'], [0.42, 'catch'], [0.55, 'whoosh'], [0.69, 'click'], [0.83, 'catch']);
    } else if (type === 'flip') {
      // fingers relax, blade folds shut · show it closed · thumb cocks and flicks it open · show the blade
      const relax = bump(t, 0.1, 0.34);
      out.curl = out.curl.map((c, i) => c - relax * (i === 0 ? 0.6 : 0.4));
      const closed = ease(seg(t, 0.13, 0.28)) * (1 - backEase(seg(t, 0.64, 0.73)));
      out.rig.flip = Math.PI * 0.97 * closed;
      out.flick = -bump(t, 0.54, 0.64) + 1.25 * bump(t, 0.64, 0.75); out.thumb = 1 - 0.5 * bump(t, 0.52, 0.8);
      out.w[0] += 0.95 * bump(t, 0.3, 0.56) - 0.85 * bump(t, 0.76, 0.94); out.w[2] += 0.2 * bump(t, 0.63, 0.76);
      ev([0.28, 'click'], [0.68, 'click'], [0.7, 'shing']);
    } else if (type === 'karambit' || type === 'talon') {
      // show it · held out in front of the fingers, it spins twice round the finger ring · back into the fist
      const s = seg(t, 0.32, 0.72), out1 = bump(t, 0.28, 0.78);
      E.set(0, 0, -4 * Math.PI * ease(s)); Q.setFromEuler(E);
      const pv = this.knife.userData.spinPivot;
      out.kp.set(0, 0.05 * out1, -0.06 * Math.min(1, out1 * 1.6)).add(pv.clone().sub(pv.clone().applyQuaternion(Q)));
      release(seg(t, 0.28, 0.33) * (1 - seg(t, 0.72, 0.78))); catchSnap(0.74);
      out.w[0] += 0.9 * bump(t, 0.08, 0.3) - 0.8 * bump(t, 0.78, 0.94); out.w[2] += 0.15 * out1;
      ev([0.36, 'whoosh'], [0.54, 'whoosh'], [0.74, 'catch']);
    } else {
      // show one face, then the other · flick it up end-over-end · catch
      const s = seg(t, 0.52, 0.8);
      if (s > 0 && s < 1) toss(s, 0.13, 'z', 1);
      release(seg(t, 0.49, 0.54) * (1 - seg(t, 0.78, 0.82))); catchSnap(0.8);
      out.w[0] += 1.05 * bump(t, 0.12, 0.32) - 1.0 * bump(t, 0.3, 0.5) - 0.25 * bump(t, 0.47, 0.56);
      ev([0.2, 'shing'], [0.52, 'whoosh'], [0.8, 'catch']);
    }
    return out;
  }
  poseHand(dt) {
    const c = this.choreo(), k = 1 - Math.exp(-dt * 26);
    for (let i = 0; i < 4; i++) { const ki = 1 - Math.exp(-dt * (30 - i * 3)); this.curl[i] += (c.curl[i] - this.curl[i]) * ki; } // slight cascade between fingers
    this.thumb += (c.thumb - this.thumb) * k; this.flick += (c.flick - this.flick) * Math.min(1, k * 1.6);
    this.wrist.x += (c.w[0] - this.wrist.x) * k; this.wrist.y += (c.w[1] - this.wrist.y) * k; this.wrist.z += (c.w[2] - this.wrist.z) * k;
    this.fingers.forEach((f, i) => {
      const cc = this.curl[i], open = Math.max(0, 1 - cc), tight = Math.max(0, cc - 1);
      f.joints.forEach((j, n) => { j.rotation.x = OPEN[n] + (f.grip[n] - OPEN[n]) * Math.min(1, cc) - tight * (n ? 0.25 : 0.1); });
      f.root.rotation.y = f.spread * open * 1.6;
    });
    const th = this.thumb;
    this.thumbRoot.rotation.set(0.15 + th * 0.35 + this.flick * 0.35, -0.45 + th * 0.85 - this.flick * 0.55, 0);
    this.thumbTip.rotation.y = 0.1 + th * 0.55 - this.flick * 0.3;
    // knife: follow the choreography exactly while it's running, otherwise glide home (no snapping on interrupts)
    const U = this.knife.userData, kk = c.live ? 1 : 1 - Math.exp(-dt * 18);
    this.knife.position.lerp(c.kp, kk); this.knife.quaternion.slerp(c.kq, kk);
    if (U.bfPivots) { U.bfPivots[1].rotation.z += (c.rig.bite - U.bfPivots[1].rotation.z) * kk; U.bfPivots[0].rotation.z += (c.rig.safe - U.bfPivots[0].rotation.z) * kk; }
    if (U.flipPivot) U.flipPivot.rotation.z += (c.rig.flip - U.flipPivot.rotation.z) * kk;
    // sounds
    const a = this.anim;
    if (a) { a.snd ??= 0; c.sounds.sort((x, y) => x[0] - y[0]); while (a.snd < c.sounds.length && a.t >= c.sounds[a.snd][0]) { const kind = c.sounds[a.snd++][1]; if (kind === 'whoosh') A.whoosh(0.5, null, 1.5); else if (kind === 'shing') A.shing(null, 0.08); else { A.flipClick(); if (kind === 'catch') A.land(null, 0.15); } } }
    // present pose (knife across the screen) blends in/out smoothly, even when an inspect is interrupted
    const pt = a && a.name === 'inspect' ? ease(seg(a.t, 0, 0.12)) * (1 - ease(seg(a.t, 0.88, 1))) : 0;
    this.present += (pt - this.present) * (1 - Math.exp(-dt * 14));
    const qe = new THREE.Quaternion().setFromEuler(this.wrist);
    this.wristG.quaternion.copy(this.baseQ).multiply(qe).slerp(this.presentQ.clone().multiply(qe), this.present);
  }
  update(dt, { speed = 0, look = { x: 0, y: 0 }, dashing = false, sprint = false, air = false, dip = 0 }) {
    this.time += dt;
    this.bob += dt * (speed > 0.3 ? 4 + speed * 1.5 : 1.2);
    const amp = speed > 0.3 ? 0.012 + (sprint ? 0.014 : 0) : 0.003;
    this.sway.x += (-look.x * 0.8 - this.sway.x) * Math.min(1, dt * 8); this.sway.y += (look.y * 0.8 - this.sway.y) * Math.min(1, dt * 8);
    this.dashTilt += ((dashing ? 1 : 0) - this.dashTilt) * Math.min(1, dt * 12);
    this.airK += ((air ? 1 : 0) - this.airK) * Math.min(1, dt * 8);
    this.hitLight.intensity *= Math.pow(0.02, dt);
    let pose = REST;
    if (this.anim) {
      const a = this.anim; a.t += dt / a.dur;
      if (a.name === 'fin') {
        const n = a.seq.length, sg = Math.min(n - 1, Math.floor(a.t * n)), lt = a.t * n - sg;
        pose = sample(K[a.seq[sg]], lt);
        const hitIdx = Math.floor((a.t * n - 0.45));
        if (hitIdx >= a.fired && a.fired < n) { a.fired++; a.onHit?.(a.fired - 1, a.fired === n); }
      } else {
        pose = sample(K[a.name], a.t);
        if (!a.fired && a.t >= a.hitAt) { a.fired = true; a.onHit?.(); }
      }
      if (a.t >= 1) this.anim = null;
    }
    this.poseHand(dt);
    // portrait: keep the arm smaller and tucked into the corner so the fight stays visible
    const portrait = this.camera.aspect < 1, xs = Math.max(0.5, Math.min(1, this.camera.aspect / 1.6));
    this.pivot.scale.setScalar(portrait ? 0.82 : 1);
    const by = Math.abs(Math.sin(this.bob)) * amp, bx = Math.cos(this.bob) * amp * 0.8;
    this.pivot.position.set(
      pose.p[0] * xs + bx + this.sway.x * 0.04 - this.dashTilt * 0.05 + (portrait ? -0.01 : 0),
      pose.p[1] + (portrait ? 0.045 : 0) - by - this.sway.y * 0.04 - (sprint ? 0.05 : 0) - dip * 0.25 + this.airK * 0.03,
      pose.p[2]);
    this.pivot.rotation.set(pose.r[0] + (sprint ? -0.3 : 0) - this.airK * 0.15, pose.r[1], pose.r[2] + this.dashTilt * 0.45);
    if (this.present > 0) {
      const b = this.present, sc = this.pivot.scale.x;
      const q = this.pivot.quaternion.clone().slerp(new THREE.Quaternion(), b);
      this.pivot.quaternion.copy(q);
      const grip = this.handG.position.clone().applyQuaternion(this.wristG.quaternion).add(this.wristG.position).multiplyScalar(sc).applyQuaternion(q);
      const target = new THREE.Vector3(portrait ? 0.035 : 0.06, portrait ? -0.06 : -0.08, -0.4).sub(grip);
      this.pivot.position.lerp(target, b);
    }
  }
}
