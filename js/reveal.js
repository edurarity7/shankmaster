// Chest opening: drop → tap to power up the rarity (blue → purple → pink → red → gold) → burst → knife reveal.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildKnife } from './knives.js';
import { rayTexture, radialTexture } from './textures.js';
import { RARITY, RARITY_ORDER } from './data.js';
import * as A from './audio.js';

const TIER_COL = RARITY_ORDER.map(k => new THREE.Color(RARITY[k].color));

export class ChestReveal {
  constructor(env) {
    const S = this.scene = new THREE.Scene();
    S.environment = env;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
    this.bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { col: { value: new THREE.Color(0x1238c9) } },
      vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 col; varying vec3 p; void main(){ float d = 1. - abs(p.y); vec3 c = mix(vec3(0.01,0.02,0.08), col * 0.5, pow(max(0., -p.z), 3.) * 0.9 + d * 0.15); gl_FragColor = vec4(c, 1.); }',
    });
    S.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), this.bgMat));
    S.add(new THREE.HemisphereLight(0xcfe0ff, 0x101040, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(2, 4, 5); S.add(key);
    this.inner = new THREE.PointLight(0xffffff, 0, 8, 1.5); this.inner.position.set(0, 0.8, 0); S.add(this.inner);
    // rays
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: rayTexture(), color: 0x4b8bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.rays.position.set(0, 1.0, -1.5); S.add(this.rays);
    this.rays2 = this.rays.clone(); this.rays2.material = this.rays.material.clone(); this.rays2.scale.setScalar(0.7); S.add(this.rays2);
    // chest
    this.chest = new THREE.Group(); S.add(this.chest);
    const wood = new THREE.MeshStandardMaterial({ color: 0x1238c9, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.22, metalness: 1, emissive: 0x2a1800, side: THREE.DoubleSide });
    this.glowMat = new THREE.MeshBasicMaterial({ color: TIER_COL[0].clone().multiplyScalar(2.2) });
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.85, 1.0, 4, 0.1), wood); body.position.y = 0.43; this.chest.add(body);
    [-0.6, 0.6].forEach(x => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.9, 1.04, 2, 0.04), gold); b.position.set(x, 0.43, 0); this.chest.add(b); });
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.07, 1.02), this.glowMat); band.position.y = 0.82; this.chest.add(band);
    this.lid = new THREE.Group(); this.lid.position.set(0, 0.86, -0.5); this.chest.add(this.lid);
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32, 1, false, 0, Math.PI), wood);
    lidM.rotation.set(0, 0, Math.PI / 2); lidM.scale.set(0.55, 1, 1); lidM.position.set(0, 0, 0.5); this.lid.add(lidM);
    [-0.6, 0.6].forEach(x => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.14, 32, 1, false, 0, Math.PI), gold); b.rotation.set(0, 0, Math.PI / 2); b.scale.set(0.57, 1, 1); b.position.set(x, 0, 0.5); this.lid.add(b); });
    const lock = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.3, 0.1, 2, 0.04), gold); lock.position.set(0, 0.72, 0.52); this.chest.add(lock);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), this.glowMat); hole.position.set(0, 0.74, 0.575); this.chest.add(hole);
    // sparkles
    this.parts = []; const n = 160, pos = new Float32Array(n * 3);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pointsMat = new THREE.PointsMaterial({ size: 0.12, map: radialTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(pg, this.pointsMat); this.points.frustumCulled = false; S.add(this.points);
    for (let i = 0; i < n; i++) this.parts.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0 });
    this.knifeG = new THREE.Group(); S.add(this.knifeG);
    this.stage = 'idle'; this.t = 0; this.shake = 0;
  }
  start(item, finalTier, { onReady, onOpen, onTier } = {}) {
    this.item = item; this.final = finalTier; this.tier = 0; this.cb = { onReady, onOpen, onTier };
    this.stage = 'drop'; this.t = 0; this.chest.position.set(0, 6, 0); this.chest.rotation.set(0, -0.4, 0); this.chest.visible = true; this.lid.rotation.x = 0;
    this.rays.material.opacity = 0; this.rays2.material.opacity = 0; this.inner.intensity = 0; this.knifeG.clear();
    this.setTier(0, true);
    this.parts.forEach(p => { p.life = 0; p.p.set(0, -99, 0); });
  }
  setTier(i, quiet) {
    this.tier = i; const c = TIER_COL[i];
    this.glowMat.color.copy(c).multiplyScalar(2.4);
    this.rays.material.color.copy(c); this.rays2.material.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.4);
    this.bgMat.uniforms.col.value.copy(c);
    this.inner.color.copy(c);
    if (!quiet) { this.burst(40, c, 0.9); A.rarityUp(i); this.shake = 0.6; this.cb.onTier?.(i); (navigator.userActivation?.hasBeenActive && navigator.vibrate) && navigator.vibrate(40 + i * 15); }
  }
  // Each tap shakes the chest and may power it up; when it can't go higher the next tap opens it.
  tap() {
    if (this.stage !== 'wait') return;
    this.taps = (this.taps || 0) + 1;
    if (this.tier < this.final) {
      // big pulls feel earned: sometimes skip a tier on the last tap
      const next = this.final - this.tier > 1 && this.taps >= 3 ? this.final : this.tier + 1;
      this.setTier(next); this.chest.position.y = 0.35; this.jumpV = 4;
    } else { this.open(); }
  }
  open() {
    this.stage = 'open'; this.t = 0; A.chestOpen(); this.burst(140, TIER_COL[this.tier], 1.6); this.shake = 1;
    (navigator.userActivation?.hasBeenActive && navigator.vibrate) && navigator.vibrate([30, 40, 80]);
    this.cb.onOpen?.();
  }
  showKnife() {
    this.stage = 'knife'; this.t = 0;
    const k = buildKnife(this.item); k.scale.setScalar(8);
    this.knifeG.clear(); this.knifeG.add(k); this.knifeG.position.set(0, 0.8, 0); this.knifeG.scale.setScalar(0.01);
    this.burst(100, TIER_COL[this.tier], 1.2);
    if (this.tier >= 3) setTimeout(() => this.burst(160, new THREE.Color(1, 0.85, 0.3), 2), 350);
  }
  burst(n, color, power) {
    this.pointsMat.color.copy(color).multiplyScalar(1.8);
    let k = 0;
    for (const p of this.parts) {
      if (p.life > 0) continue;
      p.p.set((Math.random() - 0.5) * 0.6, 0.9, (Math.random() - 0.5) * 0.4);
      p.v.set((Math.random() - 0.5) * 6, 2 + Math.random() * 6, (Math.random() - 0.5) * 3 + 1).multiplyScalar(power * 0.7);
      p.life = 1 + Math.random(); if (++k >= n) break;
    }
  }
  update(dt, aspect) {
    this.t += dt;
    const C = this.camera; C.aspect = aspect; C.fov = aspect < 1 ? 52 : 38; C.updateProjectionMatrix();
    C.position.set((Math.random() - 0.5) * this.shake * 0.1, 1.5 + (Math.random() - 0.5) * this.shake * 0.1, aspect < 1 ? 5.2 : 4.6); C.lookAt(0, 0.9, 0);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.rays.rotation.z += dt * 0.3; this.rays2.rotation.z -= dt * 0.5;
    if (this.stage === 'drop') {
      this.jumpV = (this.jumpV ?? 0) - 30 * dt; this.chest.position.y += this.jumpV * dt;
      if (this.chest.position.y <= 0) { this.chest.position.y = 0; if (this.jumpV < -3) { this.jumpV = -this.jumpV * 0.35; A.land(null, 1); this.shake = 0.5; } else { this.jumpV = 0; this.stage = 'wait'; this.taps = 0; this.cb.onReady?.(); } }
    } else if (this.stage === 'wait') {
      this.jumpV = (this.jumpV ?? 0) - 30 * dt; this.chest.position.y = Math.max(0, this.chest.position.y + this.jumpV * dt);
      const wob = Math.sin(this.t * (8 + this.tier * 3)) * (0.04 + this.tier * 0.02);
      this.chest.rotation.set(0, -0.4 + wob, wob * 0.6);
      this.rays.material.opacity = 0.25 + this.tier * 0.1 + Math.sin(this.t * 3) * 0.05; this.rays2.material.opacity = 0.15 + this.tier * 0.08;
      this.inner.intensity = 2 + this.tier;
      if (Math.random() < dt * (2 + this.tier * 2)) this.burst(3, TIER_COL[this.tier], 0.4);
    } else if (this.stage === 'open') {
      this.lid.rotation.x = Math.max(-1.9, this.lid.rotation.x - dt * 12);
      this.inner.intensity = 30; this.rays.material.opacity = Math.min(1, this.rays.material.opacity + dt * 2); this.rays2.material.opacity = Math.min(0.8, this.rays2.material.opacity + dt * 2);
      this.chest.rotation.y += (0 - this.chest.rotation.y) * dt * 4;
    } else if (this.stage === 'knife') {
      const k = Math.min(1, this.t / 0.6), e = 1 - Math.pow(1 - k, 3);
      this.knifeG.scale.setScalar(Math.max(0.01, e));
      this.knifeG.position.y = 0.8 + e * 0.75;
      this.knifeG.rotation.set(0.25, (1 - e) * 12 + this.t * 0.7, 0.45 + Math.sin(this.t * 1.3) * 0.08);
      this.chest.position.y += (-1.3 - this.chest.position.y) * dt * 3;
      this.rays.material.opacity = 0.9; this.rays.scale.setScalar(1 + Math.sin(this.t * 2) * 0.05);
    }
    const pos = this.points.geometry.attributes.position;
    this.parts.forEach((p, i) => {
      if (p.life > 0) { p.life -= dt; p.v.y -= 6 * dt; p.p.addScaledVector(p.v, dt); if (p.life <= 0) p.p.set(0, -99, 0); }
      pos.setXYZ(i, p.p.x, p.p.y, p.p.z);
    });
    pos.needsUpdate = true;
  }
}
