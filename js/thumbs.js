// Offscreen renderer that turns knives/characters into PNG thumbnails for the UI.
import * as THREE from 'three';
import { makeEnvScene } from './textures.js';
import { buildKnife, disposeKnife } from './knives.js';
import { Character } from './characters.js';

export class Thumbs {
  constructor() {
    this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setPixelRatio(1); this.r.setSize(320, 160, false);
    this.r.outputColorSpace = THREE.SRGBColorSpace; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r); this.scene.environment = pm.fromScene(makeEnvScene(), 0.03).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334477, 1.3));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 4); this.scene.add(d);
    const rim = new THREE.DirectionalLight(0x6fb0ff, 1.5); rim.position.set(-3, 1, -2); this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(22, 2, 0.01, 50);
    this.cache = new Map();
  }
  frame(obj, w, h, pad = 1.08) {
    this.r.setSize(w, h, false); this.cam.aspect = w / h;
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    obj.position.sub(c);
    const t = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    this.cam.position.set(0, 0, Math.max(size.y / 2 / t, size.x / 2 / t / this.cam.aspect) * pad + size.z); this.cam.lookAt(0, 0, 0); this.cam.updateProjectionMatrix();
  }
  knife(item, w = 320, h = 160) {
    const key = `k|${item.knife}|${item.skin}|${item.seed}|${Math.round(item.float * 50)}|${w}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const k = buildKnife(item); const g = new THREE.Group(); g.add(k);
    k.rotation.set(0.35, -0.25, 0.42);
    this.scene.add(g); this.frame(g, w, h);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(g); disposeKnife(k);
    this.cache.set(key, url); return url;
  }
  // Thumbnail of one drip item, worn by the player's own character, framed on that body part.
  drip(outfit, slot, w = 180, h = 150) {
    const key = 'd|' + slot + JSON.stringify(outfit) + w;
    if (this.cache.has(key)) return this.cache.get(key);
    const c = new Character(outfit, null); const g = new THREE.Group(); g.add(c.root);
    c.update(0.016, { speed: 0 });
    const back = slot === 'back';
    c.root.rotation.y = back ? 0.5 : Math.PI - 0.35; c.root.updateMatrixWorld(true);
    const F = { head: [1.9, 1.5, 24], face: [1.76, 1.15, 22], top: [1.25, 2.4, 30], neck: [1.42, 1.2, 24], back: [1.3, 2.2, 30], gloves: [1.0, 1.5, 30], legs: [0.55, 2.4, 32], kicks: [0.1, 1.3, 28] }[slot] || [1.2, 3, 30];
    this.scene.add(g);
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = F[2];
    this.cam.position.set(0.15, F[0] + 0.1, F[1] + 0.2); this.cam.lookAt(0, F[0], 0); this.cam.updateProjectionMatrix();
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(g); this.cam.fov = 22; c.dispose();
    this.cache.set(key, url); return url;
  }
  // head-and-shoulders portrait of an outfit
  char(outfit, w = 220, h = 220) {
    const key = 'c|' + JSON.stringify(outfit) + w;
    if (this.cache.has(key)) return this.cache.get(key);
    const c = new Character(outfit, null); const g = new THREE.Group(); g.add(c.root);
    c.update(0.016, { speed: 0 }); c.root.rotation.y = Math.PI - 0.3; c.root.updateMatrixWorld(true);
    this.scene.add(g);
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = 26;
    this.cam.position.set(0.25, 1.75, 2.4); this.cam.lookAt(0, 1.45, 0); this.cam.updateProjectionMatrix();
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(g); this.cam.fov = 22; c.dispose();
    this.cache.set(key, url); return url;
  }
}
