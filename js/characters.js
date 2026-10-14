// Stylised cel-shaded characters with a rim light, ink outlines, modular "drip" and a small procedural rig.
// Model faces -Z; its right hand is on +X.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRIP, SKIN_TONES, DEFAULT_OUTFIT } from './data.js';
import { toonGradient, checkTexture, fabricBump } from './textures.js';
import { buildKnife, disposeKnife } from './knives.js';

const outlineMat = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.0085 }, color: { value: new THREE.Color(0x0a0f2e) } },
  vertexShader: `uniform float thickness; void main(){ vec3 p = position + normal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});
export { outlineMat };

// Toon material with a cool fresnel rim — gives the "premium mobile game" pop.
const RIM = { value: new THREE.Color(0x9fc4ff).multiplyScalar(0.45) };
// Stylised PBR material with a cool fresnel rim — Fortnite-like shading with our cartoon flair.
export function toon(color, extra = {}) {
  const { rim = 1, rough = 0.62, metal = 0, bump = false, ...rest } = extra;
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: metal > 0.5 ? 1.3 : 0.65, ...(bump ? { bumpMap: fabricBump(), bumpScale: 0.9 } : {}), ...rest });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = RIM; sh.uniforms.uRimK = { value: rim };
    sh.fragmentShader = 'uniform vec3 uRim; uniform float uRimK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight += uRim * uRimK * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'pbrrim';
  return m;
}
export function inked(geo, mat, { outline = true, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = shadow;
  if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.raycast = () => {}; m.add(o); }
  return m;
}

const G = () => new THREE.Group();
const sph = (r, ...a) => new THREE.SphereGeometry(r, 28, 20, ...a);
const cyl = (rt, rb, h, s = 20, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
// Tapered limb hanging down from its pivot, optional puffer quilting
function limb(r0, r1, len, quilt = 0) {
  const pts = [[0.0001, 0.0001]];
  for (let i = 0; i <= 12; i++) { const t = i / 12; let r = r0 + (r1 - r0) * t; if (quilt) r += quilt * Math.abs(Math.sin(t * Math.PI * 3)); pts.push([r, -t * len]); }
  pts.push([0.0001, -len - 0.0001]);
  return lathe(pts.reverse(), 20);
}

export function outfitLook(outfit = DEFAULT_OUTFIT) {
  const d = s => DRIP[outfit[s]] || DRIP[DEFAULT_OUTFIT[s]];
  const top = d('top'), gl = d('gloves');
  return { skin: SKIN_TONES[outfit.skin ?? 3], top, gloves: gl, sleeve: top.c, accent: top.a ?? 0xffffff };
}

export class Character {
  constructor(outfit = DEFAULT_OUTFIT, item, { outline = true } = {}) {
    this.outfit = { ...DEFAULT_OUTFIT, ...outfit };
    this.mats = []; this.phase = 0; this.hitT = 0; this.flashT = 0; this.deadT = -1; this.lean = 0; this.t = 0; this.land = 0;
    this.outline = outline;
    this.root = new THREE.Group(); this.root.name = 'character';
    this.build();
    this.optimize();
    if (item) this.setKnife(item);
  }
  m(color, extra) {
    const key = color + '|' + JSON.stringify(extra || {});
    this.matCache ??= new Map();
    if (!this.matCache.has(key)) { const t = toon(color, extra); this.mats.push(t); this.matCache.set(key, t); }
    return this.matCache.get(key);
  }
  // Merge each rig part's meshes (and their ink outlines) into one mesh per material: ~6x fewer draw calls.
  optimize() {
    this.root.updateMatrixWorld(true);
    const groups = []; this.root.traverse(o => { if (o.isGroup || o === this.root) groups.push(o); });
    const prep = (geo, m4) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      return g.applyMatrix4(m4);
    };
    for (const grp of groups) {
      const buckets = new Map(), kill = [];
      for (const m of grp.children) {
        if (!m.isMesh) continue;
        const add = (mesh, m4) => { const k = mesh.material.uuid; if (!buckets.has(k)) buckets.set(k, { mat: mesh.material, geos: [] }); buckets.get(k).geos.push(prep(mesh.geometry, m4)); };
        add(m, m.matrix);
        m.children.forEach(o => { if (o.isMesh) add(o, m.matrix.clone().multiply(o.matrix)); });
        kill.push(m);
      }
      if (kill.length < 2) continue;
      kill.forEach(m => grp.remove(m));
      buckets.forEach(({ mat, geos }) => { const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat); mesh.castShadow = mat !== outlineMat; grp.add(mesh); });
    }
  }
  p(geo, color, parent, pos = [0, 0, 0], scale, extra, opts = {}) {
    const mesh = inked(geo, typeof color === 'number' ? this.m(color, extra) : color, { outline: this.outline && opts.outline !== false });
    mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  d(slot) { return DRIP[this.outfit[slot]] || DRIP[DEFAULT_OUTFIT[slot]]; }

  build() {
    const skin = SKIN_TONES[this.outfit.skin ?? 3];
    const top = this.d('top'), legs = this.d('legs'), kicks = this.d('kicks'), head = this.d('head'), face = this.d('face');
    const shinyTop = top.shiny ? { emissive: 0x1a1000, rim: 2, metal: 0.85, rough: 0.28 } : { rough: top.kind === 'puffer' ? 0.3 : top.kind === 'track' ? 0.5 : 0.85, bump: top.kind !== 'puffer' };
    const legsX = { rough: legs.kind === 'trackies' && /Denim/.test(legs.name) ? 0.85 : 0.75, bump: true };
    this.body = G(); this.root.add(this.body);
    this.hips = G(); this.hips.position.y = 0.85; this.body.add(this.hips);

    // ---- legs ----
    const shorts = legs.kind === 'shorts';
    const baggy = legs.kind === 'cargos' ? 0.024 : shorts ? 0.016 : 0.012;
    this.legs = [-1, 1].map(side => {
      const hip = G(); hip.position.set(0.1 * side, 0, 0); this.hips.add(hip);
      if (shorts) {
        this.p(limb(0.1 + baggy, 0.095 + baggy, 0.27), legs.c, hip, [0, 0.02, 0], undefined, legsX);
        this.p(limb(0.078, 0.07, 0.2), skin, hip, [0, -0.23, 0]);
        this.p(new THREE.BoxGeometry(0.012, 0.22, 0.02), legs.a, hip, [0.112 * side, -0.1, 0], undefined, undefined, { outline: false });
      } else {
        this.p(limb(0.105 + baggy, 0.086 + baggy, 0.4), legs.c, hip, [0, 0.02, 0], undefined, legsX);
        if (legs.kind === 'cargos') this.p(rbox(0.05, 0.1, 0.09, 0.015), legs.c, hip, [0.1 * side, -0.24, 0]);
      }
      const knee = G(); knee.position.y = -0.39; hip.add(knee);
      const shinC = shorts ? skin : legs.c;
      this.p(sph(0.084 + (shorts ? 0 : baggy * 0.7)), shinC, knee, [0, 0, 0], undefined, shorts ? undefined : legsX);
      this.p(limb(0.082 + (shorts ? 0 : baggy * 0.6), 0.07 + (shorts ? 0 : baggy * 0.5), 0.34), shinC, knee, [0, 0, 0], undefined, shorts ? undefined : legsX);
      if (legs.kind === 'trackies' && /Trackies/.test(legs.name)) this.p(new THREE.TorusGeometry(0.07, 0.018, 8, 20), legs.c, knee, [0, -0.32, 0]).rotation.x = Math.PI / 2;
      this.shoe(knee, kicks);
      return { hip, knee };
    });
    this.p(sph(1), legs.c, this.hips, [0, 0.03, 0], [0.2, 0.14, 0.15], legsX);

    // ---- torso ----
    this.torso = G(); this.torso.position.y = 0.88; this.body.add(this.torso);
    const T = this.torso;
    const base = [[0.15, 0], [0.165, 0.06], [0.178, 0.14], [0.196, 0.24], [0.214, 0.33], [0.22, 0.4], [0.205, 0.46], [0.16, 0.52], [0.09, 0.555], [0.0001, 0.565]];
    const puff = top.kind === 'puffer', bulk = puff ? 0.045 : top.kind === 'hoodie' ? 0.022 : top.kind === 'cardigan' ? 0.016 : 0.008;
    const pts = base.map(([r, y]) => [r + bulk + (puff ? 0.022 * Math.abs(Math.sin(y * Math.PI * 7)) : 0), y]);
    pts.unshift([0.0001, -0.02]);
    this.p(lathe(pts), top.c, T, [0, -0.02, 0], [1.08, 1, 0.74], shinyTop);
    const shR = puff ? 0.105 : 0.088;
    [-1, 1].forEach(s => this.p(sph(shR), top.c, T, [0.225 * s, 0.43, 0], [1, 0.9, 0.95], shinyTop));
    if (puff) {
      [1, 2, 3].forEach(i => { const y = i / 7 - 0.02, r = base.reduce((a, [rr, yy]) => Math.abs(yy - y - 0.02) < Math.abs(a[1] - y - 0.02) ? [rr, yy] : a, [0, 9])[0] + bulk;
        const st = this.p(new THREE.TorusGeometry(r, 0.006, 6, 40), new THREE.Color(top.c).multiplyScalar(0.45).getHex(), T, [0, y, 0], [1.08, 0.74, 1], { rough: 0.6 }, { outline: false }); st.rotation.x = Math.PI / 2; });
      this.p(new THREE.TorusGeometry(0.12, 0.065, 12, 28), top.c, T, [0, 0.54, 0], [1, 1, 0.9], shinyTop).rotation.x = Math.PI / 2;
      this.p(new THREE.BoxGeometry(0.012, 0.46, 0.012), top.a, T, [0, 0.27, -0.205], undefined, undefined, { outline: false });
    } else if (top.kind === 'track') {
      this.p(new THREE.BoxGeometry(0.012, 0.48, 0.012), top.a, T, [0, 0.27, -0.172], undefined, undefined, { outline: false });
      this.p(new THREE.TorusGeometry(0.1, 0.03, 10, 24), top.c, T, [0, 0.54, 0]).rotation.x = Math.PI / 2;
    } else if (top.kind === 'hoodie') {
      this.p(rbox(0.24, 0.11, 0.05, 0.02), top.a, T, [0, 0.13, -0.18]);
      [-1, 1].forEach(s => this.p(cyl(0.006, 0.006, 0.13, 6), 0xf2f2f2, T, [0.04 * s, 0.44, -0.17], undefined, undefined, { outline: false }));
      if (head.kind !== 'hood') this.p(sph(0.13), top.c, T, [0, 0.55, 0.1], [1.1, 0.6, 0.8]);
    } else if (top.kind === 'jersey') {
      this.p(new THREE.TorusGeometry(0.095, 0.02, 8, 24), top.a, T, [0, 0.545, -0.01]).rotation.x = Math.PI / 2;
      this.p(new THREE.BoxGeometry(0.3, 0.025, 0.015), top.a, T, [0, 0.33, -0.165], undefined, undefined, { outline: false });
    } else if (top.kind === 'cardigan') {
      [0.12, 0.24, 0.36].forEach(y => this.p(sph(0.018), top.a, T, [0, y, -0.18]));
      this.p(new THREE.TorusGeometry(0.105, 0.035, 8, 22), top.a, T, [0, 0.53, 0]).rotation.x = Math.PI / 2;
    }
    this.p(cyl(0.058, 0.064, 0.1), skin, T, [0, 0.6, 0]);
    this.neck = G(); this.neck.position.y = 0.64; T.add(this.neck);
    const H = this.head = G(); H.position.y = 0.16; H.scale.setScalar(1.12); this.neck.add(H);
    this.buildHead(H, skin, head, face, top);
    this.neckItem(T);
    this.backItem(T);

    // ---- arms ----
    const aR = puff ? 0.086 : top.kind === 'hoodie' ? 0.074 : 0.068;
    const gl = this.d('gloves');
    const handC = gl.kind === 'glove' ? gl.c : skin;
    this.arms = [-1, 1].map(side => {
      const sh = G(); sh.position.set(0.245 * side, 0.43, 0); sh.rotation.order = 'YXZ'; T.add(sh);
      this.p(limb(aR, aR * 0.86, 0.3, puff ? 0.014 : 0), top.c, sh, [0, 0.02, 0], undefined, shinyTop);
      if (top.kind === 'track') this.p(new THREE.BoxGeometry(0.016, 0.3, 0.016), top.a, sh, [aR * side * 0.98, -0.15, 0], undefined, undefined, { outline: false });
      const el = G(); el.position.y = -0.3; sh.add(el);
      this.p(sph(aR * 0.88), top.c, el, [0, 0, 0], undefined, shinyTop);
      this.p(limb(aR * 0.86, aR * 0.76, 0.24, puff ? 0.01 : 0), top.c, el, [0, 0, 0], undefined, shinyTop);
      this.p(new THREE.TorusGeometry(aR * 0.7, 0.016, 8, 20), top.a ?? top.c, el, [0, -0.235, 0]).rotation.x = Math.PI / 2;
      const hand = G(); hand.position.y = -0.3; el.add(hand);
      this.buildHand(hand, side, handC, gl);
      return { sh, el, hand };
    });
  }
  shoe(knee, k) {
    const y = -0.38, shiny = k.shiny ? { emissive: 0x1a1000, rim: 2, metal: 0.85, rough: 0.25 } : { rough: 0.42 };
    if (k.kind === 'sliders') {
      this.p(cyl(0.072, 0.066, 0.16), 0xffffff, knee, [0, y + 0.06, 0]);
      this.p(rbox(0.12, 0.035, 0.27, 0.015), k.c, knee, [0, y - 0.035, -0.045]);
      this.p(rbox(0.13, 0.04, 0.09, 0.02), k.c, knee, [0, y - 0.005, -0.09]);
      this.p(sph(1), 0xffffff, knee, [0, y - 0.005, -0.05], [0.06, 0.04, 0.12]);
      return;
    }
    const tall = k.kind === 'high' || k.kind === 'boots';
    this.p(rbox(0.14, 0.05, 0.3, 0.022), k.kind === 'boots' ? k.a : (k.a ?? 0xe0e0e0), knee, [0, y - 0.03, -0.045]);
    this.p(sph(1), k.c, knee, [0, y + 0.01, -0.045], [0.072, 0.066, 0.14], shiny);
    this.p(sph(1), k.c, knee, [0, y, -0.12], [0.064, 0.05, 0.07], shiny);
    if (tall) this.p(cyl(0.078, 0.076, 0.12), k.c, knee, [0, y + 0.08, -0.005], undefined, shiny);
    if (k.kind === 'high') this.p(new THREE.TorusGeometry(0.074, 0.014, 6, 18), k.a, knee, [0, y + 0.14, -0.005]).rotation.x = Math.PI / 2;
    if (k.kind !== 'boots') for (let i = 0; i < 3; i++) this.p(rbox(0.07, 0.008, 0.012, 0.003), 0xf6f6f6, knee, [0, y + 0.06 - i * 0.012, -0.07 - i * 0.03], undefined, { rough: 0.8 }, { outline: false }).rotation.x = -0.5;
    if (k.kind === 'low' || k.kind === 'high') this.p(rbox(0.012, 0.03, 0.12, 0.005), k.a === k.c ? 0xd0d0d0 : k.a, knee, [0.071, y, -0.06], undefined, undefined, { outline: false }).rotation.x = -0.2;
  }
  buildHand(hand, side, c, gl) {
    const shiny = gl.shiny ? { emissive: 0x2a1a00, rim: 2 } : undefined;
    this.p(sph(1), c, hand, [0, 0, 0], [0.055, 0.064, 0.066], shiny);
    for (let i = 0; i < 4; i++) {
      const f = this.p(new THREE.CapsuleGeometry(0.017, 0.04, 4, 10), c, hand, [-0.005 * side, -0.035 + (i - 1.5) * 0.0, -0.05], undefined, shiny, { outline: false });
      f.position.set(0, -0.012 + (i - 1.5) * 0.025, -0.05); f.rotation.z = Math.PI / 2;
    }
    this.p(new THREE.CapsuleGeometry(0.017, 0.035, 4, 10), c, hand, [-0.045 * side, 0.02, -0.035], undefined, shiny, { outline: false }).rotation.set(0.7, 0, 0.5 * side);
    if (gl.kind === 'wraps') [-0.02, 0.02].forEach(y => this.p(new THREE.TorusGeometry(0.058, 0.012, 6, 18), gl.c, hand, [0, y + 0.01, 0]).rotation.x = Math.PI / 2);
    if (gl.kind === 'glove' && gl.a) this.p(new THREE.TorusGeometry(0.055, 0.012, 6, 18), gl.a, hand, [0, 0.05, 0]).rotation.x = Math.PI / 2;
  }
  buildHead(H, skin, head, face, top) {
    this.p(sph(0.155), skin, H, [0, 0, 0], [1, 1.06, 1.0]);
    this.p(sph(0.125), skin, H, [0, -0.055, -0.025], [1.02, 0.8, 1]);
    const covered = face.kind === 'shades' || face.kind === 'goggles';
    [-1, 1].forEach(s => {
      this.p(sph(0.034), skin, H, [0.152 * s, 0.0, 0.0], [0.5, 1, 0.8]);
      if (!covered) {
        this.p(sph(1), 0xeeeeee, H, [0.058 * s, 0.022, -0.128], [0.04, 0.047, 0.026], { rim: 0 }, { outline: false });
        this.p(sph(1), 0x5a3218, H, [0.058 * s, 0.017, -0.146], [0.024, 0.028, 0.012], { rough: 0.15 }, { outline: false });
        this.p(sph(1), 0x0a0608, H, [0.058 * s, 0.017, -0.152], [0.012, 0.015, 0.006], { rough: 0.1 }, { outline: false });
        const lid = this.p(sph(0.043, 0, Math.PI * 2, 0, Math.PI * 0.42), skin, H, [0.058 * s, 0.024, -0.128], [0.98, 1.12, 0.66], undefined, { outline: false }); lid.rotation.x = -0.35;
        this.p(sph(0.007), 0xffffff, H, [0.051 * s, 0.03, -0.158], undefined, { emissive: 0x666666, rim: 0 }, { outline: false });
        const brow = this.p(rbox(0.065, 0.018, 0.022, 0.008), 0x1a120e, H, [0.06 * s, 0.083, -0.14]);
        brow.rotation.z = -0.22 * s; brow.rotation.y = 0.15 * s;
      }
    });
    if (face.kind !== 'mask') this.p(sph(0.026), skin, H, [0, -0.012, -0.155], [1, 0.9, 1.15]);
    if (face.kind !== 'mask') {
      const gr = face.kind === 'grillz';
      const mouth = this.p(new THREE.TorusGeometry(0.03, 0.0075, 6, 14, Math.PI * 0.8), gr ? face.c : 0x3a1a18, H, [0.004, -0.07, -0.136], undefined, gr ? { emissive: 0x332000, rim: 2 } : undefined, { outline: false });
      mouth.rotation.set(0, 0, Math.PI + 0.25);
      if (gr) this.p(rbox(0.05, 0.016, 0.02, 0.006), face.c, H, [0.004, -0.083, -0.135], undefined, { emissive: 0x443000, rim: 2 });
    }
    if (face.kind === 'mask') { this.p(sph(0.161, 0, Math.PI * 2, Math.PI * 0.47, Math.PI * 0.45), face.c, H, [0, 0, 0], [1.03, 1.06, 1.06]); this.p(sph(0.13, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), face.c, H, [0, -0.055, -0.03], [1.04, 0.82, 1.04]); }
    if (face.kind === 'beard') {
      this.p(sph(0.158, Math.PI * 0.95, Math.PI * 1.1, Math.PI * 0.56, Math.PI * 0.36), 0x1a120e, H, [0, 0, 0], [1.02, 1.06, 1.04]);
      this.p(rbox(0.07, 0.018, 0.02, 0.008), 0x1a120e, H, [0, -0.045, -0.145]);
    }
    if (face.kind === 'tash') this.p(rbox(0.1, 0.028, 0.03, 0.012), 0x2a1a10, H, [0, -0.045, -0.147]);
    if (face.kind === 'shades') {
      this.p(rbox(0.25, 0.058, 0.04, 0.02), face.c, H, [0, 0.025, -0.14], undefined, { emissive: 0x050a20 });
      this.p(new THREE.BoxGeometry(0.2, 0.008, 0.01), face.a, H, [0, 0.04, -0.162], undefined, { emissive: face.a }, { outline: false });
    }
    if (face.kind === 'goggles') {
      this.p(new THREE.TorusGeometry(0.158, 0.014, 8, 30), 0x222222, H, [0, 0.03, 0]).rotation.x = Math.PI / 2;
      this.p(rbox(0.24, 0.08, 0.05, 0.03), face.c, H, [0, 0.03, -0.14]);
      this.p(rbox(0.21, 0.06, 0.02, 0.02), face.a, H, [0, 0.03, -0.165], undefined, { emissive: 0x552200, rim: 2 }, { outline: false });
    }
    const k = head.kind;
    const hairCap = (c, s = 1) => { const h = this.p(sph(0.161, 0, Math.PI * 2, 0, Math.PI * 0.5), c, H, [0, 0.012, 0.01], [s, 1.07 * s, 1.03 * s]); h.rotation.x = 0.42; return h; };
    if (k === 'hair') hairCap(head.c);
    else if (k === 'hood') {
      const hood = this.p(sph(0.2, 3 * Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.74), top.c, H, [0, 0.015, 0.012], [1.02, 1.08, 1.06], { side: THREE.DoubleSide });
      hood.rotation.x = -0.12;
      const rim = this.p(new THREE.TorusGeometry(0.168, 0.026, 10, 28, Math.PI * 1.15), top.a ?? top.c, H, [0, 0.012, -0.075], [1, 1.12, 1]);
      rim.rotation.set(0, 0, -Math.PI * 0.075);
    } else if (k === 'beanie') {
      this.p(sph(0.166, 0, Math.PI * 2, 0, Math.PI * 0.52), head.c, H, [0, 0.02, 0], [1, 1.18, 1.02]);
      this.p(new THREE.TorusGeometry(0.158, 0.03, 10, 30), head.a, H, [0, 0.035, 0], [1, 1, 1.02]).rotation.x = Math.PI / 2;
      this.p(sph(0.042), head.a, H, [0, 0.22, 0]);
    } else if (k === 'durag') {
      this.p(sph(0.164, 0, Math.PI * 2, 0, Math.PI * 0.56), head.c, H, [0, 0.012, 0.01], [1, 1.08, 1.04], { emissive: 0x050a30, rim: 2.4 }).rotation.x = 0.3;
      [-1, 1].forEach(s => { const t = this.p(rbox(0.045, 0.22, 0.012, 0.005), head.c, H, [0.025 * s, -0.08, 0.16], undefined, { rim: 2.4 }); t.rotation.set(0.25, 0, 0.08 * s); });
    } else if (k === 'bucket') {
      const mat = new THREE.MeshToonMaterial({ map: checkTexture(head.c, head.a), gradientMap: toonGradient() }); this.mats.push(mat);
      this.p(cyl(0.135, 0.168, 0.13, 26), mat, H, [0, 0.12, 0]);
      this.p(cyl(0.17, 0.25, 0.04, 30), mat, H, [0, 0.055, 0]);
    } else if (k === 'cap') {
      hairCap(0x1a120e, 0.98);
      this.p(sph(0.166, 0, Math.PI * 2, 0, Math.PI * 0.5), head.c, H, [0, 0.03, 0], [1, 0.95, 1.02]);
      this.p(rbox(0.17, 0.016, 0.13, 0.008), head.a, H, [0, 0.04, 0.2]).rotation.x = -0.15;
      this.p(sph(0.016), head.a, H, [0, 0.19, 0]);
    } else if (k === 'helmet') {
      this.p(sph(0.165, 0, Math.PI * 2, 0, Math.PI * 0.56), head.c, H, [0, 0.05, 0], [1, 1.75, 1.05]);
      this.p(new THREE.TorusGeometry(0.168, 0.02, 8, 30), head.c, H, [0, 0.045, 0]).rotation.x = Math.PI / 2;
      this.p(sph(0.036), 0xd8dde6, H, [0, 0.17, -0.158], [1, 1.25, 0.4], { emissive: 0x333333, rim: 2 });
      this.p(sph(0.022), 0xd8dde6, H, [0, 0.335, 0]);
    } else if (k === 'curlers') {
      hairCap(head.c, 1.04);
      [[-0.07, 0.15], [0, 0.175], [0.07, 0.15], [-0.04, 0.12, 0.09], [0.04, 0.12, 0.09]].forEach(([x, y, z = -0.02]) => this.p(cyl(0.024, 0.024, 0.075, 12), head.a, H, [x, y, z]).rotation.z = Math.PI / 2);
    } else if (k === 'crown') {
      hairCap(0x1a120e);
      const gold = { emissive: 0x2a1800, rim: 2, metal: 1, rough: 0.2 };
      this.p(cyl(0.14, 0.135, 0.07, 28, true), head.c, H, [0, 0.16, 0], undefined, { ...gold, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        this.p(new THREE.ConeGeometry(0.03, 0.08, 8), head.c, H, [Math.sin(a) * 0.13, 0.23, Math.cos(a) * 0.13], undefined, gold);
        this.p(sph(0.017), i % 2 ? 0xff2244 : 0x2266ff, H, [Math.sin(a) * 0.142, 0.16, Math.cos(a) * 0.142], undefined, { emissive: i % 2 ? 0xaa0011 : 0x0022aa }, { outline: false });
      }
    }
  }
  neckItem(T) {
    const n = this.d('neck');
    if (n.kind === 'chain' || n.kind === 'iced') {
      const extra = n.kind === 'iced' ? { emissive: 0x4a7aa0, rim: 3, metal: 0.7, rough: 0.08 } : { emissive: 0x221400, rim: 1.6, metal: 1, rough: 0.22 };
      // cuban links: alternating little tori around the neck
      const chain = new THREE.Group(); chain.position.set(0, 0.5, -0.07); chain.rotation.x = 1.15; T.add(chain);
      const lm = this.m(n.c, extra), lg = new THREE.TorusGeometry(0.0105, 0.0042, 8, 14);
      for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; const l = new THREE.Mesh(lg, lm); l.position.set(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0); l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, a + Math.PI / 2); chain.add(l); }
      this.p(n.kind === 'iced' ? new THREE.OctahedronGeometry(0.04) : rbox(0.05, 0.06, 0.015, 0.008), n.c, T, [0, 0.38, -0.205], undefined, extra);
    }
  }
  backItem(T) {
    const b = this.d('back');
    if (b.kind === 'manbag') {
      this.p(rbox(0.2, 0.13, 0.07, 0.03), b.c, T, [0.08, 0.12, -0.215]);
      this.p(new THREE.TorusGeometry(0.31, 0.014, 6, 34), 0x15161a, T, [0, 0.3, 0], [0.86, 1, 0.78]).rotation.set(0, 0, 0.75);
    } else if (b.kind === 'backpack') {
      this.p(rbox(0.3, 0.36, 0.15, 0.06), b.c, T, [0, 0.27, 0.22]);
      this.p(rbox(0.22, 0.12, 0.05, 0.03), b.a, T, [0, 0.16, 0.3]);
      [-1, 1].forEach(s => this.p(rbox(0.035, 0.36, 0.02, 0.01), 0x111111, T, [0.11 * s, 0.3, -0.17], undefined, undefined, { outline: false }));
    } else if (b.kind === 'delivery') {
      this.p(rbox(0.44, 0.44, 0.36, 0.05), b.c, T, [0, 0.36, 0.33]);
      this.p(new THREE.BoxGeometry(0.3, 0.06, 0.01), 0xffffff, T, [0, 0.42, 0.516], undefined, undefined, { outline: false });
    } else if (b.kind === 'wings') {
      [-1, 1].forEach(s => {
        const w = G(); w.position.set(0.08 * s, 0.38, 0.17); w.rotation.set(0.2, 0.5 * s, 0.35 * s); T.add(w);
        for (let i = 0; i < 5; i++) this.p(sph(1), b.c, w, [0.12 * s + i * 0.07 * s, 0.1 - i * 0.07, 0], [0.09 - i * 0.008, 0.2 - i * 0.02, 0.025], { emissive: 0x333344, rim: 2.5 });
      });
    }
  }
  setKnife(item) {
    if (this.knife) { this.arms[1].hand.remove(this.knife); disposeKnife(this.knife); }
    this.knife = buildKnife(item, { shadows: true });
    this.knife.rotation.set(0, Math.PI / 2, 0);
    this.knife.position.set(0, -0.02, -0.01); this.knife.scale.setScalar(1.8);
    this.arms[1].hand.add(this.knife);
  }
  dispose() {
    if (this.knife) { this.knife.parent?.remove(this.knife); disposeKnife(this.knife); this.knife = null; } // knife materials are shared — only free geometry
    this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== outlineMat) o.material.dispose?.(); } });
    this.root.parent?.remove(this.root);
  }
  flash() { this.flashT = 0.1; this.hitT = 1; }
  kill(backwards = true) { this.deadT = 0; this.fallDir = backwards ? 1 : -1; }
  revive() { this.deadT = -1; this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); }

  // st: { speed, attack: {kind, t}, dash, air, vy, emote (0..1) }
  update(dt, st) {
    this.t += dt;
    const [L, R] = this.arms, [lL, lR] = this.legs;
    const sp = Math.min(1.3, st.speed / 5.2);
    this.phase += dt * (5 + st.speed * 2.0) * (sp > 0.05 ? 1 : 0);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = 0.7 * Math.min(1, sp);
    const breath = Math.sin(this.t * 2.2) * 0.012;
    lL.hip.rotation.x = s * amp; lR.hip.rotation.x = -s * amp;
    lL.knee.rotation.x = Math.max(0, -c) * amp * 1.4 + 0.05; lR.knee.rotation.x = Math.max(0, c) * amp * 1.4 + 0.05;
    this.land = Math.max(0, this.land - dt * 5);
    if (st.air) {
      const k = st.vy > 0 ? 0.7 : 0.4;
      lL.hip.rotation.x = -0.6 * k; lR.hip.rotation.x = 0.2; lL.knee.rotation.x = 1.3 * k; lR.knee.rotation.x = 0.9 * k;
    }
    if (this.deadT < 0) this.body.position.y = Math.abs(c) * 0.05 * Math.min(1, sp) - this.land * 0.12 + breath;
    const lean = st.dash ? 0.38 : Math.min(1, sp) * 0.14;
    this.lean += (lean - this.lean) * Math.min(1, dt * 10);
    this.hitT = Math.max(0, this.hitT - dt * 4);
    this.torso.rotation.x = -this.lean + this.hitT * 0.35;
    this.torso.rotation.y = s * 0.08 * Math.min(1, sp);
    this.head.rotation.set(0, 0, 0);
    L.sh.rotation.set(-s * amp * 0.8 + 0.35, 0.25, -0.2 - breath * 3); L.el.rotation.x = 0.75;
    R.sh.rotation.set(0.8 + s * amp * 0.3, -0.25, 0.12); R.el.rotation.x = 1.1;
    R.hand.rotation.set(-1.1, 0, 0);
    if (st.emote != null) {
      const e = st.emote;
      R.sh.rotation.set(1.1 + Math.sin(e * Math.PI) * 0.5, -0.6, 0.2); R.el.rotation.x = 1.5;
      R.hand.rotation.set(-1.1 + e * Math.PI * 4, 0, 0);
      this.head.rotation.set(0.12, -0.35 * Math.sin(e * Math.PI), 0);
    }
    if (st.attack) {
      const { kind, t } = st.attack;
      const e = t < 0.35 ? t / 0.35 : 1;
      const k = t < 0.35 ? 0 : Math.min(1, (t - 0.35) / 0.3);
      if (kind === 'slash1' || kind === 'slash2' || kind === 'fin') {
        const dir = kind === 'slash2' ? -1 : 1;
        const from = -1.5 * dir, to = 1.1 * dir;
        R.sh.rotation.x = 1.45; R.sh.rotation.y = t < 0.35 ? from * e : from + (to - from) * easeOut(k);
        R.el.rotation.x = t < 0.35 ? 1.2 : 0.25;
        this.torso.rotation.y = (t < 0.35 ? -0.4 * dir * e : -0.4 * dir + 0.9 * dir * easeOut(k));
        R.hand.rotation.set(-1.2, 0, -dir * 0.6);
      } else {
        R.sh.rotation.x = t < 0.35 ? 0.4 + e * 0.6 : 1.0 + easeOut(k) * 0.65; R.sh.rotation.y = -0.15;
        R.el.rotation.x = t < 0.35 ? 1.9 : 1.9 - easeOut(k) * 1.75;
        R.hand.rotation.x = -1.2 + (t < 0.35 ? 0 : easeOut(k) * 0.6);
        this.torso.rotation.x = -this.lean - (t < 0.35 ? -0.15 * e : 0.3 * easeOut(k));
      }
    }
    if (this.flashT > 0) this.flashT -= dt;
    const fl = this.flashT > 0 ? 1 : 0;
    if (fl !== this._fl) { this._fl = fl; this.mats.forEach(m => { if (m._e === undefined) m._e = m.emissive.getHex(); m.emissive.setHex(fl ? 0x660000 : m._e); }); }
    if (this.deadT >= 0) {
      this.deadT += dt;
      const f = Math.min(1, this.deadT / 0.55);
      this.body.rotation.x = this.fallDir * easeIn(f) * Math.PI / 2;
      this.body.position.y = -easeIn(f) * 0.08 + (f >= 1 ? -0.05 : 0);
      this.body.position.z = this.fallDir * easeIn(f) * 0.15;
      lL.hip.rotation.x = 0.2; lR.hip.rotation.x = -0.1; L.sh.rotation.set(2.6, 0, -0.6); R.sh.rotation.set(2.4, 0, 0.6);
    }
  }
}
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
