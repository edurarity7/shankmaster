// Shared car dressing for parked cars (map.js) and traffic (npcs.js): glass greenhouse, lights, bumpers, plates, hubcaps.
// `add(geo, mat, x, y, z)` adds a mesh to the car group. Car faces -Z (front), cabin centred at z = cz with length cl.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);
const MATS = {};
const M = (k, f) => MATS[k] ??= f();
const glowM = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

export function carDetails(add, cz, cl) {
  const glass = M('glass', () => new THREE.MeshStandardMaterial({ color: 0x0c1430, roughness: 0.05, metalness: 0.45, envMapIntensity: 2 }));
  const trim = M('trim', () => new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6 }));
  const chrome = M('chrome', () => new THREE.MeshStandardMaterial({ color: 0xe6e8ee, roughness: 0.18, metalness: 1 }));
  // a glass band slightly wider/longer than the cabin → windows on all four sides with a body-coloured roof on top
  add(rb(1.72, 0.44, cl - 0.01, 0.24), glass, 0, 1.45, cz);
  [-1, 1].forEach(s => add(new THREE.BoxGeometry(0.03, 0.44, 0.07), trim, 0.865 * s, 1.45, cz + 0.05)); // B-pillars
  [-1, 1].forEach(s => add(rb(0.12, 0.1, 0.2, 0.03), trim, 0.98 * s, 1.18, cz - cl / 2 + 0.25)); // wing mirrors
  add(rb(1.96, 0.24, 0.3, 0.09), trim, 0, 0.42, -2.12); add(rb(1.96, 0.24, 0.3, 0.09), trim, 0, 0.42, 2.12); // bumpers
  add(rb(0.52, 0.13, 0.03, 0.02), M('plateF', () => new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 })), 0, 0.6, -2.22);
  add(rb(0.52, 0.13, 0.03, 0.02), M('plateR', () => new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.4 })), 0, 0.6, 2.22);
  [-0.68, 0.68].forEach(x => {
    add(rb(0.34, 0.14, 0.06, 0.04), M('tail', () => glowM(2.4, 0.12, 0.1)), x, 0.92, 2.19);
    add(rb(0.36, 0.16, 0.06, 0.05), M('headL', () => glowM(2.6, 2.5, 2.1)), x, 0.86, -2.19);
  });
  add(rb(0.7, 0.12, 0.04, 0.03), M('grille', () => new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.4, metalness: 0.5 })), 0, 0.82, -2.2);
  [-1, 1].forEach(s => add(new THREE.BoxGeometry(0.02, 0.62, 0.02), trim, 0.955 * s, 0.82, 0.2)); // door seams
  [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([x, z]) => {
    const h = add(new THREE.CylinderGeometry(0.21, 0.21, 0.27, 16), chrome, x, 0.36, z); h.rotation.z = Math.PI / 2;
  });
}
