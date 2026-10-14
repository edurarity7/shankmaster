// Static game data + the player profile (saved in localStorage for now).

export const RARITY = {
  mil:        { name: 'Mil-Spec',       short: 'RARE',      color: '#4b8bff', weight: 60,  sell: 40 },
  restricted: { name: 'Restricted',     short: 'EPIC',      color: '#9a5bff', weight: 22,  sell: 90 },
  classified: { name: 'Classified',     short: 'MYTHIC',    color: '#ff3ddc', weight: 11,  sell: 200 },
  covert:     { name: 'Covert',         short: 'COVERT',    color: '#ff3b4e', weight: 5.5, sell: 450 },
  gold:       { name: '★ Rare Special', short: 'LEGENDARY', color: '#ffc21a', weight: 1.5, sell: 1200 },
};
export const RARITY_ORDER = ['mil', 'restricted', 'classified', 'covert', 'gold'];

export const KNIVES = {
  shank:     { name: 'Kitchen Shank', desc: 'Nicked from mum\'s drawer. Taped up. Gets the job done.', inChest: false },
  karambit:  { name: 'Karambit',      desc: 'Claw blade, finger ring. The one everyone wants.' },
  butterfly: { name: 'Butterfly',     desc: 'Flips open. Flips around. Flips out.' },
  bayonet:   { name: 'M9 Bayonet',    desc: 'Military spine saw. Heavy and honest.' },
  huntsman:  { name: 'Huntsman',      desc: 'Big clip-point bowie. Says less, does more.' },
  flip:      { name: 'Flip Knife',    desc: 'Slim drop-point with a thumb hole. Flicks open.' },
  talon:     { name: 'Talon',         desc: 'Oversized claw with a brass ring. Pure menace.' },
  skeleton:  { name: 'Skeleton',      desc: 'Skeletonised handle, paracord wrap. Light and mean.' },
};

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
  holo:       { name: 'Holo Chrome',   rarity: 'gold', anim: true },
  lava:       { name: 'Molten',        rarity: 'gold', anim: true },
  galaxy:     { name: 'Galaxy',        rarity: 'gold', anim: true },
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

// ---------- DRIP (cosmetics) ----------
export const SKIN_TONES = [0xf3cfb0, 0xe2ad85, 0xc58a5c, 0xa06a42, 0x7a4a2a, 0x553119];
export const SLOTS = [
  { id: 'head',   name: 'Head',   icon: '🧢' },
  { id: 'face',   name: 'Face',   icon: '😎' },
  { id: 'top',    name: 'Top',    icon: '🧥' },
  { id: 'legs',   name: 'Legs',   icon: '👖' },
  { id: 'kicks',  name: 'Kicks',  icon: '👟' },
  { id: 'gloves', name: 'Gloves', icon: '🧤' },
  { id: 'neck',   name: 'Chain',  icon: '⛓' },
  { id: 'back',   name: 'Back',   icon: '🎒' },
];
// kind = which builder in characters.js; c = main colour, a = accent
export const DRIP = {
  // head
  fade:        { slot: 'head', name: 'Fresh Trim',     rarity: 'mil',        kind: 'hair',   c: 0x1a120e, price: 0 },
  hood:        { slot: 'head', name: 'Hood Up',        rarity: 'mil',        kind: 'hood',   price: 0 },
  beanie:      { slot: 'head', name: 'Black Beanie',   rarity: 'mil',        kind: 'beanie', c: 0x17181d, a: 0x2a2c33, price: 250 },
  beanie_red:  { slot: 'head', name: 'Cherry Beanie',  rarity: 'restricted', kind: 'beanie', c: 0xd8203a, a: 0xffffff, price: 450 },
  durag:       { slot: 'head', name: 'Royal Durag',    rarity: 'restricted', kind: 'durag',  c: 0x1640d8, price: 500 },
  bucket:      { slot: 'head', name: 'Check Bucket',   rarity: 'classified', kind: 'bucket', c: 0xd9b98a, a: 0x8a2a1a, price: 900 },
  capback:     { slot: 'head', name: 'Backwards Cap',  rarity: 'restricted', kind: 'cap',    c: 0xf2f2f2, a: 0x1640d8, price: 500 },
  helmet:      { slot: 'head', name: 'Bobby Helmet',   rarity: 'covert',     kind: 'helmet', c: 0x0c1430, price: 1500 },
  curlers:     { slot: 'head', name: 'Nan\'s Curlers', rarity: 'classified', kind: 'curlers', c: 0xd8d8d8, a: 0xff7fb5, price: 900 },
  crown:       { slot: 'head', name: 'Crown of the Ends', rarity: 'gold',    kind: 'crown',  c: 0xffc21a, price: 3500 },
  // face
  noface:      { slot: 'face', name: 'Bare Face',      rarity: 'mil',        kind: 'none',   price: 0 },
  balaclava:   { slot: 'face', name: 'Face Mask',      rarity: 'mil',        kind: 'mask',   c: 0x111216, price: 0 },
  beard:       { slot: 'face', name: 'Full Beard',     rarity: 'mil',        kind: 'beard',  price: 0 },
  shades:      { slot: 'face', name: 'Night Shades',   rarity: 'restricted', kind: 'shades', c: 0x0a0a12, a: 0x3de0ff, price: 450 },
  goggles:     { slot: 'face', name: 'Ski Goggles',    rarity: 'classified', kind: 'goggles', c: 0xffffff, a: 0xff8a1a, price: 900 },
  tash:        { slot: 'face', name: 'The Tash',       rarity: 'restricted', kind: 'tash',   price: 400 },
  grillz:      { slot: 'face', name: 'Gold Grillz',    rarity: 'covert',     kind: 'grillz', c: 0xffc21a, price: 1600 },
  // top
  puffer:      { slot: 'top', name: 'Black Puffer',    rarity: 'mil',        kind: 'puffer', c: 0x1a1c22, a: 0x2b2f38, price: 0 },
  puffer_white:{ slot: 'top', name: 'Arctic Puffer',   rarity: 'restricted', kind: 'puffer', c: 0xf2f4f8, a: 0xdfe4ee, price: 600 },
  puffer_gold: { slot: 'top', name: 'Gold Puffer',     rarity: 'gold',       kind: 'puffer', c: 0xffc21a, a: 0xe89b0c, shiny: true, price: 4000 },
  track:       { slot: 'top', name: 'Maroon Trackie',  rarity: 'mil',        kind: 'track',  c: 0x6d1424, a: 0xffffff, price: 0 },
  track_navy:  { slot: 'top', name: 'Navy Trackie',    rarity: 'mil',        kind: 'track',  c: 0x0e1b4a, a: 0xffcc33, price: 300 },
  track_green: { slot: 'top', name: 'Pitch Trackie',   rarity: 'restricted', kind: 'track',  c: 0x0f6b3a, a: 0xffffff, price: 450 },
  hoodie:      { slot: 'top', name: 'Grey Hoodie',     rarity: 'mil',        kind: 'hoodie', c: 0x8d929c, a: 0x6f747e, price: 250 },
  hoodie_pink: { slot: 'top', name: 'Bubblegum Hoodie',rarity: 'classified', kind: 'hoodie', c: 0xff7fbf, a: 0xff5aa8, price: 900 },
  jersey:      { slot: 'top', name: 'No.10 Jersey',    rarity: 'classified', kind: 'jersey', c: 0xe0202e, a: 0xffffff, price: 1000 },
  cardigan:    { slot: 'top', name: 'Nan\'s Cardigan', rarity: 'restricted', kind: 'cardigan', c: 0x8a5ca8, a: 0xe8d9f0, price: 500 },
  // legs
  trackies:    { slot: 'legs', name: 'Grey Trackies',  rarity: 'mil',        kind: 'trackies', c: 0x6c717c, price: 0 },
  trackies_blk:{ slot: 'legs', name: 'Black Trackies', rarity: 'mil',        kind: 'trackies', c: 0x1a1b20, price: 200 },
  trackies_mar:{ slot: 'legs', name: 'Maroon Trackies',rarity: 'mil',        kind: 'trackies', c: 0x6d1424, price: 0 },
  cargos:      { slot: 'legs', name: 'Khaki Cargos',   rarity: 'restricted', kind: 'cargos', c: 0x8a7a52, price: 450 },
  jeans:       { slot: 'legs', name: 'Baggy Denim',    rarity: 'restricted', kind: 'trackies', c: 0x3a5a9a, price: 400 },
  shorts:      { slot: 'legs', name: 'Gym Shorts',     rarity: 'classified', kind: 'shorts', c: 0x111216, a: 0xffffff, price: 800 },
  // kicks
  airs:        { slot: 'kicks', name: 'Triple Whites', rarity: 'mil',        kind: 'low',   c: 0xf4f4f4, a: 0xe0e0e0, price: 0 },
  airs_black:  { slot: 'kicks', name: 'Triple Blacks', rarity: 'mil',        kind: 'low',   c: 0x18181c, a: 0x2a2a30, price: 250 },
  hightops:    { slot: 'kicks', name: 'Red High-Tops', rarity: 'restricted', kind: 'high',  c: 0xd8203a, a: 0xffffff, price: 500 },
  sliders:     { slot: 'kicks', name: 'Sliders & Socks',rarity: 'classified',kind: 'sliders', c: 0x111216, a: 0xffffff, price: 800 },
  boots:       { slot: 'kicks', name: 'Work Boots',    rarity: 'restricted', kind: 'boots', c: 0xb8862e, a: 0x3a2a1a, price: 450 },
  goldkicks:   { slot: 'kicks', name: 'Gold Kicks',    rarity: 'gold',       kind: 'high',  c: 0xffc21a, a: 0xffffff, shiny: true, price: 3200 },
  // gloves (you see these in first person!)
  bare:        { slot: 'gloves', name: 'Bare Hands',   rarity: 'mil',        kind: 'bare',  price: 0 },
  tac:         { slot: 'gloves', name: 'Tactical Black', rarity: 'mil',      kind: 'glove', c: 0x1a1b20, a: 0x3a3d45, price: 300 },
  pink:        { slot: 'gloves', name: 'Pink Panther',  rarity: 'classified', kind: 'glove', c: 0xff4fa8, a: 0x111111, price: 1000 },
  wraps:       { slot: 'gloves', name: 'Fight Wraps',   rarity: 'restricted', kind: 'wraps', c: 0xf2efe6, a: 0xd8203a, price: 500 },
  webgloves:   { slot: 'gloves', name: 'Blood Web Gloves', rarity: 'covert', kind: 'glove', c: 0xb0101a, a: 0x111111, price: 1800 },
  goldgloves:  { slot: 'gloves', name: 'Midas Touch',   rarity: 'gold',      kind: 'glove', c: 0xffc21a, a: 0xffe9a0, shiny: true, price: 3500 },
  // neck
  nochain:     { slot: 'neck', name: 'No Chain',        rarity: 'mil',       kind: 'none',  price: 0 },
  chain:       { slot: 'neck', name: 'Gold Chain',      rarity: 'restricted', kind: 'chain', c: 0xffc21a, price: 0 },
  iced:        { slot: 'neck', name: 'Iced Out',        rarity: 'covert',    kind: 'iced',  c: 0xbff4ff, price: 2000 },
  // back
  noback:      { slot: 'back', name: 'Nothing',         rarity: 'mil',       kind: 'none',  price: 0 },
  manbag:      { slot: 'back', name: 'Man Bag',         rarity: 'mil',       kind: 'manbag', c: 0x22252b, price: 0 },
  backpack:    { slot: 'back', name: 'School Bag',      rarity: 'mil',       kind: 'backpack', c: 0x1640d8, a: 0xffcc33, price: 300 },
  delivery:    { slot: 'back', name: 'Delivery Box',    rarity: 'classified', kind: 'delivery', c: 0x1fc8b4, price: 900 },
  wings:       { slot: 'back', name: 'Angel of the Ends', rarity: 'gold',    kind: 'wings', c: 0xffffff, price: 4500 },
};
export const DEFAULT_OUTFIT = { skin: 3, head: 'hood', face: 'balaclava', top: 'puffer', legs: 'trackies', kicks: 'airs', gloves: 'bare', neck: 'nochain', back: 'manbag' };
export const PRESETS = {
  roadman: { name: 'Roadman', outfit: DEFAULT_OUTFIT },
  zain:    { name: 'Zain', outfit: { skin: 2, head: 'fade', face: 'beard', top: 'track', legs: 'trackies_mar', kicks: 'airs', gloves: 'bare', neck: 'chain', back: 'noback' } },
};
export function randomOutfit(r = Math.random) {
  const by = s => Object.keys(DRIP).filter(k => DRIP[k].slot === s);
  const o = { skin: Math.floor(r() * SKIN_TONES.length) };
  SLOTS.forEach(s => { const opts = by(s.id); o[s.id] = opts[Math.floor(r() * opts.length)]; });
  if (r() < 0.6) o.back = 'noback';
  return o;
}

// Double-tap finishers.
export const FINISHERS = {
  stitch:  { name: 'Triple Stitch',  price: 0,    rarity: 'mil',        desc: 'Three fast slashes. Classic.', style: 'stitch', hits: 3, icon: '⚔️' },
  spin:    { name: 'Helicopter',     price: 600,  rarity: 'restricted', desc: '360° spin slash through the gut.', style: 'spin', hits: 2, icon: '🌀' },
  gutcheck:{ name: 'Gut Check',      price: 900,  rarity: 'classified', desc: 'Stab, twist, rip out sideways.', style: 'gut', hits: 3, icon: '🗡️' },
  bread:   { name: 'Sliced Bread',   price: 1400, rarity: 'covert',     desc: 'Six-slash flurry. Unreal blood.', style: 'bread', hits: 6, icon: '🍞' },
  goldrush:{ name: 'Gold Rush',      price: 2500, rarity: 'gold',       desc: 'They bleed gold coins. Pure flex.', style: 'stitch', hits: 3, gold: true, icon: '🪙' },
};

export const CHEST_PRICE = 250;
export const WIN_CHEST_WINS = 3;

export const RANKS = [
  { name: 'Bronze',      min: 0,    color: '#d08a4c' },
  { name: 'Silver',      min: 0.40, color: '#d6dde6' },
  { name: 'Gold',        min: 0.50, color: '#ffcc33' },
  { name: 'Platinum',    min: 0.60, color: '#5ff0dc' },
  { name: 'Diamond',     min: 0.70, color: '#7ab4ff' },
  { name: 'Shankmaster', min: 0.80, color: '#ff3b5c' },
];
export const PLACEMENT_GAMES = 5;
export function rankOf(p) {
  const games = p.wins + p.losses;
  const pct = games ? p.wins / games : 0;
  if (games < PLACEMENT_GAMES) return { name: 'Unranked', color: '#9aa6c8', pct, games, placement: PLACEMENT_GAMES - games, idx: -1 };
  let idx = 0;
  RANKS.forEach((r, i) => { if (pct >= r.min) idx = i; });
  return { ...RANKS[idx], pct, games, idx };
}

// ---------- levels ----------
export const xpFor = lvl => 250 + lvl * 60;
export function levelReward(lvl) {
  if (lvl % 5 === 0) return { type: 'drip', label: 'Epic Drip' };
  if (lvl % 2 === 0) return { type: 'chest', label: 'Endz Chest' };
  return { type: 'coins', amount: 150 + lvl * 10, label: `${150 + lvl * 10} Coins` };
}

// ---------- daily login ----------
export const DAILY = [
  { type: 'coins', amount: 100 }, { type: 'coins', amount: 150 }, { type: 'chest' }, { type: 'coins', amount: 250 },
  { type: 'drip' }, { type: 'coins', amount: 400 }, { type: 'chest', n: 2 },
];

// ---------- quests ----------
const QUEST_POOL = [
  { id: 'win', text: 'Win {n} matches', n: [1, 2, 3], stat: 'wins', coins: 120 },
  { id: 'play', text: 'Play {n} matches', n: [2, 3], stat: 'matches', coins: 80 },
  { id: 'backstab', text: 'Land {n} backstabs', n: [2, 3, 5], stat: 'backstabs', coins: 150 },
  { id: 'fin', text: 'Pull off {n} finishers', n: [1, 2, 3], stat: 'finishers', coins: 150 },
  { id: 'dodge', text: 'Dodge {n} hits with a dash', n: [3, 5], stat: 'dashDodges', coins: 130 },
  { id: 'hits', text: 'Land {n} hits', n: [15, 25, 40], stat: 'hits', coins: 100 },
  { id: 'air', text: 'Land {n} air shanks', n: [1, 3], stat: 'airHits', coins: 160 },
  { id: 'pick', text: 'Grab {n} pickups', n: [3, 5], stat: 'pickups', coins: 90 },
];
export const today = () => new Date().toISOString().slice(0, 10);
export function rollQuests() {
  const pool = [...QUEST_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map(q => { const n = q.n[Math.floor(Math.random() * q.n.length)]; return { id: q.id, text: q.text.replace('{n}', n), stat: q.stat, goal: n, prog: 0, coins: q.coins + n * 10, xp: 80, claimed: false }; });
}

// ---------- seeded RNG ----------
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

export function rollRarity() {
  const total = RARITY_ORDER.reduce((a, k) => a + RARITY[k].weight, 0);
  let x = Math.random() * total;
  for (const k of RARITY_ORDER) { x -= RARITY[k].weight; if (x <= 0) return k; }
  return 'mil';
}
export function rollItem(rar = rollRarity()) {
  const skins = Object.keys(SKINS).filter(s => SKINS[s].rarity === rar);
  const knives = Object.keys(KNIVES).filter(k => KNIVES[k].inChest !== false);
  const it = makeItem(pick(knives), pick(skins));
  if (Math.random() < 0.15) it.trak = 0; // ShankTrak™ kill counter
  return it;
}
export function makeItem(knife, skin, flt) {
  return { id: Math.random().toString(36).slice(2, 10), knife, skin, float: flt ?? +(Math.pow(Math.random(), 1.6)).toFixed(4), seed: Math.floor(Math.random() * 1000) };
}
export const itemName = (it) => `${it.trak != null ? 'ShankTrak™ ' : ''}${KNIVES[it.knife].name} | ${SKINS[it.skin].name}`;
export const itemRarity = (it) => SKINS[it.skin].rarity;
// A drip item the player doesn't own yet (biased to better rarity), or null.
export function rollDrip(minRarity = 'restricted') {
  const minI = RARITY_ORDER.indexOf(minRarity);
  const opts = Object.keys(DRIP).filter(k => !profile.drip.includes(k) && RARITY_ORDER.indexOf(DRIP[k].rarity) >= minI);
  return opts.length ? pick(opts) : null;
}

// ---------- profile ----------
const KEY = 'shankmaster.profile.v1';
const BOT_FIRST = ['Peckham', 'Brixton', 'Tottenham', 'Hackney', 'Croydon', 'Lewisham', 'Stratford', 'Ilford', 'Wembley', 'Bow', 'Deptford', 'Walthamstow'];
const BOT_LAST = ['Prince', 'Menace', 'Ghost', 'Shotta', 'Blade', 'Don', 'Youngen', 'Smoke', 'Phantom', 'Wasteman', 'Bossman', 'Slasher'];
export const botName = () => `${pick(BOT_FIRST)}${pick(BOT_LAST)}${Math.random() < 0.5 ? Math.floor(Math.random() * 99) : ''}`;

function freshProfile() {
  const starter = makeItem('shank', 'stock', 0.05);
  return {
    v: 2, name: 'You', coins: 500, wins: 0, losses: 0, streak: 0, best: 0, matches: 0,
    level: 1, xp: 0, winChest: 0,
    inventory: [starter],
    equipped: { item: starter.id, finisher: 'stitch' },
    outfit: { ...DEFAULT_OUTFIT },
    drip: Object.keys(DRIP).filter(k => DRIP[k].price === 0),
    finishers: ['stitch'],
    chests: 1, history: [],
    daily: { last: null, day: 0 }, quests: { date: null, list: [] },
    shop: { date: null, items: [] },
    learned: {}, seen: {},
    settings: { sens: 1, vol: 0.8, quality: 'high', haptics: true },
  };
}
export let profile = load();
function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && (p.v === 1 || p.v === 2)) {
      const f = freshProfile();
      const merged = { ...f, ...p, v: 2, settings: { ...f.settings, ...p.settings } };
      merged.outfit ??= { ...DEFAULT_OUTFIT }; merged.drip ??= f.drip; merged.equipped = { ...f.equipped, ...p.equipped };
      return merged;
    }
  } catch (e) { /* storage blocked */ }
  return freshProfile();
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ } }
export const equippedItem = () => profile.inventory.find(i => i.id === profile.equipped.item) || profile.inventory[0];

// Refresh daily state (quests + item shop). Returns true if the daily login reward is claimable.
export function dailyTick() {
  const d = today();
  if (profile.quests.date !== d) profile.quests = { date: d, list: rollQuests() };
  if (profile.shop.date !== d) {
    const r = rng(parseInt(d.replace(/-/g, ''), 10));
    const keys = Object.keys(DRIP).filter(k => DRIP[k].price > 0).sort(() => r() - 0.5);
    profile.shop = { date: d, items: keys.slice(0, 6) };
  }
  save();
  return profile.daily.last !== d;
}
// Add XP; returns list of levels gained.
export function addXp(n) {
  const gained = [];
  profile.xp += n;
  while (profile.xp >= xpFor(profile.level)) { profile.xp -= xpFor(profile.level); profile.level++; gained.push(profile.level); }
  return gained;
}
