// "The Ends" — a stylised London street arena with a park square. Collision is 2D (XZ boxes).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, inked, Character } from './characters.js';
import { brickTexture, asphaltTexture, paveTexture, grassTexture, signTexture, windowTexture, graffitiTexture } from './textures.js';

export class GameMap {
  constructor(quality = 'high') {
    this.group = new THREE.Group(); this.colliders = []; this.q = quality;
    this.mat = {};
    this.build();
    this.buildWaypoints();
  }
  M(key, make) { return this.mat[key] ??= make(); }
  box(w, h, d, mat, x, y, z, { collide = true, edges = true, shadow = true, recv = true } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y + h / 2, z); m.castShadow = shadow; m.receiveShadow = recv;
    if (edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), this.M('edge', () => new THREE.LineBasicMaterial({ color: 0x1a1222 }))); m.add(e); }
    this.group.add(m);
    if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y + h });
    return m;
  }
  collider(x0, x1, z0, z1, h = 3) { this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, h }); }
  plane(w, d, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y, z); m.receiveShadow = true; this.group.add(m); return m;
  }
  build() {
    const G = this.group;
    // ---- sky ----
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x5b3fc4) }, mid: { value: new THREE.Color(0xb98be0) }, bot: { value: new THREE.Color(0xffb3c9) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(c,1.); }`,
    }));
    sky.renderOrder = -1; G.add(sky);
    const cloudMat = toon(0xfff4ff);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group(), a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, r = 140 + Math.random() * 60;
      for (let j = 0; j < 5; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 6, 12, 8), cloudMat); s.position.set(j * 8 - 16, Math.random() * 4, Math.random() * 6); c.add(s); }
      c.position.set(Math.cos(a) * r, 55 + Math.random() * 30, Math.sin(a) * r); c.scale.y = 0.55; c.lookAt(0, c.position.y, 0); G.add(c);
    }
    // ---- ground ----
    const grass = this.M('grass', () => toon(0xffffff, { map: grassTexture() })); grass.map.repeat.set(30, 30);
    this.plane(220, 220, grass, 0, -0.01, 0);
    const asphalt = toon(0xffffff, { map: asphaltTexture() }); asphalt.map.repeat.set(2, 16);
    this.plane(8, 66, asphalt, 0, 0.0, 0);
    const pave = toon(0xffffff, { map: paveTexture() }); pave.map.repeat.set(1.5, 33);
    pave.map.repeat.set(1.5, 33);
    this.plane(3, 66, pave, -5.5, 0.06, 0); this.plane(3, 66, pave, 5.5, 0.06, 0);
    const kerb = this.M('kerb', () => toon(0xc9c6c0));
    this.box(0.18, 0.12, 66, kerb, -4.0, 0, 0, { collide: false, shadow: false }); this.box(0.18, 0.12, 66, kerb, 4.0, 0, 0, { collide: false, shadow: false });
    // markings
    const white = this.M('white', () => new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })), yellow = this.M('yel', () => new THREE.MeshBasicMaterial({ color: 0xf2c418 }));
    for (let z = -30; z < 31; z += 4) if (Math.abs(z) > 3) this.plane(0.14, 2, white, 0, 0.012, z);
    [-3.75, -3.6, 3.6, 3.75].forEach(x => this.plane(0.08, 66, yellow, x, 0.012, 0));
    for (let i = -3; i <= 3; i++) this.plane(0.55, 3, white, i * 1.1, 0.013, 0); // zebra
    [-4.4, 4.4].forEach(x => { [-1.8, 1.8].forEach(z => this.beacon(x, z)); });
    // park
    const parkGrass = toon(0xffffff, { map: grassTexture() }); parkGrass.map.repeat.set(6, 8);
    this.plane(15, 20, parkGrass, 14.5, 0.03, 0);
    const path = this.M('path', () => toon(0xd8c8a8));
    this.plane(15, 2.2, path, 14.5, 0.04, 0); this.plane(2.2, 20, path, 14, 0.045, 0);
    const pathRing = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.6, 40), path); pathRing.rotation.x = -Math.PI / 2; pathRing.position.set(14, 0.05, 0); pathRing.receiveShadow = true; G.add(pathRing);

    // ---- buildings ----
    const bricks = [brickTexture('#b4553a'), brickTexture('#8f4a36', '#cbb8a2'), brickTexture('#c9a27a', '#e8dcc8'), brickTexture('#7a3b2c')];
    // west terrace (facade faces +X at x=-7)
    [[-32, -18], [-18, -4], [-4, 10], [10, 22], [22, 32]].forEach(([z0, z1], i) => this.terrace(-14, -7, z0, z1, 'x+', bricks[i % 4], 8 + (i % 2) * 1.5));
    // east terraces (facade faces -X at x=7)
    [[-32, -20], [-20, -10]].forEach(([z0, z1], i) => this.terrace(7, 22, z0, z1, 'x-', bricks[(i + 2) % 4], 9 + i));
    [[10, 21], [21, 32]].forEach(([z0, z1], i) => this.terrace(7, 22, z0, z1, 'x-', bricks[(i + 1) % 4], 8.5 + i));
    // tower block behind the park
    this.tower(22, 30, -10, 10);
    // north end: shops
    this.shop(-7, 0, -38, -32, 'PERI PERI PALACE', '#d61f2a', '#ffd23a', 'FRIED CHICKEN · OPEN TILL 4AM');
    this.shop(0, 7, -38, -32, 'OFF LICENCE', '#173f8a', '#ffffff', 'NEWS · LOTTO · CARDS');
    // south end: railway bridge
    this.bridge();

    // ---- props / cover ----
    this.bus(-2.3, -9);
    this.car(2.1, 10.3, 0x161616, true);
    this.car(-2.5, 18.2, 0xa9b3bd, false);
    this.car(2.4, -22, 0x3a6fd8, false);
    this.phoneBox(5.1, 2.6);
    this.busStop(5.1, -5);
    [[6.0, 19.2], [6.0, 20.2], [-6.0, -19.5], [-6.0, -18.5], [-6.0, -17.5]].forEach(([x, z], i) => this.bin(x, z, [0x1c4a2a, 0x2a2a2a, 0x1c3a6a][i % 3]));
    this.skip(-5.7, 24.5);
    this.postBox(5.2, -15);
    for (let z = -26; z <= 26; z += 13) { this.lamp(-4.4, z); this.lamp(4.4, z + 6.5); }
    // front garden walls (west), with gaps
    for (let z = -30; z < 30; z += 6) if (Math.abs(z - 2) > 3) this.box(0.45, 0.9, 3.6, this.M('wallb', () => toon(0xffffff, { map: brickTexture('#9b4a33') })), -6.6, 0, z + 1.8);
    // park contents
    this.statue(14, 0);
    [[10, -6.5], [18.5, -7], [10.2, 6.8], [19, 6.5], [17.5, -3.6]].forEach(([x, z]) => this.tree(x, z));
    [[11, 3.6, 0], [17, 3.6, 0], [11, -3.6, Math.PI], [17, -3.6, Math.PI]].forEach(([x, z, r]) => this.bench(x, z, r));
    const hedge = this.M('hedge', () => toon(0x2f8a3e));
    this.hedge(8.6, 9.2, -9.4, -4.5, hedge); this.hedge(8.6, 9.2, 4.5, 9.4, hedge);
    this.hedge(19.8, 21.2, -2, 2, hedge);
    // park railings along street (gaps for entrances)
    this.railing(7.1, -9.8, -2.2); this.railing(7.1, 2.2, 9.8);
    // graffiti on the bridge
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: graffitiTexture(), transparent: true }));
    gr.position.set(-5.4, 2.0, 31.9); gr.rotation.y = Math.PI; G.add(gr);
    // street sign
    const ss = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('ENDZ ROAD E14', { bg: '#ffffff', fg: '#111', border: '#c8102e', font: 'Rubik, Arial', sub: null }) }));
    ss.position.set(-6.97, 2.6, -8); ss.rotation.y = Math.PI / 2; G.add(ss);

    // outer invisible bounds
    this.collider(-30, -7.0, -40, 40); this.collider(7, 40, -40, -10); this.collider(7, 40, 10, 40);
    this.collider(-30, 40, -40, -32); this.collider(-30, 40, 32, 40); this.collider(22, 40, -40, 40);

    this.spawns = [
      [{ x: 0, z: 28 }, { x: 0, z: -28 }],
      [{ x: -5.2, z: 29.5 }, { x: 18, z: -5 }],
      [{ x: 18, z: 5 }, { x: -5.2, z: -27 }],
      [{ x: 5.5, z: 27 }, { x: -5.4, z: -28 }],
    ];
    this.menuSpot = { x: 1.5, z: 24, yaw: 0.25 };
  }
  beacon(x, z) {
    const pole = new THREE.Group();
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), this.M(i % 2 ? 'bk' : 'wt', () => toon(i % 2 ? 0x111111 : 0xffffff))); s.position.y = 0.15 + i * 0.3; pole.add(s); }
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), this.M('beacon', () => new THREE.MeshBasicMaterial({ color: 0xffa21f }))); globe.position.y = 2.55; pole.add(globe);
    pole.position.set(x, 0, z); this.group.add(pole); this.collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
  }
  terrace(x0, x1, z0, z1, face, brick, h) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const mat = new THREE.MeshToonMaterial({ map: brick.clone(), gradientMap: toon(0).gradientMap });
    mat.map.needsUpdate = true; mat.map.repeat.set(Math.max(w, d) / 3, h / 3);
    this.box(w, h, d, mat, cx, 0, cz, { edges: true });
    // roof
    const roofMat = this.M('roof', () => toon(0x3b3f4f));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, (face[0] === 'x' ? w : d) * 0.55, face[0] === 'x' ? d : w, 4, 1), roofMat);
    roof.rotation.set(face[0] === 'x' ? Math.PI / 2 : 0, Math.PI / 4, face[0] === 'x' ? 0 : Math.PI / 2);
    roof.scale.set(1, 1, 0.55); roof.position.set(cx, h + 1.2, cz); roof.castShadow = true; this.group.add(roof);
    // facade details
    const fx = face === 'x+' ? x1 + 0.02 : x0 - 0.02, ry = face === 'x+' ? Math.PI / 2 : -Math.PI / 2;
    const houses = Math.max(1, Math.round(d / 4.5)), hw = d / houses;
    const doorCols = [0x1f4fbf, 0xc8102e, 0x1d6b3a, 0x111111, 0xf2c418, 0x6a2a8a];
    for (let i = 0; i < houses; i++) {
      const z = z0 + hw * (i + 0.5);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), this.M('door' + (i % 6), () => toon(doorCols[i % 6]))); door.position.set(fx, 1.1, z - hw * 0.25); door.rotation.y = ry; this.group.add(door);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.4), this.M('step', () => toon(0xd8d4cc))); step.position.set(fx + (face === 'x+' ? 0.25 : -0.25), 0.09, z - hw * 0.25); this.group.add(step);
      for (let f = 0; f < Math.floor(h / 3); f++) {
        for (const off of f === 0 ? [0.22] : [-0.25, 0.22]) {
          const lit = Math.random() < 0.3;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), this.M('win' + lit, () => new THREE.MeshBasicMaterial({ map: windowTexture(lit) })));
          win.position.set(fx, 1.5 + f * 3, z + hw * off); win.rotation.y = ry; this.group.add(win);
        }
      }
      // chimney
      this.box(0.8, 1.6, 1.2, this.M('chim', () => toon(0x8a4030)), cx, h + 0.4, z0 + hw * i + 0.8, { collide: false, edges: false });
    }
  }
  tower(x0, x1, z0, z1) {
    const h = 34, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.box(x1 - x0, h, z1 - z0, this.M('tower', () => toon(0xcfc6b8)), cx, 0, cz);
    const winMat = this.M('twin', () => new THREE.MeshBasicMaterial({ map: windowTexture(false) })), litMat = this.M('twinl', () => new THREE.MeshBasicMaterial({ map: windowTexture(true) }));
    const balc = this.M('balc', () => toon(0x8a8478));
    for (let f = 0; f < 10; f++) for (let i = 0; i < 6; i++) {
      const z = z0 + 1.6 + i * 3.4, y = 2 + f * 3.3;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), Math.random() < 0.25 ? litMat : winMat); w.position.set(x0 - 0.02, y, z); w.rotation.y = -Math.PI / 2; this.group.add(w);
      if (f > 0 && i % 2 === 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 2.6), balc); b.position.set(x0 - 0.4, y - 0.8, z + 1.7); this.group.add(b); }
    }
  }
  shop(x0, x1, z0, z1, name, bg, fg, sub) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 7.5;
    this.box(w, h, d, new THREE.MeshToonMaterial({ map: brickTexture('#a24b33'), gradientMap: toon(0).gradientMap }), cx, 0, cz);
    const front = z1 + 0.03;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(name, { bg, fg, sub, glow: fg }) }));
    sign.position.set(cx, 3.4, front); this.group.add(sign);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.3), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); glass.position.set(cx, 1.35, front); this.group.add(glass);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.15, 1.4), toon(bg === '#d61f2a' ? 0xd61f2a : 0x173f8a)); awn.position.set(cx, 2.65, front + 0.7); awn.rotation.x = 0.25; awn.castShadow = true; this.group.add(awn);
    const glow = new THREE.PointLight(bg === '#d61f2a' ? 0xff5040 : 0x6fa0ff, 6, 9, 2); glow.position.set(cx, 2.6, front + 1.4); this.group.add(glow);
  }
  bridge() {
    const brick = new THREE.MeshToonMaterial({ map: brickTexture('#6e3426', '#9d8a78'), gradientMap: toon(0).gradientMap }); brick.map.repeat.set(10, 3);
    this.box(44, 9, 3, brick, 0, 0, 33.5);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x0a0710 }));
    arch.position.set(0, 3.4, 31.98); arch.rotation.y = Math.PI; this.group.add(arch);
    const archB = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.4), arch.material); archB.position.set(0, 1.7, 31.98); archB.rotation.y = Math.PI; this.group.add(archB);
    const fence = this.M('fence', () => toon(0x2a2d33));
    for (let x = -3.4; x <= 3.4; x += 0.35) this.box(0.05, 2.6, 0.05, fence, x, 0, 31.6, { collide: false, edges: false, shadow: false });
    this.box(44, 0.8, 3.6, this.M('rail', () => toon(0x3a2a2a)), 0, 9, 33.5, { collide: false });
  }
  bus(x, z) {
    const g = new THREE.Group(), red = this.M('busred', () => toon(0xd4161e)), glass = this.M('busglass', () => toon(0x1a2440)), cream = this.M('cream', () => toon(0xf0e6c8));
    const body = inked(new RoundedBoxGeometry(2.5, 4.3, 10.4, 3, 0.25), red); body.position.y = 2.35; g.add(body);
    [[1.25, 1.75], [3.55, 1.05]].forEach(([y, hgt]) => { [-1.26, 1.26].forEach(sx => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, hgt, 9.4), glass); w.position.set(sx, y + 0.6, 0); g.add(w); }); });
    [-1.27, 1.27].forEach(sx => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 10.2), cream); s.position.set(sx, 2.75, 0); g.add(s); });
    const fw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 0.05), glass); fw.position.set(0, 1.85, -5.21); g.add(fw);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: signTexture('25 ENDZ', { bg: '#111', fg: '#ffbf00', font: 'Rubik, Arial' }) })); dest.position.set(0, 3.2, -5.23); dest.rotation.y = Math.PI; g.add(dest);
    const wheel = this.M('tyre', () => toon(0x151515));
    [[-1.15, -3.4], [1.15, -3.4], [-1.15, 3.2], [1.15, 3.2]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 18), wheel); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.55, wz); g.add(w); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); this.group.add(g);
    this.collider(x - 1.3, x + 1.3, z - 5.25, z + 5.25, 4.5);
  }
  car(x, z, color, cab) {
    const g = new THREE.Group(), body = toon(color), glass = this.M('cglass', () => toon(0x24324f));
    const b = inked(new RoundedBoxGeometry(1.9, 0.85, 4.4, 3, 0.25), body); b.position.y = 0.75; g.add(b);
    const t = inked(new RoundedBoxGeometry(1.7, 0.75, cab ? 2.6 : 2.2, 3, 0.25), body); t.position.set(0, 1.45, cab ? 0.2 : 0.3); g.add(t);
    [-0.86, 0.86].forEach(sx => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, cab ? 2.3 : 1.9), glass); w.position.set(sx, 1.5, cab ? 0.2 : 0.3); g.add(w); });
    const fw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.02), glass); fw.position.set(0, 1.5, cab ? -1.1 : -0.81); fw.rotation.x = -0.3; g.add(fw);
    if (cab) { const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xffb400 })); sign.position.set(0, 1.92, -0.3); g.add(sign); }
    const wheel = this.M('tyre', () => toon(0x151515));
    [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16), wheel); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); this.group.add(g);
    this.collider(x - 0.95, x + 0.95, z - 2.2, z + 2.2, 1.9);
  }
  phoneBox(x, z) {
    const red = this.M('busred', () => toon(0xd4161e));
    const b = inked(new RoundedBoxGeometry(1.0, 2.6, 1.0, 2, 0.06), red); b.position.set(x, 1.3, z); b.castShadow = true; this.group.add(b);
    const top = inked(new THREE.CylinderGeometry(0.1, 0.62, 0.3, 4), red); top.rotation.y = Math.PI / 4; top.position.set(x, 2.75, z); this.group.add(top);
    const glass = this.M('pglass', () => toon(0xbfe0ff));
    [[-0.51, 0, Math.PI / 2], [0, -0.51, 0], [0, 0.51, 0]].forEach(([dx, dz, r]) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.6), glass); w.position.set(x + dx, 1.3, z + dz); w.rotation.y = r; this.group.add(w); });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.18), new THREE.MeshBasicMaterial({ map: signTexture('TELEPHONE', { bg: '#111', fg: '#fff', font: 'Rubik, Arial' }) })); s.position.set(x - 0.52, 2.42, z); s.rotation.y = -Math.PI / 2; this.group.add(s);
    this.collider(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 2.8);
  }
  busStop(x, z) {
    const frame = this.M('stopf', () => toon(0x2a2d33)), glass = this.M('stopg', () => new THREE.MeshToonMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.35 }));
    this.box(0.1, 2.4, 3.6, glass, x + 0.7, 0, z, { edges: true, shadow: false });
    this.box(1.6, 0.1, 3.8, frame, x, 2.4, z, { collide: false });
    [[-0.7, -1.8], [-0.7, 1.8]].forEach(([dx, dz]) => this.box(0.08, 2.4, 0.08, frame, x + dx, 0, z + dz, { edges: false }));
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ map: signTexture('SHANKMASTER', { bg: '#ff2d55', fg: '#ffe14d', sub: 'NOW IN THE ENDZ', w: 256, h: 384 }) }));
    ad.position.set(x + 0.64, 1.3, z - 1); ad.rotation.y = -Math.PI / 2; this.group.add(ad);
  }
  bin(x, z, color) {
    const b = inked(new RoundedBoxGeometry(0.7, 1.05, 0.75, 2, 0.06), toon(color)); b.position.set(x, 0.53, z); b.castShadow = true; this.group.add(b);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.8), toon(color)); lid.position.set(x, 1.08, z); this.group.add(lid);
    this.collider(x - 0.36, x + 0.36, z - 0.38, z + 0.38, 1.1);
  }
  skip(x, z) {
    const m = this.M('skip', () => toon(0xf2b705));
    const s = inked(new THREE.CylinderGeometry(1.25, 1.0, 1.3, 4, 1), m); s.rotation.y = Math.PI / 4; s.scale.set(0.95, 1, 2.0); s.position.set(x, 0.65, z); s.castShadow = true; this.group.add(s);
    const junk = this.M('junk', () => toon(0x6b5a48));
    for (let i = 0; i < 5; i++) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.5 + Math.random() * 0.5, 0.3, 0.4 + Math.random() * 0.6), junk); j.position.set(x + (Math.random() - 0.5) * 1, 1.3, z + (Math.random() - 0.5) * 2.6); j.rotation.y = Math.random() * 3; this.group.add(j); }
    this.collider(x - 1.1, x + 1.1, z - 2.2, z + 2.2, 1.4);
  }
  postBox(x, z) {
    const red = this.M('busred', () => toon(0xd4161e));
    const p = inked(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 20), red); p.position.set(x, 0.7, z); p.castShadow = true; this.group.add(p);
    const t = inked(new THREE.SphereGeometry(0.31, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red); t.position.set(x, 1.4, z); this.group.add(t);
    this.collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 1.6);
  }
  lamp(x, z) {
    const m = this.M('lamp', () => toon(0x2a2d33));
    this.box(0.12, 5, 0.12, m, x, 0, z, { edges: false });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), m); arm.position.set(x + (x > 0 ? -0.5 : 0.5), 5, z); arm.rotation.y = Math.PI / 2; this.group.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.M('lampg', () => new THREE.MeshBasicMaterial({ color: 0xfff1b8 }))); head.position.set(x + (x > 0 ? -0.95 : 0.95), 4.9, z); this.group.add(head);
  }
  statue(x, z) {
    const stone = this.M('stone', () => toon(0x8f8a7c));
    this.box(2.2, 1.6, 2.2, stone, x, 0, z);
    this.box(2.6, 0.3, 2.6, stone, x, 0, z, { collide: false });
    const c = new Character('zain', null);
    c.mats.forEach(m => { m.color.setHex(0x9a6c55); });
    c.root.scale.setScalar(1.6); c.root.position.set(x, 1.6, z); c.root.rotation.y = -Math.PI / 2;
    c.arms[1].sh.rotation.set(2.6, 0, 0.3); c.arms[1].el.rotation.x = 0.3;
    c.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.group.add(c.root);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: signTexture('THE FIRST SHANKMASTER', { bg: '#3a3428', fg: '#e8d29a', font: 'Rubik, Arial' }) }));
    plaque.position.set(x - 1.11, 1.0, z); plaque.rotation.y = -Math.PI / 2; this.group.add(plaque);
  }
  tree(x, z) {
    const trunk = inked(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 10), this.M('trunk', () => toon(0x6b4423))); trunk.position.set(x, 1.3, z); this.group.add(trunk);
    const leaf = this.M('leaf', () => toon(0x3fae49));
    [[0, 3.4, 0, 1.6], [0.8, 3.0, 0.3, 1.1], [-0.7, 3.1, -0.2, 1.15], [0.1, 4.3, -0.1, 1.05]].forEach(([dx, y, dz, r]) => {
      const l = inked(new THREE.SphereGeometry(r, 16, 12), leaf); l.position.set(x + dx, y, z + dz); l.castShadow = true; this.group.add(l);
    });
    this.collider(x - 0.28, x + 0.28, z - 0.28, z + 0.28, 3);
  }
  bench(x, z, r) {
    const g = new THREE.Group(), wood = this.M('bwood', () => toon(0x8a5a2b)), iron = this.M('iron', () => toon(0x222222));
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 0.14), wood); s.position.set(0, 0.48, -0.18 + i * 0.17); g.add(s); }
    for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.14, 0.05), wood); s.position.set(0, 0.7 + i * 0.18, 0.28); g.add(s); }
    [-0.85, 0.85].forEach(dx => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), iron); l.position.set(dx, 0.25, 0); g.add(l); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); g.rotation.y = r; this.group.add(g);
    this.collider(x - 1, x + 1, z - 0.3, z + 0.3, 0.9);
  }
  hedge(x0, x1, z0, z1, mat) {
    const h = inked(new RoundedBoxGeometry(x1 - x0, 1.2, z1 - z0, 3, 0.25), mat); h.position.set((x0 + x1) / 2, 0.6, (z0 + z1) / 2); h.castShadow = true; this.group.add(h);
    this.collider(x0, x1, z0, z1, 1.2);
  }
  railing(x, z0, z1) {
    const m = this.M('rail2', () => toon(0x1d2a22));
    this.box(0.06, 0.06, z1 - z0, m, x, 1.0, (z0 + z1) / 2, { collide: false, edges: false });
    for (let z = z0; z <= z1; z += 0.3) this.box(0.04, 1.1, 0.04, m, x, 0, z, { collide: false, edges: false, shadow: false });
    this.collider(x - 0.05, x + 0.05, z0, z1, 1.1);
  }

  // ---------- collision / visibility ----------
  resolve(pos, r = 0.38) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX)), nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; pos.x += dx / d * push; pos.z += dz / d * push; }
        else { // centre inside the box: push out on the shallowest axis
          const ox = Math.min(pos.x - c.minX, c.maxX - pos.x), oz = Math.min(pos.z - c.minZ, c.maxZ - pos.z);
          if (ox < oz) pos.x = (pos.x - c.minX < c.maxX - pos.x) ? c.minX - r : c.maxX + r; else pos.z = (pos.z - c.minZ < c.maxZ - pos.z) ? c.minZ - r : c.maxZ + r;
        }
      }
    }
  }
  // Segment vs boxes; minH ignores colliders lower than that (e.g. low walls don't block sight at eye level).
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
  path(ax, az, bx, bz) { // A* over the waypoint graph
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
