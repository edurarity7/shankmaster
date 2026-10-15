// "The Ends" — a stylised London street arena with a park, parkour props, jump pads and pickups.
// Collision is 2.5D: XZ boxes with a top height. Anything with a top below your feet + STEP can be stood on.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, inked, Character } from './characters.js';
import { PRESETS } from './data.js';
import { carDetails } from './vehicles.js';
import { panelTexture, brickTexture, asphaltTexture, paveTexture, grassTexture, signTexture, windowTexture, graffitiTexture, crateTexture, stripeTexture, radialTexture, bumpOf, shadeStripTexture } from './textures.js';

export const STEP = 0.4;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
// textured material + its matching bump map at the same tiling
const surf = (src, rx, ry, o = {}, bump = 1.2) => {
  const map = src.clone(); map.repeat.set(rx, ry); map.needsUpdate = true;
  const b = bumpOf(src), m = std(0xffffff, { map, ...o });
  if (b) { m.bumpMap = b.clone(); m.bumpMap.repeat.set(rx, ry); m.bumpMap.needsUpdate = true; m.bumpScale = bump; }
  return m;
};

export class GameMap {
  constructor(quality = 'high') {
    this.group = new THREE.Group(); this.colliders = []; this.q = quality; this.mat = {};
    this.pads = []; this.pickupSpots = []; this.animated = [];
    this.build();
    this.extras();
    this.mergeStatic();
    this.buildWaypoints();
  }
  M(key, make) { return this.mat[key] ??= make(); }
  mesh(geo, mat, x, y, z, { shadow = true, recv = true } = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = recv; this.group.add(m); return m;
  }
  box(w, h, d, mat, x, y, z, { collide = true, round = 0, shadow = true } = {}) {
    const g = round ? new RoundedBoxGeometry(w, h, d, 2, round) : new THREE.BoxGeometry(w, h, d);
    const m = this.mesh(g, mat, x, y + h / 2, z, { shadow });
    if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y + h });
    return m;
  }
  collider(x0, x1, z0, z1, h = 50) { this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, h }); }
  plane(w, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; this.group.add(m); return m;
  }
  build() {
    const G = this.group;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x1236b8) }, mid: { value: new THREE.Color(0x4f8cff) }, bot: { value: new THREE.Color(0xffc49a) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.75, h)) : mix(bot, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c,1.); }`,
    }));
    sky.renderOrder = -1; sky.userData.dynamic = true; G.add(sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,240,200,1)', 'rgba(255,190,120,0)'), fog: false, depthWrite: false }));
    sun.scale.setScalar(70); sun.position.set(160, 70, -220); G.add(sun);
    const cloudMat = std(0xffffff, { roughness: 1, emissive: 0x6070a0, emissiveIntensity: 0.3 });
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group(), a = (i / 16) * Math.PI * 2 + Math.random() * 0.3, r = 150 + Math.random() * 60;
      for (let j = 0; j < 6; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 7, 14, 10), cloudMat); s.position.set(j * 7 - 18, Math.random() * 5, Math.random() * 6); c.add(s); }
      c.position.set(Math.cos(a) * r, 50 + Math.random() * 35, Math.sin(a) * r); c.scale.y = 0.6; c.lookAt(0, c.position.y, 0); G.add(c);
    }
    // ---- ground ----
    const grassT = grassTexture(), grass = surf(grassT, 30, 30, {}, 0.6);
    this.plane(220, 220, grass, 0, -0.01, 0);
    this.asphaltT = asphaltTexture(); const asphalt = surf(this.asphaltT, 2, 16, { roughness: 0.88 }, 0.8);
    this.plane(8, 66, asphalt, 0, 0.0, 0);
    const pave = surf(paveTexture(), 1.5, 33, { roughness: 0.85 }, 1.4);
    this.plane(3, 66, pave, -5.5, 0.06, 0); this.plane(3, 66, pave, 5.5, 0.06, 0);
    const kerb = this.M('kerb', () => std(0xd8d5ce));
    [-4, 4].forEach(x => this.box(0.2, 0.12, 66, kerb, x, 0, 0, { collide: false, shadow: false, round: 0.05 }));
    const white = this.M('white', () => new THREE.MeshBasicMaterial({ color: 0xf6f6f6 })), yellow = this.M('yel', () => new THREE.MeshBasicMaterial({ color: 0xffcc1a }));
    for (let z = -30; z < 31; z += 4) if (Math.abs(z) > 3) this.plane(0.14, 2, white, 0, 0.012, z);
    [-3.75, -3.6, 3.6, 3.75].forEach(x => this.plane(0.08, 66, yellow, x, 0.012, 0));
    for (let i = -3; i <= 3; i++) this.plane(0.55, 3, white, i * 1.1, 0.013, 0);
    [-4.4, 4.4].forEach(x => [-1.8, 1.8].forEach(z => this.beacon(x, z)));
    const parkGrass = surf(grassT, 4, 5.3, {}, 0.6);
    this.plane(15, 20, parkGrass, 14.5, 0.03, 0);
    const path = this.M('path', () => std(0xe6d4b0));
    this.plane(15, 2.2, path, 14.5, 0.04, 0); this.plane(2.2, 20, path, 14, 0.045, 0);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.6, 48), path); ring.rotation.x = -Math.PI / 2; ring.position.set(14, 0.05, 0); ring.receiveShadow = true; G.add(ring);

    // ---- buildings ----
    const bricks = [brickTexture('#c0583a'), brickTexture('#9a4e38', '#d8c4ac'), brickTexture('#d6ab7c', '#efe2cc'), brickTexture('#8a4130')];
    [[-32, -18], [-18, -4], [-4, 10], [10, 22], [22, 32]].forEach(([z0, z1], i) => this.terrace(-14, -7, z0, z1, 'x+', bricks[i % 4], 8 + (i % 2) * 1.5, i));
    [[-32, -20], [-20, -10]].forEach(([z0, z1], i) => this.terrace(7, 22, z0, z1, 'x-', bricks[(i + 2) % 4], 9 + i, i + 5));
    [[10, 21], [21, 32]].forEach(([z0, z1], i) => this.terrace(7, 22, z0, z1, 'x-', bricks[(i + 1) % 4], 8.5 + i, i + 7));
    this.tower(22, 30, -10, 10);
    this.shop(-7, -2.2, -38, -32, 'PERI PERI PALACE', '#d61f2a', '#ffd23a', 'FRIED CHICKEN · OPEN TILL 4AM', 0xff5040);
    this.shop(2.2, 7, -38, -32, 'OFF LICENCE', '#1238c9', '#ffffff', 'NEWS · LOTTO · CARDS', 0x5f8cff);
    this.bridge();
    this.northRoad();

    // ---- cover + parkour ----
    this.bus(-2.65, -9);
    this.car(2.1, 10.3, 0x161616, true);
    this.car(-2.5, 18.2, 0xb8c2cc, false);
    this.car(2.4, -22, 0x2a63e0, false);
    this.phoneBox(5.1, 2.6);
    this.busStop(5.1, -5);
    [[6.0, 19.2], [6.0, 20.2], [-6.0, -19.5], [-6.0, -18.5], [-6.0, -17.5]].forEach(([x, z], i) => this.bin(x, z, [0x1c6a3a, 0x2a2a2a, 0x1c4ab0][i % 3]));
    this.skip(-5.7, 24.5);
    this.postBox(5.2, -15);
    for (let z = -26; z <= 26; z += 13) { this.lamp(-4.4, z); if (z + 6.5 < 31) this.lamp(4.4, z + 6.5); }
    for (let z = -30; z < 30; z += 6) if (Math.abs(z - 2) > 3 && z !== -30) this.box(0.45, 0.85, 3.6, this.M('wallb', () => surf(this.brickW ??= brickTexture('#a24c33'), 1.2, 0.3)), -6.6, 0, z + 1.8, { round: 0.06 });
    this.crates([[-5.2, -23.6, 0], [-5.4, -25.0, 0], [-5.4, -25.0, 1]]);
    this.scaffold(-6.3, -28.6, 2.2, 1.4, 5);
    this.crates([[5.4, 12.8, 0], [6.3, 12.8, 0], [6.3, 13.9, 0], [6.3, 13.9, 1]]);
    this.crates([[-1.6, 3.4, 0], [1.6, -3.2, 0]]);
    this.mattress(-5.3, 7.5);
    this.trampoline(17.5, 3.6);
    this.statue(14, 0);
    [[10, -6.5], [18.5, -7], [10.2, 6.8], [19.2, 7.2]].forEach(([x, z]) => this.tree(x, z));
    [[11, 3.6, 0], [17, -3.6, Math.PI], [11, -3.6, Math.PI]].forEach(([x, z, r]) => this.bench(x, z, r));
    const hedge = this.M('hedge', () => toon(0x2fa04a));
    this.hedge(8.6, 9.2, -9.4, -4.5, hedge); this.hedge(8.6, 9.2, 4.5, 9.4, hedge); this.hedge(19.8, 21.2, -2, 2, hedge);
    this.railing(7.1, -9.8, -2.2); this.railing(7.1, 2.2, 9.8);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: graffitiTexture(), transparent: true }));
    gr.position.set(-5.4, 2.0, 31.9); gr.rotation.y = Math.PI; G.add(gr);
    const ss = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('ENDZ ROAD E14', { bg: '#ffffff', fg: '#111', border: '#c8102e', font: 'Rubik, Arial' }) }));
    ss.position.set(-6.97, 2.6, -8); ss.rotation.y = Math.PI / 2; G.add(ss);

    this.pickupSpots = [{ x: 0, z: 0.0 }, { x: 14, z: 6.2 }, { x: -5.3, z: -12 }, { x: 5.6, z: 24 }, { x: -6.3, z: -29.5, y: 2.2 }, { x: 0.8, z: -26 }, { x: 14, z: -8.4 }];
    this.collider(-30, -7.0, -40, 40); this.collider(7, 40, -40, -10); this.collider(7, 40, 10, 40);
    this.collider(-30, -2.2, -40, -32); this.collider(2.2, 40, -40, -32); this.collider(-30, -3.6, 32, 40); this.collider(3.6, 40, 32, 40); this.collider(22, 40, -40, 40);
    this.spawns = [
      [{ x: 0, z: 28 }, { x: 0, z: -28 }],
      [{ x: -5.2, z: 29.5 }, { x: 18, z: -5 }],
      [{ x: 18, z: 5 }, { x: -5.4, z: -21 }],
      [{ x: 5.5, z: 27 }, { x: 0.5, z: -28 }],
    ];
  }
  beacon(x, z) {
    for (let i = 0; i < 8; i++) this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), this.M(i % 2 ? 'bk' : 'wt', () => std(i % 2 ? 0x111111 : 0xffffff)), x, 0.15 + i * 0.3, z, { shadow: false });
    const globe = this.mesh(new THREE.SphereGeometry(0.2, 16, 12), this.M('beacon', () => glow(2.4, 1.3, 0.1)), x, 2.55, z, { shadow: false }); globe.userData.dynamic = true;
    this.animated.push(t => { globe.visible = Math.sin(t * 4) > -0.3; });
    this.collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1, 2.7);
  }
  terrace(x0, x1, z0, z1, face, brick, h, seed) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const mat = surf(brick, Math.max(w, d) / 3, h / 3);
    this.box(w, h, d, mat, cx, 0, cz);
    const trim = this.M('trim', () => std(0xf3ece0));
    const out = face === 'x+' ? 1 : -1, fx = face === 'x+' ? x1 : x0;
    this.box(0.35, 0.35, d, trim, fx + out * 0.12, h - 0.4, cz, { collide: false });
    this.box(0.18, 0.5, d, this.M('plinth', () => std(0x6d6a72)), fx + out * 0.05, 0, cz, { collide: false, shadow: false });
    const roofShape = new THREE.Shape(); roofShape.moveTo(-w / 2 - 0.3, 0); roofShape.lineTo(0, 2.2); roofShape.lineTo(w / 2 + 0.3, 0); roofShape.closePath();
    const rg = new THREE.ExtrudeGeometry(roofShape, { depth: d, bevelEnabled: false }); rg.translate(0, 0, -d / 2);
    this.mesh(rg, this.M('roof' + (seed % 2), () => std(seed % 2 ? 0x3c4258 : 0x4a3a3a, { roughness: 0.9 })), cx, h, cz);
    const ry = face === 'x+' ? Math.PI / 2 : -Math.PI / 2;
    this.shadeStrip(fx + out * 0.55, cz, 1.1, d, out);
    const houses = Math.max(1, Math.round(d / 4.5)), hw = d / houses;
    const doorCols = [0x1f4fbf, 0xc8102e, 0x1d8b4a, 0x111111, 0xf2c418, 0x6a2a8a];
    const frame = this.M('frame', () => std(0xffffff));
    for (let i = 0; i < houses; i++) {
      const z = z0 + hw * (i + 0.5), dz = z - hw * 0.25;
      this.box(0.12, 2.5, 1.5, frame, fx + out * 0.04, 0, dz, { collide: false, shadow: false });
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.14, 2.2, 1.1, 2, 0.04), this.M('door' + (i % 6), () => std(doorCols[i % 6], { roughness: 0.4 })));
      door.position.set(fx + out * 0.07, 1.1, dz); this.group.add(door);
      this.mesh(new THREE.SphereGeometry(0.05, 8, 6), this.M('brass', () => std(0xffcc55, { metalness: 1, roughness: 0.25 })), fx + out * 0.16, 1.1, dz + 0.35, { shadow: false });
      this.box(0.5, 0.18, 1.5, this.M('step', () => std(0xdedad2)), fx + out * 0.25, 0, dz, { collide: false, shadow: false });
      for (let f = 0; f < Math.floor(h / 3); f++) {
        for (const off of f === 0 ? [0.22] : [-0.25, 0.22]) {
          const lit = (seed * 7 + i * 3 + f + (off > 0 ? 1 : 0)) % 4 === 0;
          const wz = z + hw * off, wy = 1.6 + f * 3;
          this.box(0.1, 1.75, 1.3, frame, fx + out * 0.03, wy - 0.88, wz, { collide: false, shadow: false });
          const v = (seed + i * 2 + f) % 3;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), this.M('win' + lit + v, () => lit ? new THREE.MeshStandardMaterial({ map: windowTexture(true, v), emissiveMap: windowTexture(true, v, true), emissive: new THREE.Color(1.5, 1.3, 1.0), roughness: 0.2 })
            : new THREE.MeshStandardMaterial({ map: windowTexture(false, v), roughness: 0.08, metalness: 0, envMapIntensity: 1.8 })));
          win.position.set(fx + out * 0.09, wy, wz); win.rotation.y = ry; this.group.add(win);
          this.box(0.25, 0.08, 1.4, frame, fx + out * 0.12, wy - 0.86, wz, { collide: false, shadow: false });
          if (f === 1 && (seed + i + (off > 0 ? 1 : 0)) % 3 === 0) this.flowerBox(fx + out * 0.26, wy - 0.78, wz, (seed + i) % 4);
        }
      }
      if (i > 0) this.mesh(new THREE.CylinderGeometry(0.055, 0.055, h - 0.3, 8), this.M('pipe', () => std(0x23262e, { roughness: 0.5, metalness: 0.3 })), fx + out * 0.12, (h - 0.3) / 2, z0 + hw * i, { shadow: false });
      if ((seed + i) % 3 === 1 && h > 6) { const dish = this.mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, 0.9), this.M('dish', () => std(0xe8e8ec, { roughness: 0.4, side: THREE.DoubleSide })), fx + out * 0.35, h - 1.6, z - hw * 0.05, { shadow: false }); dish.rotation.z = -out * 1.2; }
      this.box(0.8, 1.4, 1.1, this.M('chim', () => std(0x9a4a34)), cx, h + 1.2, z0 + hw * i + 0.9, { collide: false });
      [-0.2, 0.2].forEach(o => this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 10), this.M('pot', () => std(0xc8703a)), cx + o, h + 2.75, z0 + hw * i + 0.9, { shadow: false }));
    }
  }
  tower(x0, x1, z0, z1) {
    const h = 34, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.box(x1 - x0, h, z1 - z0, this.M('tower', () => surf(panelTexture(), (z1 - z0) / 6, h / 6, { roughness: 0.9 }, 1)), cx, 0, cz);
    const winMat = this.M('twin', () => new THREE.MeshStandardMaterial({ map: windowTexture(false, 2), roughness: 0.08, envMapIntensity: 1.8 })), litMat = this.M('twinl', () => new THREE.MeshBasicMaterial({ map: windowTexture(true), color: new THREE.Color(1.6, 1.4, 1.1) }));
    const balc = this.M('balc', () => std(0x8a93a8));
    for (let f = 0; f < 10; f++) for (let i = 0; i < 6; i++) {
      const z = z0 + 1.6 + i * 3.4, y = 2 + f * 3.3;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), (f * 6 + i) % 5 === 0 ? litMat : winMat); w.position.set(x0 - 0.02, y, z); w.rotation.y = -Math.PI / 2; this.group.add(w);
      if (f > 0 && i % 2 === 0) this.box(0.8, 0.9, 2.6, balc, x0 - 0.4, y - 1.25, z + 1.7, { collide: false });
    }
    const red = this.mesh(new THREE.SphereGeometry(0.4, 10, 8), glow(3, 0.2, 0.2), cx, h + 0.4, cz, { shadow: false }); red.userData.dynamic = true;
    this.animated.push(t => { red.visible = Math.sin(t * 2.5) > 0; });
  }
  shop(x0, x1, z0, z1, name, bg, fg, sub, glowC) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 7.5;
    this.box(w, h, d, surf(this.brickS ??= brickTexture('#a24b33'), w / 3, h / 3), cx, 0, cz);
    const front = z1 + 0.03;
    this.box(w - 0.2, 1.5, 0.15, this.M('signbox', () => std(0x222222)), cx, 2.65, front - 0.02, { collide: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(name, { bg, fg, sub, glow: fg }), color: new THREE.Color(1.5, 1.5, 1.5) }));
    sign.position.set(cx, 3.4, front + 0.07); this.group.add(sign);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.3), glow(1.4, 1.15, 0.8)); glass.position.set(cx, 1.35, front); this.group.add(glass);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.12, 1.4), std(0xffffff, { map: stripeTexture(bg, '#ffffff') })); awn.position.set(cx, 2.55, front + 0.7); awn.rotation.x = 0.25; awn.castShadow = true; this.group.add(awn);
    const light = new THREE.PointLight(glowC, 8, 10, 2); light.position.set(cx, 2.6, front + 1.6); this.group.add(light);
  }
  bridge() {
    // railway bridge with a real tunnel opening — traffic drives in and out of the dark
    const brick = surf(brickTexture('#6e3426', '#9d8a78'), 4, 3);
    this.box(18.4, 9, 3, brick, -12.8, 0, 33.5); this.box(18.4, 9, 3, brick, 12.8, 0, 33.5);
    this.box(7.2, 4.0, 3, brick, 0, 5.0, 33.5, { collide: false });
    const dark = new THREE.MeshBasicMaterial({ color: 0x03050e, side: THREE.BackSide });
    const tunnel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 5.0, 14), dark); tunnel.position.set(0, 2.5, 39); this.group.add(tunnel);
    this.mesh(new THREE.PlaneGeometry(7.2, 14), this.M('tunnelroad', () => std(0x1a1c24)), 0, 0.01, 39, { shadow: false }).rotation.x = -Math.PI / 2;
    const lampM = glow(2.2, 1.6, 0.8); [35.5, 40, 44.5].forEach(z => this.mesh(new THREE.BoxGeometry(0.5, 0.08, 0.2), lampM, 0, 4.85, z, { shadow: false }));
    this.box(44, 0.8, 3.6, this.M('rail', () => std(0x3a2a2a)), 0, 9, 33.5, { collide: false });
    this.collider(-3.6, 3.6, 32, 35, 50); // players can't walk into the tunnel
  }
  // the street carries on north past the shops — traffic drives off into the fog
  northRoad() {
    const asphalt = this.M('asph2', () => surf(this.asphaltT, 1.1, 15, { roughness: 0.88 }, 0.8));
    this.plane(4.4, 60, asphalt, 0, 0.0, -62);
    const white = this.M('white', () => new THREE.MeshBasicMaterial({ color: 0xf6f6f6 }));
    for (let z = -34; z > -90; z -= 4) this.plane(0.14, 2, white, 0, 0.012, z);
    const bricks = [brickTexture('#b65a3c'), brickTexture('#8f4a36', '#cbb8a2')];
    [-1, 1].forEach((sd, i) => this.box(10, 10, 56, surf(bricks[i], 16, 3), sd * 7.3, 0, -66, { collide: false }));
    const bol = this.M('bollard', () => std(0x16181d, { metalness: 0.5, roughness: 0.4 })), band = this.M('bolband', () => glow(1.6, 1.6, 1.6));
    [-2.0, 2.0].forEach(x => { this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.0, 14), bol, x, 0.5, -32.3); this.mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.08, 14), band, x, 0.85, -32.3, { shadow: false }); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: signTexture('ONE WAY ↑', { bg: '#1238c9', fg: '#ffffff', w: 256, h: 256, font: 'Rubik, Arial' }), color: new THREE.Color(1.3, 1.3, 1.3) }));
    sign.position.set(4.3, 2.4, 30.5); sign.rotation.y = Math.PI; this.group.add(sign);
    this.collider(-2.2, 2.2, -33.5, -32.2, 50);
  }
  bus(x, z) {
    const g = new THREE.Group(), red = this.M('busred', () => std(0xe0141e, { roughness: 0.35 })), glass = this.M('busglass', () => std(0x16234a, { roughness: 0.1, metalness: 0.5 })), cream = this.M('cream', () => std(0xf0e6c8));
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.5, 4.3, 10.4, 4, 0.35), red); body.position.y = 2.35; g.add(body);
    [[1.25, 1.75], [3.55, 1.05]].forEach(([y, hgt]) => [-1.26, 1.26].forEach(sx => { const w = new THREE.Mesh(new RoundedBoxGeometry(0.06, hgt, 9.4, 2, 0.02), glass); w.position.set(sx, y + 0.6, 0); g.add(w); }));
    [-1.27, 1.27].forEach(sx => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 10.2), cream); s.position.set(sx, 2.75, 0); g.add(s); });
    const fw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 0.05), glass); fw.position.set(0, 1.85, -5.21); g.add(fw);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: signTexture('25 ENDZ', { bg: '#111', fg: '#ffbf00', font: 'Rubik, Arial' }), color: new THREE.Color(1.6, 1.6, 1.6) })); dest.position.set(0, 3.2, -5.23); dest.rotation.y = Math.PI; g.add(dest);
    [-0.8, 0.8].forEach(hx => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), glow(2, 2, 1.6)); l.position.set(hx, 0.9, -5.22); g.add(l); });
    const wheel = this.M('tyre', () => std(0x151515));
    [[-1.15, -3.4], [1.15, -3.4], [-1.15, 3.2], [1.15, 3.2]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 20), wheel); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.55, wz); g.add(w); });
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); this.group.add(g);
    this.collider(x - 1.3, x + 1.3, z - 5.25, z + 5.25, 4.5);
  }
  car(x, z, color, cab) {
    const g = new THREE.Group(), body = std(color, { roughness: 0.28, metalness: 0.35 }), cz = cab ? 0.2 : 0.3, cl = cab ? 2.6 : 2.2;
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); g.add(o); return o; };
    add(new RoundedBoxGeometry(1.9, 0.85, 4.4, 4, 0.3), body, 0, 0.75, 0);
    add(new RoundedBoxGeometry(1.7, 0.78, cl, 4, 0.3), body, 0, 1.45, cz);
    carDetails(add, cz, cl);
    if (cab) add(new RoundedBoxGeometry(0.5, 0.18, 0.18, 2, 0.04), glow(2.2, 1.5, 0), 0, 1.92, -0.3);
    const wheel = this.M('tyre', () => std(0x151515));
    [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([wx, wz]) => { const w = add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 18), wheel, wx, 0.36, wz); w.rotation.z = Math.PI / 2; });
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); this.group.add(g);
    const hl = cl / 2;
    this.collider(x - 0.95, x + 0.95, z - 2.2, z + 2.2, 1.18);
    this.collider(x - 0.85, x + 0.85, z + cz - hl, z + cz + hl, 1.86);
  }
  phoneBox(x, z) {
    const red = this.M('busred', () => std(0xe0141e, { roughness: 0.35 }));
    this.mesh(new RoundedBoxGeometry(1.0, 2.6, 1.0, 3, 0.08), red, x, 1.3, z);
    const top = this.mesh(new THREE.CylinderGeometry(0.15, 0.64, 0.3, 4), red, x, 2.75, z); top.rotation.y = Math.PI / 4;
    const glass = this.M('pglass', () => glow(1.3, 1.2, 0.9));
    [[-0.51, 0, Math.PI / 2], [0, -0.51, 0], [0, 0.51, 0]].forEach(([dx, dz, r]) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.6), glass); w.position.set(x + dx, 1.3, z + dz); w.rotation.y = r; this.group.add(w); });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.18), new THREE.MeshBasicMaterial({ map: signTexture('TELEPHONE', { bg: '#111', fg: '#fff', font: 'Rubik, Arial' }) })); s.position.set(x - 0.52, 2.42, z); s.rotation.y = -Math.PI / 2; this.group.add(s);
    this.collider(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 2.9);
  }
  busStop(x, z) {
    const frame = this.M('stopf', () => std(0x2a2d33, { metalness: 0.5, roughness: 0.4 })), glass = this.M('stopg', () => new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.3, roughness: 0.05 }));
    this.box(0.08, 2.4, 3.6, glass, x + 0.7, 0, z, { shadow: false });
    this.box(1.7, 0.12, 3.9, frame, x, 2.4, z, { collide: false });
    [[-0.7, -1.8], [-0.7, 1.8], [0.7, -1.8], [0.7, 1.8]].forEach(([dx, dz]) => this.box(0.08, 2.4, 0.08, frame, x + dx, 0, z + dz, { collide: false }));
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ map: signTexture('SHANKMASTER', { bg: '#1238c9', fg: '#ffcc33', sub: 'NOW IN THE ENDZ', w: 256, h: 384 }), color: new THREE.Color(1.4, 1.4, 1.4) }));
    ad.position.set(x + 0.65, 1.3, z - 1); ad.rotation.y = -Math.PI / 2; this.group.add(ad);
    this.box(0.4, 0.45, 2.4, this.M('seat', () => std(0x8a93a8)), x + 0.4, 0, z, { round: 0.05 });
  }
  bin(x, z, color) {
    const m = std(color, { roughness: 0.5 });
    this.mesh(new RoundedBoxGeometry(0.7, 1.05, 0.75, 3, 0.08), m, x, 0.53, z);
    this.mesh(new RoundedBoxGeometry(0.76, 0.07, 0.82, 2, 0.03), m, x, 1.08, z);
    this.collider(x - 0.36, x + 0.36, z - 0.38, z + 0.38, 1.12);
  }
  skip(x, z) {
    const m = this.M('skip', () => std(0xffb800, { roughness: 0.5 }));
    const s = this.mesh(new THREE.CylinderGeometry(1.25, 1.0, 1.3, 4, 1), m, x, 0.65, z); s.rotation.y = Math.PI / 4; s.scale.set(0.95, 1, 2.0);
    const junk = this.M('junk', () => std(0x6b5a48));
    [[0.2, -0.8], [-0.3, 0.4], [0.1, 1.1]].forEach(([dx, dz], i) => { const j = this.mesh(new RoundedBoxGeometry(0.6, 0.35, 0.7, 2, 0.06), junk, x + dx, 1.35, z + dz); j.rotation.y = i; });
    this.collider(x - 1.1, x + 1.1, z - 2.2, z + 2.2, 1.45);
  }
  postBox(x, z) {
    const red = this.M('busred', () => std(0xe0141e, { roughness: 0.35 }));
    this.mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 24), red, x, 0.7, z);
    this.mesh(new THREE.SphereGeometry(0.31, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red, x, 1.4, z);
    this.collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 1.7);
  }
  lamp(x, z) {
    const m = this.M('lamp', () => std(0x23262e, { metalness: 0.6, roughness: 0.4 }));
    this.mesh(new THREE.CylinderGeometry(0.06, 0.09, 5, 10), m, x, 2.5, z);
    const ax = x > 0 ? -0.5 : 0.5;
    this.mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), m, x + ax, 5, z, { shadow: false });
    this.mesh(new THREE.SphereGeometry(0.24, 14, 10), this.M('lampg', () => glow(2.4, 2.1, 1.5)), x + ax * 1.9, 4.9, z, { shadow: false });
    this.collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1, 5);
  }
  crates(list) {
    const mat = this.M('crate', () => std(0xffffff, { map: crateTexture(), roughness: 0.75 }));
    list.forEach(([x, z, lvl]) => {
      const m = this.mesh(new RoundedBoxGeometry(1.1, 1.0, 1.1, 2, 0.06), mat, x, 0.5 + lvl * 1.0, z);
      m.rotation.y = ((x * 7 + z) % 0.3);
      const ex = this.colliders.find(c => c.crate && Math.abs((c.minX + c.maxX) / 2 - x) < 0.01 && Math.abs((c.minZ + c.maxZ) / 2 - z) < 0.01);
      if (ex) ex.h = Math.max(ex.h, (lvl + 1) * 1.0); else this.colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55, h: (lvl + 1) * 1.0, crate: true });
    });
  }
  scaffold(x, z, h, w, d) {
    const pipe = this.M('pipe', () => std(0xb8bec8, { metalness: 0.8, roughness: 0.3 })), plank = this.M('plank', () => std(0xc89a5a, { roughness: 0.85 }));
    for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, 0, d / 2]) this.mesh(new THREE.CylinderGeometry(0.05, 0.05, h + 1.1, 8), pipe, x + dx, (h + 1.1) / 2, z + dz);
    this.box(w + 0.1, 0.12, d + 0.1, plank, x, h - 0.12, z, { collide: false });
    [1.0, 0.5].forEach(o => { const r = this.mesh(new THREE.CylinderGeometry(0.04, 0.04, d, 8), pipe, x + w / 2, h + o, z); r.rotation.x = Math.PI / 2; });
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
  }
  mattress(x, z) {
    const m = this.mesh(new RoundedBoxGeometry(1.4, 0.35, 2.0, 3, 0.15), this.M('matt', () => std(0xf2ecdd, { roughness: 0.95 })), x, 0.18, z);
    const stain = this.mesh(new THREE.CircleGeometry(0.3, 16), this.M('stain', () => std(0xd8c49a)), x + 0.2, 0.36, z - 0.3, { shadow: false }); stain.rotation.x = -Math.PI / 2;
    this.addPad(x, z, 0.85, 0.35, 12.5, m);
  }
  trampoline(x, z) {
    const frame = this.M('tframe', () => std(0x1238c9, { roughness: 0.4 }));
    this.mesh(new THREE.TorusGeometry(1.1, 0.09, 10, 30), frame, x, 0.6, z).rotation.x = Math.PI / 2;
    const mat = this.mesh(new THREE.CircleGeometry(1.05, 30), this.M('tmat', () => std(0x111111, { roughness: 0.6 })), x, 0.58, z, { shadow: false }); mat.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), frame, x + Math.cos(a) * 1.05, 0.3, z + Math.sin(a) * 1.05); }
    this.addPad(x, z, 1.05, 0.6, 14, mat);
  }
  addPad(x, z, r, h, power, mesh) {
    const pad = { x, z, r, h, power, mesh, squash: 0 }; mesh.userData.dynamic = true;
    this.pads.push(pad);
    this.colliders.push({ minX: x - r * 0.8, maxX: x + r * 0.8, minZ: z - r * 0.8, maxZ: z + r * 0.8, h, pad });
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r * 0.95, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.8, 2.4), transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, h + 0.03, z); ring.userData.dynamic = true; this.group.add(ring);
    this.animated.push(t => { const s = 1 + Math.sin(t * 4) * 0.08; ring.scale.set(s, s, s); ring.material.opacity = 0.45 + Math.sin(t * 4) * 0.25; });
  }
  statue(x, z) {
    const stone = this.M('stone', () => std(0x9a9486, { roughness: 1 }));
    this.box(2.2, 1.6, 2.2, stone, x, 0, z, { round: 0.08 });
    this.box(2.6, 0.3, 2.6, stone, x, 0, z, { collide: false, round: 0.06 });
    const c = new Character(PRESETS.zain.outfit, null);
    c.mats.forEach(m => { m.color.setHex(0xb07a52); });
    c.root.scale.setScalar(1.6); c.root.position.set(x, 1.6, z); c.root.rotation.y = -Math.PI / 2;
    c.arms[1].sh.rotation.set(2.6, 0, 0.3); c.arms[1].el.rotation.x = 0.3;
    c.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.group.add(c.root);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: signTexture('THE FIRST SHANKMASTER', { bg: '#3a3428', fg: '#e8d29a', font: 'Rubik, Arial' }) }));
    plaque.position.set(x - 1.11, 1.0, z); plaque.rotation.y = -Math.PI / 2; this.group.add(plaque);
  }
  tree(x, z) {
    this.mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.8, 10), this.M('trunk', () => toon(0x7a4a26)), x, 1.4, z);
    const leaf = this.M('leaf', () => toon(0x46c255)), leaf2 = this.M('leaf2', () => toon(0x2f9a45));
    [[0, 3.5, 0, 1.6, leaf], [0.9, 3.1, 0.3, 1.15, leaf2], [-0.8, 3.2, -0.2, 1.2, leaf2], [0.1, 4.5, -0.1, 1.1, leaf], [-0.3, 3.0, 0.8, 1.0, leaf]].forEach(([dx, y, dz, r, m]) => {
      const l = inked(new THREE.SphereGeometry(r, 18, 14), m); l.position.set(x + dx, y, z + dz); this.group.add(l);
    });
    this.collider(x - 0.28, x + 0.28, z - 0.28, z + 0.28, 6);
  }
  bench(x, z, r) {
    const g = new THREE.Group(), wood = this.M('bwood', () => std(0x9a6430)), iron = this.M('iron', () => std(0x222222, { metalness: 0.6, roughness: 0.4 }));
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new RoundedBoxGeometry(2, 0.06, 0.14, 2, 0.02), wood); s.position.set(0, 0.48, -0.18 + i * 0.17); g.add(s); }
    for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new RoundedBoxGeometry(2, 0.14, 0.05, 2, 0.02), wood); s.position.set(0, 0.7 + i * 0.18, 0.28); g.add(s); }
    [-0.85, 0.85].forEach(dx => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), iron); l.position.set(dx, 0.25, 0); g.add(l); });
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); g.rotation.y = r; this.group.add(g);
    this.collider(x - 1, x + 1, z - 0.3, z + 0.3, 0.52);
  }
  hedge(x0, x1, z0, z1, mat) {
    const h = inked(new RoundedBoxGeometry(x1 - x0, 1.2, z1 - z0, 3, 0.28), mat); h.position.set((x0 + x1) / 2, 0.6, (z0 + z1) / 2); h.castShadow = true; this.group.add(h);
    this.collider(x0, x1, z0, z1, 1.2);
  }
  railing(x, z0, z1) {
    const m = this.M('rail2', () => std(0x1d2a22, { metalness: 0.5, roughness: 0.4 }));
    this.box(0.06, 0.06, z1 - z0, m, x, 1.0, (z0 + z1) / 2, { collide: false });
    for (let z = z0; z <= z1; z += 0.3) this.box(0.04, 1.1, 0.04, m, x, 0, z, { collide: false, shadow: false });
    this.collider(x - 0.05, x + 0.05, z0, z1, 1.1);
  }
  flowerBox(x, y, z, k) {
    this.box(0.3, 0.22, 1.2, this.M('fbox', () => std(0x2a2d33, { roughness: 0.6 })), x, y, z, { collide: false, shadow: false });
    const cols = [0xff4f8a, 0xffd23a, 0xff7a1a, 0xb05cff], leaf = this.M('fleaf', () => toon(0x2f9a45)), bloom = this.M('fl' + k, () => toon(cols[k], { emissive: new THREE.Color(cols[k]).multiplyScalar(0.12) }));
    for (let j = 0; j < 6; j++) { const dz = -0.48 + j * 0.19; this.mesh(new THREE.SphereGeometry(0.1, 8, 6), leaf, x, y + 0.27, z + dz, { shadow: false }); this.mesh(new THREE.SphereGeometry(0.06, 8, 6), bloom, x + 0.03, y + 0.36, z + dz + 0.05, { shadow: false }); }
  }
  shadeStrip(x, z, w, d, out = 1) { // soft contact shading where a wall meets the pavement
    const m = this.M('shade', () => new THREE.MeshBasicMaterial({ map: shadeStripTexture(), color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.set(-Math.PI / 2, 0, out > 0 ? 0 : Math.PI); p.position.set(x, 0.072, z); p.renderOrder = 1; this.group.add(p);
  }
  // ---------- V3 dressing ----------
  blob(x, z, w, d, y = 0.03, k = 0.5) { // soft contact shadow so props sit on the ground
    const m = this.M('blob' + k, () => new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,1)', 'rgba(0,0,0,0)'), transparent: true, opacity: k, depthWrite: false }));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.renderOrder = 1; this.group.add(p);
  }
  extras() {
    // contact shadows
    [[-2.65, -9, 3.4, 11.5], [2.1, 10.3, 2.6, 5.2], [-2.5, 18.2, 2.6, 5.2], [2.4, -22, 2.6, 5.2], [5.1, 2.6, 1.6, 1.6], [-5.7, 24.5, 3, 5.5], [14, 0, 3.4, 3.4]].forEach(([x, z, w, d]) => this.blob(x, z, w, d, 0.075));
    [[10, -6.5], [18.5, -7], [10.2, 6.8], [19.2, 7.2]].forEach(([x, z]) => this.blob(x, z, 4.2, 4.2, 0.05, 0.35));
    // string lights criss-crossing the street (bloom candy)
    this.stringLights(-6.9, -24, 6.9, -20, 6.2); this.stringLights(-6.9, -4, 6.9, -8, 6.0); this.stringLights(-6.9, 14, 6.9, 18, 6.3);
    // market stall
    this.stall(5.5, -27.5);
    // city bikes
    [13.6, 14.6, 15.6].forEach((z, i) => this.bike(-5.9, z, [0xd8203a, 0x1238c9, 0xd8203a][i]));
    this.collider(-6.4, -5.4, 13.1, 16.1, 1.0);
    // cones, puddles, manholes
    [[-3.2, -16.5], [-2.7, -17.4], [3.2, 4.2], [3.3, 15.8], [-3.2, 26]].forEach(([x, z]) => this.cone(x, z));
    [[1.2, -14, 2.2, 1.2], [-1.8, 7, 1.6, 0.9], [2.6, 23, 2.4, 1.3], [-0.5, -27, 1.8, 1]].forEach(([x, z, w, d]) => this.puddle(x, z, w, d));
    [[0, -18], [0, 6], [-1.5, 24]].forEach(([x, z]) => this.manhole(x, z));
    this.barber(-6.98, -10.2);
    this.skyline();
  }
  stringLights(x0, z0, x1, z1, h) {
    const a = new THREE.Vector3(x0, h, z0), b = new THREE.Vector3(x1, h, z1), mid = a.clone().lerp(b, 0.5); mid.y -= 1.2;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    this.mesh(new THREE.TubeGeometry(curve, 24, 0.012, 4, false), this.M('wire', () => std(0x111111)), 0, 0, 0, { shadow: false });
    const n = 22, cols = [[2.6, 1.9, 0.9], [2.8, 0.6, 1.6], [0.5, 2.0, 2.8], [2.6, 1.9, 0.9], [2.2, 2.6, 0.6]];
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { const p = curve.getPoint((i + 0.5) / n); m4.makeTranslation(p.x, p.y - 0.08, p.z); inst.setMatrixAt(i, m4); c.setRGB(...cols[i % cols.length]); inst.setColorAt(i, c); }
    inst.userData.dynamic = true; this.group.add(inst);
  }
  stall(x, z) {
    const wood = this.M('stallw', () => std(0x8a5a2b)), cloth = std(0xffffff, { map: stripeTexture('#1d8b4a', '#ffffff') });
    this.box(1.6, 0.9, 3.0, wood, x, 0, z, { round: 0.04 });
    [[-0.7, -1.4], [-0.7, 1.4], [0.7, -1.4], [0.7, 1.4]].forEach(([dx, dz]) => this.box(0.06, 2.4, 0.06, this.M('pole', () => std(0x23262e)), x + dx, 0, z + dz, { collide: false }));
    const awn = this.mesh(new THREE.BoxGeometry(1.9, 0.06, 3.4), cloth, x, 2.4, z); awn.rotation.z = -0.18;
    const fruit = [[0xff8a1a, 0.07], [0xd8203a, 0.065], [0x6cc04a, 0.07], [0xffd23a, 0.06]];
    fruit.forEach(([col, r], i) => { const m = std(col, { roughness: 0.45 }); for (let j = 0; j < 14; j++) this.mesh(new THREE.SphereGeometry(r, 10, 8), m, x - 0.45 + (j % 4) * 0.28 + Math.random() * 0.05, 0.96 + Math.random() * 0.05, z - 1.2 + i * 0.75 + Math.floor(j / 4) * 0.16, { shadow: false }); });
    this.blob(x, z, 2.2, 3.6, 0.075);
  }
  bike(x, z, col) {
    const g = new THREE.Group(), frame = std(col, { roughness: 0.35, metalness: 0.4 }), tyre = this.M('tyre', () => std(0x151515));
    [-0.5, 0.5].forEach(dz => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 24), tyre); w.position.set(0, 0.36, dz); w.rotation.y = Math.PI / 2; g.add(w); });
    const bar = (ax, ay, az, bx, by, bz) => { const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 8), frame); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); };
    bar(0, 0.36, -0.5, 0, 0.7, -0.05); bar(0, 0.7, -0.05, 0, 0.36, 0.5); bar(0, 0.36, -0.5, 0, 0.92, -0.45); bar(0, 0.7, -0.05, 0, 0.95, 0.35);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.05, 0.25, 2, 0.02), this.M('seat2', () => std(0x111111))); seat.position.set(0, 0.98, 0.32); g.add(seat);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), this.M('chrome', () => std(0xdddddd, { metalness: 1, roughness: 0.2 }))); hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.95, -0.45); g.add(hb);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); g.rotation.y = 0.12; this.group.add(g);
  }
  cone(x, z) {
    this.mesh(new THREE.ConeGeometry(0.22, 0.7, 20), this.M('cone', () => std(0xff6a00, { roughness: 0.5 })), x, 0.38, z);
    this.mesh(new THREE.CylinderGeometry(0.115, 0.16, 0.12, 20), this.M('coneb', () => std(0xffffff, { roughness: 0.4 })), x, 0.4, z, { shadow: false });
    this.mesh(new RoundedBoxGeometry(0.5, 0.05, 0.5, 2, 0.02), this.M('conebase', () => std(0x222222)), x, 0.03, z);
  }
  puddle(x, z, w, d) {
    const m = this.M('puddle', () => new THREE.MeshStandardMaterial({ color: 0x0c1430, roughness: 0.02, metalness: 0.9, envMapIntensity: 1.6 }));
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), m); p.scale.set(w, d, 1); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.015, z); p.receiveShadow = true; this.group.add(p);
  }
  manhole(x, z) {
    const m = this.M('manhole', () => std(0x2a2c33, { metalness: 0.6, roughness: 0.5 }));
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), m); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.016, z); p.receiveShadow = true; this.group.add(p);
  }
  barber(fx, z) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), glow(1.5, 1.35, 1.05)); win.position.set(fx + 0.11, 1.25, z); win.rotation.y = Math.PI / 2; this.group.add(win);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshBasicMaterial({ map: signTexture('FADEZ BARBERS', { bg: '#0b1a5e', fg: '#3de0ff', glow: '#3de0ff', sub: 'SKIN FADES · BEARDS · LINE-UPS' }), color: new THREE.Color(1.5, 1.5, 1.5) }));
    sign.position.set(fx + 0.15, 2.65, z); sign.rotation.y = Math.PI / 2; this.group.add(sign);
    const poleTex = stripeTexture('#e8202e', '#ffffff'); poleTex.repeat.set(1, 3);
    const pole = this.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 20), new THREE.MeshBasicMaterial({ map: poleTex, color: new THREE.Color(1.4, 1.4, 1.4) }), fx + 0.25, 1.7, z + 1.6, { shadow: false });
    [1.22, 2.18].forEach(y => this.mesh(new THREE.SphereGeometry(0.13, 14, 10), this.M('chrome', () => std(0xdddddd, { metalness: 1, roughness: 0.2 })), fx + 0.25, y, z + 1.6, { shadow: false }));
    this.animated.push(t => { poleTex.offset.y = -t * 0.6; });
  }
  skyline() {
    const haze = new THREE.MeshBasicMaterial({ color: 0x7f97d8, fog: false }), haze2 = new THREE.MeshBasicMaterial({ color: 0x9db0e6, fog: false });
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.userData.dynamic = true; this.group.add(o); return o; };
    add(new THREE.ConeGeometry(16, 120, 4), haze, -70, 60, -190).rotation.y = 0.4; // the Shard
    const gh = add(new THREE.SphereGeometry(14, 20, 16), haze, 45, 34, -200); gh.scale.y = 2.6; // the Gherkin
    add(new THREE.CylinderGeometry(3, 4, 95, 12), haze2, -140, 47, -130); add(new THREE.CylinderGeometry(9, 9, 6, 16), haze2, -140, 88, -130); // BT Tower
    [[-30, 40, 18], [10, 55, 16], [80, 46, 20], [120, 30, 24], [-100, 36, 20], [160, 26, 30], [-180, 28, 30]].forEach(([x, h, w]) => add(new THREE.BoxGeometry(w, h, w), haze2, x, h / 2, -230));
  }
  // Merge every static mesh into one mesh per material: hundreds of draw calls → a few dozen. Big win on phones.
  mergeStatic() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map(), victims = [];
    this.group.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic) return;
      for (let p = o.parent; p && p !== this.group; p = p.parent) if (p.userData.dynamic) return;
      const key = o.material.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.renderOrder;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      if (o.matrixWorld.determinant() < 0) { const idx = g.attributes.position; for (let i = 0; i < idx.count; i += 3) { /* flip winding */ for (const a of ['position', 'normal', 'uv']) { const at = g.attributes[a], n = at.itemSize; for (let k = 0; k < n; k++) { const t = at.array[(i + 1) * n + k]; at.array[(i + 1) * n + k] = at.array[(i + 2) * n + k]; at.array[(i + 2) * n + k] = t; } } } }
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder, geos: [] });
      buckets.get(key).geos.push(g); victims.push(o);
    });
    victims.forEach(o => o.parent?.remove(o));
    let n = 0;
    buckets.forEach(b => {
      const geo = mergeGeometries(b.geos, false); if (!geo) return;
      const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.ro; m.matrixAutoUpdate = false;
      this.group.add(m); n++;
    });
    this.drawCalls = n;
  }
  update(t) {
    this.animated.forEach(f => f(t));
    this.pads.forEach(p => { p.squash = Math.max(0, p.squash - 0.06); p.mesh.scale.y = 1 - p.squash * 0.5; });
  }

  // ---------- collision ----------
  resolve(pos, r = 0.38, y = 0) {
    for (const c of this.colliders) {
      if (c.h <= y + STEP) continue;
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX)), nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; pos.x += dx / d * push; pos.z += dz / d * push; }
        else {
          const ox = Math.min(pos.x - c.minX, c.maxX - pos.x), oz = Math.min(pos.z - c.minZ, c.maxZ - pos.z);
          if (ox < oz) pos.x = (pos.x - c.minX < c.maxX - pos.x) ? c.minX - r : c.maxX + r; else pos.z = (pos.z - c.minZ < c.maxZ - pos.z) ? c.minZ - r : c.maxZ + r;
        }
      }
    }
  }
  // Surface under a point that can be stood on from height y: { h, pad }
  groundAt(x, z, y = 0, r = 0.3) {
    let h = 0, pad = null;
    for (const c of this.colliders) {
      if (c.h > y + STEP || c.h <= h) continue;
      if (x > c.minX - r * 0.5 && x < c.maxX + r * 0.5 && z > c.minZ - r * 0.5 && z < c.maxZ + r * 0.5) { h = c.h; pad = c.pad || null; }
    }
    return { h, pad };
  }
  segClear(ax, az, bx, bz, minH = 1.5, pad = 0) {
    const dx = bx - ax, dz = bz - az;
    for (const c of this.colliders) {
      if (c.h < minH) continue;
      let t0 = 0, t1 = 1;
      const minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
      if (Math.abs(dx) < 1e-9) { if (ax < minX || ax > maxX) continue; }
      else { let u0 = (minX - ax) / dx, u1 = (maxX - ax) / dx; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (az < minZ || az > maxZ) continue; }
      else { let u0 = (minZ - az) / dz, u1 = (maxZ - az) / dz; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) continue; }
      return false;
    }
    return true;
  }
  inside(x, z, pad = 0) { return this.colliders.some(c => x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad); }
  buildWaypoints() {
    const pts = [];
    for (let x = -5.5; x <= 21; x += 3.5) for (let z = -30; z <= 30; z += 3.5) if (!this.inside(x, z, 0.75)) pts.push({ x, z, n: [] });
    pts.forEach((a, i) => pts.forEach((b, j) => {
      if (j <= i) return; const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 7.6 && this.segClear(a.x, a.z, b.x, b.z, 0, 0.45)) { a.n.push(j); b.n.push(i); }
    }));
    this.wps = pts;
  }
  nearestWp(x, z) {
    let best = -1, bd = 1e9;
    this.wps.forEach((w, i) => { const d = (w.x - x) ** 2 + (w.z - z) ** 2; if (d < bd && this.segClear(x, z, w.x, w.z, 0, 0.3)) { bd = d; best = i; } });
    if (best < 0) this.wps.forEach((w, i) => { const d = (w.x - x) ** 2 + (w.z - z) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  path(ax, az, bx, bz) {
    const s = this.nearestWp(ax, az), g = this.nearestWp(bx, bz);
    if (s < 0 || g < 0) return [];
    const W = this.wps, open = new Set([s]), came = new Map(), gs = new Map([[s, 0]]);
    const h = i => Math.hypot(W[i].x - W[g].x, W[i].z - W[g].z), fs = new Map([[s, h(s)]]);
    while (open.size) {
      let cur = -1, bf = 1e9; open.forEach(i => { if (fs.get(i) < bf) { bf = fs.get(i); cur = i; } });
      if (cur === g) { const out = [cur]; while (came.has(cur)) { cur = came.get(cur); out.unshift(cur); } return out.map(i => W[i]); }
      open.delete(cur);
      for (const nb of W[cur].n) {
        const t = gs.get(cur) + Math.hypot(W[cur].x - W[nb].x, W[cur].z - W[nb].z);
        if (t < (gs.get(nb) ?? 1e9)) { came.set(nb, cur); gs.set(nb, t); fs.set(nb, t + h(nb)); open.add(nb); }
      }
    }
    return [];
  }
  randomPoint() { const w = this.wps[Math.floor(Math.random() * this.wps.length)]; return { x: w.x, z: w.z }; }
}
