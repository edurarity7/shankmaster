// Static game data + the player profile (saved in localStorage for now).

export const RARITY = {
  mil:        { name: 'Mil-Spec',     color: '#4b69ff', weight: 60,  sell: 40 },
  restricted: { name: 'Restricted',   color: '#8847ff', weight: 22,  sell: 90 },
  classified: { name: 'Classified',   color: '#d32ce6', weight: 11,  sell: 200 },
  covert:     { name: 'Covert',       color: '#eb4b4b', weight: 5.5, sell: 450 },
  gold:       { name: '★ Rare Special', color: '#e4ae39', weight: 1.5, sell: 1200 },
};
export const RARITY_ORDER = ['mil', 'restricted', 'classified', 'covert', 'gold'];

export const KNIVES = {
  shank:     { name: 'Kitchen Shank', desc: 'Nicked from mum\'s drawer. Taped up. Gets the job done.', inChest: false },
  karambit:  { name: 'Karambit',      desc: 'Claw blade, finger ring. The one everyone wants.' },
  butterfly: { name: 'Butterfly',     desc: 'Flips open. Flips around. Flips out.' },
  bayonet:   { name: 'M9 Bayonet',    desc: 'Military spine saw. Heavy and honest.' },
  huntsman:  { name: 'Huntsman',      desc: 'Big clip-point bowie. Says less, does more.' },
  flip:      { name: 'Flip Knife',    desc: 'Slim drop-point with a thumb hole. Clean.' },
};

// Skins are procedural (see textures.js). Names are our own.
export const SKINS = {
  stock:      { name: 'Vanilla',       rarity: 'mil' },
  midnight:   { name: 'Midnight',      rarity: 'mil' },
  urban:      { name: 'Urban Camo',    rarity: 'mil' },
  ultraviolet:{ name: 'Ultraviolet',   rarity: 'restricted' },
  patina:     { name: 'Patina',        rarity: 'restricted' },
  tiger:      { name: 'Tiger Fang',    rarity: 'classified' },
  butcher:    { name: 'Butcher',       rarity: 'classified' },
  doppler:    { name: 'Deep Doppler',  rarity: 'classified' },
  gamma:      { name: 'Gamma Swirl',   rarity: 'classified' },
  bloodweb:   { name: 'Blood Web',     rarity: 'covert' },
  fade:       { name: 'Sunset Fade',   rarity: 'covert' },
  marble:     { name: 'Marble Riot',   rarity: 'covert' },
  ruby:       { name: 'Ruby',          rarity: 'gold' },
  sapphire:   { name: 'Sapphire',      rarity: 'gold' },
  emerald:    { name: 'Emerald',       rarity: 'gold' },
};

export const WEARS = [
  { name: 'Factory New',    max: 0.07 },
  { name: 'Minimal Wear',   max: 0.15 },
  { name: 'Field-Tested',   max: 0.38 },
  { name: 'Well-Worn',      max: 0.45 },
  { name: 'Battle-Scarred', max: 1.0 },
];
export const wearName = (f) => WEARS.find(w => f <= w.max).name;

export const CHARACTERS = {
  roadman: {
    name: 'Roadman', price: 0, desc: 'Puffer zipped, hood up, mask on. Knows the ends.',
    skin: 0x6b4226, top: 'puffer', topColor: 0x1b1d22, accent: 0x2b2f38, pants: 0x8c8f96, shoes: 0xf2f2f2,
    head: 'hood', mask: 0x111111, bag: true,
  },
  zain: {
    name: 'Zain', price: 0, desc: 'Skin fade, sharp beard, gold chain. Tracksuit pressed.',
    skin: 0xb98058, top: 'tracksuit', topColor: 0x6d1424, accent: 0xffffff, pants: 0x6d1424, shoes: 0xf5f5f5,
    head: 'fade', hair: 0x1a1210, beard: true, chain: true,
  },
  doris: {
    name: 'Nan Doris', price: 1200, desc: 'Cardigan, curlers, zero mercy.',
    skin: 0xf0c8a8, top: 'cardigan', topColor: 0x8a5ca8, accent: 0xe8d9f0, pants: 0x4a4a5a, shoes: 0x5a3a2a,
    head: 'curlers', hair: 0xdddddd, glasses: true,
  },
  bobby: {
    name: 'The Bobby', price: 1800, desc: 'Off duty. Very off duty.',
    skin: 0xe2b08c, top: 'tracksuit', topColor: 0x101a3a, accent: 0xd6e030, pants: 0x101a3a, shoes: 0x111111,
    head: 'helmet', hair: 0x3a2a1a, moustache: true,
  },
};

// Double-tap finishers. `hits` = blood bursts during the move, `style` drives the viewmodel anim.
export const FINISHERS = {
  stitch:  { name: 'Triple Stitch',  price: 0,    rarity: 'mil',        desc: 'Three fast slashes. Classic.', style: 'stitch', hits: 3 },
  spin:    { name: 'Helicopter',     price: 600,  rarity: 'restricted', desc: '360° spin slash through the gut.', style: 'spin', hits: 2 },
  gutcheck:{ name: 'Gut Check',      price: 900,  rarity: 'classified', desc: 'Stab, twist, rip out sideways.', style: 'gut', hits: 3 },
  bread:   { name: 'Sliced Bread',   price: 1400, rarity: 'covert',     desc: 'Six-slash flurry. Unreal blood.', style: 'bread', hits: 6 },
  goldrush:{ name: 'Gold Rush',      price: 2500, rarity: 'gold',       desc: 'They bleed gold coins. Pure flex.', style: 'stitch', hits: 3, gold: true },
};

export const CHEST_PRICE = 250;

export const RANKS = [
  { name: 'Bronze',      min: 0,    color: '#c47a3c' },
  { name: 'Silver',      min: 0.40, color: '#c9d1d9' },
  { name: 'Gold',        min: 0.50, color: '#f4c542' },
  { name: 'Platinum',    min: 0.60, color: '#5fe0d0' },
  { name: 'Diamond',     min: 0.70, color: '#7aa8ff' },
  { name: 'Shankmaster', min: 0.80, color: '#ff3b5c' },
];
export const PLACEMENT_GAMES = 5;

export function rankOf(p) {
  const games = p.wins + p.losses;
  const pct = games ? p.wins / games : 0;
  if (games < PLACEMENT_GAMES) return { name: 'Unranked', color: '#8a8f98', pct, games, placement: PLACEMENT_GAMES - games, idx: -1 };
  let idx = 0;
  RANKS.forEach((r, i) => { if (pct >= r.min) idx = i; });
  return { ...RANKS[idx], pct, games, idx };
}

// ---------- seeded RNG ----------
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

export function rollItem() {
  const total = RARITY_ORDER.reduce((a, k) => a + RARITY[k].weight, 0);
  let x = Math.random() * total, rar = 'mil';
  for (const k of RARITY_ORDER) { x -= RARITY[k].weight; if (x <= 0) { rar = k; break; } }
  const skins = Object.keys(SKINS).filter(s => SKINS[s].rarity === rar);
  const knives = Object.keys(KNIVES).filter(k => KNIVES[k].inChest !== false);
  return makeItem(pick(knives), pick(skins));
}
export function makeItem(knife, skin, flt) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    knife, skin,
    float: flt ?? +(Math.pow(Math.random(), 1.6)).toFixed(4),
    seed: Math.floor(Math.random() * 1000),
  };
}
export const itemName = (it) => `${KNIVES[it.knife].name} | ${SKINS[it.skin].name}`;
export const itemRarity = (it) => SKINS[it.skin].rarity;

// ---------- profile ----------
const KEY = 'shankmaster.profile.v1';
const BOT_FIRST = ['Peckham', 'Brixton', 'Tottenham', 'Hackney', 'Croydon', 'Lewisham', 'Stratford', 'Ilford', 'Wembley', 'Bow', 'Deptford', 'Walthamstow'];
const BOT_LAST = ['Prince', 'Menace', 'Ghost', 'Shotta', 'Blade', 'Don', 'Youngen', 'Smoke', 'Phantom', 'Wasteman', 'Bossman', 'Slasher'];
export const botName = () => `${pick(BOT_FIRST)}${pick(BOT_LAST)}${Math.random() < 0.5 ? Math.floor(Math.random() * 99) : ''}`;

function freshProfile() {
  const starter = makeItem('shank', 'stock', 0.05);
  return {
    v: 1, name: 'You', coins: 500, wins: 0, losses: 0, streak: 0, best: 0,
    inventory: [starter],
    equipped: { item: starter.id, character: 'roadman', finisher: 'stitch' },
    characters: ['roadman', 'zain'], finishers: ['stitch'],
    chests: 1, history: [],
    settings: { sens: 1, vol: 0.8, quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'high', tutorial: true },
  };
}
export let profile = load();
function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && p.v === 1) return { ...freshProfile(), ...p, settings: { ...freshProfile().settings, ...p.settings } };
  } catch (e) { /* storage blocked */ }
  return freshProfile();
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ } }
export const equippedItem = () => profile.inventory.find(i => i.id === profile.equipped.item) || profile.inventory[0];
