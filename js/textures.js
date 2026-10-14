// Procedural textures: knife skins, environment, blood, signs. Everything is drawn on canvases.
import * as THREE from 'three';
import { rng } from './data.js';

// ---------- noise ----------
function makeNoise(seed) {
  const r = rng(seed * 7919 + 13);
  const P = new Uint8Array(512); const base = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) P[i] = base[i & 255];
  const G = new Float32Array(256).map(() => r() * 2 - 1);
  const fade = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => G[P[(P[a & 255] + b) & 255]];
    const u = fade(xf), v = fade(yf);
    const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
    const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * n2(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
  return { n2, fbm, r };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.max(0, Math.min(1, x));
const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function ramp(stops, t) {
  t = clamp01(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0 || 1); const a = hex(c0), b = hex(c1);
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    }
  }
  return hex(stops[stops.length - 1][1]);
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Each skin: per-pixel colour fn (u,v in 0..1 along blade: u = heel→tip, v = edge→spine) + material params.
const SKIN_DEFS = {
  stock:  { metal: 1, rough: 0.28, px: (u, v, N) => { const s = 0.72 + 0.1 * N.n2(u * 4, v * 140) + 0.04 * N.n2(u * 60, v * 400); return [s * 205, s * 210, s * 218]; } },
  midnight: { metal: 0.6, rough: 0.42, px: (u, v, N) => { const s = 0.12 + 0.05 * N.fbm(u * 8, v * 8); return [s * 255, s * 255, s * 275]; } },
  urban:  { metal: 0.15, rough: 0.7, px: (u, v, N) => {
    const n = N.fbm(u * 5, v * 3, 4), m = N.fbm(u * 5 + 9, v * 3 + 4, 4);
    if (n > 0.18) return [40, 42, 46]; if (m > 0.12) return [215, 218, 222]; if (n < -0.2) return [110, 114, 120]; return [160, 164, 170]; } },
  ultraviolet: { metal: 0.45, rough: 0.4, px: (u, v, N) => { const n = N.fbm(u * 6, v * 5); const w = n > 0.25 ? 0.25 : 1; return [70 * w, 22 * w, 120 * w]; } },
  patina: { metal: 0.95, rough: 0.26, px: (u, v, N, seed) => {
    const blueBias = ((seed % 100) / 100) * 0.5 - 0.15;
    const n = N.fbm(u * 3 + 3, v * 3, 6) + blueBias, d = N.fbm(u * 9, v * 9, 3);
    if (n > 0.12) return ramp([[0, 0x1b3fa8], [0.5, 0x3c6fe0], [1, 0x87b4ff]], (n - 0.12) * 3 + d * 0.5);
    if (n < -0.12) return ramp([[0, 0xa8741c], [0.5, 0xd8a640], [1, 0xf3d27e]], (-n - 0.12) * 3 + d * 0.5);
    return ramp([[0, 0x6c6a7a], [1, 0xb4b0a8]], 0.5 + d); } },
  tiger: { metal: 1, rough: 0.14, px: (u, v, N) => {
    const w = N.n2(u * 6, v * 2) * 0.35; const s = Math.sin((u * 22 + w * 6 + v * 3) * Math.PI);
    const stripe = s > 0.55 ? 1 : 0;
    const base = ramp([[0, 0xe8a42a], [0.5, 0xf6cd5b], [1, 0xffe9a0]], v + 0.15 * N.n2(u * 3, v * 3));
    return stripe ? [base[0] * 0.75, base[1] * 0.38, base[2] * 0.1] : base; } },
  butcher: { metal: 0.9, rough: 0.2, px: (u, v, N) => {
    const n = N.fbm(u * 5, v * 4, 6), vein = Math.abs(N.fbm(u * 10 + 2, v * 8, 4));
    const c = n > 0.08 ? ramp([[0, 0xd06070], [1, 0xf3c6c8]], (n - 0.08) * 4) : ramp([[0, 0x6a0a12], [1, 0xb3121f]], 0.6 + n);
    return vein < 0.03 ? [c[0] * 0.6, c[1] * 0.5, c[2] * 0.5] : c; } },
  doppler: { metal: 1, rough: 0.07, px: (u, v, N, seed) => swirl(u, v, N, seed, [[0, 0x07030c], [0.35, 0x2a0e3f], [0.6, 0x8a1d6e], [0.8, 0xe2477a], [1, 0xff9fbf]]) },
  gamma:   { metal: 1, rough: 0.07, px: (u, v, N, seed) => swirl(u, v, N, seed, [[0, 0x02100a], [0.35, 0x0b4a2e], [0.65, 0x1fae6b], [0.85, 0x7cf2b8], [1, 0xe6fff2]]) },
  ruby:    { metal: 1, rough: 0.04, emissive: 0x330004, px: (u, v, N, seed) => swirl(u, v, N, seed, [[0, 0x1a0002], [0.3, 0x5e0010], [0.6, 0xc4062a], [0.85, 0xff2b52], [1, 0xff9db0]]) },
  sapphire:{ metal: 1, rough: 0.04, emissive: 0x00102e, px: (u, v, N, seed) => swirl(u, v, N, seed, [[0, 0x00030f], [0.3, 0x041a5c], [0.6, 0x0c4fd4], [0.85, 0x34a2ff], [1, 0xb8e2ff]]) },
  emerald: { metal: 1, rough: 0.04, emissive: 0x002810, px: (u, v, N, seed) => swirl(u, v, N, seed, [[0, 0x000d05], [0.3, 0x024d22], [0.6, 0x0aa74a], [0.85, 0x3ff58e], [1, 0xc8ffd9]]) },
  bloodweb: { metal: 0.35, rough: 0.32, px: (u, v, N) => { const n = N.fbm(u * 4, v * 4, 3) * 0.12; return [168 + n * 200, 12, 14]; }, post: drawWeb },
  fade: { metal: 1, rough: 0.08, px: (u, v, N, seed) => {
    const off = (seed % 100) / 400; const t = u * 0.9 + v * 0.25 + off + 0.04 * N.n2(u * 3, v * 3);
    return ramp([[0, 0xf7e43c], [0.35, 0xff8a3d], [0.6, 0xf04b9a], [0.85, 0x7a3bd8], [1, 0x3b2bb0]], t); } },
  marble: { metal: 1, rough: 0.1, px: (u, v, N, seed) => {
    const wx = N.fbm(u * 2 + seed * 0.01, v * 2, 4), wy = N.fbm(u * 2 + 5, v * 2 + 7, 4);
    const t = N.fbm(u * 3 + wx * 2.2, v * 3 + wy * 2.2, 5);
    if (t > 0.18) return ramp([[0, 0xffb400], [1, 0xfff07a]], (t - 0.18) * 4);
    if (t > -0.02) return ramp([[0, 0xd4120f], [1, 0xff4a2a]], (t + 0.02) * 5);
    if (t > -0.08) return [12, 10, 16];
    return ramp([[0, 0x0a1c8a], [1, 0x2f6bff]], (-t - 0.08) * 4); } },
};

function swirl(u, v, N, seed, stops) {
  const wx = N.fbm(u * 2.5 + seed * 0.013, v * 2.5, 4), wy = N.fbm(u * 2.5 + 4, v * 2.5 + 2, 4);
  const t = N.fbm(u * 3.2 + wx * 2.5, v * 3.2 + wy * 2.5, 5) * 1.4 + 0.5;
  const c = ramp(stops, t);
  // occasional sparkle
  const sp = N.n2(u * 160, v * 160);
  if (sp > 0.62) return [Math.min(255, c[0] + 120), Math.min(255, c[1] + 120), Math.min(255, c[2] + 120)];
  return c;
}

function drawWeb(ctx, W, H, r) {
  ctx.strokeStyle = 'rgba(8,0,0,0.92)'; ctx.lineWidth = 2.2;
  const cx = W * (0.3 + r() * 0.4), cy = H * (r() * 1.2 - 0.1);
  const spokes = 14, rings = 9;
  const ang = [...Array(spokes)].map((_, i) => (i / spokes) * Math.PI * 2 + r() * 0.2);
  ang.forEach(a => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * W * 1.2, cy + Math.sin(a) * W * 1.2); ctx.stroke(); });
  for (let k = 1; k <= rings; k++) {
    const rad = k * W * 0.09;
    ctx.beginPath();
    ang.forEach((a, i) => {
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else {
        const pa = ang[i - 1], mid = (a + pa) / 2, sag = rad * 0.86;
        ctx.quadraticCurveTo(cx + Math.cos(mid) * sag, cy + Math.sin(mid) * sag, x, y);
      }
    });
    ctx.stroke();
  }
}

const skinCache = new Map();
// Returns { map, metalness, roughness, emissive }.
export function skinMaterialParams(skin, seed = 0, flt = 0.05) {
  const key = `${skin}|${seed}|${Math.round(flt * 50)}`;
  if (skinCache.has(key)) return skinCache.get(key);
  const def = SKIN_DEFS[skin] || SKIN_DEFS.stock;
  const W = 256, H = 128, c = canvas(W, H), ctx = c.getContext('2d');
  const N = makeNoise(seed + skin.length * 31);
  const img = ctx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = def.px(x / W, 1 - y / H, N, seed);
    const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (def.post) def.post(ctx, W, H, N.r);
  // wear: scratches / chipped paint revealing steel
  const scratches = Math.floor(flt * 260);
  const R = rng(seed + 99);
  for (let i = 0; i < scratches; i++) {
    const x = R() * W, y = R() * H, len = 4 + R() * 24 * flt * 2, a = R() * Math.PI;
    ctx.strokeStyle = `rgba(200,204,210,${0.25 + R() * 0.5})`; ctx.lineWidth = 0.6 + R() * flt * 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.3); ctx.stroke();
  }
  // polished edge highlight along the cutting edge (bottom)
  const g = ctx.createLinearGradient(0, H, 0, H - 14); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 14, W, 14);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // Painted/anodised finishes keep some diffuse colour so they read vividly; bare steel stays fully metallic.
  const bare = skin === 'stock' || skin === 'patina';
  const out = { map: tex, metalness: bare ? 0.88 : Math.min(def.metal, 0.6), roughness: Math.min(1, Math.max(bare ? 0.2 : 0.16, def.rough) + flt * 0.25), emissive: def.emissive || 0 };
  skinCache.set(key, out);
  return out;
}

// CSS gradient approximating a skin, for UI chips.
export const SKIN_SWATCH = {
  stock: 'linear-gradient(90deg,#9aa0a8,#e5e8ec)', midnight: 'linear-gradient(90deg,#111,#2a2a33)', urban: 'linear-gradient(90deg,#2a2b2e,#b3b6bb,#dfe1e4)',
  ultraviolet: 'linear-gradient(90deg,#220833,#5a1a96)', patina: 'linear-gradient(90deg,#2a52c9,#9a9590,#d8a640)', tiger: 'repeating-linear-gradient(100deg,#f6cd5b 0 10px,#9c4a10 10px 14px)',
  butcher: 'linear-gradient(90deg,#7a0a14,#e7a3ae)', doppler: 'linear-gradient(90deg,#0a0412,#8a1d6e,#ff9fbf)', gamma: 'linear-gradient(90deg,#03140c,#1fae6b,#c8ffe4)',
  bloodweb: 'linear-gradient(90deg,#a40c0e,#c81616)', fade: 'linear-gradient(90deg,#f7e43c,#ff8a3d,#f04b9a,#7a3bd8)', marble: 'linear-gradient(90deg,#1f4bff,#d4120f,#ffd23a)',
  ruby: 'linear-gradient(90deg,#3a0006,#c4062a,#ff6f8c)', sapphire: 'linear-gradient(90deg,#020a2e,#0c4fd4,#7cc4ff)', emerald: 'linear-gradient(90deg,#00180a,#0aa74a,#8bffbb)',
};

// ---------- toon gradient ----------
let toonGrad;
export function toonGradient() {
  if (toonGrad) return toonGrad;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  toonGrad = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter; toonGrad.needsUpdate = true;
  return toonGrad;
}

// ---------- environment ----------
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
}
export function brickTexture(base = '#b4553a', mortar = '#d9c7b0') {
  const c = canvas(256, 256), x = c.getContext('2d'), r = rng(base.length * 77 + base.charCodeAt(1));
  x.fillStyle = mortar; x.fillRect(0, 0, 256, 256);
  const bw = 32, bh = 16;
  for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) {
    const off = row % 2 ? bw / 2 : 0, v = (r() - 0.5) * 30;
    const b = hex(parseInt(base.slice(1), 16));
    x.fillStyle = `rgb(${b[0] + v},${b[1] + v * 0.6},${b[2] + v * 0.5})`;
    x.fillRect(col * bw + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
  }
  return tex(c);
}
export function asphaltTexture() {
  const c = canvas(512, 512), x = c.getContext('2d'), N = makeNoise(5);
  const img = x.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) { const px = i % 512, py = (i / 512) | 0; const n = 70 + N.fbm(px / 40, py / 40, 4) * 30 + (N.r() - 0.5) * 18; img.data.set([n * 0.92, n * 0.9, n * 1.02, 255], i * 4); }
  x.putImageData(img, 0, 0);
  return tex(c);
}
export function paveTexture() {
  const c = canvas(256, 256), x = c.getContext('2d'), r = rng(3);
  x.fillStyle = '#8a8c94'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 170 + (r() - 0.5) * 22; x.fillStyle = `rgb(${v},${v},${v + 6})`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(40,40,40,0.25)'; x.beginPath(); x.arc(r() * 256, r() * 256, 2 + r() * 4, 0, 7); x.fill(); }
  return tex(c);
}
export function grassTexture() {
  const c = canvas(256, 256), x = c.getContext('2d'), N = makeNoise(11);
  const img = x.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const px = i % 256, py = (i / 256) | 0; const n = N.fbm(px / 30, py / 30, 4); img.data.set([46 + n * 30, 140 + n * 50, 70 + n * 20, 255], i * 4); }
  x.putImageData(img, 0, 0);
  return tex(c);
}
export function signTexture(text, { bg = '#111', fg = '#fff', font = 'Bangers, Impact, sans-serif', w = 512, h = 128, border, sub, glow } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = 10; x.strokeRect(6, 6, w - 12, h - 12); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = h * (sub ? 0.5 : 0.66); x.font = `${size}px ${font}`;
  while (x.measureText(text).width > w * 0.9) { size -= 2; x.font = `${size}px ${font}`; }
  if (glow) { x.shadowColor = glow; x.shadowBlur = 18; }
  x.fillText(text, w / 2, sub ? h * 0.4 : h / 2 + 4);
  if (sub) { x.shadowBlur = 0; x.font = `${h * 0.2}px Rubik, Arial, sans-serif`; x.fillText(sub, w / 2, h * 0.8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function windowTexture(lit) {
  const c = canvas(64, 96), x = c.getContext('2d');
  x.fillStyle = '#f1ece0'; x.fillRect(0, 0, 64, 96);
  const g = x.createLinearGradient(0, 0, 0, 96);
  if (lit) { g.addColorStop(0, '#ffe7a3'); g.addColorStop(1, '#ffb14a'); } else { g.addColorStop(0, '#9ec6e8'); g.addColorStop(1, '#3b5f8f'); }
  x.fillStyle = g; x.fillRect(6, 6, 52, 84);
  x.fillStyle = '#f1ece0'; x.fillRect(30, 6, 4, 84); x.fillRect(6, 44, 52, 4);
  if (!lit) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(10, 40); x.lineTo(24, 10); x.lineTo(28, 10); x.lineTo(14, 40); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function graffitiTexture() {
  const c = canvas(512, 256), x = c.getContext('2d');
  x.clearRect(0, 0, 512, 256);
  const tags = [['ENDZ', '#ff3b8d', '#2bd1ff'], ['SHANK', '#f9e04b', '#ff5a1f'], ['E14', '#7cff5a', '#202020']];
  tags.forEach(([t, f, s], i) => {
    x.save(); x.translate(90 + i * 165, 130 + (i % 2 ? -30 : 25)); x.rotate((i - 1) * 0.12);
    x.font = `${86 - i * 8}px Bangers, Impact, sans-serif`; x.textAlign = 'center';
    x.lineWidth = 12; x.strokeStyle = s; x.strokeText(t, 0, 0); x.fillStyle = f; x.fillText(t, 0, 0); x.restore();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- blood ----------
export function bloodSplatTextures(n = 4) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = canvas(128, 128), x = c.getContext('2d'), r = rng(k * 31 + 7);
    const blob = (cx, cy, rad) => {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(120,0,6,0.95)'); g.addColorStop(0.7, 'rgba(150,4,12,0.9)'); g.addColorStop(1, 'rgba(150,4,12,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
    };
    blob(64, 64, 26 + r() * 10);
    for (let i = 0; i < 14; i++) { const a = r() * 7, d = 20 + r() * 38; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + r() * 9); }
    for (let i = 0; i < 6; i++) { // streaks
      const a = r() * 7; x.strokeStyle = 'rgba(130,0,8,0.8)'; x.lineWidth = 2 + r() * 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20); x.lineTo(64 + Math.cos(a) * (40 + r() * 20), 64 + Math.sin(a) * (40 + r() * 20)); x.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; out.push(t);
  }
  return out;
}
export function bloodSmearTexture() {
  const c = canvas(256, 128), x = c.getContext('2d'), r = rng(42);
  for (let i = 0; i < 40; i++) {
    const cx = r() * 256, cy = 60 + r() * 68, rad = 6 + r() * 26;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(0, 100, 256, 28);
  return new THREE.CanvasTexture(c);
}
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(64, 64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Reflection environment for blades: dusk-purple sky, pink horizon, a few bright softboxes for that showroom shine.
export function makeEnvScene() {
  const sc = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; void main(){ vec3 top = vec3(0.55,0.45,1.0); vec3 hor = vec3(1.0,0.62,0.78); vec3 bot = vec3(0.12,0.1,0.16); vec3 c = p.y > 0. ? mix(hor, top, pow(p.y, .6)) : mix(hor*.6, bot, pow(-p.y, .5)); gl_FragColor = vec4(c, 1.); }',
  }));
  sc.add(sky);
  const box = (w, h, x, y, z, c = 0xffffff, k = 6) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  box(6, 2, 0, 8, 2); box(2, 5, -7, 2, -3, 0xffe6c8, 4); box(2, 5, 7, 1, 3, 0xd8c8ff, 3); box(3, 1, 3, 3, -8, 0xffffff, 5);
  return sc;
}
