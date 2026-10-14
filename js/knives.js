// Knife models. Blade points along +X, cutting edge toward -Y, origin at the grip centre.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { skinMaterialParams, bloodSmearTexture } from './textures.js';

const BLADE_EXTRUDE = { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0017, bevelSize: 0.0026, bevelSegments: 3, curveSegments: 28 };

function planarUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x) / w; uv[i * 2 + 1] = (p.getY(i) - b.min.y) / h; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function bladeGeo(shape, opts = BLADE_EXTRUDE) {
  const g = new THREE.ExtrudeGeometry(shape, opts);
  g.translate(0, 0, -opts.depth / 2);
  return planarUV(g);
}
function sawSpine(s, x0, x1, y, step = 0.006, depth = 0.0032) {
  for (let x = x0; x < x1; x += step) { s.lineTo(x + step * 0.5, y - depth); s.lineTo(x + step, y); }
}

const M = {
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.75, metalness: 0.05 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x6e3f1d, roughness: 0.6, metalness: 0 }),
  tape: () => new THREE.MeshStandardMaterial({ color: 0x9c9da0, roughness: 0.92, metalness: 0 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0xc9cdd3, roughness: 0.25, metalness: 1 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.35, metalness: 0.9 }),
};
const rbox = (w, h, d, r = 0.004) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));

let smear;
export function buildKnife(item, { shadows = false } = {}) {
  const { knife, skin, seed = 0, float: flt = 0.05 } = item;
  const sp = skinMaterialParams(skin, seed, flt);
  const bladeMat = new THREE.MeshStandardMaterial({ map: sp.map, metalness: sp.metalness, roughness: sp.roughness, emissive: sp.emissive, emissiveIntensity: 0.6, envMapIntensity: 1.4 });
  const paintMat = new THREE.MeshStandardMaterial({ map: sp.map, metalness: Math.min(0.6, sp.metalness), roughness: Math.max(0.35, sp.roughness), envMapIntensity: 1.1 });
  const handlePaint = skin === 'stock' ? M.dark() : paintMat;
  const root = new THREE.Group(); root.name = 'knife';
  const k = new THREE.Group(); root.add(k);
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = shadows; k.add(m); return m;
  };
  let blade, length = 0.17, gripX = -0.05;
  const s = new THREE.Shape();

  if (knife === 'shank') {
    s.moveTo(0, 0.013); s.lineTo(0.16, 0.012); s.quadraticCurveTo(0.176, 0.011, 0.182, 0.008);
    s.quadraticCurveTo(0.162, -0.012, 0.11, -0.016); s.lineTo(0, -0.016); s.closePath();
    blade = add(bladeGeo(s), bladeMat);
    add(rbox(0.105, 0.026, 0.017, 0.006), M.wood(), -0.052, -0.002, 0);
    const tape = M.tape();
    [-0.03, -0.055, -0.08].forEach((x, i) => add(new THREE.CylinderGeometry(0.0115 + i * 0.0006, 0.0115, 0.012 + i * 0.003, 14), tape, x, -0.002, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.78));
    add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.02, 8), M.steel(), -0.02, -0.002, 0, Math.PI / 2, 0, 0);
    length = 0.182;
  } else if (knife === 'karambit') {
    s.moveTo(0, 0.012); s.bezierCurveTo(0.05, 0.022, 0.092, 0.002, 0.094, -0.06);
    s.bezierCurveTo(0.072, -0.03, 0.04, -0.012, 0, -0.012); s.closePath();
    blade = add(bladeGeo(s), bladeMat);
    const h = new THREE.Shape();
    h.moveTo(0.004, 0.013); h.quadraticCurveTo(-0.05, 0.02, -0.098, 0.004); h.lineTo(-0.1, -0.02);
    h.quadraticCurveTo(-0.05, -0.008, 0.004, -0.013); h.closePath();
    add(new THREE.ExtrudeGeometry(h, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 3 }).translate(0, 0, -0.006), M.rubber());
    add(new THREE.TorusGeometry(0.019, 0.0055, 12, 28), M.dark(), -0.118, -0.012, 0);
    [-0.03, -0.06].forEach(x => add(new THREE.CylinderGeometry(0.003, 0.003, 0.022, 10), M.steel(), x, 0.003, 0, Math.PI / 2, 0, 0));
    length = 0.1; gripX = -0.06;
  } else if (knife === 'butterfly') {
    s.moveTo(0, 0.009); s.lineTo(0.082, 0.009); s.lineTo(0.116, 0.0); s.quadraticCurveTo(0.094, -0.01, 0.064, -0.01); s.lineTo(0, -0.01); s.closePath();
    blade = add(bladeGeo(s), bladeMat);
    const hs = new THREE.Shape();
    hs.moveTo(0, 0.008); hs.lineTo(-0.128, 0.008); hs.quadraticCurveTo(-0.134, 0, -0.128, -0.008); hs.lineTo(0, -0.008); hs.closePath();
    for (let i = 0; i < 4; i++) { const p = new THREE.Path(); const x = -0.02 - i * 0.027; p.moveTo(x, 0.0035); p.lineTo(x - 0.018, 0.0035); p.lineTo(x - 0.018, -0.0035); p.lineTo(x, -0.0035); p.closePath(); hs.holes.push(p); }
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 2 });
    planarUV(hg);
    const pivots = [];
    [0.0055, -0.0055].forEach((z, i) => {
      const pv = new THREE.Group(); pv.position.set(0, 0, 0); k.add(pv);
      const m = new THREE.Mesh(hg, handlePaint); m.position.z = z - (i ? 0.006 : 0); m.castShadow = shadows; pv.add(m);
      pivots.push(pv);
    });
    add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.026, 12), M.steel(), -0.004, 0, 0, Math.PI / 2, 0, 0);
    add(rbox(0.012, 0.004, 0.006, 0.0015), M.steel(), -0.134, 0.006, 0);
    root.userData.bfPivots = pivots;
    length = 0.116; gripX = -0.064;
  } else if (knife === 'bayonet') {
    s.moveTo(0, 0.014); sawSpine(s, 0.028, 0.094, 0.014); s.lineTo(0.12, 0.014);
    s.quadraticCurveTo(0.16, 0.013, 0.182, 0.0); s.quadraticCurveTo(0.166, -0.016, 0.13, -0.017); s.lineTo(0.012, -0.017); s.lineTo(0, -0.012); s.closePath();
    blade = add(bladeGeo(s), bladeMat);
    add(rbox(0.009, 0.05, 0.016, 0.003), M.dark(), -0.004, -0.002, 0);
    add(new THREE.TorusGeometry(0.0075, 0.0024, 10, 20), M.dark(), -0.004, 0.028, 0);
    const grip = new THREE.CylinderGeometry(0.0125, 0.0115, 0.105, 18); grip.rotateZ(Math.PI / 2); grip.scale(1, 1.05, 0.8);
    add(grip, M.rubber(), -0.06, 0, 0);
    for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(0.0122, 0.0013, 6, 18), M.rubber(), -0.025 - i * 0.014, 0, 0, 0, Math.PI / 2, 0).scale.set(1, 1.05, 0.8);
    add(rbox(0.016, 0.026, 0.02, 0.005), M.dark(), -0.118, 0, 0);
    length = 0.182; gripX = -0.06;
  } else if (knife === 'huntsman') {
    s.moveTo(0, 0.018); sawSpine(s, 0.02, 0.07, 0.018, 0.007, 0.004); s.lineTo(0.13, 0.018);
    s.quadraticCurveTo(0.172, 0.016, 0.207, 0.004); s.quadraticCurveTo(0.184, -0.021, 0.14, -0.022); s.lineTo(0, -0.022); s.closePath();
    blade = add(bladeGeo(s), bladeMat);
    add(rbox(0.011, 0.074, 0.02, 0.004), M.dark(), -0.005, -0.002, 0);
    const gh = new THREE.Shape();
    gh.moveTo(-0.01, 0.014); gh.lineTo(-0.11, 0.016); gh.quadraticCurveTo(-0.122, 0, -0.112, -0.018);
    [-0.09, -0.065, -0.04].forEach(x => { gh.quadraticCurveTo(x - 0.005, -0.012, x + 0.006, -0.018); });
    gh.lineTo(-0.01, -0.016); gh.closePath();
    add(new THREE.ExtrudeGeometry(gh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3 }).translate(0, 0, -0.007), M.rubber());
    add(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 10), M.steel(), -0.105, 0.0, 0, Math.PI / 2, 0, 0);
    length = 0.207; gripX = -0.062;
  } else { // flip
    s.moveTo(0, 0.012); s.lineTo(0.07, 0.013); s.quadraticCurveTo(0.11, 0.012, 0.126, 0.0); s.quadraticCurveTo(0.11, -0.013, 0.08, -0.014); s.lineTo(0, -0.014); s.closePath();
    const hole = new THREE.Path(); hole.absarc(0.016, 0.004, 0.0055, 0, Math.PI * 2, true); s.holes.push(hole);
    blade = add(bladeGeo(s), bladeMat);
    const hs = new THREE.Shape();
    hs.moveTo(0.004, 0.013); hs.lineTo(-0.105, 0.011); hs.quadraticCurveTo(-0.116, 0, -0.105, -0.012); hs.lineTo(0.004, -0.015); hs.closePath();
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2 }).translate(0, 0, -0.006);
    planarUV(hg);
    add(hg, handlePaint);
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 14), M.steel(), -0.004, 0, 0, Math.PI / 2, 0, 0);
    length = 0.126; gripX = -0.055;
  }
  k.position.x = -gripX; // grip centre at origin

  // Blood layer over the blade (opacity driven by game)
  smear ??= bloodSmearTexture();
  const bloodMat = new THREE.MeshStandardMaterial({ color: 0x7a0008, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0, alphaMap: smear, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const bl = new THREE.Mesh(blade.geometry, bloodMat); bl.scale.set(1, 1, 1.15); blade.add(bl);
  root.userData = { ...root.userData, blade, bloodMat, length, tipX: length - gripX };
  return root;
}

export function setKnifeBlood(knife, amount) {
  knife.userData.bloodMat.opacity = Math.max(0, Math.min(0.95, amount));
}

export function disposeKnife(knife) {
  knife.traverse(o => { if (o.isMesh) { o.geometry.dispose?.(); } });
}
