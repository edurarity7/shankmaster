// Knife models (HD). Blade points along +X, cutting edge toward -Y, origin at the grip centre.
// Each knife exposes rig pivots (butterfly handles, flip-knife blade) and a CS-style inspect trick.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { skinMaterialParams, bloodSmearTexture, bladeNormalMap, handleTexture } from './textures.js';

const BLADE_EXTRUDE = { depth: 0.001, bevelEnabled: true, bevelThickness: 0.0019, bevelSize: 0.0028, bevelSegments: 4, curveSegments: 40 };

function planarUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  const w = b.max.x - b.min.x || 1, h = b.max.y - b.min.y || 1;
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x) / w; uv[i * 2 + 1] = (p.getY(i) - b.min.y) / h; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const extrude = (shape, depth, bevel = 0.0015, segs = 3) => planarUV(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: segs, curveSegments: 28 }).translate(0, 0, -depth / 2));
function sawSpine(s, x0, x1, y, step = 0.006, depth = 0.0032) { for (let x = x0; x < x1; x += step) { s.lineTo(x + step * 0.5, y - depth); s.lineTo(x + step, y); } }
const rbox = (w, h, d, r = 0.004) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
const cyl = (r, h, s = 16) => new THREE.CylinderGeometry(r, r, h, s);

// ---------- materials ----------
const MAT = {};
const mat = (k, make) => MAT[k] ??= make();
const steel = () => mat('steel', () => new THREE.MeshPhysicalMaterial({ color: 0xd3d8df, roughness: 0.22, metalness: 1, clearcoat: 0.4 }));
const darkSteel = () => mat('dsteel', () => new THREE.MeshPhysicalMaterial({ color: 0x2b2e35, roughness: 0.3, metalness: 0.9, clearcoat: 0.3 }));
const brass = () => mat('brass', () => new THREE.MeshPhysicalMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 1 }));
const screw = () => mat('screw', () => new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.8 }));
const handleMat = (kind, tint, rep = [1, 1]) => mat('h' + kind + tint + rep, () => {
  const t = handleTexture(kind, tint).clone(); t.needsUpdate = true; t.repeat.set(...rep);
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: kind === 'rubber' ? 0.85 : kind === 'wood' ? 0.55 : kind === 'tape' ? 0.7 : 0.45, metalness: 0, clearcoat: kind === 'wood' || kind === 'g10' ? 0.6 : 0, clearcoatRoughness: 0.3 });
});

// Animated legendary finishes tick through this list.
const ANIM = new Set();
export function updateKnifeFX(t) {
  ANIM.forEach(f => f(t));
}

let smear;
export function buildKnife(item, { shadows = false, hi = false } = {}) {
  const { knife, skin, seed = 0, float: flt = 0.05 } = item;
  const sp = skinMaterialParams(skin, seed, flt, hi);
  const painted = !['stock', 'patina', 'holo', 'midnight'].includes(skin);
  const bladeMat = new THREE.MeshPhysicalMaterial({
    map: sp.map, metalness: sp.metalness, roughness: sp.roughness, emissive: sp.emissive, emissiveIntensity: 0.6, envMapIntensity: 1.6,
    clearcoat: painted ? 1 : 0.35, clearcoatRoughness: 0.06, normalMap: bladeNormalMap(), normalScale: new THREE.Vector2(0.6, 0.6),
  });
  if (sp.special === 'holo') { bladeMat.iridescence = 1; bladeMat.iridescenceIOR = 1.8; bladeMat.iridescenceThicknessRange = [200, 900]; }
  if (sp.special === 'lava' || sp.special === 'galaxy') {
    bladeMat.emissiveMap = sp.emissiveMap; bladeMat.emissive = new THREE.Color(sp.special === 'lava' ? 0xffffff : 0xdcc8ff);
    const f = (t) => { bladeMat.emissiveIntensity = (sp.special === 'lava' ? 1.6 : 1.1) + Math.sin(t * (sp.special === 'lava' ? 3 : 5)) * 0.5; sp.map.offset.x = sp.emissiveMap.offset.x = (t * (sp.special === 'lava' ? 0.02 : 0.008)) % 1; };
    ANIM.add(f); bladeMat.userData.anim = f;
  }
  const paint = new THREE.MeshPhysicalMaterial({ map: sp.map, metalness: Math.min(0.6, sp.metalness), roughness: Math.max(0.3, sp.roughness), clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const root = new THREE.Group(); root.name = 'knife';
  const k = new THREE.Group(); root.add(k);
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = k) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = shadows; parent.add(mesh); return mesh;
  };
  const pins = (xs, y = 0, z = 0.0085, r = 0.0028, parent = k) => xs.forEach(x => [z, -z].forEach(zz => add(cyl(r, 0.002, 14), screw(), x, y, zz, Math.PI / 2, 0, 0, parent)));
  let blade, length = 0.17, gripX = -0.05, ring = null;
  const s = new THREE.Shape();

  if (knife === 'shank') {
    s.moveTo(0, 0.013); s.lineTo(0.16, 0.012); s.quadraticCurveTo(0.176, 0.011, 0.184, 0.008);
    s.quadraticCurveTo(0.162, -0.013, 0.11, -0.017); s.lineTo(0.004, -0.017); s.lineTo(0, -0.012); s.closePath();
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat);
    const hs = new THREE.Shape(); hs.moveTo(0, 0.013); hs.lineTo(-0.1, 0.012); hs.quadraticCurveTo(-0.112, 0, -0.1, -0.016); hs.lineTo(0, -0.017); hs.closePath();
    add(extrude(hs, 0.014, 0.003), handleMat('wood', '', [1.5, 1]));
    [-0.02, -0.05, -0.08].forEach(x => add(cyl(0.0035, 0.021, 14), brass(), x, -0.002, 0, Math.PI / 2, 0, 0));
    [-0.035, -0.066].forEach((x, i) => { const t = add(new THREE.CylinderGeometry(0.0135, 0.0135, 0.014 + i * 0.004, 20), handleMat('tape', '', [1, 0.3]), x, -0.002, 0, 0, 0, Math.PI / 2); t.scale.set(1, 1, 0.75); t.rotation.x = 0.15 * (i ? -1 : 1); });
    length = 0.184;
  } else if (knife === 'karambit' || knife === 'talon') {
    const T = knife === 'talon' ? 1.28 : 1;
    s.moveTo(0, 0.012 * T); s.bezierCurveTo(0.05 * T, 0.024 * T, 0.094 * T, 0.004 * T, 0.096 * T, -0.062 * T);
    s.bezierCurveTo(0.074 * T, -0.03 * T, 0.042 * T, -0.012 * T, 0, -0.012 * T); s.closePath();
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat);
    if (knife === 'talon') { const sp2 = new THREE.Shape(); sp2.moveTo(0.02, 0.016); sp2.lineTo(0.03, 0.03); sp2.lineTo(0.04, 0.019); sp2.closePath(); add(extrude(sp2, 0.002, 0.0008, 2), bladeMat); }
    const h = new THREE.Shape();
    h.moveTo(0.004, 0.014 * T); h.quadraticCurveTo(-0.05, 0.022, -0.098, 0.006); h.lineTo(-0.102, -0.02);
    h.quadraticCurveTo(-0.075, -0.012, -0.06, -0.018); h.quadraticCurveTo(-0.045, -0.008, -0.03, -0.016); h.quadraticCurveTo(-0.015, -0.008, 0.004, -0.014 * T); h.closePath();
    add(extrude(h, 0.012, 0.003), knife === 'talon' ? handleMat('g10', '', [2, 2]) : handleMat('rubber', '', [3, 2]));
    add(extrude(h, 0.0022, 0.0006, 2), darkSteel()).scale.set(1, 1, 1); // liner
    ring = new THREE.Vector3(-0.121, -0.012, 0);
    add(new THREE.TorusGeometry(0.0195 * (knife === 'talon' ? 1.1 : 1), 0.0058, 16, 36), knife === 'talon' ? brass() : darkSteel(), ring.x, ring.y, 0);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(new THREE.SphereGeometry(0.0022, 8, 6), steel(), ring.x + Math.cos(a) * 0.0195, ring.y + Math.sin(a) * 0.0195, 0.005); }
    pins([-0.03, -0.065], 0.003);
    length = 0.1 * T; gripX = -0.06;
  } else if (knife === 'butterfly') {
    s.moveTo(0, 0.009); s.lineTo(0.082, 0.009); s.lineTo(0.118, 0.0); s.quadraticCurveTo(0.096, -0.01, 0.066, -0.01); s.lineTo(0.008, -0.01); s.lineTo(0, -0.006); s.closePath();
    const hole = new THREE.Path(); hole.absarc(0.004, 0.002, 0.0022, 0, Math.PI * 2, true); s.holes.push(hole);
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat);
    const hs = new THREE.Shape();
    hs.moveTo(0, 0.008); hs.lineTo(-0.128, 0.008); hs.quadraticCurveTo(-0.136, 0, -0.128, -0.008); hs.lineTo(0, -0.008); hs.quadraticCurveTo(0.006, 0, 0, 0.008);
    for (let i = 0; i < 5; i++) { const p = new THREE.Path(); const x = -0.018 - i * 0.022; p.moveTo(x, 0.0035); p.lineTo(x - 0.014, 0.0035); p.quadraticCurveTo(x - 0.017, 0, x - 0.014, -0.0035); p.lineTo(x, -0.0035); p.quadraticCurveTo(x + 0.003, 0, x, 0.0035); hs.holes.push(p); }
    const hg = extrude(hs, 0.0055, 0.0011, 2);
    const handleM = skin === 'stock' ? darkSteel() : paint;
    const pivots = [0.0058, -0.0058].map((z, i) => {
      const pv = new THREE.Group(); pv.position.set(0, 0, z); k.add(pv);
      add(hg, handleM, 0, 0, 0, 0, 0, 0, pv);
      add(cyl(0.0034, 0.004, 14), steel(), -0.002, 0, i ? -0.002 : 0.002, Math.PI / 2, 0, 0, pv);
      if (i === 0) add(rbox(0.016, 0.004, 0.005, 0.0015), steel(), -0.13, 0.007, 0.003, 0, 0, 0, pv); // latch
      return pv;
    });
    root.userData.bfPivots = pivots;
    length = 0.118; gripX = -0.066;
  } else if (knife === 'bayonet') {
    s.moveTo(0, 0.014); sawSpine(s, 0.028, 0.094, 0.014); s.lineTo(0.12, 0.014);
    s.quadraticCurveTo(0.16, 0.013, 0.183, 0.0); s.quadraticCurveTo(0.166, -0.016, 0.13, -0.017); s.lineTo(0.012, -0.017); s.lineTo(0, -0.012); s.closePath();
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat);
    add(rbox(0.006, 0.0025, 0.0045, 0.001), darkSteel(), 0.06, -0.003, 0).scale.set(14, 1, 1); // fuller
    add(rbox(0.009, 0.052, 0.017, 0.003), darkSteel(), -0.004, -0.002, 0);
    add(new THREE.TorusGeometry(0.0078, 0.0026, 12, 24), darkSteel(), -0.004, 0.029, 0);
    const grip = new THREE.CylinderGeometry(0.0128, 0.0118, 0.105, 24); grip.rotateZ(Math.PI / 2); grip.scale(1, 1.05, 0.8);
    add(grip, handleMat('rubber', '', [3, 1]), -0.06, 0, 0);
    for (let i = 0; i < 7; i++) add(new THREE.TorusGeometry(0.0124, 0.0014, 8, 24), handleMat('rubber', '', [3, 1]), -0.022 - i * 0.012, 0, 0, 0, Math.PI / 2, 0).scale.set(1, 1.05, 0.8);
    add(rbox(0.016, 0.027, 0.021, 0.005), darkSteel(), -0.118, 0, 0);
    add(new THREE.TorusGeometry(0.004, 0.0015, 8, 16), steel(), -0.128, 0, 0);
    length = 0.183; gripX = -0.06;
  } else if (knife === 'huntsman') {
    s.moveTo(0, 0.018); sawSpine(s, 0.02, 0.07, 0.018, 0.007, 0.004); s.lineTo(0.13, 0.018);
    s.quadraticCurveTo(0.172, 0.016, 0.208, 0.004); s.quadraticCurveTo(0.184, -0.021, 0.14, -0.022); s.lineTo(0.008, -0.022); s.lineTo(0, -0.016); s.closePath();
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat);
    add(rbox(0.011, 0.078, 0.021, 0.004), darkSteel(), -0.005, -0.002, 0);
    [-1, 1].forEach(sy => add(new THREE.SphereGeometry(0.006, 12, 10), darkSteel(), -0.005, sy * 0.039 - 0.002, 0));
    const gh = new THREE.Shape();
    gh.moveTo(-0.01, 0.014); gh.lineTo(-0.11, 0.016); gh.quadraticCurveTo(-0.124, 0, -0.112, -0.018);
    [-0.09, -0.065, -0.04].forEach(x => { gh.quadraticCurveTo(x - 0.005, -0.012, x + 0.006, -0.018); });
    gh.lineTo(-0.01, -0.016); gh.closePath();
    add(extrude(gh, 0.016, 0.004), handleMat('rubber', '', [3, 2]));
    add(cyl(0.004, 0.022, 16), steel(), -0.106, 0, 0, Math.PI / 2, 0, 0);
    pins([-0.04, -0.075]);
    length = 0.208; gripX = -0.062;
  } else if (knife === 'skeleton') {
    s.moveTo(0, 0.012); s.lineTo(0.09, 0.013); s.quadraticCurveTo(0.13, 0.012, 0.15, 0.0); s.quadraticCurveTo(0.13, -0.015, 0.09, -0.016); s.lineTo(0, -0.015); s.closePath();
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat);
    // skeletonised steel handle with a paracord wrap
    const hs = new THREE.Shape(); hs.moveTo(0, 0.013); hs.lineTo(-0.105, 0.012); hs.absarc(-0.108, 0, 0.012, Math.PI / 2, -Math.PI / 2, false); hs.lineTo(0, -0.015); hs.closePath();
    const cut = new THREE.Path(); cut.moveTo(-0.012, 0.006); cut.lineTo(-0.098, 0.005); cut.absarc(-0.1, -0.001, 0.006, Math.PI / 2, -Math.PI / 2, false); cut.lineTo(-0.012, -0.008); cut.closePath(); hs.holes.push(cut);
    add(extrude(hs, 0.004, 0.001, 2), skin === 'stock' ? darkSteel() : paint);
    const wrap = new THREE.CylinderGeometry(0.0115, 0.0115, 0.062, 20); wrap.rotateZ(Math.PI / 2); wrap.scale(1, 1, 0.55);
    add(wrap, handleMat('paracord', '#ff6a00', [6, 2]), -0.05, -0.001, 0);
    add(new THREE.TorusGeometry(0.008, 0.0018, 8, 20), handleMat('paracord', '#ff6a00', [6, 2]), -0.125, 0, 0, 0, Math.PI / 2, 0);
    length = 0.15; gripX = -0.055;
  } else { // flip
    const fp = new THREE.Group(); k.add(fp); root.userData.flipPivot = fp;
    s.moveTo(0, 0.012); s.lineTo(0.07, 0.013); s.quadraticCurveTo(0.11, 0.012, 0.127, 0.0); s.quadraticCurveTo(0.11, -0.013, 0.08, -0.014); s.lineTo(0.004, -0.014); s.quadraticCurveTo(-0.004, 0, 0, 0.012);
    const hole = new THREE.Path(); hole.absarc(0.018, 0.004, 0.0056, 0, Math.PI * 2, true); s.holes.push(hole);
    blade = add(planarUV(new THREE.ExtrudeGeometry(s, BLADE_EXTRUDE).translate(0, 0, -0.0005)), bladeMat, 0, 0, 0, 0, 0, 0, fp);
    const hs = new THREE.Shape();
    hs.moveTo(0.004, 0.013); hs.lineTo(-0.105, 0.011); hs.quadraticCurveTo(-0.117, 0, -0.105, -0.012); hs.lineTo(0.004, -0.015); hs.closePath();
    [0.0055, -0.0055].forEach(z => add(extrude(hs, 0.004, 0.0012, 2), skin === 'stock' ? handleMat('g10', '', [2, 2]) : paint, 0, 0, z));
    add(rbox(0.11, 0.022, 0.006, 0.002), darkSteel(), -0.05, -0.001, 0); // backspacer
    add(cyl(0.0046, 0.017, 18), steel(), -0.003, 0, 0, Math.PI / 2, 0, 0);
    pins([-0.05, -0.095], 0, 0.0078, 0.0024);
    add(rbox(0.03, 0.004, 0.001, 0.0008), steel(), -0.06, -0.006, 0.0085); // pocket clip
    length = 0.127; gripX = -0.055;
  }
  k.position.x = -gripX;

  // ShankTrak™ counter plate on the handle
  if (item.trak != null) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 40;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const draw = (n) => { const x = c.getContext('2d'); x.fillStyle = '#120a02'; x.fillRect(0, 0, 128, 40); x.fillStyle = '#ff8a1a'; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.shadowColor = '#ff6a00'; x.shadowBlur = 8; x.fillText(String(n).padStart(5, '0'), 64, 31); tex.needsUpdate = true; };
    draw(item.trak);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.011), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5) }));
    plate.position.set(gripX + 0.005, 0, 0.0105); k.add(plate);
    root.userData.setTrak = draw;
  }

  smear ??= bloodSmearTexture();
  const bloodMat = new THREE.MeshPhysicalMaterial({ color: 0x7a0008, roughness: 0.12, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0, alphaMap: smear, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const bl = new THREE.Mesh(blade.geometry, bloodMat); bl.scale.set(1, 1, 1.2); blade.add(bl);
  root.userData = { ...root.userData, type: knife, blade, bloodMat, length, tipX: length - gripX, bladeMat,
    spinPivot: ring ? ring.clone().add(new THREE.Vector3(-gripX, 0, 0)) : new THREE.Vector3(0, 0, 0) };
  return root;
}

export function setKnifeBlood(knife, amount) { knife.userData.bloodMat.opacity = Math.max(0, Math.min(0.95, amount)); }
export function disposeKnife(knife) {
  knife.traverse(o => { if (o.isMesh) { o.geometry.dispose?.(); if (o.material?.userData?.anim) ANIM.delete(o.material.userData.anim); } });
}

// ---------- CS-style inspect / flip tricks ----------
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
// Sets rig pivots for time t (0..1) and returns the extra rotation [x,y,z] to apply around userData.spinPivot.
// Also returns `clicks`: list of t values where a flick sound should play.
export function knifeTrick(root, t, kind = 'inspect') {
  const U = root.userData, type = U.type;
  const bf = U.bfPivots, fp = U.flipPivot;
  if (bf) { bf[0].rotation.z = 0; bf[1].rotation.z = 0; }
  if (fp) fp.rotation.z = 0;
  if (kind === 'draw') {
    if (bf) { const o = 1 - back(seg(t, 0.15, 0.7)); bf[1].rotation.z = o * Math.PI; bf[0].rotation.z = -o * Math.PI * 0.15; return [ease(seg(t, 0, 0.7)) * Math.PI * 2, 0, 0]; }
    if (fp) { fp.rotation.z = (1 - back(seg(t, 0.25, 0.6))) * Math.PI * 0.97; return [0, 0, 0]; }
    return [0, 0, 0];
  }
  if (type === 'butterfly') {
    // bite handle spins round twice, safe handle swings out and back, whole knife rolls
    bf[1].rotation.z = Math.PI * 2 * (ease(seg(t, 0.05, 0.4)) + ease(seg(t, 0.55, 0.88)));
    bf[0].rotation.z = -Math.PI * Math.sin(Math.PI * seg(t, 0.3, 0.62));
    return [Math.PI * 2 * ease(seg(t, 0.2, 0.75)), 0, Math.sin(Math.PI * seg(t, 0.05, 0.95)) * 0.4];
  }
  if (type === 'flip') {
    fp.rotation.z = Math.PI * 0.97 * (ease(seg(t, 0.08, 0.22)) - back(seg(t, 0.72, 0.86)) + (t >= 0.86 ? 0 : 0));
    if (t > 0.86) fp.rotation.z = 0;
    return [Math.PI * 2 * ease(seg(t, 0.28, 0.66)), 0, Math.sin(Math.PI * seg(t, 0.28, 0.66)) * 0.35];
  }
  if (type === 'karambit' || type === 'talon') {
    return [0, 0, -Math.PI * 4 * ease(seg(t, 0.12, 0.7))]; // finger-ring spins (pivot is the ring, so it stays in the hand)
  }
  // twirl: roll the blade to show both faces, then a flip toss in the hand
  return [Math.PI * 2 * ease(seg(t, 0.1, 0.45)) + Math.PI * 2 * ease(seg(t, 0.55, 0.9)), 0, Math.sin(Math.PI * seg(t, 0.5, 0.95)) * 0.55];
}
export const TRICK_CLICKS = { butterfly: [0.22, 0.4, 0.62, 0.88], flip: [0.2, 0.84], karambit: [0.3, 0.55], talon: [0.3, 0.55], default: [0.3, 0.75] };
