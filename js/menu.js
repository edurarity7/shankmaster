// Main-menu stage: your character on a glowing podium in front of a royal-blue London skyline. Drag to spin.
import * as THREE from 'three';
import { Character, toon } from './characters.js';
import { buildKnife } from './knives.js';
import { radialTexture } from './textures.js';

export class MenuStage {
  constructor(env) {
    const S = this.scene = new THREE.Scene();
    S.environment = env;
    S.fog = new THREE.Fog(0x0b2a8f, 14, 40);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    const bg = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec3 p; void main(){ vec3 top = vec3(0.02,0.07,0.32); vec3 mid = vec3(0.07,0.25,0.85); vec3 hor = vec3(0.45,0.62,1.0); float h = p.y; vec3 c = h > 0.05 ? mix(mid, top, smoothstep(0.05, 0.6, h)) : mix(hor, mid, smoothstep(-0.15, 0.05, h)); gl_FragColor = vec4(c, 1.); }',
    }));
    S.add(bg);
    // skyline silhouettes (Big Ben, the Shard, the Gherkin, terraces) in two layers
    const layer = (z, col, pieces) => {
      const m = new THREE.MeshBasicMaterial({ color: col, fog: false });
      pieces.forEach(([x, w, h, kind]) => {
        let g;
        if (kind === 'shard') g = new THREE.ConeGeometry(w, h, 4);
        else if (kind === 'gherkin') g = new THREE.SphereGeometry(w, 16, 12);
        else g = new THREE.BoxGeometry(w, h, 0.5);
        const mesh = new THREE.Mesh(g, m);
        if (kind === 'gherkin') { mesh.scale.y = h / w / 2; mesh.position.set(x, h / 2, z); }
        else mesh.position.set(x, h / 2, z);
        if (kind === 'ben') { const top = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, w * 2.2, 4), m); top.position.set(x, h + w, z); S.add(top); const clock = new THREE.Mesh(new THREE.CircleGeometry(w * 0.35, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.2), fog: false })); clock.position.set(x, h - w * 0.8, z + 0.26); S.add(clock); }
        S.add(mesh);
      });
    };
    layer(-26, 0x1a3fb0, [[-14, 3, 9], [-9, 2.5, 6], [-4, 1.4, 16, 'ben'], [2, 4, 7], [7, 2.2, 18, 'shard'], [12, 2.4, 11, 'gherkin'], [16, 4, 8], [-19, 4, 6]]);
    layer(-18, 0x0f2a80, [[-12, 5, 4], [-6, 4, 3], [0, 6, 3.5], [6, 5, 4.5], [11, 4, 3], [-17, 4, 5], [17, 5, 3.5]]);
    // windows twinkling on the near layer
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.6, 0.9), fog: false });
    for (let i = 0; i < 60; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.35), winMat); w.position.set(-19 + Math.random() * 38, 0.5 + Math.random() * 3.2, -17.7); S.add(w); }
    // floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x0a1f6e, roughness: 0.75, metalness: 0.0, envMapIntensity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    // podium
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 1, roughness: 0.25, emissive: 0x3a2400 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x102a8a, metalness: 0.1, roughness: 0.6, envMapIntensity: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.3, 48), navy); base.position.y = 0.15; base.receiveShadow = true; S.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.05, 12, 64), gold); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; S.add(rim);
    this.glowRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 3.0), transparent: true, opacity: 0.85 }));
    this.glowRing.rotation.x = -Math.PI / 2; this.glowRing.position.y = 0.305; S.add(this.glowRing);
    const top = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.MeshStandardMaterial({ color: 0x1a3fc4, roughness: 0.55, metalness: 0.1, envMapIntensity: 0.4 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.302; top.receiveShadow = true; S.add(top);
    // lights
    S.add(new THREE.HemisphereLight(0xbcd2ff, 0x0a1a5a, 0.9));
    const key = this.key = new THREE.SpotLight(0xfff2dc, 45, 20, 0.45, 0.5, 1.2); key.position.set(2.5, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; S.add(key, key.target);
    const rimL = new THREE.DirectionalLight(0x6fb0ff, 2.2); rimL.position.set(-3, 3, -4); S.add(rimL);
    const rimR = new THREE.DirectionalLight(0xffb070, 1.0); rimR.position.set(4, 2, -3); S.add(rimR);
    // floating sparkles
    const n = 120, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 10; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.08, map: radialTexture('rgba(255,255,255,1)', 'rgba(120,180,255,0)'), color: new THREE.Color(1.6, 1.8, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    S.add(this.sparks);
    this.holder = new THREE.Group(); this.holder.position.y = 0.3; S.add(this.holder);
    this.knifeHolder = new THREE.Group(); S.add(this.knifeHolder);
    this.spin = 0; this.spinVel = 0; this.mode = 'home'; this.t = 0; this.emoteT = 3; this.look = new THREE.Vector3(0, 1.2, 0);
    this.bindDrag();
  }
  bindDrag() {
    let last = null;
    const down = e => { if (e.target.id !== 'gl') return; last = e.clientX; };
    addEventListener('pointerdown', down);
    addEventListener('pointermove', e => { if (last == null || !this.active) return; this.spinVel = (e.clientX - last) * 0.012; this.spin += this.spinVel; last = e.clientX; });
    addEventListener('pointerup', () => { last = null; });
  }
  setCharacter(outfit, item) {
    this.holder.clear();
    this.char = new Character(outfit, item);
    this.char.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.holder.add(this.char.root);
  }
  setKnife(item) {
    this.knifeHolder.clear();
    const k = buildKnife(item); k.scale.setScalar(5.2); this.knifeHolder.add(k); this.knife = k;
  }
  emote() { this.emoteT = 0; }
  update(dt, aspect) {
    this.t += dt;
    const portrait = aspect < 1;
    if (!this.active) return;
    this.spinVel *= Math.pow(0.05, dt);
    if (Math.abs(this.spinVel) < 0.001) this.spin += (0 - this.spin) * Math.min(1, dt * 0.8) * 0; // keep the user's angle
    this.holder.rotation.y = Math.PI - 0.25 + this.spin + Math.sin(this.t * 0.5) * 0.08;
    this.emoteT += dt;
    const e = this.emoteT < 1.2 ? this.emoteT / 1.2 : null;
    if (this.emoteT > 7 + Math.random() * 0.02) this.emoteT = 0;
    this.char?.update(dt, { speed: 0, emote: e });
    const pos = this.sparks.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) + dt * 0.25; if (y > 5) y = 0; pos.setY(i, y); }
    pos.needsUpdate = true;
    this.glowRing.material.opacity = 0.6 + Math.sin(this.t * 2.5) * 0.25;
    // camera framing per screen
    const C = this.camera, M = this.mode;
    let want, look, fov = portrait ? 40 : 30;
    if (M === 'knife') { want = new THREE.Vector3(0, 1.45, 2.6); look = new THREE.Vector3(0, 1.4, 0.6); fov = portrait ? 46 : 34; }
    else if (M === 'head') { want = new THREE.Vector3(0.15, 2.0, 2.1); look = new THREE.Vector3(0, 1.95, 0); fov = portrait ? 40 : 30; }
    else if (M === 'legs') { want = new THREE.Vector3(0.2, 0.9, 2.8); look = new THREE.Vector3(0, 0.75, 0); }
    else if (M === 'body') { want = new THREE.Vector3(0.2, 1.5, 3.0); look = new THREE.Vector3(0, 1.4, 0); }
    else if (M === 'store') { want = new THREE.Vector3(0, 1.4, 6.2); look = new THREE.Vector3(0, 1.6, 0); }
    else { want = portrait ? new THREE.Vector3(0, 1.5, 6.6) : new THREE.Vector3(0, 1.35, 5.6); look = new THREE.Vector3(0, portrait ? 1.2 : 1.1, 0); }
    if (M !== 'home') { // a bottom sheet covers ~60% of the screen: frame the subject in the space above it
      const shift = want.distanceTo(look) * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (portrait ? (M === 'head' ? 0.45 : 0.58) : 0.0);
      look.y -= shift; want.y -= shift * 0.4;
      if (!portrait) { look.x -= want.distanceTo(look) * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect * 0.42; }
    }
    C.position.lerp(want, Math.min(1, dt * 4)); this.look.lerp(look, Math.min(1, dt * 4)); C.lookAt(this.look);
    C.fov += (fov - C.fov) * Math.min(1, dt * 4); C.aspect = aspect; C.updateProjectionMatrix();
    this.knifeHolder.visible = M === 'knife';
    if (this.knife) { this.knifeHolder.position.set(0, 1.4, 0.6); this.knife.rotation.set(0.2 + Math.sin(this.t) * 0.1, this.t * 0.8, 0.5); }
    this.holder.visible = M !== 'knife';
    this.key.target.position.set(0, 1, 0);
  }
}
