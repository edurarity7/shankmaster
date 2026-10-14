// "The Ends" — a stylised London street arena with a park, parkour props, jump pads and pickups.
// Collision is 2.5D: XZ boxes with a top height. Anything with a top below your feet + STEP can be stood on.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, inked, Character } from './characters.js';
import { PRESETS } from './data.js';
import { brickTexture, asphaltTexture, paveTexture, grassTexture, signTexture, windowTexture, graffitiTexture, crateTexture, stripeTexture, radialTexture } from './textures.js';

export const STEP = 0.4;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

export class GameMap {
  constructor(quality = 'high') {
    this.group = new THREE.Group(); this.colliders = []; this.q = quality; this.mat = {};
    this.pads = []; this.pickupSpots = []; this.animated = [];
    this.build();
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
    sky.renderOrder = -1; G.add(sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,240,200,1)', 'rgba(255,190,120,0)'), fog: false, depthWrite: false }));
    sun.scale.setScalar(70); sun.position.set(160, 70, -220); G.add(sun);
    const cloudMat = std(0xffffff, { roughness: 1, emissive: 0x6070a0, emissiveIntensity: 0.3 });
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group(), a = (i / 16) * Math.PI * 2 + Math.random() * 0.3, r = 150 + Math.random() * 60;
      for (let j = 0; j < 6; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 7, 14, 10), cloudMat); s.position.set(j * 7 - 18, Math.random() * 5, Math.random() * 6); c.add(s); }
      c.position.set(Math.cos(a) * r, 50 + Math.random() * 35, Math.sin(a) * r); c.scale.y = 0.6; c.lookAt(0, c.position.y, 0); G.add(c);
    }
    // ---- ground ----
    const grass = std(0xffffff, { map: grassTexture() }); grass.map.repeat.set(30, 30);
    this.plane(220, 220, grass, 0, -0.01, 0);
    const asphalt = std(0xffffff, { map: asphaltTexture(), roughness: 0.9 }); asphalt.map.repeat.set(2, 16);
    this.plane(8, 66, asphalt, 0, 0.0, 0);
    const pave = std(0xffffff, { map: paveTexture() }); pave.map.repeat.set(1.5, 33);
    this.plane(3, 66, pave, -5.5, 0.06, 0); this.plane(3, 66, pave, 5.5, 0.06, 0);
    const kerb = this.M('kerb', () => std(0xd8d5ce));
    [-4, 4].forEach(x => this.box(0.2, 0.12, 66, kerb, x, 0, 0, { collide: false, shadow: false, round: 0.05 }));
    const white = this.M('white', () => new THREE.MeshBasicMaterial({ color: 0xf6f6f6 })), yellow = this.M('yel', () => new THREE.MeshBasicMaterial({ color: 0xffcc1a }));
    for (let z = -30; z < 31; z += 4) if (Math.abs(z) > 3) this.plane(0.14, 2, white, 0, 0.012, z);
    [-3.75, -3.6, 3.6, 3.75].forEach(x => this.plane(0.08, 66, yellow, x, 0.012, 0));
    for (let i = -3; i <= 3; i++) this.plane(0.55, 3, white, i * 1.1, 0.013, 0);
    [-4.4, 4.4].forEach(x => [-1.8, 1.8].forEach(z => this.beacon(x, z)));
    const parkGrass = std(0xffffff, { map: grassTexture() }); parkGrass.map.repeat.set(6, 8);
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
    this.shop(-7, 0, -38, -32, 'PERI PERI PALACE', '#d61f2a', '#ffd23a', 'FRIED CHICKEN · OPEN TILL 4AM', 0xff5040);
    this.shop(0, 7, -38, -32, 'OFF LICENCE', '#1238c9', '#ffffff', 'NEWS · LOTTO · CARDS', 0x5f8cff);
    this.bridge();

    // ---- cover + parkour ----
    this.bus(-2.3, -9);
    this.car(2.1, 10.3, 0x161616, true);
    this.car(-2.5, 18.2, 0xb8c2cc, false);
    this.car(2.4, -22, 0x2a63e0, false);
    this.phoneBox(5.1, 2.6);
    this.busStop(5.1, -5);
    [[6.0, 19.2], [6.0, 20.2], [-6.0, -19.5], [-6.0, -18.5], [-6.0, -17.5]].forEach(([x, z], i) => this.bin(x, z, [0x1c6a3a, 0x2a2a2a, 0x1c4ab0][i % 3]));
    this.skip(-5.7, 24.5);
    this.postBox(5.2, -15);
    for (let z = -26; z <= 26; z += 13) { this.lamp(-4.4, z); if (z + 6.5 < 31) this.lamp(4.4, z + 6.5); }
    for (let z = -30; z < 30; z += 6) if (Math.abs(z - 2) > 3 && z !== -30) this.box(0.45, 0.85, 3.6, this.M('wallb', () => std(0xffffff, { map: brickTexture('#a24c33') })), -6.6, 0, z + 1.8, { round: 0.06 });
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
    this.collider(-30, 40, -40, -32); this.collider(-30, 40, 32, 40); this.collider(22, 40, -40, 40);
    this.spawns = [
      [{ x: 0, z: 28 }, { x: 0, z: -28 }],
      [{ x: -5.2, z: 29.5 }, { x: 18, z: -5 }],
      [{ x: 18, z: 5 }, { x: -5.4, z: -21 }],
      [{ x: 5.5, z: 27 }, { x: 0.5, z: -28 }],
    ];
  }
  beacon(x, z) {
    for (let i = 0; i < 8; i++) this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), this.M(i % 2 ? 'bk' : 'wt', () => std(i % 2 ? 0x111111 : 0xffffff)), x, 0.15 + i * 0.3, z, { shadow: false });
    const globe = this.mesh(new THREE.SphereGeometry(0.2, 16, 12), this.M('beacon', () => glow(2.4, 1.3, 0.1)), x, 2.55, z, { shadow: false });
    this.animated.push(t => { globe.visible = Math.sin(t * 4) > -0.3; });
    this.collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1, 2.7);
  }
  terrace(x0, x1, z0, z1, face, brick, h, seed) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const mat = std(0xffffff, { map: brick.clone() }); mat.map.needsUpdate = true; mat.map.repeat.set(Math.max(w, d) / 3, h / 3);
    this.box(w, h, d, mat, cx, 0, cz);
    const trim = this.M('trim', () => std(0xf3ece0));
    const out = face === 'x+' ? 1 : -1, fx = face === 'x+' ? x1 : x0;
    this.box(0.35, 0.35, d, trim, fx + out * 0.12, h - 0.4, cz, { collide: false });
    this.box(0.18, 0.5, d, this.M('plinth', () => std(0x6d6a72)), fx + out * 0.05, 0, cz, { collide: false, shadow: false });
    const roofShape = new THREE.Shape(); roofShape.moveTo(-w / 2 - 0.3, 0); roofShape.lineTo(0, 2.2); roofShape.lineTo(w / 2 + 0.3, 0); roofShape.closePath();
    const rg = new THREE.ExtrudeGeometry(roofShape, { depth: d, bevelEnabled: false }); rg.translate(0, 0, -d / 2);
    this.mesh(rg, this.M('roof' + (seed % 2), () => std(seed % 2 ? 0x3c4258 : 0x4a3a3a, { roughness: 0.9 })), cx, h, cz);
    const ry = face === 'x+' ? Math.PI / 2 : -Math.PI / 2;
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
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), this.M('win' + lit, () => new THREE.MeshBasicMaterial({ map: windowTexture(lit), color: lit ? new THREE.Color(1.6, 1.4, 1.1) : 0xffffff })));
          win.position.set(fx + out * 0.09, wy, wz); win.rotation.y = ry; this.group.add(win);
          this.box(0.25, 0.08, 1.4, frame, fx + out * 0.12, wy - 0.86, wz, { collide: false, shadow: false });
        }
      }
      this.box(0.8, 1.4, 1.1, this.M('chim', () => std(0x9a4a34)), cx, h + 1.2, z0 + hw * i + 0.9, { collide: false });
      [-0.2, 0.2].forEach(o => this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 10), this.M('pot', () => std(0xc8703a)), cx + o, h + 2.75, z0 + hw * i + 0.9, { shadow: false }));
    }
  }
  tower(x0, x1, z0, z1) {
    const h = 34, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.box(x1 - x0, h, z1 - z0, this.M('tower', () => std(0xd9d2c6)), cx, 0, cz);
    const winMat = this.M('twin', () => new THREE.MeshBasicMaterial({ map: windowTexture(false) })), litMat = this.M('twinl', () => new THREE.MeshBasicMaterial({ map: windowTexture(true), color: new THREE.Color(1.6, 1.4, 1.1) }));
    const balc = this.M('balc', () => std(0x8a93a8));
    for (let f = 0; f < 10; f++) for (let i = 0; i < 6; i++) {
      const z = z0 + 1.6 + i * 3.4, y = 2 + f * 3.3;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), (f * 6 + i) % 5 === 0 ? litMat : winMat); w.position.set(x0 - 0.02, y, z); w.rotation.y = -Math.PI / 2; this.group.add(w);
      if (f > 0 && i % 2 === 0) this.box(0.8, 0.9, 2.6, balc, x0 - 0.4, y - 1.25, z + 1.7, { collide: false });
    }
    const red = this.mesh(new THREE.SphereGeometry(0.4, 10, 8), glow(3, 0.2, 0.2), cx, h + 0.4, cz, { shadow: false });
    this.animated.push(t => { red.visible = Math.sin(t * 2.5) > 0; });
  }
  shop(x0, x1, z0, z1, name, bg, fg, sub, glowC) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 7.5;
    this.box(w, h, d, std(0xffffff, { map: brickTexture('#a24b33') }), cx, 0, cz);
    const front = z1 + 0.03;
    this.box(w - 0.2, 1.5, 0.15, this.M('signbox', () => std(0x222222)), cx, 2.65, front - 0.02, { collide: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(name, { bg, fg, sub, glow: fg }), color: new THREE.Color(1.5, 1.5, 1.5) }));
    sign.position.set(cx, 3.4, front + 0.07); this.group.add(sign);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.3), glow(1.4, 1.15, 0.8)); glass.position.set(cx, 1.35, front); this.group.add(glass);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.12, 1.4), std(0xffffff, { map: stripeTexture(bg, '#ffffff') })); awn.position.set(cx, 2.55, front + 0.7); awn.rotation.x = 0.25; awn.castShadow = true; this.group.add(awn);
    const light = new THREE.PointLight(glowC, 8, 10, 2); light.position.set(cx, 2.6, front + 1.6); this.group.add(light);
  }
  bridge() {
    const brick = std(0xffffff, { map: brickTexture('#6e3426', '#9d8a78') }); brick.map.repeat.set(10, 3);
    this.box(44, 9, 3, brick, 0, 0, 33.5);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050818 }));
    arch.position.set(0, 3.4, 31.98); arch.rotation.y = Math.PI; this.group.add(arch);
    const archB = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.4), arch.material); archB.position.set(0, 1.7, 31.98); archB.rotation.y = Math.PI; this.group.add(archB);
    const fence = this.M('fence', () => std(0x2a2d33, { metalness: 0.6, roughness: 0.4 }));
    for (let x = -3.4; x <= 3.4; x += 0.35) this.box(0.05, 2.6, 0.05, fence, x, 0, 31.6, { collide: false, shadow: false });
    this.box(44, 0.8, 3.6, this.M('rail', () => std(0x3a2a2a)), 0, 9, 33.5, { collide: false });
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
    const g = new THREE.Group(), body = std(color, { roughness: 0.3, metalness: 0.3 }), glass = this.M('cglass', () => std(0x1c2a4f, { roughness: 0.1, metalness: 0.6 }));
    const b = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.85, 4.4, 4, 0.3), body); b.position.y = 0.75; g.add(b);
    const t = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.78, cab ? 2.6 : 2.2, 4, 0.3), body); t.position.set(0, 1.45, cab ? 0.2 : 0.3); g.add(t);
    [-0.86, 0.86].forEach(sx => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, cab ? 2.3 : 1.9), glass); w.position.set(sx, 1.5, cab ? 0.2 : 0.3); g.add(w); });
    const fw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.02), glass); fw.position.set(0, 1.5, cab ? -1.1 : -0.81); fw.rotation.x = -0.3; g.add(fw);
    if (cab) { const sign = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.18, 0.18, 2, 0.04), glow(2.2, 1.5, 0)); sign.position.set(0, 1.92, -0.3); g.add(sign); }
    [-0.65, 0.65].forEach(hx => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(2, 2, 1.7)); l.position.set(hx, 0.85, -2.18); g.add(l); });
    const wheel = this.M('tyre', () => std(0x151515));
    [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 18), wheel); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); });
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); this.group.add(g);
    const oz = cab ? 0.2 : 0.3, hl = cab ? 1.3 : 1.1;
    this.collider(x - 0.95, x + 0.95, z - 2.2, z + 2.2, 1.18);
    this.collider(x - 0.85, x + 0.85, z + oz - hl, z + oz + hl, 1.86);
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
    const pad = { x, z, r, h, power, mesh, squash: 0 };
    this.pads.push(pad);
    this.colliders.push({ minX: x - r * 0.8, maxX: x + r * 0.8, minZ: z - r * 0.8, maxZ: z + r * 0.8, h, pad });
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r * 0.95, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.8, 2.4), transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, h + 0.03, z); this.group.add(ring);
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
