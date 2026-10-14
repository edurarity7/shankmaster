// Blood: 3D droplets that splat into decals, mist puffs, and a 2D "blood on your screen" layer.
import * as THREE from 'three';
import { bloodSplatTextures, radialTexture } from './textures.js';

const MAX_DROPS = 600, MAX_DECALS = 140, MAX_MIST = 24;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpV = new THREE.Vector3();

export class BloodFX {
  constructor(scene, quality) {
    this.scene = scene; this.q = quality;
    const dropGeo = new THREE.SphereGeometry(1, 6, 4);
    this.dropMat = new THREE.MeshBasicMaterial({ color: 0x8a0010 });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.2 });
    this.drops = new THREE.InstancedMesh(dropGeo, this.dropMat, MAX_DROPS);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.drops.frustumCulled = false; this.drops.count = 0;
    scene.add(this.drops);
    this.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.25, 12), this.goldMat, 200);
    this.coins.frustumCulled = false; this.coins.count = 0; scene.add(this.coins);
    this.d = []; this.c = [];
    // decals
    this.splatTex = bloodSplatTextures(4);
    this.decals = []; this.decalIdx = 0;
    const dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ map: this.splatTex[i % 4], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.92 }));
      m.visible = false; m.renderOrder = 2; scene.add(m); this.decals.push(m);
    }
    // mist sprites
    const mt = radialTexture('rgba(180,0,10,0.9)', 'rgba(120,0,0,0)');
    this.mist = [...Array(MAX_MIST)].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); return { s, t: 1 }; });
    this.mistIdx = 0;
    this.pools = [];
  }
  // dir: THREE.Vector3 world direction of the cut, amount 0..2
  burst(pos, dir, amount = 1, gold = false) {
    const n = Math.floor((this.q === 'low' ? 26 : 50) * amount);
    for (let i = 0; i < n; i++) {
      const spread = 0.9;
      const v = new THREE.Vector3(dir.x + (Math.random() - 0.5) * spread, dir.y + Math.random() * 0.9 + 0.1, dir.z + (Math.random() - 0.5) * spread).normalize().multiplyScalar(2 + Math.random() * 5 * amount);
      const p = { p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.15)), v, s: 0.012 + Math.random() * 0.03, life: 2 };
      if (gold) { if (this.c.length < 200) this.c.push({ ...p, s: 0.04 + Math.random() * 0.03, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: (Math.random() - 0.5) * 20 }); }
      else if (this.d.length < MAX_DROPS) this.d.push(p);
    }
    if (!gold) for (let k = 0; k < 2; k++) this.puff(pos.clone().addScaledVector(dir, 0.15 * k), 0.4 + amount * 0.4);
  }
  puff(pos, size) {
    const m = this.mist[this.mistIdx++ % MAX_MIST]; m.s.position.copy(pos); m.s.visible = true; m.t = 0; m.size = size; m.s.material.opacity = 0.9;
  }
  decal(x, z, size, y = 0.07) {
    const m = this.decals[this.decalIdx++ % MAX_DECALS];
    m.position.set(x, y + (this.decalIdx % 10) * 0.0015, z); m.rotation.y = Math.random() * 6.28; m.scale.setScalar(size); m.visible = true; m.material.opacity = 0.92;
    return m;
  }
  pool(x, z) { const m = this.decal(x, z, 0.2, 0.08); this.pools.push({ m, t: 0 }); }
  clear() {
    this.d.length = 0; this.c.length = 0; this.decals.forEach(m => (m.visible = false)); this.pools.length = 0;
    this.drops.count = 0; this.coins.count = 0;
  }
  update(dt) {
    let n = 0;
    for (let i = this.d.length - 1; i >= 0; i--) {
      const p = this.d[i]; p.v.y -= 14 * dt; p.p.addScaledVector(p.v, dt); p.life -= dt;
      if (p.p.y <= 0.07 || p.life <= 0) {
        if (p.p.y <= 0.07 && Math.random() < 0.55) this.decal(p.p.x, p.p.z, 0.08 + p.s * 9 * Math.random());
        this.d.splice(i, 1); continue;
      }
      const sp = p.v.length();
      tmpQ.setFromUnitVectors(tmpV.set(0, 1, 0), p.v.clone().normalize());
      tmpS.set(p.s, p.s * (1 + sp * 0.35), p.s);
      tmpM.compose(p.p, tmpQ, tmpS); this.drops.setMatrixAt(n++, tmpM);
    }
    this.drops.count = n; this.drops.instanceMatrix.needsUpdate = true;
    let cn = 0;
    for (let i = this.c.length - 1; i >= 0; i--) {
      const p = this.c[i]; p.v.y -= 10 * dt; p.p.addScaledVector(p.v, dt); p.r.x += p.w * dt;
      if (p.p.y <= 0.06) { p.p.y = 0.06; p.v.multiplyScalar(0.4); p.v.y = Math.abs(p.v.y) * 0.3; p.w *= 0.5; }
      p.life -= dt * 0.4; if (p.life <= 0) { this.c.splice(i, 1); continue; }
      tmpQ.setFromEuler(p.r); tmpS.setScalar(p.s); tmpM.compose(p.p, tmpQ, tmpS); this.coins.setMatrixAt(cn++, tmpM);
    }
    this.coins.count = cn; this.coins.instanceMatrix.needsUpdate = true;
    this.mist.forEach(m => { if (!m.s.visible) return; m.t += dt * 2.2; const s = m.size * (0.4 + m.t * 1.4); m.s.scale.set(s, s, s); m.s.material.opacity = Math.max(0, 0.8 * (1 - m.t)); if (m.t >= 1) m.s.visible = false; });
    this.pools.forEach(p => { if (p.t < 1) { p.t += dt * 0.25; p.m.scale.setScalar(0.2 + p.t * 2.2); } });
  }
}

// ---------- screen-space blood (on the "lens") ----------
export class ScreenBlood {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.splats = [];
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { const dpr = Math.min(devicePixelRatio, 1.5); this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr; this.dpr = dpr; }
  splat(intensity = 1, side = 0) {
    const W = this.cv.width, H = this.cv.height, D = this.dpr, n = Math.floor(1 + intensity * 3);
    for (let i = 0; i < n; i++) {
      const cx = W * (0.5 + side * 0.28 + (Math.random() - 0.5) * 0.8), cy = H * (0.2 + Math.random() * 0.65);
      const r = (5 + Math.random() * 13) * D * Math.min(1.6, 0.6 + intensity * 0.5);
      // main blob = a few overlapping lobes; spray = many tiny droplets flung along one direction
      const lobes = [...Array(4)].map(() => ({ x: (Math.random() - 0.5) * r, y: (Math.random() - 0.5) * r, r: r * (0.45 + Math.random() * 0.45) }));
      const ang = Math.random() * 6.28;
      const drops = [...Array(10 + Math.floor(Math.random() * 16))].map(() => { const a = ang + (Math.random() - 0.5) * 1.6; return { a, d: r * (1.1 + Math.random() * 4 * intensity), r: (0.8 + Math.random() * 3.2) * D }; });
      this.splats.push({ x: cx, y: cy, r, lobes, drops, life: 1, run: 0, runSpeed: (6 + Math.random() * 22) * (r > 12 * D ? 1 : 0.2) });
    }
  }
  update(dt) {
    const { ctx, cv } = this; ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i]; s.life -= dt * 0.33; s.run += s.runSpeed * dt * this.dpr;
      if (s.life <= 0) { this.splats.splice(i, 1); continue; }
      const a = Math.min(1, s.life * 1.8);
      ctx.fillStyle = `rgba(105,0,6,${0.9 * a})`;
      ctx.beginPath(); s.lobes.forEach(l => { ctx.moveTo(s.x + l.x + l.r, s.y + l.y); ctx.arc(s.x + l.x, s.y + l.y, l.r, 0, 7); }); ctx.fill();
      if (s.run > 1) { ctx.fillRect(s.x - s.r * 0.12, s.y, s.r * 0.24, s.run); ctx.beginPath(); ctx.arc(s.x, s.y + s.run, s.r * 0.17, 0, 7); ctx.fill(); }
      ctx.beginPath(); s.drops.forEach(d => { const x = s.x + Math.cos(d.a) * d.d, y = s.y + Math.sin(d.a) * d.d; ctx.moveTo(x + d.r, y); ctx.arc(x, y, d.r, 0, 7); }); ctx.fill();
      ctx.fillStyle = `rgba(255,140,140,${0.28 * a})`; ctx.beginPath(); ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.18, 0, 7); ctx.fill();
    }
  }
  clear() { this.splats.length = 0; }
}
