// Stylised cel-shaded characters built from primitives, with ink outlines and a tiny procedural rig.
// Model faces -Z; its right hand is on +X.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CHARACTERS } from './data.js';
import { toonGradient } from './textures.js';
import { buildKnife } from './knives.js';

const outlineMat = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.011 }, color: { value: new THREE.Color(0x15101c) } },
  vertexShader: `uniform float thickness; void main(){ vec3 p = position + normal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});
export function toon(color, extra = {}) { return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra }); }
export function inked(geo, mat, { outline = true, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = shadow;
  if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.raycast = () => {}; m.add(o); }
  return m;
}
export { outlineMat };

const cap = (r, len, rs = 8) => new THREE.CapsuleGeometry(r, len, 6, rs * 2);
const sph = (r, ...a) => new THREE.SphereGeometry(r, 24, 16, ...a);

export class Character {
  constructor(id, item, { outline = true } = {}) {
    this.def = CHARACTERS[id] || CHARACTERS.roadman;
    this.id = id; this.mats = []; this.phase = 0; this.hitT = 0; this.flashT = 0; this.deadT = -1; this.lean = 0;
    this.outline = outline;
    this.root = new THREE.Group(); this.root.name = 'char-' + id;
    this.build();
    if (item) this.setKnife(item);
  }
  m(color, extra) { const t = toon(color, extra); this.mats.push(t); return t; }
  p(geo, color, parent, pos = [0, 0, 0], scale, extra) {
    const mesh = inked(geo, typeof color === 'number' ? this.m(color, extra) : color, { outline: this.outline });
    mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  build() {
    const d = this.def, G = () => new THREE.Group();
    this.body = G(); this.root.add(this.body);
    this.hips = G(); this.hips.position.y = 0.95; this.body.add(this.hips);
    // legs
    this.legs = [-1, 1].map(side => {
      const hip = G(); hip.position.set(0.105 * side, 0, 0); this.hips.add(hip);
      this.p(cap(0.088, 0.3), d.pants, hip, [0, -0.22, 0]);
      const knee = G(); knee.position.y = -0.45; hip.add(knee);
      this.p(cap(0.078, 0.3), d.pants, knee, [0, -0.2, 0]);
      this.p(new RoundedBoxGeometry(0.15, 0.1, 0.28, 3, 0.04), d.shoes, knee, [0, -0.43, -0.04]);
      this.p(new RoundedBoxGeometry(0.155, 0.03, 0.29, 2, 0.012), 0xdddddd, knee, [0, -0.475, -0.04]);
      return { hip, knee };
    });
    this.p(cap(0.17, 0.12), d.pants, this.hips, [0, 0.02, 0], [1.05, 1, 0.8]);
    // torso
    this.torso = G(); this.torso.position.y = 0.98; this.body.add(this.torso);
    const T = this.torso;
    if (d.top === 'puffer') {
      this.p(cap(0.25, 0.32), d.topColor, T, [0, 0.24, 0], [1, 1, 0.82]);
      [0.06, 0.2, 0.34].forEach(y => this.p(new THREE.TorusGeometry(0.235, 0.04, 10, 28), d.accent, T, [0, y, 0], [1, 0.82, 1]).rotation.x = Math.PI / 2);
      this.p(new THREE.TorusGeometry(0.15, 0.06, 10, 24), d.topColor, T, [0, 0.52, 0.0]).rotation.x = Math.PI / 2; // collar
    } else if (d.top === 'tracksuit') {
      this.p(cap(0.215, 0.32), d.topColor, T, [0, 0.24, 0], [1, 1, 0.78]);
      this.p(new THREE.BoxGeometry(0.018, 0.5, 0.02), d.accent, T, [0, 0.24, -0.172], undefined);
      this.p(new THREE.TorusGeometry(0.12, 0.035, 8, 22), d.topColor, T, [0, 0.5, 0]).rotation.x = Math.PI / 2;
    } else { // cardigan
      this.p(cap(0.23, 0.3), d.topColor, T, [0, 0.23, 0], [1, 1, 0.8]);
      [0.1, 0.22, 0.34].forEach(y => this.p(sph(0.02), d.accent, T, [0, y, -0.19]));
      this.p(new THREE.TorusGeometry(0.12, 0.04, 8, 22), d.accent, T, [0, 0.49, 0]).rotation.x = Math.PI / 2;
    }
    if (d.chain) { const c = this.p(new THREE.TorusGeometry(0.13, 0.012, 8, 30), 0xffcc33, T, [0, 0.45, -0.05], undefined, { emissive: 0x332200 }); c.rotation.x = 1.2; }
    if (d.bag) {
      this.p(new RoundedBoxGeometry(0.2, 0.13, 0.07, 3, 0.03), 0x22252b, T, [0.08, 0.12, -0.21]);
      const strap = this.p(new THREE.TorusGeometry(0.3, 0.014, 6, 30), 0x15161a, T, [0.0, 0.3, 0], [0.85, 1, 0.75]);
      strap.rotation.set(0, 0, 0.75);
    }
    // head
    this.neck = G(); this.neck.position.y = 0.55; T.add(this.neck);
    const H = this.head = G(); H.position.y = 0.15; this.neck.add(H);
    this.p(cap(0.06, 0.06), d.skin, this.neck, [0, 0.02, 0]);
    this.p(sph(0.145), d.skin, H, [0, 0, 0], [1, 1.12, 1]);
    [-1, 1].forEach(s => {
      this.p(sph(0.047), 0xffffff, H, [0.055 * s, 0.035, -0.115]);
      this.p(sph(0.015), 0x111111, H, [0.058 * s, 0.035, -0.16], undefined).castShadow = false;
      this.p(sph(0.03), d.skin, H, [0.148 * s, 0.0, 0.0], [0.6, 1, 1]);
    });
    this.p(sph(0.032), d.skin, H, [0, -0.015, -0.15], [1, 0.9, 1.2]);
    if (d.head === 'hood') {
      const hood = this.p(sph(0.185, 3 * Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.72), d.topColor, H, [0, 0.01, 0.01], [1, 1.1, 1.05], { side: THREE.DoubleSide });
      hood.rotation.x = -0.15;
      this.p(new THREE.TorusGeometry(0.15, 0.022, 8, 26, Math.PI * 1.25), d.accent, H, [0, 0.0, -0.06], [1, 1.25, 1]).rotation.set(0, 0, -Math.PI * 0.125 + Math.PI / 2 - Math.PI * 0.5);
      this.p(sph(0.149, Math.PI, Math.PI, Math.PI * 0.52, Math.PI * 0.4), d.mask, H, [0, 0, 0], [1, 1.12, 1.03]);
    } else if (d.head === 'fade') {
      this.p(sph(0.15, 0, Math.PI * 2, 0, Math.PI * 0.42), d.hair, H, [0, 0.02, 0.005], [1, 1.14, 1.02]);
      if (d.beard) this.p(sph(0.15, Math.PI, Math.PI, Math.PI * 0.56, Math.PI * 0.36), d.hair, H, [0, 0, 0.0], [1, 1.12, 1.03]);
    } else if (d.head === 'curlers') {
      this.p(sph(0.155, 0, Math.PI * 2, 0, Math.PI * 0.45), d.hair, H, [0, 0.02, 0.01], [1.05, 1.15, 1.05]);
      [[-0.07, 0.15], [0, 0.17], [0.07, 0.15], [-0.04, 0.12, 0.08], [0.04, 0.12, 0.08]].forEach(([x, y, z = -0.02]) => this.p(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10), 0xff7fb5, H, [x, y, z]).rotation.z = Math.PI / 2);
    } else if (d.head === 'helmet') {
      this.p(sph(0.16, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x0c1430, H, [0, 0.05, 0.0], [1, 1.75, 1.05]);
      this.p(new THREE.TorusGeometry(0.16, 0.018, 8, 28), 0x0c1430, H, [0, 0.04, 0]).rotation.x = Math.PI / 2;
      this.p(sph(0.035), 0xd8dde6, H, [0, 0.16, -0.155], [1, 1.2, 0.4], { emissive: 0x222222 });
      this.p(sph(0.02), 0xd8dde6, H, [0, 0.33, 0]);
    }
    if (d.glasses) [-1, 1].forEach(s => this.p(new THREE.TorusGeometry(0.05, 0.008, 6, 20), 0x222222, H, [0.055 * s, 0.035, -0.158]));
    if (d.moustache) this.p(new RoundedBoxGeometry(0.11, 0.03, 0.03, 2, 0.012), d.hair, H, [0, -0.055, -0.14]);
    // arms
    const armR = (d.top === 'puffer') ? 0.085 : 0.07;
    this.arms = [-1, 1].map(side => {
      const sh = G(); sh.position.set(0.29 * side, 0.43, 0); sh.rotation.order = 'YXZ'; T.add(sh);
      this.p(cap(armR, 0.2), d.topColor, sh, [0, -0.15, 0]);
      if (d.top === 'tracksuit') this.p(new THREE.BoxGeometry(0.02, 0.3, 0.02), d.accent, sh, [armR * side, -0.15, 0]);
      const el = G(); el.position.y = -0.3; sh.add(el);
      this.p(cap(armR * 0.9, 0.18), d.topColor, el, [0, -0.12, 0]);
      const hand = G(); hand.position.y = -0.28; el.add(hand);
      this.p(sph(0.058), d.skin, hand, [0, 0, 0], [1, 1.1, 1.05]);
      this.p(cap(0.022, 0.03), d.skin, hand, [-0.045 * side, 0.015, -0.035]).rotation.x = 0.6; // thumb
      return { sh, el, hand };
    });
    this.root.traverse(o => { if (o.isMesh && o.material !== outlineMat) o.receiveShadow = false; });
  }
  setKnife(item) {
    if (this.knife) this.arms[1].hand.remove(this.knife);
    this.knife = buildKnife(item, { shadows: true });
    this.knife.rotation.set(0, Math.PI / 2, 0); // blade forward when arm hangs
    this.knife.position.set(0, -0.01, -0.0); this.knife.scale.setScalar(1.5);
    this.arms[1].hand.add(this.knife);
  }
  flash() { this.flashT = 0.12; this.hitT = 1; }
  kill(backwards = true) { this.deadT = 0; this.fallDir = backwards ? 1 : -1; }
  revive() { this.deadT = -1; this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); }

  // st: { speed, attack: {kind, t} | null, dash, block, walkScale }
  update(dt, st) {
    const [L, R] = this.arms, [lL, lR] = this.legs;
    const sp = Math.min(1, st.speed / 4.6);
    this.phase += dt * (4 + st.speed * 2.2) * (sp > 0.05 ? 1 : 0);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = 0.75 * sp;
    lL.hip.rotation.x = s * amp; lR.hip.rotation.x = -s * amp;
    lL.knee.rotation.x = Math.max(0, -c) * amp * 1.3; lR.knee.rotation.x = Math.max(0, c) * amp * 1.3;
    this.body.position.y = this.deadT < 0 ? Math.abs(c) * 0.05 * sp : this.body.position.y;
    const lean = st.dash ? 0.35 : sp * 0.12;
    this.lean += (lean - this.lean) * Math.min(1, dt * 10);
    this.hitT = Math.max(0, this.hitT - dt * 4);
    this.torso.rotation.x = -this.lean + this.hitT * 0.35;
    this.torso.rotation.y = 0;
    // idle/ready arms
    L.sh.rotation.set(-s * amp * 0.8 + 0.25, 0.2, -0.15); L.el.rotation.x = 0.6;
    R.sh.rotation.set(0.75 + s * amp * 0.4, -0.25, 0.1); R.el.rotation.x = 1.1;
    R.hand.rotation.set(-1.1, 0, 0);
    if (st.attack) {
      const { kind, t } = st.attack; // t: 0..1 over windup+active+recover
      const e = t < 0.35 ? t / 0.35 : 1;
      const k = t < 0.35 ? 0 : Math.min(1, (t - 0.35) / 0.3);
      if (kind === 'slash1' || kind === 'slash2' || kind === 'fin') {
        const dir = kind === 'slash2' ? -1 : 1;
        const from = -1.5 * dir, to = 1.1 * dir;
        R.sh.rotation.order = 'YXZ';
        R.sh.rotation.x = 1.45; R.sh.rotation.y = t < 0.35 ? from * e : from + (to - from) * easeOut(k);
        R.el.rotation.x = t < 0.35 ? 1.2 : 0.25;
        this.torso.rotation.y = (t < 0.35 ? -0.4 * dir * e : -0.4 * dir + 0.9 * dir * easeOut(k));
        R.hand.rotation.set(-1.2, 0, -dir * 0.6);
      } else { // stab / heavy
        R.sh.rotation.x = t < 0.35 ? 0.4 + e * 0.6 : 1.0 + easeOut(k) * 0.65; R.sh.rotation.y = -0.15;
        R.el.rotation.x = t < 0.35 ? 1.9 : 1.9 - easeOut(k) * 1.75;
        R.hand.rotation.x = -1.2 + (t < 0.35 ? 0 : easeOut(k) * 0.6);
        this.torso.rotation.x = -this.lean - (t < 0.35 ? -0.15 * e : 0.3 * easeOut(k));
      }
    }
    if (this.flashT > 0) { this.flashT -= dt; }
    const fl = this.flashT > 0 ? 1 : 0;
    if (fl !== this._fl) { this._fl = fl; this.mats.forEach(m => m.emissive?.setHex(fl ? 0x770000 : 0x000000)); }
    if (this.deadT >= 0) {
      this.deadT += dt;
      const f = Math.min(1, this.deadT / 0.55);
      this.body.rotation.x = this.fallDir * easeIn(f) * Math.PI / 2;
      this.body.position.y = -easeIn(f) * 0.08 + (f >= 1 ? -0.05 : 0);
      this.body.position.z = this.fallDir * easeIn(f) * 0.15;
      lL.hip.rotation.x = 0.2; lR.hip.rotation.x = -0.1; L.sh.rotation.set(2.6, 0, -0.6); R.sh.rotation.set(2.4, 0, 0.6);
    }
  }
}
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
