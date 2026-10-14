// All sound is synthesised with WebAudio — no files to load. Positional sounds use HRTF panning.
let ctx, master, sfx, amb, noiseBuf, brownBuf, started = false, volume = 0.8;

export function initAudio(vol = volume) {
  volume = vol;
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = volume; master.connect(comp);
  sfx = ctx.createGain(); sfx.connect(master);
  amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  brownBuf = ctx.createBuffer(1, len, ctx.sampleRate); const b = brownBuf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  started = true;
}
export const setVolume = v => { volume = v; if (master) master.gain.value = v; };
export const audioReady = () => started;

const now = () => ctx.currentTime;
function noise(t, dur, { buf = noiseBuf, rate = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; s.loop = true;
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s;
}
function env(t, a, hold, rel, peak = 1) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); return g;
}
function filt(type, f, Q = 1) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = Q; return n; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

// Output target: plain (2D) or positioned in the world.
function out(pos) {
  if (!pos) return sfx;
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.3; p.maxDistance = 80;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1, pos.z);
  p.connect(sfx); return p;
}
export function setListener(pos, fwd) {
  if (!ctx) return; const L = ctx.listener;
  if (L.positionX) {
    L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
    L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
}

// ---------- weapon ----------
export function whoosh(intensity = 1, pos, pitch = 1) {
  if (!ctx) return; const t = now(), dur = 0.2 + 0.06 * intensity;
  const bp = filt('bandpass', 500 * pitch, 1.4);
  bp.frequency.setValueAtTime(500 * pitch, t); bp.frequency.exponentialRampToValueAtTime(2800 * pitch, t + dur * 0.45); bp.frequency.exponentialRampToValueAtTime(700 * pitch, t + dur);
  chain(noise(t, dur), bp, env(t, dur * 0.4, 0, dur * 0.6, 0.55 * intensity), out(pos));
}
export function shing(pos, vol = 0.12) { // metallic ring
  if (!ctx) return; const t = now();
  [3150, 4370, 5920, 7410].forEach((f, i) => { const o = osc(i % 2 ? 'triangle' : 'sine', f * (0.97 + Math.random() * 0.06)); chain(o, env(t, 0.003, 0, 0.25 + i * 0.05, vol / (i + 1)), out(pos)); o.start(t); o.stop(t + 0.5); });
}
export function slice(pos, heavy = false) {
  if (!ctx) return; const t = now();
  // tearing flesh
  const bp = filt('bandpass', 3200, 0.9); bp.frequency.setValueAtTime(3600, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.14);
  chain(noise(t, 0.16), filt('highpass', 500), bp, env(t, 0.002, 0.02, 0.12, 1.1), out(pos));
  // wet squelch (amplitude-modulated low noise)
  const sq = filt('lowpass', 1100, 3); sq.frequency.setValueAtTime(1300, t + 0.01); sq.frequency.exponentialRampToValueAtTime(250, t + 0.25);
  const am = ctx.createGain(); am.gain.value = 0.5; const lfo = osc('square', 28 + Math.random() * 18); const lg = ctx.createGain(); lg.gain.value = 0.5; chain(lfo, lg, am.gain); lfo.start(t); lfo.stop(t + 0.35);
  chain(noise(t, 0.3), sq, am, env(t + 0.01, 0.01, 0.06, 0.2, heavy ? 1.6 : 1.1), out(pos));
  // body thump
  const o = osc('sine', 120); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  chain(o, env(t, 0.003, 0.03, 0.16, heavy ? 1.3 : 0.8), out(pos)); o.start(t); o.stop(t + 0.3);
  shing(pos, 0.07);
  // splatter droplets hitting the floor
  for (let i = 0; i < (heavy ? 7 : 4); i++) {
    const tt = t + 0.12 + Math.random() * 0.35;
    chain(noise(tt, 0.03), filt('bandpass', 1800 + Math.random() * 1600, 2), env(tt, 0.001, 0, 0.03, 0.25 + Math.random() * 0.2), out(pos));
  }
}
export function stab(pos) {
  if (!ctx) return; const t = now();
  slice(pos, true);
  const cr = filt('bandpass', 420, 1.5);
  const ws = ctx.createWaveShaper(); const curve = new Float32Array(256).map((_, i) => Math.tanh((i / 128 - 1) * 6)); ws.curve = curve;
  chain(noise(t + 0.02, 0.12, { rate: 0.5 }), cr, ws, env(t + 0.02, 0.003, 0.03, 0.09, 0.5), out(pos));
}
// Synth voice: buzzy glottal source + vowel formants + breath. Sounds like "ugh!" / "argh".
const VOWELS = [[640, 1190, 2390], [800, 1150, 2800], [500, 900, 2500], [560, 1700, 2500]];
export function grunt(pos, pitch = 1, long = false, vol = 0.7) {
  if (!ctx) return; const t = now(), dur = long ? 0.6 : 0.2 + Math.random() * 0.08;
  const f0 = (115 + Math.random() * 30) * pitch;
  const o = osc('sawtooth', f0), o2 = osc('square', f0 * 1.005);
  o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.exponentialRampToValueAtTime(f0 * (long ? 0.6 : 0.8), t + dur);
  o2.frequency.setValueAtTime(f0 * 1.25, t); o2.frequency.exponentialRampToValueAtTime(f0 * (long ? 0.6 : 0.8), t + dur);
  const vib = osc('sine', 7 + Math.random() * 4), vg = ctx.createGain(); vg.gain.value = f0 * 0.04; chain(vib, vg, o.frequency); vib.start(t); vib.stop(t + dur + 0.1);
  const src = ctx.createGain(); src.gain.value = 0.5; o.connect(src); o2.connect(src);
  const ws = ctx.createWaveShaper(); ws.curve = new Float32Array(256).map((_, i) => Math.tanh((i / 128 - 1) * 2.5));
  const [F1, F2, F3] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
  const g = env(t, 0.012, dur * 0.35, dur * 0.65, vol);
  [[F1, 6, 1], [F2, 8, 0.6], [F3, 10, 0.25]].forEach(([f, q, a]) => { const bp = filt('bandpass', f, q); const ga = ctx.createGain(); ga.gain.value = a * 3; src.connect(ws); ws.connect(bp); bp.connect(ga); ga.connect(g); });
  chain(noise(t, dur), filt('bandpass', 1800, 0.7), env(t, 0.005, dur * 0.2, dur * 0.6, 0.18 * vol), out(pos)); // breath
  g.connect(out(pos)); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}
export function hurt() { grunt(null, 0.85 + Math.random() * 0.1, false, 0.9); }
export function thud(pos) {
  if (!ctx) return; const t = now();
  const o = osc('sine', 70); o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
  chain(o, env(t, 0.005, 0.04, 0.3, 1.2), out(pos)); o.start(t); o.stop(t + 0.4);
  chain(noise(t, 0.15, { rate: 0.4 }), filt('lowpass', 500), env(t, 0.003, 0.02, 0.12, 0.6), out(pos));
}
export function draw() { // knife unsheathed
  if (!ctx) return; const t = now();
  const bp = filt('bandpass', 2500, 6); bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(6500, t + 0.35);
  chain(noise(t, 0.4), bp, env(t, 0.03, 0.15, 0.2, 0.35), sfx);
  setTimeout(() => shing(null, 0.16), 300);
}
export function flipClick() { if (!ctx) return; const t = now(); chain(noise(t, 0.02), filt('highpass', 3000), env(t, 0.001, 0, 0.02, 0.4), sfx); }

// ---------- movement ----------
export function footstep(pos, loud = 1) {
  if (!ctx) return; const t = now();
  chain(noise(t, 0.06, { rate: 0.7 }), filt('lowpass', 900 + loud * 500), env(t, 0.002, 0.01, 0.06, 0.45 * loud), out(pos));
  chain(noise(t, 0.02), filt('bandpass', 3500, 2), env(t, 0.001, 0, 0.02, 0.12 * loud), out(pos));
}
export function dashSfx(pos) {
  if (!ctx) return; whoosh(1.3, pos, 0.55);
  const t = now(); chain(noise(t, 0.25), filt('bandpass', 900, 0.8), env(t, 0.02, 0.05, 0.15, 0.35), out(pos));
}
export function sprintStart() { if (!ctx) return; whoosh(0.8, null, 0.7); }

// ---------- feedback ----------
let lastBeat = 0;
export function heartbeat(rate = 1) {
  if (!ctx) return; const t = now(); if (t - lastBeat < 0.75 / rate) return; lastBeat = t;
  [0, 0.17].forEach((d, i) => { const o = osc('sine', i ? 48 : 55); chain(o, env(t + d, 0.01, 0.03, 0.12, 0.9), sfx); o.start(t + d); o.stop(t + d + 0.25); });
}
export function hitMarker(big) { if (!ctx) return; const t = now(); const o = osc('square', big ? 1400 : 1800); chain(o, filt('bandpass', 1800, 3), env(t, 0.001, 0.01, 0.04, 0.12), sfx); o.start(t); o.stop(t + 0.08); }
export function beep(f = 880, d = 0.12, v = 0.3, type = 'square') { if (!ctx) return; const t = now(); const o = osc(type, f); chain(o, filt('lowpass', 3000), env(t, 0.005, d, 0.08, v), sfx); o.start(t); o.stop(t + d + 0.15); }
export function chord(freqs, d = 0.6, v = 0.18, type = 'sawtooth', delay = 0) {
  if (!ctx) return; const t = now() + delay;
  freqs.forEach(f => { const o = osc(type, f); chain(o, filt('lowpass', 2400), env(t, 0.02, d, 0.5, v), sfx); o.start(t); o.stop(t + d + 0.6); });
}
export const winSting = () => { chord([523, 659, 784], 0.25, 0.12); chord([587, 740, 880], 0.25, 0.12, 'sawtooth', 0.22); chord([659, 831, 988, 1319], 0.8, 0.13, 'sawtooth', 0.44); };
export const loseSting = () => { chord([392, 466, 587], 0.3, 0.12); chord([349, 415, 523], 0.3, 0.12, 'sawtooth', 0.3); chord([294, 349, 440], 0.9, 0.12, 'sawtooth', 0.6); };
export const uiClick = () => beep(1200, 0.02, 0.12, 'triangle');
export const tick = () => { if (!ctx) return; const t = now(); chain(noise(t, 0.02), filt('bandpass', 2600, 4), env(t, 0.001, 0, 0.025, 0.5), sfx); };
export function reveal(rarityIdx) {
  if (rarityIdx >= 3) setTimeout(() => choir(rarityIdx === 4 ? 659 : 523), 200);
  if (!ctx) return; const base = [440, 523, 587, 698, 880][rarityIdx] || 440;
  [0, 4, 7, 12, 16].forEach((s, i) => { const f = base * Math.pow(2, s / 12); setTimeout(() => beep(f, 0.08, 0.14, 'triangle'), i * 70); });
  if (rarityIdx >= 3) setTimeout(() => chord([base, base * 1.25, base * 1.5, base * 2], 1.2, 0.1, 'triangle'), 380);
}
export const coin = () => { beep(1500, 0.04, 0.1, 'triangle'); setTimeout(() => beep(2000, 0.08, 0.1, 'triangle'), 60); };

// ---------- ambience: London at dusk ----------
let ambStarted = false, sirenTimer;
export function ambience(on) {
  if (!ctx) return;
  amb.gain.cancelScheduledValues(now()); amb.gain.linearRampToValueAtTime(on ? 0.5 : 0, now() + 1.2);
  if (ambStarted) return; ambStarted = true;
  const rumble = ctx.createBufferSource(); rumble.buffer = brownBuf; rumble.loop = true;
  const g = ctx.createGain(); g.gain.value = 0.25; chain(rumble, filt('lowpass', 380), g, amb); rumble.start();
  const siren = () => {
    if (amb.gain.value > 0.05) {
      const t = now(), o = osc('triangle', 700), sg = env(t, 1.0, 3.5, 1.5, 0.05);
      for (let i = 0; i < 10; i++) o.frequency.setValueAtTime(i % 2 ? 660 : 880, t + i * 0.55);
      const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
      chain(o, filt('lowpass', 1400), sg, p, amb); o.start(t); o.stop(t + 6.2);
    }
    sirenTimer = setTimeout(siren, 25000 + Math.random() * 35000);
  };
  sirenTimer = setTimeout(siren, 9000);
}

export function jumpSfx(pos) { if (!ctx) return; const t = now(); chain(noise(t, 0.12), filt('bandpass', 700, 1), env(t, 0.005, 0.02, 0.1, 0.35), out(pos)); const o = osc('sine', 180); o.frequency.exponentialRampToValueAtTime(320, t + 0.12); chain(o, env(t, 0.005, 0.02, 0.1, 0.12), out(pos)); o.start(t); o.stop(t + 0.2); }
export function land(pos, k = 0.5) { if (!ctx) return; const t = now(); chain(noise(t, 0.12, { rate: 0.5 }), filt('lowpass', 600), env(t, 0.002, 0.02, 0.12, 0.4 + k * 0.6), out(pos)); }
export function boing(pos) { if (!ctx) return; const t = now(); const o = osc('triangle', 140); o.frequency.exponentialRampToValueAtTime(620, t + 0.25); const lfo = osc('sine', 18), lg = ctx.createGain(); lg.gain.value = 40; chain(lfo, lg, o.frequency); chain(o, env(t, 0.005, 0.1, 0.25, 0.4), out(pos)); o.start(t); o.stop(t + 0.45); lfo.start(t); lfo.stop(t + 0.45); }
export function pickup(type, pos) { if (!ctx) return; const base = type === 'chicken' ? 660 : 880; [0, 4, 7, 12].forEach((s, i) => setTimeout(() => { const t = now(), o = osc('triangle', base * Math.pow(2, s / 12)); chain(o, env(t, 0.005, 0.04, 0.12, 0.2), out(pos)); o.start(t); o.stop(t + 0.2); }, i * 55)); }
export function dodge() { if (!ctx) return; whoosh(0.8, null, 1.6); beep(1760, 0.05, 0.12, 'triangle'); }
export function levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.12, 0.16, 'triangle'), i * 90)); setTimeout(() => chord([1047, 1319, 1568], 1.0, 0.1, 'triangle'), 480); }
export function countTick(i = 0) { beep(900 + (i % 12) * 60, 0.02, 0.08, 'triangle'); }
export function claim() { coin(); setTimeout(() => beep(1568, 0.1, 0.14, 'triangle'), 120); }
export function chestShake(level = 0) { if (!ctx) return; const t = now(); chain(noise(t, 0.15, { rate: 0.6 }), filt('bandpass', 300 + level * 120, 2), env(t, 0.005, 0.05, 0.1, 0.5), sfx); const o = osc('sine', 90 + level * 20); chain(o, env(t, 0.005, 0.05, 0.15, 0.4), sfx); o.start(t); o.stop(t + 0.25); }
export function rarityUp(level) { if (!ctx) return; const base = [392, 494, 587, 698, 880][level] || 440; [0, 7, 12].forEach((s, i) => setTimeout(() => beep(base * Math.pow(2, s / 12), 0.09, 0.2, 'sawtooth'), i * 60)); whoosh(1.2, null, 1.4); }
export function chestOpen() { if (!ctx) return; const t = now(); chain(noise(t, 0.8), filt('highpass', 2000), env(t, 0.005, 0.1, 0.7, 0.4), sfx); const o = osc('sine', 60); o.frequency.exponentialRampToValueAtTime(30, t + 0.6); chain(o, env(t, 0.005, 0.1, 0.5, 1.0), sfx); o.start(t); o.stop(t + 0.8); shing(null, 0.2); }
export function swoosh() { whoosh(0.6, null, 1.8); }

// ---------- V3 dopamine pack ----------
export function riser(dur = 1) { if (!ctx) return; const t = now(); const bp = filt('bandpass', 300, 3); bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(4000, t + dur); chain(noise(t, dur + 0.1), bp, env(t, dur * 0.8, 0, 0.2, 0.35), sfx); }
export function latch() { if (!ctx) return; const t = now(); chain(noise(t, 0.04), filt('bandpass', 3200, 6), env(t, 0.001, 0.005, 0.04, 0.7), sfx); const o = osc('square', 1900); chain(o, filt('bandpass', 1900, 8), env(t, 0.001, 0.01, 0.05, 0.25), sfx); o.start(t); o.stop(t + 0.08); }
export function hiss() { if (!ctx) return; const t = now(); const hp = filt('highpass', 2500); hp.frequency.setValueAtTime(5000, t); hp.frequency.exponentialRampToValueAtTime(1200, t + 0.6); chain(noise(t, 0.7), hp, env(t, 0.01, 0.2, 0.45, 0.45), sfx); }
export function boom(k = 1) {
  if (!ctx) return; const t = now();
  const o = osc('sine', 90); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
  chain(o, env(t, 0.004, 0.08, 0.7, 1.4 * k), sfx); o.start(t); o.stop(t + 0.9);
  chain(noise(t, 0.6, { rate: 0.6 }), filt('lowpass', 900), env(t, 0.002, 0.05, 0.5, 0.9 * k), sfx);
  chain(noise(t, 0.25), filt('highpass', 3000), env(t, 0.001, 0.02, 0.2, 0.3 * k), sfx);
}
export function pop() { if (!ctx) return; const t = now(); chain(noise(t, 0.08), filt('bandpass', 1500, 1), env(t, 0.001, 0.01, 0.07, 0.5), sfx); [2093, 2637, 3136].forEach((f, i) => setTimeout(() => beep(f, 0.04, 0.06, 'triangle'), 40 + i * 35)); }
export function choir(base = 523) { if (!ctx) return; const t = now(); [1, 1.25, 1.5, 2].forEach(m => [-6, 6].forEach(det => { const o = osc('sawtooth', base * m); o.detune.value = det; chain(o, filt('lowpass', 1800, 0.7), env(t, 0.35, 1.0, 1.2, 0.05), sfx); o.start(t); o.stop(t + 2.7); })); [0, 0.3, 0.6].forEach(d => setTimeout(() => shing(null, 0.2), d * 1000)); }
export function rankUp() { boom(0.6); [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.1, 0.18, 'sawtooth'), i * 80)); setTimeout(() => choir(523), 500); }
export function coinShower(n = 12) { for (let i = 0; i < n; i++) setTimeout(() => beep(1800 + Math.random() * 1600, 0.03, 0.06, 'triangle'), i * 45 + Math.random() * 30); }
export function inspectShing() { shing(null, 0.14); }
export function ping() { if (!ctx) return; [1320, 990].forEach((f, i) => setTimeout(() => { const t = now(), o = osc('sine', f); chain(o, env(t, 0.005, 0.05, 0.35, 0.18), sfx); o.start(t); o.stop(t + 0.5); }, i * 160)); }
