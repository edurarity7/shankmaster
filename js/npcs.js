// The street is alive: one-way traffic (cars, cabs, police with sirens, the 25 bus, cyclists),
// pedestrians + police officers who panic when blood flies, and dogs that bark and follow you.
// Everything is randomised per match. Vehicles hurt and launch fighters who stand in the road.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Character } from './characters.js';
import { randomOutfit } from './data.js';
import { signTexture, stripeTexture } from './textures.js';
import * as A from './audio.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);
const Z_START = 46, Z_END = -78, LANE_X = 0;
const pick = a => a[Math.floor(Math.random() * a.length)];

// Bake a group of static meshes into one mesh per material (vehicles have lots of little parts).
function bake(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), out = new THREE.Group();
  group.traverse(o => {
    if (!o.isMesh || o.userData.keep) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, { m: o.material, g: [] }); buckets.get(k).g.push(g);
  });
  buckets.forEach(b => { const m = new THREE.Mesh(mergeGeometries(b.g, false), b.m); m.castShadow = true; out.add(m); });
  group.traverse(o => { if (o.isMesh && o.userData.keep) { const c = o.clone(); c.matrix.copy(o.matrixWorld); c.matrix.decompose(c.position, c.quaternion, c.scale); out.add(c); } });
  return out;
}

const MATS = {};
const M = (k, f) => MATS[k] ??= f();
function carModel(kind) {
  const g = new THREE.Group();
  const col = kind === 'cab' ? 0x111214 : kind === 'police' ? 0xf4f6fa : pick([0xd8203a, 0x2a63e0, 0xb8c2cc, 0x1d8b4a, 0xffb800, 0x6a2a8a, 0x2b2f38]);
  const body = std(col, { roughness: 0.25, metalness: 0.35 }), glass = M('glass', () => std(0x1c2a4f, { roughness: 0.08, metalness: 0.7 }));
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  add(rb(1.9, 0.85, 4.4, 0.3), body, 0, 0.75, 0);
  add(rb(1.7, 0.78, kind === 'cab' ? 2.6 : 2.2, 0.3), body, 0, 1.45, 0.25);
  [-0.86, 0.86].forEach(x => add(new THREE.BoxGeometry(0.02, 0.5, kind === 'cab' ? 2.3 : 1.9), glass, x, 1.5, 0.25));
  add(new THREE.BoxGeometry(1.5, 0.5, 0.02), glass, 0, 1.5, -0.95, -0.3);
  [-0.65, 0.65].forEach(x => { add(new THREE.SphereGeometry(0.11, 10, 8), M('head', () => glow(2.6, 2.5, 2.0)), x, 0.85, -2.18); add(new THREE.BoxGeometry(0.3, 0.1, 0.05), M('tail', () => glow(2.4, 0.1, 0.1)), x, 0.9, 2.2); });
  if (kind === 'cab') add(rb(0.5, 0.18, 0.18, 0.04), M('cabsign', () => glow(2.4, 1.6, 0)), 0, 1.92, -0.3);
  if (kind === 'police') {
    const batt = std(0xffffff, { map: stripeTexture('#1238c9', '#ffd21a') }); batt.map.repeat.set(4, 1);
    [-0.96, 0.96].forEach(x => { const p = add(new THREE.PlaneGeometry(4.2, 0.3), batt, x, 0.72, 0); p.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; });
    add(rb(1.1, 0.12, 0.3, 0.04), M('bar', () => std(0x222222)), 0, 1.92, 0.1);
  }
  [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([x, z]) => { const w = add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 18), M('tyre', () => std(0x151515, { roughness: 0.8 })), x, 0.36, z); w.rotation.z = Math.PI / 2; });
  const out = bake(g);
  if (kind === 'police') { // flashing light bar stays separate so it can blink
    out.userData.lights = [-0.3, 0.3].map((x, i) => { const l = new THREE.Mesh(rb(0.42, 0.14, 0.26, 0.05), glow(...(i ? [0.2, 0.5, 3] : [3, 0.2, 0.2]))); l.position.set(x, 2.02, 0.1); out.add(l); return l; });
  }
  return out;
}
function busModel() {
  const g = new THREE.Group(), red = M('busred', () => std(0xe0141e, { roughness: 0.35 })), glass = M('glass', () => std(0x1c2a4f, { roughness: 0.08, metalness: 0.7 }));
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(rb(2.5, 4.3, 10.4, 0.35), red, 0, 2.35, 0);
  [[1.25, 1.75], [3.55, 1.05]].forEach(([y, h]) => [-1.26, 1.26].forEach(x => add(new THREE.BoxGeometry(0.06, h, 9.4), glass, x, y + 0.6, 0)));
  add(new THREE.BoxGeometry(2.2, 1.9, 0.05), glass, 0, 1.85, -5.21);
  const dest = add(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: signTexture('25 ENDZ', { bg: '#111', fg: '#ffbf00', font: 'Rubik, Arial' }), color: new THREE.Color(1.6, 1.6, 1.6) }), 0, 3.2, -5.23); dest.rotation.y = Math.PI;
  [-0.8, 0.8].forEach(x => add(new THREE.SphereGeometry(0.15, 10, 8), M('head', () => glow(2.6, 2.5, 2.0)), x, 0.9, -5.22));
  [[-1.15, -3.4], [1.15, -3.4], [-1.15, 3.2], [1.15, 3.2]].forEach(([x, z]) => { const w = add(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 20), M('tyre', () => std(0x151515, { roughness: 0.8 })), x, 0.55, z); w.rotation.z = Math.PI / 2; });
  return bake(g);
}
function bikeModel() {
  const g = new THREE.Group(), frame = std(pick([0xd8203a, 0x1238c9, 0x1fc8b4]), { metalness: 0.4, roughness: 0.35 }), tyre = M('tyre', () => std(0x151515, { roughness: 0.8 }));
  [-0.5, 0.5].forEach(dz => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 24), tyre); w.position.set(0, 0.36, dz); w.rotation.y = Math.PI / 2; g.add(w); });
  const bar = (a, b) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 8), frame); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  bar(V(0, 0.36, -0.5), V(0, 0.7, -0.05)); bar(V(0, 0.7, -0.05), V(0, 0.36, 0.5)); bar(V(0, 0.36, -0.5), V(0, 0.95, -0.42)); bar(V(0, 0.7, -0.05), V(0, 0.92, 0.3));
  const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), M('chrome', () => std(0xdddddd, { metalness: 1, roughness: 0.2 }))); hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.97, -0.42); g.add(hb);
  return bake(g);
}
function dogModel() {
  const col = pick([0x8a5a2b, 0x2a2a2a, 0xd9c49a, 0xf2f2f2, 0x6b4423]);
  const fur = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }), dark = M('nose', () => std(0x111111));
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const add = (geo, m, x, y, z, p = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  add(new THREE.CapsuleGeometry(0.16, 0.42, 6, 12), fur, 0, 0.42, 0).rotation.x = Math.PI / 2;
  const head = new THREE.Group(); head.position.set(0, 0.6, -0.36); body.add(head);
  add(new THREE.SphereGeometry(0.14, 14, 12), fur, 0, 0, 0, head);
  add(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), fur, 0, -0.03, -0.14, head).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.03, 8, 6), dark, 0, -0.01, -0.22, head);
  [-1, 1].forEach(s => { add(new THREE.SphereGeometry(0.022, 8, 6), dark, 0.06 * s, 0.04, -0.11, head); const e = add(new THREE.SphereGeometry(0.06, 10, 8), fur, 0.09 * s, 0.1, 0.02, head); e.scale.set(0.5, 1.2, 0.8); e.rotation.z = 0.5 * s; });
  const legs = [[-0.09, -0.22], [0.09, -0.22], [-0.09, 0.22], [0.09, 0.22]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.36, z); body.add(p); add(new THREE.CapsuleGeometry(0.04, 0.24, 4, 8), fur, 0, -0.17, 0, p); return p; });
  const tail = new THREE.Group(); tail.position.set(0, 0.5, 0.36); body.add(tail); add(new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), fur, 0, 0.1, 0.04, tail).rotation.x = -0.6;
  return { root, body, head, legs, tail };
}

export class StreetLife {
  constructor(match) {
    this.m = match; this.group = new THREE.Group(); match.scene.add(this.group);
    this.vehicles = []; this.peds = []; this.dogs = [];
    this.spawnT = 2 + Math.random() * 3;
    // per-match random cast
    const nPeds = 2 + Math.floor(Math.random() * 3), nDogs = Math.random() < 0.85 ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0;
    for (let i = 0; i < nPeds; i++) this.addPed(i === 0 || Math.random() < 0.3 ? 'police' : 'civ');
    for (let i = 0; i < nDogs; i++) this.addDog();
    this.mix = ['car', 'car', 'car', 'cab', 'cab', 'police', 'bike', 'bike', 'bus'].sort(() => Math.random() - 0.5);
  }
  dispose() { this.peds.forEach(p => p.ch.dispose()); this.vehicles.forEach(v => v.rider?.dispose()); this.m.scene.remove(this.group); }

  // ---------- spawning ----------
  addVehicle(kind) {
    let mesh, len, w, h, speed, dmg, rider = null;
    if (kind === 'bus') { mesh = busModel(); len = 10.4; w = 2.5; h = 4.5; speed = 7; dmg = 28; }
    else if (kind === 'bike') {
      mesh = new THREE.Group(); mesh.add(bikeModel()); len = 1.6; w = 0.6; h = 1.8; speed = 5.5; dmg = 8;
      rider = new Character(randomOutfit(), null); rider.root.position.set(0, -0.08, 0.15); rider.root.scale.setScalar(0.95); mesh.add(rider.root);
    } else { mesh = carModel(kind); len = 4.4; w = 1.9; h = 1.9; speed = kind === 'police' ? 12.5 : 10; dmg = 18; }
    const x = kind === 'bike' ? LANE_X + (Math.random() - 0.5) * 1.2 : LANE_X;
    mesh.position.set(x, 0, Z_START + len / 2); this.group.add(mesh);
    this.vehicles.push({ kind, mesh, len, w, h, speed, base: speed, dmg, rider, honked: new Set(), hitCd: new Map(), siren: kind === 'police' && Math.random() < 0.7, t: 0, whooshed: false });
  }
  addPed(type) {
    const outfit = type === 'police'
      ? { skin: Math.floor(Math.random() * 6), head: 'helmet', face: Math.random() < 0.5 ? 'tash' : 'noface', top: 'track_navy', legs: 'trackies_blk', kicks: 'boots', gloves: 'bare', neck: 'nochain', back: 'noback' }
      : randomOutfit();
    const ch = new Character(outfit, null);
    const p = this.m.map.randomPoint();
    ch.root.position.set(p.x, 0, p.z); this.group.add(ch.root);
    this.peds.push({ type, ch, pos: ch.root.position, yaw: Math.random() * 6, path: [], goal: null, speed: 0, panic: 0, down: 0, voice: 0 });
  }
  addDog() {
    const d = dogModel(), p = this.m.map.randomPoint();
    d.root.position.set(p.x, 0, p.z); this.group.add(d.root);
    this.dogs.push({ ...d, pos: d.root.position, yaw: 0, target: null, t: Math.random() * 10, barkT: 2 + Math.random() * 4, follow: null, followT: 0, path: [] });
  }
  // A fight nearby → pedestrians scatter, police blow the whistle, dogs go mad.
  alarm(at) {
    this.peds.forEach(p => { if (p.pos.distanceTo(at) < 14 && p.panic <= 0) { p.panic = 3.5; p.path = []; if (p.type === 'police') A.whistle({ x: p.pos.x, y: 1.6, z: p.pos.z }); else if (Math.random() < 0.6) A.grunt({ x: p.pos.x, y: 1.6, z: p.pos.z }, 1.5); } });
    this.dogs.forEach(d => { if (d.pos.distanceTo(at) < 16) { d.barkT = 0; d.excited = 3; } });
  }

  // ---------- per frame ----------
  update(dt) {
    const M = this.m, fighters = [M.me, M.op], live = M.state === 'live';
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 4 + Math.random() * 7;
      const last = this.vehicles[this.vehicles.length - 1];
      if (!last || last.mesh.position.z < Z_START - last.len - 6) { const k = this.mix.shift() || pick(['car', 'cab', 'bike', 'police', 'car']); this.mix.push(k); this.addVehicle(k); }
    }
    if (M.brain) M.brain.carDanger = null;
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i]; v.t += dt;
      // follow the vehicle in front instead of driving through it
      const ahead = this.vehicles.filter(o => o !== v && o.mesh.position.z < v.mesh.position.z).sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0];
      let target = v.base;
      if (ahead) { const gap = (v.mesh.position.z - v.len / 2) - (ahead.mesh.position.z + ahead.len / 2); if (gap < 7) target = Math.min(target, ahead.speed * (gap < 3 ? 0.5 : 1)); }
      v.speed += (target - v.speed) * Math.min(1, dt * 2);
      v.mesh.position.z -= v.speed * dt;
      const z = v.mesh.position.z;
      if (v.mesh.userData.lights) { const on = Math.floor(v.t * 6) % 2; v.mesh.userData.lights[0].visible = !!on; v.mesh.userData.lights[1].visible = !on; }
      if (v.siren && !v.sirened && z < 40) { v.sirened = true; A.siren({ x: 0, y: 1, z }); }
      if (v.rider) { // pedal
        v.rider.update(dt, { speed: 0 });
        const ph = v.t * 9, [lL, lR] = v.rider.legs;
        lL.hip.rotation.x = -1.2 + Math.sin(ph) * 0.45; lR.hip.rotation.x = -1.2 - Math.sin(ph) * 0.45; lL.knee.rotation.x = 1.3 + Math.cos(ph) * 0.4; lR.knee.rotation.x = 1.3 - Math.cos(ph) * 0.4;
        v.rider.arms.forEach(a => { a.sh.rotation.set(1.1, 0, 0); a.el.rotation.x = 0.3; });
        v.rider.torso.rotation.x = -0.35;
      }
      // fighters in the road: honk, then launch them on contact
      for (const f of fighters) {
        if (f.dead) continue;
        const dx = f.pos.x - v.mesh.position.x, dz = f.pos.z - z;
        const inLane = Math.abs(dx) < v.w / 2 + 0.6 && f.pos.y < v.h;
        if (inLane && dz < 0 && dz > -12 && !v.honked.has(f)) { v.honked.add(f); (v.kind === 'bike' ? A.bell : A.honk)({ x: v.mesh.position.x, y: 1, z }); }
        if (f.isBot && inLane && dz < 0 && dz > -9) M.brain.carDanger = { side: dx >= 0 ? 1 : -1 };
        const hitX = Math.abs(dx) < v.w / 2 + 0.38, hitZ = Math.abs(dz) < v.len / 2 + 0.38;
        if (hitX && hitZ && f.pos.y < v.h - 0.2 && live && !(v.hitCd.get(f) > 0)) { v.hitCd.set(f, 1.2); M.trafficHit(f, v, dx >= 0 ? 1 : -1); }
        if (v.hitCd.get(f) > 0) v.hitCd.set(f, v.hitCd.get(f) - dt);
      }
      if (!v.whooshed && Math.abs(z - M.me.pos.z) < 4 && Math.abs(M.me.pos.x) < 6) { v.whooshed = true; A.passBy(v.kind === 'bus' ? 0.6 : v.kind === 'bike' ? 0.25 : 0.45, { x: 0, y: 1, z }); }
      // knock pedestrians/dogs out of the way
      this.peds.forEach(p => { if (p.down <= 0 && Math.abs(p.pos.x - v.mesh.position.x) < v.w / 2 + 0.3 && Math.abs(p.pos.z - z) < v.len / 2 + 0.3) { p.down = 2.2; p.ch.kill(true); A.thud({ x: p.pos.x, y: 1, z: p.pos.z }); p.pos.x += (p.pos.x >= v.mesh.position.x ? 1 : -1) * 1.5; } });
      if (z < Z_END) { v.rider?.dispose(); this.group.remove(v.mesh); this.vehicles.splice(i, 1); }
    }
    this.updatePeds(dt, fighters);
    this.updateDogs(dt, fighters);
  }
  walkTo(n, dt, speed) {
    if (!n.path.length) return false;
    const t = n.path[0], dx = t.x - n.pos.x, dz = t.z - n.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5) { n.path.shift(); return true; }
    const want = Math.atan2(-dx, -dz); let a = want - n.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    n.yaw += Math.max(-dt * 6, Math.min(dt * 6, a));
    n.pos.x += dx / d * speed * dt; n.pos.z += dz / d * speed * dt;
    this.m.map.resolve(n.pos, 0.3, 0);
    return true;
  }
  updatePeds(dt, fighters) {
    const map = this.m.map;
    for (const p of this.peds) {
      if (p.down > 0) { p.down -= dt; p.ch.update(dt, { speed: 0 }); if (p.down <= 0) { p.ch.revive(); if (Math.random() < 0.7) A.grunt({ x: p.pos.x, y: 1.6, z: p.pos.z }, 1.3); } continue; }
      p.panic -= dt;
      if (!p.path.length) {
        let g = map.randomPoint();
        if (p.panic > 0) { const fx = (fighters[0].pos.x + fighters[1].pos.x) / 2, fz = (fighters[0].pos.z + fighters[1].pos.z) / 2; for (let k = 0; k < 6; k++) { const c = map.randomPoint(); if (Math.hypot(c.x - fx, c.z - fz) > Math.hypot(g.x - fx, g.z - fz)) g = c; } }
        p.path = map.path(p.pos.x, p.pos.z, g.x, g.z).slice(0, 8); if (!p.path.length) p.path = [g];
      }
      const speed = p.panic > 0 ? 4.2 : 1.25;
      this.walkTo(p, dt, speed);
      for (const f of fighters) { const dx = p.pos.x - f.pos.x, dz = p.pos.z - f.pos.z, d = Math.hypot(dx, dz); if (d < 0.75 && d > 1e-3 && Math.abs(f.pos.y) < 1) { const k = (0.75 - d) / d; p.pos.x += dx * k; p.pos.z += dz * k; } }
      p.ch.root.rotation.y = p.yaw;
      p.ch.update(dt, { speed });
      if (p.panic > 0) { p.ch.arms.forEach(a => { a.sh.rotation.set(2.6, 0, 0); a.el.rotation.x = 0.4; }); }
    }
  }
  updateDogs(dt, fighters) {
    const map = this.m.map;
    for (const d of this.dogs) {
      d.t += dt; d.barkT -= dt; d.excited = Math.max(0, (d.excited || 0) - dt);
      const near = fighters.filter(f => !f.dead).sort((a, b) => a.pos.distanceTo(d.pos) - b.pos.distanceTo(d.pos))[0];
      const dist = near ? near.pos.distanceTo(d.pos) : 99;
      if (near && dist < 7 && !d.follow && Math.random() < dt * 0.6) { d.follow = near; d.followT = 5 + Math.random() * 5; }
      let speed = 1.6;
      if (d.follow) {
        d.followT -= dt; if (d.followT <= 0 || d.follow.dead) d.follow = null;
        else { const fp = d.follow.pos; d.path = Math.hypot(fp.x - d.pos.x, fp.z - d.pos.z) > 2 ? [{ x: fp.x + Math.sin(d.t) * 1.2, z: fp.z + Math.cos(d.t) * 1.2 }] : []; speed = 5.5; }
      }
      if (!d.path.length && !d.follow) { const g = map.randomPoint(); d.path = map.path(d.pos.x, d.pos.z, g.x, g.z).slice(0, 6); }
      const moving = this.walkTo(d, dt, d.excited > 0 ? 6 : speed);
      d.root.rotation.y = d.yaw;
      const s = moving ? Math.sin(d.t * (speed > 3 ? 18 : 9)) * 0.6 : 0;
      d.legs[0].rotation.x = s; d.legs[3].rotation.x = s; d.legs[1].rotation.x = -s; d.legs[2].rotation.x = -s;
      d.tail.rotation.z = Math.sin(d.t * (d.follow || d.excited ? 22 : 6)) * 0.6;
      d.body.position.y = moving ? Math.abs(Math.sin(d.t * 9)) * 0.03 : 0;
      if (d.barkT <= 0 && (dist < 6 || d.excited > 0)) { d.barkT = 1.2 + Math.random() * 3; A.woof({ x: d.pos.x, y: 0.6, z: d.pos.z }); d.head.rotation.x = -0.4; }
      d.head.rotation.x *= 0.9;
    }
  }
}
