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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x553366, 1.2));
    const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); this.scene.add(d);
    this.cam = new THREE.PerspectiveCamera(22, 2, 0.01, 50);
    this.cache = new Map();
  }
  frame(obj, w, h, pad = 1.08) {
    this.r.setSize(w, h, false); this.cam.aspect = w / h;
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    obj.position.sub(c);
    const fitH = size.y / 2 / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)), fitW = size.x / 2 / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) / this.cam.aspect;
    this.cam.position.set(0, 0, Math.max(fitH, fitW) * pad + size.z); this.cam.lookAt(0, 0, 0); this.cam.updateProjectionMatrix();
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
  char(id, w = 200, h = 200) {
    const key = `c|${id}|${w}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const c = new Character(id, null); const g = new THREE.Group(); g.add(c.root);
    c.update(0.016, { speed: 0 }); c.root.rotation.y = Math.PI - 0.35;
    c.root.updateMatrixWorld(true);
    this.scene.add(g); this.frame(g, w, h, 1.0);
    this.cam.position.y += 0.3; this.cam.lookAt(0, 0.25, 0);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(g);
    this.cache.set(key, url); return url;
  }
}
