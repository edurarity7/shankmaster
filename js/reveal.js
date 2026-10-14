// Supply-case opening (CoD style): drop → tap to power up the rarity → latches pop, smoke hisses,
// lid blasts open with a beam → reel → knife rises out of the beam.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildKnife, disposeKnife, knifeTrick } from './knives.js';
import { rayTexture, radialTexture, stripeTexture } from './textures.js';
import { RARITY, RARITY_ORDER } from './data.js';
import * as A from './audio.js';

const TIER_COL = RARITY_ORDER.map(k => new THREE.Color(RARITY[k].color));
const buzz = ms => { if (navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(ms); } catch (e) { /* no-op */ } };
const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);

function stencilTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.font = '900 46px Rubik, Arial'; x.textAlign = 'center'; x.fillStyle = 'rgba(230,236,245,.85)';
  x.fillText('SHANK SUPPLY · E14', 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function emblemTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  const knife = () => { x.beginPath(); x.moveTo(-10, 40); x.lineTo(-10, -60); x.quadraticCurveTo(0, -100, 10, -60); x.lineTo(10, 40); x.fill(); x.fillRect(-28, 40, 56, 12); x.fillRect(-9, 52, 18, 50); };
  x.fillStyle = '#ffffff'; x.translate(128, 128); x.rotate(-0.6); knife(); x.rotate(1.2); knife();
  return new THREE.CanvasTexture(c);
}

export class ChestReveal {
  constructor(env) {
    const S = this.scene = new THREE.Scene();
    S.environment = env;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
    this.bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { col: { value: new THREE.Color(0x1238c9) } },
      vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 col; varying vec3 p; void main(){ float d = pow(max(0., -p.z), 3.); vec3 c = mix(vec3(0.008,0.012,0.04), col * 0.42, d * 0.9 + (1. - abs(p.y)) * 0.12); gl_FragColor = vec4(c, 1.); }',
    });
    S.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), this.bgMat));
    S.add(new THREE.HemisphereLight(0xcfe0ff, 0x0a0a20, 0.9));
    const key = new THREE.SpotLight(0xffffff, 60, 20, 0.5, 0.6, 1.2); key.position.set(1.5, 6, 4); S.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x6fa8ff, 1.6); rim.position.set(-4, 2, -3); S.add(rim);
    this.inner = new THREE.PointLight(0xffffff, 0, 9, 1.4); this.inner.position.set(0, 1.1, 0); S.add(this.inner);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x060914, metalness: 0.3, roughness: 0.55 })); floor.rotation.x = -Math.PI / 2; S.add(floor);
    this.floorRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); this.floorRing.rotation.x = -Math.PI / 2; this.floorRing.position.y = 0.01; S.add(this.floorRing);
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: rayTexture(), color: 0x4b8bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.rays.position.set(0, 1.2, -1.8); S.add(this.rays);
    this.rays2 = this.rays.clone(); this.rays2.material = this.rays.material.clone(); this.rays2.scale.setScalar(0.65); S.add(this.rays2);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.beam.position.y = 4.9; S.add(this.beam);
    // ---- the case ----
    const C = this.chest = new THREE.Group(); S.add(C);
    const gun = new THREE.MeshPhysicalMaterial({ color: 0x2b313c, metalness: 0.75, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const steel = new THREE.MeshPhysicalMaterial({ color: 0x9aa3b2, metalness: 1, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.5, roughness: 0.5 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: TIER_COL[0].clone().multiplyScalar(2.4) });
    const body = new THREE.Mesh(rb(1.7, 0.8, 1.05, 0.08), gun); body.position.y = 0.42; C.add(body);
    [-0.62, 0.62].forEach(x => { const r = new THREE.Mesh(rb(0.09, 0.62, 0.05, 0.02), dark); r.position.set(x, 0.42, 0.53); C.add(r); });
    for (const x of [-0.82, 0.82]) for (const z of [-0.5, 0.5]) for (const y of [0.06, 0.78]) { const g = new THREE.Mesh(rb(0.16, 0.16, 0.16, 0.04), steel); g.position.set(x, y, z); C.add(g); }
    const haz = stripeTexture('#ffc21a', '#111111'); haz.repeat.set(6, 1);
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.13), new THREE.MeshStandardMaterial({ map: haz, roughness: 0.6 })); hz.position.set(0, 0.12, 0.528); C.add(hz);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), new THREE.MeshBasicMaterial({ map: stencilTexture(), transparent: true, depthWrite: false })); st.position.set(0, 0.4, 0.535); C.add(st);
    [-1, 1].forEach(sd => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 18, Math.PI), steel); h.position.set(0.86 * sd, 0.55, 0); h.rotation.set(0, Math.PI / 2, Math.PI); C.add(h); });
    [[1.66, 0.03, 0.02, 0, 0.8, 0.53], [0.02, 0.03, 1.0, 0.85, 0.8, 0], [0.02, 0.03, 1.0, -0.85, 0.8, 0]].forEach(([w, h, d, x, y, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.glowMat); l.position.set(x, y, z); C.add(l); });
    this.latches = [-0.55, 0.55].map(x => {
      const g = new THREE.Group(); g.position.set(x, 0.74, 0.55); C.add(g);
      const base = new THREE.Mesh(rb(0.18, 0.1, 0.05, 0.015), steel); base.position.y = -0.05; g.add(base);
      const lever = new THREE.Group(); g.add(lever);
      const lv = new THREE.Mesh(rb(0.14, 0.16, 0.035, 0.012), steel); lv.position.y = 0.06; lever.add(lv);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.01), this.glowMat); led.position.set(0, 0.08, 0.02); lever.add(led);
      return lever;
    });
    this.lid = new THREE.Group(); this.lid.position.set(0, 0.82, -0.53); C.add(this.lid);
    const lidM = new THREE.Mesh(rb(1.72, 0.22, 1.08, 0.07), gun); lidM.position.set(0, 0.1, 0.53); this.lid.add(lidM);
    const panel = new THREE.Mesh(rb(1.2, 0.06, 0.7, 0.03), dark); panel.position.set(0, 0.23, 0.53); this.lid.add(panel);
    this.emblem = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), new THREE.MeshBasicMaterial({ map: emblemTexture(), color: TIER_COL[0].clone().multiplyScalar(2), transparent: true }));
    this.emblem.rotation.x = -Math.PI / 2; this.emblem.position.set(0, 0.265, 0.53); this.lid.add(this.emblem);
    const lidLed = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 6, 40), this.glowMat); lidLed.rotation.x = Math.PI / 2; lidLed.position.set(0, 0.262, 0.53); this.lid.add(lidLed);
    const smokeTex = radialTexture('rgba(220,226,240,0.55)', 'rgba(200,210,230,0)');
    this.smoke = [...Array(26)].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; S.add(sp); return { sp, t: 1, v: new THREE.Vector3() }; });
    this.waves = [...Array(4)].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; S.add(m); return { m, t: 1, size: 1 }; });
    this.parts = []; const n = 220, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.13, map: radialTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; S.add(this.points);
    for (let i = 0; i < n; i++) this.parts.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), c: new THREE.Color(), life: 0 });
    this.knifeG = new THREE.Group(); S.add(this.knifeG);
    this.stage = 'idle'; this.t = 0; this.shake = 0; this.timeScale = 1; this.tier = 0; this.jumpV = 0;
  }
  start(item, finalTier, cb = {}) {
    this.item = item; this.final = finalTier; this.cb = cb; this.taps = 0; this.timeScale = 1;
    this.stage = 'drop'; this.t = 0; this.jumpV = 0; this.chest.position.set(0, 7, 0); this.chest.rotation.set(0, -0.5, 0); this.chest.visible = true;
    this.lid.rotation.x = 0; this.latches.forEach(l => (l.rotation.x = 0));
    this.rays.material.opacity = 0; this.rays2.material.opacity = 0; this.beam.material.opacity = 0; this.inner.intensity = 0;
    if (this.knife) { disposeKnife(this.knife); this.knife = null; } this.knifeG.clear();
    this.setTier(0, true);
    this.parts.forEach(p => { p.life = 0; p.p.set(0, -99, 0); });
    A.riser(0.9);
  }
  setTier(i, quiet) {
    this.tier = i; const c = TIER_COL[i];
    this.emblem.material.color.copy(c).multiplyScalar(2.2);
    this.rays.material.color.copy(c); this.rays2.material.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.4);
    this.bgMat.uniforms.col.value.copy(c); this.inner.color.copy(c); this.beam.material.color.copy(c).multiplyScalar(1.4);
    this.floorRing.material.color.copy(c).multiplyScalar(2);
    if (!quiet) { this.burst(70, c, 1.0); this.wave(c, 0.5); this.puff(6, 0.6); A.rarityUp(i); this.shake = 0.7; this.cb.onTier?.(i); buzz(40 + i * 15); }
  }
  // Each tap jolts the case and may power it up; when it can't go higher the next tap opens it.
  tap() {
    if (this.stage !== 'wait') return;
    this.taps++;
    if (this.tier < this.final) {
      const next = this.final - this.tier > 1 && this.taps >= 3 ? this.final : this.tier + 1;
      this.setTier(next); this.jumpV = 4.5;
    } else this.open();
  }
  open() {
    this.stage = 'open'; this.t = 0; this.cb.onOpening?.();
    A.latch(); setTimeout(() => A.latch(), 140);
    setTimeout(() => { A.hiss(); this.puff(16, 1.1); }, 260);
    setTimeout(() => {
      A.boom(); A.chestOpen(); this.burst(200, TIER_COL[this.tier], 1.8); this.wave(TIER_COL[this.tier], 1.4); this.wave(new THREE.Color(1, 1, 1), 1.0);
      this.shake = 1.2; buzz([30, 40, 90]); this.cb.onOpen?.();
      if (this.tier >= 4) this.timeScale = 0.35;
    }, 520);
  }
  showKnife() {
    this.stage = 'knife'; this.t = 0;
    const k = this.knife = buildKnife(this.item, { hi: true });
    this.knifeLen = new THREE.Box3().setFromObject(k).getSize(new THREE.Vector3()).x || 0.3; // fit it to the screen in update()
    this.knifeG.clear(); this.knifeG.add(k); this.knifeG.position.set(0, 0.9, 0.2); this.knifeG.scale.setScalar(0.01);
    this.burst(140, TIER_COL[this.tier], 1.4); this.wave(TIER_COL[this.tier], 1.2);
    if (this.tier >= 3) setTimeout(() => { this.burst(200, new THREE.Color(1, 0.85, 0.3), 2.2); this.wave(new THREE.Color(1, 0.85, 0.3), 1.6); A.boom(0.6); }, 380);
  }
  burst(n, color, power) {
    let k = 0;
    for (const p of this.parts) {
      if (p.life > 0) continue;
      p.p.set((Math.random() - 0.5) * 0.8, 0.85, (Math.random() - 0.5) * 0.5);
      p.v.set((Math.random() - 0.5) * 7, 2 + Math.random() * 7, (Math.random() - 0.5) * 4 + 1.2).multiplyScalar(power * 0.7);
      p.c.copy(color).lerp(new THREE.Color(1, 1, 1), Math.random() * 0.5).multiplyScalar(1.6);
      p.life = 0.8 + Math.random() * 1.2; if (++k >= n) break;
    }
  }
  wave(color, size) { const w = this.waves.find(x => x.t >= 1) || this.waves[0]; w.t = 0; w.size = size; w.m.visible = true; w.m.material.color.copy(color).multiplyScalar(2); w.m.position.set(0, 0.05, 0); }
  puff(n, power) {
    let k = 0;
    for (const s of this.smoke) {
      if (s.t < 1) continue;
      const a = Math.random() * Math.PI * 2;
      s.sp.position.set(Math.cos(a) * 0.85, 0.75 + Math.random() * 0.1, Math.sin(a) * 0.55); s.v.set(Math.cos(a) * power, 0.4 + Math.random() * 0.6, Math.sin(a) * power * 0.6);
      s.t = 0; s.sp.visible = true; if (++k >= n) break;
    }
  }
  update(rdt, aspect) {
    const dt = rdt * this.timeScale; this.timeScale += (1 - this.timeScale) * Math.min(1, rdt * 0.8);
    this.t += dt;
    const C = this.camera; C.aspect = aspect; C.fov = aspect < 1 ? 54 : 38; C.updateProjectionMatrix();
    const push = this.stage === 'wait' ? Math.min(1, this.t * 0.15) * 0.5 : 0;
    C.position.set((Math.random() - 0.5) * this.shake * 0.12, 1.75 + (Math.random() - 0.5) * this.shake * 0.12, (aspect < 1 ? 5.6 : 4.8) - push); C.lookAt(0, 0.95, 0);
    this.shake = Math.max(0, this.shake - rdt * 2.2);
    this.rays.rotation.z += dt * 0.3; this.rays2.rotation.z -= dt * 0.5;
    this.glowMat.color.copy(TIER_COL[this.tier]).multiplyScalar(2.2 + Math.sin(this.t * (4 + this.tier * 2)) * 0.5);
    if (this.stage === 'drop') {
      this.jumpV -= 34 * dt; this.chest.position.y += this.jumpV * dt;
      if (this.chest.position.y <= 0) {
        this.chest.position.y = 0;
        if (this.jumpV < -4) { if (this.jumpV < -10) { A.boom(0.5); this.puff(12, 1.4); this.wave(new THREE.Color(0.8, 0.85, 1), 1.2); } else A.land(null, 1); this.jumpV = -this.jumpV * 0.3; this.shake = 0.8; buzz(30); }
        else { this.jumpV = 0; this.stage = 'wait'; this.t = 0; this.cb.onReady?.(); }
      }
    } else if (this.stage === 'wait') {
      this.jumpV -= 34 * dt; this.chest.position.y = Math.max(0, this.chest.position.y + this.jumpV * dt);
      const wob = Math.sin(this.t * (8 + this.tier * 4)) * (0.03 + this.tier * 0.018);
      this.chest.rotation.set(0, -0.35 + wob, wob * 0.6);
      this.rays.material.opacity = 0.2 + this.tier * 0.1 + Math.sin(this.t * 3) * 0.05; this.rays2.material.opacity = 0.12 + this.tier * 0.08;
      this.inner.intensity = 2 + this.tier;
      if (Math.random() < dt * (2 + this.tier * 3)) this.burst(3, TIER_COL[this.tier], 0.35);
    } else if (this.stage === 'open') {
      this.latches.forEach((l, i) => { l.rotation.x = -Math.min(1, Math.max(0, (this.t - i * 0.14) / 0.12)) * 2.2; });
      if (this.t > 0.52) {
        this.lid.rotation.x = Math.max(-1.95, this.lid.rotation.x - dt * 14);
        this.inner.intensity = 14; this.beam.material.opacity = Math.min(0.32, this.beam.material.opacity + dt * 2);
        this.rays.material.opacity = Math.min(1, this.rays.material.opacity + dt * 2); this.rays2.material.opacity = Math.min(0.8, this.rays2.material.opacity + dt * 2);
      }
      this.chest.rotation.y += (0 - this.chest.rotation.y) * dt * 4; this.chest.rotation.z *= 0.9;
    } else if (this.stage === 'knife') {
      const k = Math.min(1, this.t / 0.7), e = 1 - Math.pow(1 - k, 3);
      // fit: knife spans ~58% of the visible width at its distance (both portrait and landscape)
      const dist = this.camera.position.z - this.knifeG.position.z, visW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
      const fit = Math.min(visW * 0.58, 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.5) / this.knifeLen;
      this.knifeG.scale.setScalar(Math.max(0.01, e * fit));
      this.knifeG.position.y = 0.9 + e * 0.75 + Math.sin(this.t * 1.6) * 0.04;
      this.knifeG.rotation.set(0.12, (1 - e) * Math.PI * 4 + Math.sin(this.t * 0.9) * 0.45, 0.45 + Math.sin(this.t * 1.3) * 0.08); // spins in, then faces you
      if (this.knife && this.t > 1.2) knifeTrick(this.knife, ((this.t - 1.2) / 2.6) % 1, 'inspect');
      this.chest.position.y += (-1.4 - this.chest.position.y) * dt * 2.5;
      this.beam.material.opacity = 0.16 + Math.sin(this.t * 2) * 0.05; this.inner.intensity = 5;
      this.rays.material.opacity = 0.55; this.rays2.material.opacity = 0.35; this.rays.scale.setScalar(1 + Math.sin(this.t * 2) * 0.05);
    }
    const pos = this.points.geometry.attributes.position, col = this.points.geometry.attributes.color;
    this.parts.forEach((p, i) => {
      if (p.life > 0) { p.life -= dt; p.v.y -= 6 * dt; p.v.multiplyScalar(1 - dt * 0.6); p.p.addScaledVector(p.v, dt); if (p.life <= 0) p.p.set(0, -99, 0); }
      pos.setXYZ(i, p.p.x, p.p.y, p.p.z); const f = Math.max(0, Math.min(1, p.life)); col.setXYZ(i, p.c.r * f, p.c.g * f, p.c.b * f);
    });
    pos.needsUpdate = true; col.needsUpdate = true;
    this.smoke.forEach(s => { if (s.t >= 1) return; s.t += dt * 0.7; s.sp.position.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 1.5); const sc = 0.4 + s.t * 1.8; s.sp.scale.set(sc, sc, sc); s.sp.material.opacity = 0.7 * (1 - s.t); if (s.t >= 1) s.sp.visible = false; });
    this.waves.forEach(w => { if (w.t >= 1) return; w.t += dt * 1.6; const sc = 0.3 + w.t * 4 * w.size; w.m.scale.set(sc, sc, sc); w.m.material.opacity = 0.9 * (1 - w.t); if (w.t >= 1) w.m.visible = false; });
    this.floorRing.material.opacity = 0.35 + Math.sin(this.t * 3) * 0.2;
  }
}
