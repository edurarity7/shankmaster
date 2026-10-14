// First-person arm + knife, rendered in its own scene on top of the world (like CS viewmodels).
import * as THREE from 'three';
import { CHARACTERS } from './data.js';
import { buildKnife, setKnifeBlood } from './knives.js';
import { toon, inked } from './characters.js';

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
  inspect: [
    [0, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
    [0.18, [0.06, -0.12, -0.34], [0.2, 1.3, 0.4]],
    [0.45, [0.04, -0.12, -0.34], [0.25, 1.5, 0.5]],
    [0.62, [0.08, -0.16, -0.34], [-0.4, -0.4, -0.6]],
    [0.82, [0.08, -0.16, -0.34], [-0.45, -0.5, -0.7]],
    [1, [0.2, -0.22, -0.36], [0.05, 0.12, 0]],
  ],
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

export class ViewModel {
  constructor(aspect) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xd9ccff, 0x40304a, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.4); key.position.set(1, 2, 1); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff80c0, 1.2); rim.position.set(-2, 0.5, -1); this.scene.add(rim);
    this.hitLight = new THREE.PointLight(0xff0000, 0, 2); this.hitLight.position.set(0, 0, -0.4); this.scene.add(this.hitLight);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    this.anim = null; this.bob = 0; this.sway = { x: 0, y: 0 }; this.blood = 0; this.dashTilt = 0;
  }
  setEnv(env) { this.scene.environment = env; }
  setLoadout(charId, item) {
    this.pivot.clear();
    const d = CHARACTERS[charId];
    const arm = new THREE.Group(); this.pivot.add(arm);
    const sleeve = inked(new THREE.CapsuleGeometry(d.top === 'puffer' ? 0.06 : 0.048, 0.32, 6, 14), toon(d.topColor), { shadow: false });
    sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0.02, -0.02, 0.24); arm.add(sleeve);
    if (d.top === 'tracksuit') { const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.36), toon(d.accent)); st.position.set(0.06, 0.0, 0.24); arm.add(st); }
    const cuff = inked(new THREE.TorusGeometry(0.045, 0.014, 8, 18), toon(d.accent), { shadow: false }); cuff.position.set(0.02, -0.02, 0.07); arm.add(cuff);
    const hand = inked(new THREE.SphereGeometry(0.048, 18, 14), toon(d.skin), { shadow: false }); hand.scale.set(0.9, 1.0, 1.15); hand.position.set(0.0, -0.01, 0.02); arm.add(hand);
    [0, 1, 2, 3].forEach(i => { const f = inked(new THREE.CapsuleGeometry(0.0125, 0.03, 4, 8), toon(d.skin), { shadow: false }); f.position.set(-0.035, -0.02 + (i - 1.5) * 0.024, -0.005); f.rotation.z = Math.PI / 2; arm.add(f); });
    this.knife = buildKnife(item);
    // orient: blade (+X) forward and a little up/inward, flat of the blade facing the camera's right
    const X = new THREE.Vector3(-0.22, 0.42, -0.88).normalize();
    const Y = new THREE.Vector3(0.15, 1, 0.35); Y.addScaledVector(X, -Y.dot(X)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    this.knife.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    this.baseQ = this.knife.quaternion.clone();
    this.knife.position.set(-0.01, 0.0, 0.0);
    arm.add(this.knife);
    this.arm = arm; this.item = item; this.blood = 0; setKnifeBlood(this.knife, 0);
    this.play('draw', 0.7);
  }
  play(name, dur, onHit, hitAt = 0.45) {
    if (name === 'inspect' && this.anim && this.anim.name !== 'inspect') return;
    this.anim = { name, t: 0, dur, onHit, hitAt, fired: false };
  }
  playFinisher(style, dur, onHit, hits) {
    const seq = FIN[style] || FIN.stitch;
    this.anim = { name: 'fin', seq, t: 0, dur, onHit, hits, fired: 0 };
  }
  get busy() { return !!this.anim && this.anim.name !== 'inspect'; }
  addBlood(a = 0.25) { this.blood = Math.min(1, this.blood + a); setKnifeBlood(this.knife, this.blood); }
  flashHit() { this.hitLight.intensity = 6; }
  update(dt, { speed = 0, look = { x: 0, y: 0 }, dashing = false, sprint = false }) {
    this.bob += dt * (speed > 0.3 ? 4 + speed * 1.6 : 1.2);
    const amp = speed > 0.3 ? 0.012 + (sprint ? 0.012 : 0) : 0.003;
    this.sway.x += (-look.x * 0.8 - this.sway.x) * Math.min(1, dt * 8); this.sway.y += (look.y * 0.8 - this.sway.y) * Math.min(1, dt * 8);
    this.dashTilt += ((dashing ? 1 : 0) - this.dashTilt) * Math.min(1, dt * 12);
    this.hitLight.intensity *= Math.pow(0.02, dt);
    let pose = REST;
    if (this.anim) {
      const a = this.anim; a.t += dt / a.dur;
      if (a.name === 'fin') {
        const n = a.seq.length, seg = Math.min(n - 1, Math.floor(a.t * n)), lt = a.t * n - seg;
        pose = sample(K[a.seq[seg]], lt);
        const hitIdx = Math.floor((a.t * n - 0.45));
        if (hitIdx >= a.fired && a.fired < n) { a.fired++; a.onHit?.(a.fired - 1, a.fired === n); }
      } else {
        pose = sample(K[a.name], a.t);
        if (!a.fired && a.t >= a.hitAt) { a.fired = true; a.onHit?.(); }
      }
      // butterfly flip during inspect / draw
      const bf = this.knife.userData.bfPivots;
      if (bf && (a.name === 'inspect' || a.name === 'draw')) {
        const f = Math.sin(Math.min(1, a.t) * Math.PI * 2);
        bf[0].rotation.z = f * Math.PI; bf[1].rotation.z = -f * Math.PI * 0.2;
      }
      if (a.name === 'inspect' && this.item.knife === 'karambit') this.knife.quaternion.copy(this.baseQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(a.t * Math.PI) * Math.PI * 2));
      if (a.t >= 1) { this.anim = null; if (bf) bf.forEach(p => (p.rotation.z = 0)); this.knife.quaternion.copy(this.baseQ); }
    }
    const xs = Math.max(0.5, Math.min(1, this.camera.aspect / 1.6));
    const by = Math.abs(Math.sin(this.bob)) * amp, bx = Math.cos(this.bob) * amp * 0.8;
    this.pivot.position.set(pose.p[0] * xs + bx + this.sway.x * 0.04 - this.dashTilt * 0.05, pose.p[1] + (1 - xs) * 0.06 - by - this.sway.y * 0.04 - (sprint ? 0.04 : 0), pose.p[2]);
    this.pivot.rotation.set(pose.r[0] + (sprint ? -0.25 : 0), pose.r[1], pose.r[2] + this.dashTilt * 0.4);
  }
}
