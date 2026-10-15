// DOM UI: lobby (Clash-style), locker/drip, shop, quests, rank, chest reveal, HUD, results, modals.
import {
  profile, save, RARITY, RARITY_ORDER, KNIVES, SKINS, FINISHERS, CHEST_PRICE, WIN_CHEST_WINS, rankOf, itemName, itemRarity, wearName,
  rollItem, rollRarity, equippedItem, RANKS, DRIP, SLOTS, SKIN_TONES, DAILY, xpFor, levelReward, rollDrip, today,
} from './data.js';
import * as A from './audio.js';
import { rankEmblem } from './emblems.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = n => Math.round(n).toLocaleString('en-GB');
const rc = r => RARITY[r].color;
const hex = n => '#' + (n ?? 0).toString(16).padStart(6, '0');
const vibe = ms => { if (profile.settings.haptics && navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(ms); } catch (e) { /* no-op */ } };

export function logoSVG() {
  return `<svg class="logo-anim" viewBox="0 0 820 190" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lgBlade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset=".45" stop-color="#b9cdf7"/><stop offset=".55" stop-color="#7d97da"/><stop offset="1" stop-color="#3a55b8"/></linearGradient>
    <linearGradient id="lgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b8"/><stop offset=".5" stop-color="#ffcc33"/><stop offset="1" stop-color="#e08a00"/></linearGradient>
    <linearGradient id="lgShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="lgClip"><path d="M150 42 L700 42 Q770 46 812 96 Q760 146 700 148 L150 148 Z"/></clipPath>
  </defs>
  <rect x="8" y="62" width="128" height="66" rx="22" fill="#14193a" stroke="#050a24" stroke-width="7"/>
  <g stroke="#2c3566" stroke-width="5" stroke-linecap="round">${[34, 56, 78, 100, 122].map(x => `<line x1="${x}" y1="72" x2="${x - 6}" y2="118"/>`).join('')}</g>
  <circle cx="26" cy="95" r="9" fill="url(#lgGold)" stroke="#050a24" stroke-width="4"/>
  <rect x="126" y="22" width="30" height="146" rx="10" fill="url(#lgGold)" stroke="#050a24" stroke-width="7"/>
  <path d="M150 42 L700 42 Q770 46 812 96 Q760 146 700 148 L150 148 Z" fill="url(#lgBlade)" stroke="#050a24" stroke-width="7" stroke-linejoin="round"/>
  <path d="M160 132 L700 132 Q752 130 796 100" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/>
  <g clip-path="url(#lgClip)"><rect class="blade-shine" x="150" y="30" width="120" height="130" fill="url(#lgShine)" transform="skewX(-20)"/></g>
  <text x="470" y="120" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="74" letter-spacing="2" fill="url(#lgGold)" stroke="#050a24" stroke-width="9" paint-order="stroke" style="font-weight:400">SHANKMASTER</text>
  <path d="M790 112 q-6 14 0 22 q6 -8 0 -22z" fill="#ff1f3d" stroke="#050a24" stroke-width="3"/>
  <circle cx="790" cy="150" r="5" fill="#ff1f3d" stroke="#050a24" stroke-width="2.5"/>
</svg>`;
}

const HINTS = [
  { id: 'move', touch: 'Drag the <b>left side</b> to move', desk: '<b>WASD</b> to move', icon: '👈', hx: '-6px', hy: '0px' },
  { id: 'look', touch: 'Drag the <b>right side</b> to look', desk: '<b>Mouse</b> to look around', icon: '👉', hx: '6px', hy: '0px' },
  { id: 'attack', touch: '<b>Tap</b> the right side to shank', desk: '<b>Left click</b> to shank', icon: '👆', hy: '-5px' },
  { id: 'jump', touch: 'Tap <b>JUMP</b> — climb crates & cars', desk: '<b>Space</b> to jump — climb crates & cars', icon: '⤒', hy: '-6px' },
  { id: 'dash', touch: 'Tap <b>»</b> to dash-dodge', desk: 'Press <b>Q</b> to dash-dodge', icon: '»', hx: '-6px', hy: '0px' },
  { id: 'sprint', touch: 'Push the stick <b>all the way up</b> to sprint', desk: 'Hold <b>Shift</b> to sprint', icon: '⇈', hy: '-8px' },
  { id: 'inspect', touch: 'Tap <b>✦ INSPECT</b> to flex your knife', desk: 'Press <b>F</b> to inspect your knife', icon: '✦', hy: '-4px' },
];

export class UI {
  constructor(app) {
    this.app = app; this.screen = 'loading'; this.tabName = 'home'; this.seg = 'knives'; this.slot = 'top'; this.sel = null;
    $$('.logo-slot').forEach(e => (e.innerHTML = logoSVG()));
    // Hub navigation: tap a tab again, the ✕, swipe the sheet down, tap the 3D scene above it, or press Esc → back home.
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => { A.uiClick(); vibe(8); const t = b.dataset.tab; this.tab(t === this.tabName && t !== 'home' ? 'home' : t); }));
    $$('.sheet-x').forEach(b => b.addEventListener('click', () => { A.uiClick(); this.tab('home'); }));
    $$('.sheet-head').forEach(hd => {
      let y0 = null; const sheet = hd.closest('.sheet');
      hd.addEventListener('pointerdown', e => { if (e.target.closest('.sheet-x')) return; y0 = e.clientY; sheet.classList.add('dragging'); hd.setPointerCapture?.(e.pointerId); });
      hd.addEventListener('pointermove', e => { if (y0 == null) return; const dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
      const end = e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; sheet.classList.remove('dragging'); sheet.style.transform = ''; if (dy > 70) { A.uiClick(); this.tab('home'); } };
      hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end);
    });
    let gx = null;
    $('#gl').addEventListener('pointerdown', e => { gx = [e.clientX, e.clientY]; });
    $('#gl').addEventListener('pointerup', e => {
      const tap = gx && Math.hypot(e.clientX - gx[0], e.clientY - gx[1]) < 8; gx = null;
      if (!tap || this.screen !== 'lobby') return;
      if (this.tabName !== 'home') this.tab('home');
      else if (!profile.learned.flex) { profile.learned.flex = true; save(); $('#tapHint').style.display = 'none'; }
    });
    addEventListener('keydown', e => { if (e.key !== 'Escape') return; if ($('#modal').classList.contains('show')) this.closeModal(); else if (this.screen === 'lobby' && this.tabName !== 'home') this.tab('home'); });
    $('#playBtn').addEventListener('click', () => { A.uiClick(); vibe(20); app.queue(); });
    $('#chestBtn').addEventListener('click', () => { A.uiClick(); profile.chests > 0 ? this.openChest(true) : this.tab('shop'); });
    $('#dailyBtn').addEventListener('click', () => { A.uiClick(); this.daily(); });
    $('#settingsBtn').addEventListener('click', () => { A.uiClick(); this.settings(); });
    $('#playerChip').addEventListener('click', () => { A.uiClick(); this.tab('rank'); });
    $('#lockerSeg').addEventListener('click', e => { const s = e.target.dataset.seg; if (s) { A.uiClick(); this.seg = s; this.sel = null; this.renderLocker(); } });
    $('#mmCancel').addEventListener('click', () => { A.uiClick(); app.cancelQueue(); });
    $('#pauseBtn').addEventListener('click', () => app.pause());
    const tapBtn = (id, fn) => { const el = $(id); const go = e => { e.preventDefault(); e.stopPropagation(); fn(); vibe(10); }; el.addEventListener('touchstart', go, { passive: false }); el.addEventListener('mousedown', go); };
    tapBtn('#jumpBtn', () => app.input.emit('jump'));
    tapBtn('#dashBtn', () => app.input.emit('dash', { dir: 'auto' }));
    tapBtn('#finBtn', () => app.input.emit('double'));
    tapBtn('#inspectBtn', () => app.input.emit('inspect'));
    tapBtn('#inspectDesk', () => app.input.emit('inspect'));
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && this.modalDismiss) { A.uiClick(); this.closeModal(); } });
    $('#reveal').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; app.reveal.tap(); });
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  }
  loading(p, msg) { $('.loadbar i').style.width = `${Math.round(p * 100)}%`; if (msg) $('#loadHint').textContent = msg; }
  go(name) {
    ['loading', 'lobby', 'hud', 'reveal'].forEach(s => $('#' + s).classList.toggle('show', s === name));
    this.screen = name;
    if (name === 'lobby') { this.refreshLobby(); this.tab(this.tabName); }
  }
  overlay(name, on) { $('#' + name).classList.toggle('show', on); }
  gToast(msg) { const t = $('#gToast'); t.innerHTML = msg; t.classList.add('on'); clearTimeout(this._gt); this._gt = setTimeout(() => t.classList.remove('on'), 1800); }
  // ---- dopamine explosions (DOM confetti / coins / shockwaves) ----
  burst(x, y, colors = ['#ffcc33', '#ff3ddc', '#3de0ff', '#ffffff', '#3ee87a'], n = 60, power = 1, coins = false) {
    const L = $('#fxLayer'), kinds = ['sq', 'sq', 'ci', 'st'];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i'), coin = coins && i % 3 === 0;
      el.className = 'cf ' + (coin ? 'cn' : kinds[i % kinds.length]); if (!coin) el.style.background = colors[i % colors.length];
      L.append(el);
      const a = Math.random() * Math.PI * 2, sp = (140 + Math.random() * 320) * power, dx = Math.cos(a) * sp, dy = Math.sin(a) * sp - 120 * power, rot = (Math.random() - 0.5) * 1080;
      const dur = 900 + Math.random() * 900;
      el.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0) scale(${0.6 + Math.random() * 0.8})`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy}px) rotate(${rot * 0.6}deg) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${x + dx * 1.2}px, ${y + dy + 420 + Math.random() * 300}px) rotate(${rot}deg) scale(.8)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(.15,.7,.4,1)' }).onfinish = () => el.remove();
    }
  }
  shock(x, y, color = '#ffcc33', size = 520) {
    const el = document.createElement('i'); el.className = 'shock'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = el.style.height = size + 'px'; el.style.borderColor = color;
    $('#fxLayer').append(el);
    el.animate([{ transform: 'translate(-50%,-50%) scale(.1)', opacity: 1, borderWidth: '14px' }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0, borderWidth: '2px' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => el.remove();
  }
  celebrate(color = '#ffcc33', big = false) {
    const x = innerWidth / 2, y = innerHeight * 0.42;
    this.shock(x, y, color, big ? 900 : 520); this.burst(x, y, [color, '#ffcc33', '#ffffff', '#3de0ff'], big ? 140 : 70, big ? 1.4 : 1, big); A.pop(); if (big) A.coinShower(16);
  }
  flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

  // ---------- LOBBY ----------
  tab(name) {
    if (this.tabName === 'locker' && name !== 'locker') this.app.previewOutfit(null);
    this.tabName = name;
    $$('.tab').forEach(t => t.classList.toggle('show', t.id === 'tab-' + name));
    $$('#navbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'shop') this.renderShop();
    if (name === 'locker') this.renderLocker();
    if (name === 'pass') this.renderPass();
    if (name === 'rank') this.renderRank();
    this.app.menuMode(name === 'home' ? 'home' : name === 'locker' ? this.lockerCam() : name === 'shop' ? 'store' : 'body');
    this.refreshLobby();
  }
  lockerCam() {
    if (this.seg === 'knives') return 'knife';
    if (this.seg === 'drip') return ['head', 'face'].includes(this.slot) ? 'head' : ['legs', 'kicks'].includes(this.slot) ? 'legs' : 'body';
    return 'body';
  }
  refreshLobby() {
    const r = rankOf(profile);
    $('#coins').textContent = fmt(profile.coins);
    $('#lvlNum').textContent = profile.level; $('#pcName').textContent = profile.name;
    $('#xpRing').style.strokeDashoffset = 94.2 * (1 - profile.xp / xpFor(profile.level));
    $('#pcRank').innerHTML = `${rankEmblem(r.idx, 18)}${r.name}`; $('#pcRank').style.color = r.color;
    const badge = (id, n) => { const b = $(id); b.classList.toggle('on', !!n); if (typeof n === 'number' || typeof n === 'string') b.textContent = n; };
    badge('#chestBadge', profile.chests || 0); $('#chestBtn').classList.toggle('has', profile.chests > 0);
    badge('#dailyBadge', profile.daily.last !== today() ? '!' : 0);
    const claimable = profile.quests.list.filter(q => q.prog >= q.goal && !q.claimed).length;
    badge('#questBadge', claimable);
    badge('#shopBadge', profile.seen.shop !== profile.shop.date ? 'NEW' : 0);
    const it = equippedItem();
    $('#heroPlate').innerHTML = `<div class="hp-row" style="--rc:${r.color}">${rankEmblem(r.idx, 40)}<div><b>${r.name.toUpperCase()}</b><br><small>LV ${profile.level} · ${profile.wins}W ${profile.losses}L</small></div></div><div class="kn" style="--kc:${rc(itemRarity(it))}">🔪 ${itemName(it)}</div>`;
    $('#tapHint').style.display = profile.learned.flex ? 'none' : '';
    this.app.menu?.setRankColor?.(r.color);
    const pips = [...Array(WIN_CHEST_WINS)].map((_, i) => `<i class="${i < profile.winChest ? 'on' : ''}"></i>`).join('');
    $('#winChest').innerHTML = `<span class="chest-ico" style="width:22px;height:18px"></span><span class="pips">${pips}</span><span>WIN ${WIN_CHEST_WINS - profile.winChest} MORE FOR A CHEST</span>`;
  }

  // ---------- SHOP ----------
  renderShop() {
    profile.seen.shop = profile.shop.date; save();
    const total = RARITY_ORDER.reduce((a, k) => a + RARITY[k].weight, 0);
    const msLeft = new Date().setHours(24, 0, 0, 0) - Date.now(), hh = Math.floor(msLeft / 3600000), mm = Math.floor(msLeft / 60000) % 60;
    const b = $('#shopBody');
    b.innerHTML = `<div class="featured"><div class="big-chest"></div><div>
        <h4>ENDZ CHEST</h4><p>Tap it to power it up, then pull a knife from the reel. Gems are Legendary.</p>
        <div class="odds">${RARITY_ORDER.map(k => `<span style="border-color:${rc(k)}">${RARITY[k].short} ${(RARITY[k].weight / total * 100).toFixed(1)}%</span>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold small" id="buyChest" ${profile.coins < CHEST_PRICE ? 'disabled' : ''}><b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b> ${CHEST_PRICE}</button>
        ${profile.chests ? `<button class="btn green small" id="openOwned">OPEN (${profile.chests})</button>` : ''}</div></div></div>
      <h3>🔥 DAILY DRIP <span class="timer">NEW IN ${hh}h ${mm}m</span></h3><div class="grid" id="dripGrid"></div>
      <h3>💀 FINISHERS</h3><div class="grid" id="finGrid"></div>`;
    $('#buyChest').onclick = () => { if (profile.coins < CHEST_PRICE) return; profile.coins -= CHEST_PRICE; save(); A.coin(); this.openChest(false); };
    $('#openOwned') && ($('#openOwned').onclick = () => this.openChest(true));
    profile.shop.items.forEach(id => $('#dripGrid').append(this.dripCard(id, true)));
    Object.entries(FINISHERS).forEach(([id, f]) => {
      const owned = profile.finishers.includes(id);
      const c = h(`<button class="card ${owned ? 'eq' : 'locked'}" style="--r:${rc(f.rarity)}"><div class="glyph">${f.icon}</div><div class="nm">${f.name}</div><div class="sk">${owned ? 'OWNED' : RARITY[f.rarity].short}</div>${owned ? '' : `<span class="price"><b class="coin"></b>${fmt(f.price)}</span>`}</button>`);
      c.onclick = () => { A.uiClick(); this.finTap(id); };
      $('#finGrid').append(c);
    });
  }
  // Thumbnails render one per tick so tabs open instantly and fill in progressively.
  queueThumb(img, fn) {
    (this.tq ??= []).push([img, fn]);
    if (this.tqRun) return; this.tqRun = true;
    const step = () => { const job = this.tq.shift(); if (!job) { this.tqRun = false; return; } if (job[0].isConnected) job[0].src = job[1](); setTimeout(step, 0); };
    setTimeout(step, 16);
  }
  dripCard(id, shop) {
    const d = DRIP[id], owned = profile.drip.includes(id), eq = profile.outfit[d.slot] === id;
    const c = h(`<button class="card ${eq ? 'eq' : ''} ${owned ? '' : 'locked'}" style="--r:${rc(d.rarity)}">
      <img class="dimg" alt=""><div class="nm">${d.name}</div><div class="sk">${RARITY[d.rarity].short}</div>${owned ? '' : `<span class="price"><b class="coin"></b>${fmt(d.price)}</span>`}</button>`);
    this.queueThumb(c.querySelector('img'), () => this.app.thumbs.drip({ ...profile.outfit, [d.slot]: id }, d.slot));
    c.onclick = () => {
      A.uiClick();
      if (!shop && owned) { // locker: tap to wear, instantly
        if (eq) return;
        profile.outfit[d.slot] = id; save(); A.claim(); vibe(15);
        $$('#lockerGrid .card.eq').forEach(x => x.classList.remove('eq')); c.classList.add('eq');
        this.lockerWearing(); requestAnimationFrame(() => this.app.loadoutChanged());
      } else this.itemPopup('drip', id);
    };
    return c;
  }
  lockerWearing() {
    const el = $('#lockerDetail'); if (!el) return;
    const d = DRIP[profile.outfit[this.slot]];
    el.innerHTML = `<div class="detail"><div class="dt"><h4>${this.slot === 'skin' ? 'Skin tone' : `Wearing: ${d?.name || '—'}`}</h4><div class="meta">Tap anything you own to wear it. Locked items open a preview to buy.</div></div></div>`;
  }
  // Clash-style item popup: big preview + one obvious button.
  itemPopup(kind, id) {
    const isDrip = kind === 'drip', it = isDrip ? DRIP[id] : FINISHERS[id];
    const owned = isDrip ? profile.drip.includes(id) : profile.finishers.includes(id);
    const eq = isDrip ? profile.outfit[it.slot] === id : profile.equipped.finisher === id;
    const short = profile.coins < it.price;
    const art = isDrip ? `<img class="pop-img" src="${this.app.thumbs.drip({ ...profile.outfit, [it.slot]: id }, it.slot, 360, 300)}" alt="">` : `<div class="pop-icon">${it.icon}</div>`;
    const sub = isDrip ? SLOTS.find(x => x.id === it.slot).name.toUpperCase() : 'FINISHER';
    this.modal(`<div class="pop" style="--r:${rc(it.rarity)}"><span class="rr">${RARITY[it.rarity].short} · ${sub}</span>${art}<h2>${it.name}</h2>
      <p>${isDrip ? (owned ? (eq ? 'You\'re wearing this.' : 'In your locker.') : 'Cop it and it goes straight on.') : it.desc + ' Double tap when they\'re under 40 HP.'}</p>
      <div class="row"><button class="btn ghost" id="pClose">CLOSE</button>${owned ? `<button class="btn green" id="pAct" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>` : `<button class="btn gold" id="pAct" ${short ? 'disabled' : ''}><b class="coin" style="vertical-align:-3px"></b> ${fmt(it.price)}</button>`}</div>
      ${!owned && short ? `<small class="need">Need ${fmt(it.price - profile.coins)} more coins — win matches & clear quests</small>` : ''}</div>`, true);
    $('#pClose').onclick = () => { A.uiClick(); this.closeModal(); };
    $('#pAct').onclick = () => {
      if (!owned) {
        if (profile.coins < it.price) return;
        profile.coins -= it.price; (isDrip ? profile.drip : profile.finishers).push(id);
        A.reveal(RARITY_ORDER.indexOf(it.rarity)); vibe([20, 30, 40]); this.flash(); this.celebrate(rc(it.rarity), it.rarity === 'gold');
        this.gToast(isDrip ? `🔥 <b>${it.name}</b> copped & equipped` : `💀 <b>${it.name}</b> unlocked`);
      } else A.claim();
      if (isDrip) profile.outfit[it.slot] = id; else profile.equipped.finisher = id;
      save(); this.closeModal();
      const sheet = document.querySelector('.tab.show .sheet-inner'), top = sheet?.scrollTop;
      this.rerender(); this.refreshLobby(); if (sheet) document.querySelector('.tab.show .sheet-inner').scrollTop = top;
      if (isDrip) requestAnimationFrame(() => { this.app.loadoutChanged(); this.app.menu.emote(); });
    };
  }
  rerender() { if (this.tabName === 'shop') this.renderShop(); else if (this.tabName === 'locker') this.renderLocker(); }

  // ---------- LOCKER ----------
  renderLocker() {
    $$('#lockerSeg button').forEach(b => b.classList.toggle('on', b.dataset.seg === this.seg));
    const body = $('#lockerBody'), bar = $('#slotBar');
    body.innerHTML = '<div id="lockerDetail"></div><div class="grid" id="lockerGrid"></div>';
    const grid = $('#lockerGrid'), T = this.app.thumbs;
    bar.classList.toggle('show', this.seg === 'drip');
    if (this.seg === 'knives') {
      const inv = [...profile.inventory].sort((a, b) => RARITY_ORDER.indexOf(itemRarity(b)) - RARITY_ORDER.indexOf(itemRarity(a)));
      this.sel = profile.inventory.some(i => i.id === this.sel) ? this.sel : equippedItem().id;
      inv.forEach(it => {
        const c = h(`<button class="card ${it.id === profile.equipped.item ? 'eq' : ''} ${it.id === this.sel ? 'sel' : ''}" style="--r:${rc(itemRarity(it))}"><img alt=""><div class="nm">${it.trak != null ? '<i class="trak">ST</i>' : ''}${KNIVES[it.knife].name}</div><div class="sk">${SKINS[it.skin].name}</div></button>`);
        this.queueThumb(c.querySelector('img'), () => T.knife(it, 200, 100));
        c.onclick = () => { A.uiClick(); this.sel = it.id; this.knifeDetail(it); $$('.card.sel').forEach(x => x.classList.remove('sel')); c.classList.add('sel'); $('#lockerBody').scrollTo({ top: 0, behavior: 'smooth' }); };
        grid.append(c);
      });
      this.knifeDetail(profile.inventory.find(i => i.id === this.sel));
    } else if (this.seg === 'drip') {
      bar.innerHTML = `<button data-slot="skin" class="${this.slot === 'skin' ? 'on' : ''}">🎨</button>` + SLOTS.map(s => `<button data-slot="${s.id}" class="${this.slot === s.id ? 'on' : ''}">${s.icon}</button>`).join('');
      bar.onclick = e => { const s = e.target.closest('button')?.dataset.slot; if (s) { A.uiClick(); this.slot = s; this.sel = null; this.app.previewOutfit(null); this.renderLocker(); } };
      if (this.slot === 'skin') {
        SKIN_TONES.forEach((c, i) => {
          const card = h(`<button class="card ${profile.outfit.skin === i ? 'eq' : ''}" style="--r:#4b8bff"><div class="sw" style="background:${hex(c)}">✋</div><div class="nm">Tone ${i + 1}</div></button>`);
          card.onclick = () => { profile.outfit.skin = i; save(); A.uiClick(); this.app.loadoutChanged(); this.renderLocker(); };
          grid.append(card);
        });
        $('#lockerDetail').innerHTML = '<div class="detail"><div class="dt"><h4>Skin tone</h4><div class="meta">Free to change any time.</div></div></div>';
      } else {
        const ids = Object.keys(DRIP).filter(k => DRIP[k].slot === this.slot).sort((a, b) => (profile.drip.includes(b) - profile.drip.includes(a)) || RARITY_ORDER.indexOf(DRIP[a].rarity) - RARITY_ORDER.indexOf(DRIP[b].rarity));
        ids.forEach(id => grid.append(this.dripCard(id, false)));
        this.lockerWearing();
      }
    } else {
      Object.entries(FINISHERS).forEach(([id, f]) => {
        const owned = profile.finishers.includes(id);
        const card = h(`<button class="card ${id === profile.equipped.finisher ? 'eq' : ''} ${owned ? '' : 'locked'}" style="--r:${rc(f.rarity)}"><div class="glyph">${f.icon}</div><div class="nm">${f.name}</div><div class="sk">${owned ? RARITY[f.rarity].short : ''}</div>${owned ? '' : `<span class="price"><b class="coin"></b>${fmt(f.price)}</span>`}</button>`);
        card.onclick = () => { A.uiClick(); this.finTap(id); };
        grid.append(card);
      });
      $('#lockerDetail').innerHTML = `<div class="detail"><div style="font-size:34px">${FINISHERS[profile.equipped.finisher].icon}</div><div class="dt"><h4>${FINISHERS[profile.equipped.finisher].name}</h4><div class="meta">Equipped. Double tap when they're under 40 HP. Tap another to swap.</div></div></div>`;
    }
    this.app.menuMode(this.lockerCam());
  }
  knifeDetail(it) {
    const r = itemRarity(it), eq = it.id === profile.equipped.item;
    this.app.menu.setKnife(it);
    const d = $('#lockerDetail');
    d.innerHTML = `<div class="detail"><div class="dt"><h4>${itemName(it)}</h4><div class="rar" style="color:${rc(r)}">${RARITY[r].short} · ${wearName(it.float)} · #${it.seed}</div>
      <div class="floatbar"><i style="left:${it.float * 100}%"></i></div><div class="row"></div></div></div>`;
    const row = d.querySelector('.row');
    const eqb = h(`<button class="btn small ${eq ? '' : 'green'}" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>`);
    eqb.onclick = () => { profile.equipped.item = it.id; save(); A.claim(); vibe(15); this.app.loadoutChanged(); this.renderLocker(); };
    row.append(eqb);
    const insp = h(`<button class="btn small">✦ INSPECT</button>`); insp.onclick = () => { this.app.menu.inspect(); };
    row.append(insp);
    if (!eq && profile.inventory.length > 1) {
      const sell = h(`<button class="btn small ghost">SELL ${RARITY[r].sell}</button>`);
      sell.onclick = () => this.confirm(`Sell <b>${itemName(it)}</b> for ${RARITY[r].sell} coins?`, () => { A.coin(); profile.coins += RARITY[r].sell; profile.inventory = profile.inventory.filter(i => i.id !== it.id); this.sel = null; save(); this.renderLocker(); this.refreshLobby(); });
      row.append(sell);
    }
  }
  finTap(id) {
    if (profile.finishers.includes(id) && this.tabName === 'locker') {
      profile.equipped.finisher = id; save(); A.claim(); vibe(15); this.renderLocker();
    } else this.itemPopup('fin', id);
  }

  // ---------- QUESTS / LEVEL ROAD ----------
  renderPass() {
    const b = $('#passBody'), L = profile.level;
    const icon = r => r.type === 'chest' ? '🧰' : r.type === 'drip' ? '🧥' : '<b class="coin"></b>';
    const nodes = []; for (let l = Math.max(2, L - 1); l <= L + 8; l++) { const r = levelReward(l); nodes.push(`<div class="node ${l <= L ? 'got' : l === L + 1 ? 'cur' : ''}"><b>LV ${l}</b><span>${icon(r)}</span><small>${r.label}</small></div>`); }
    const msLeft = new Date().setHours(24, 0, 0, 0) - Date.now();
    b.innerHTML = `<h3>⭐ LEVEL ${L}</h3>
      <div class="xpbar"><i style="width:${profile.xp / xpFor(L) * 100}%"></i><span>${fmt(profile.xp)} / ${fmt(xpFor(L))} XP</span></div>
      <div class="road">${nodes.join('')}</div>
      <h3>📜 DAILY QUESTS <span class="timer">RESET ${Math.floor(msLeft / 3600000)}h ${Math.floor(msLeft / 60000) % 60}m</span></h3><div id="qList"></div>`;
    profile.quests.list.forEach((q, i) => {
      const done = q.prog >= q.goal;
      const el = h(`<div class="quest ${done && !q.claimed ? 'done' : ''} ${q.claimed ? 'claimed' : ''}"><div class="qt"><b>${q.text}</b><div class="qbar"><i style="width:${Math.min(1, q.prog / q.goal) * 100}%"></i></div><small>${Math.min(q.prog, q.goal)} / ${q.goal} · <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b> ${q.coins} · ⭐ ${q.xp} XP</small></div></div>`);
      if (done && !q.claimed) {
        const c = h(`<button class="btn green small">CLAIM</button>`);
        c.onclick = () => { q.claimed = true; profile.coins += q.coins; const lv = this.app.addXp(q.xp); save(); A.claim(); vibe([15, 20, 30]); this.flash(); this.burst(innerWidth / 2, innerHeight * 0.5, undefined, 50, 1, true); this.gToast(`+${q.coins} <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b>  +${q.xp} XP`); this.renderPass(); this.refreshLobby(); if (lv.length) this.levelUp(lv); };
        el.append(c);
      } else if (q.claimed) el.append(h('<span style="font-size:22px">✅</span>'));
      $('#qList').append(el);
    });
  }

  // ---------- RANK ----------
  renderRank() {
    const r = rankOf(profile), games = profile.wins + profile.losses;
    $('#rankBody').innerHTML = `<div class="rank-hero"><div class="emblem-big">${rankEmblem(r.idx, 150)}</div><h2 style="color:${r.color}">${r.name.toUpperCase()}</h2>
      <small>${r.placement ? `${r.placement} placement match${r.placement > 1 ? 'es' : ''} to go` : `${(r.pct * 100).toFixed(1)}% win rate`}</small></div>
      <div class="stats"><div><b>${profile.wins}</b><small>WINS</small></div><div><b>${profile.losses}</b><small>LOSSES</small></div><div><b>${games ? Math.round(r.pct * 100) : 0}%</b><small>WIN RATE</small></div></div>
      <div class="stats"><div><b>${profile.best}</b><small>BEST STREAK</small></div><div><b>${profile.level}</b><small>LEVEL</small></div><div><b>${profile.inventory.length}</b><small>KNIVES</small></div></div>
      <h3>🏆 TIERS</h3><div class="ladder">${RANKS.map((t, i) => [t, i]).reverse().map(([t, i]) => `<div class="${t.name === r.name ? 'me' : ''}">${rankEmblem(i, 58)}<b style="color:${t.color}">${t.name}</b><span>${Math.round(t.min * 100)}%+ win rate</span></div>`).join('')}</div>
      ${profile.history.length ? `<h3>🕑 RECENT</h3>${profile.history.slice(0, 8).map(m => `<div class="hist"><span class="${m.win ? 'w' : 'l'}">${m.win ? 'WIN' : 'LOSS'} ${m.score.join('–')}</span><span>vs ${m.opp}</span></div>`).join('')}` : ''}`;
  }

  // ---------- CHEST OPENING ----------
  openChest(fromOwned) {
    if (fromOwned) { if (profile.chests <= 0) return; profile.chests--; }
    const rar = rollRarity(), won = rollItem(rar), tier = RARITY_ORDER.indexOf(rar);
    profile.inventory.push(won); save();
    this.go('reveal');
    $('#rvCard').classList.remove('on'); $('#rvActions').innerHTML = ''; $('#reelWrap').classList.remove('on'); $('#rvTap').classList.remove('on');
    this.setTierLabel(0); $('#rvSub').textContent = 'Tap the chest to power it up!';
    this.app.startReveal(won, tier, {
      onReady: () => $('#rvTap').classList.add('on'),
      onTier: (i) => { this.setTierLabel(i); this.flash(); const c = rc(RARITY_ORDER[i]); this.shock(innerWidth / 2, innerHeight * 0.55, c, 420 + i * 80); this.burst(innerWidth / 2, innerHeight * 0.55, [c, '#ffffff'], 30 + i * 15, 0.8); },
      onOpen: () => {
        $('#rvTap').classList.remove('on'); this.flash(); $('#rvSub').textContent = '';
        const c = rc(RARITY_ORDER[tier]); this.shock(innerWidth / 2, innerHeight * 0.55, c, 900); this.burst(innerWidth / 2, innerHeight * 0.55, [c, '#ffffff', '#ffcc33'], 90, 1.3);
        setTimeout(() => this.spinReel(won, tier), 900);
      },
    });
  }
  setTierLabel(i) {
    const k = RARITY_ORDER[i], el = $('#rvTier');
    el.textContent = RARITY[k].short; el.style.setProperty('--tc', rc(k));
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  spinReel(won, tier) {
    const reel = $('#reel'), T = this.app.thumbs, N = 40, WIN = 34, W = 138;
    const pool = () => rollItem(Math.random() < 0.8 ? RARITY_ORDER[tier] : rollRarity());
    const items = [...Array(N)].map((_, i) => i === WIN ? won : (i === WIN + 1 || i === WIN - 1) && tier < 4 ? rollItem(RARITY_ORDER[Math.min(4, tier + 1 + (Math.random() < 0.4 ? 1 : 0))]) : pool());
    reel.innerHTML = items.map(it => `<div class="ri" style="--r:${rc(itemRarity(it))}"><img src="${T.knife(it, 200, 100)}" alt=""><span>${KNIVES[it.knife].name}<br><em style="color:${rc(itemRarity(it))};font-style:normal">${SKINS[it.skin].name}</em></span></div>`).join('');
    $('#reelWrap').classList.add('on');
    const wrap = $('#reelWrap').clientWidth;
    const target = WIN * W + W / 2 - wrap / 2 + (Math.random() - 0.5) * (W - 36);
    const dur = 3600, t0 = performance.now(); let lastIdx = -1;
    reel.style.transform = 'translateX(0)';
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4), x = target * e;
      reel.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + wrap / 2) / W); if (idx !== lastIdx) { lastIdx = idx; A.tick(); vibe(4); }
      if (k < 1) requestAnimationFrame(step);
      else setTimeout(() => this.revealDone(won, tier), 350);
    };
    requestAnimationFrame(step);
  }
  revealDone(it, tier) {
    const r = itemRarity(it);
    $('#reelWrap').classList.remove('on');
    this.app.reveal.showKnife(); this.flash();
    this.celebrate(rc(r), tier >= 3); if (tier >= 4) setTimeout(() => this.celebrate('#ffc21a', true), 450);
    A.reveal(tier); vibe(tier >= 3 ? [40, 60, 120] : [30, 40]);
    const c = $('#rvCard'); c.style.setProperty('--r', rc(r));
    c.innerHTML = `<span class="rr">${RARITY[r].short}${tier === 4 ? ' ★' : ''}</span><h2>${KNIVES[it.knife].name}<br><span style="color:${rc(r)}">${SKINS[it.skin].name}</span></h2><p>${wearName(it.float)} · Float ${it.float.toFixed(4)} · Pattern #${it.seed}</p>`;
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    const a = $('#rvActions'); a.innerHTML = '';
    const eq = h(`<button class="btn green">EQUIP</button>`); eq.onclick = () => { profile.equipped.item = it.id; save(); this.app.loadoutChanged(); A.claim(); this.closeChest(); };
    const can = profile.chests > 0 || profile.coins >= CHEST_PRICE;
    const again = h(`<button class="btn gold" ${can ? '' : 'disabled'}>${profile.chests > 0 ? `OPEN NEXT (${profile.chests})` : `AGAIN · ${CHEST_PRICE}`}</button>`);
    again.onclick = () => { if (profile.chests > 0) this.openChest(true); else if (profile.coins >= CHEST_PRICE) { profile.coins -= CHEST_PRICE; save(); this.openChest(false); } };
    const close = h(`<button class="btn ghost">COLLECT</button>`); close.onclick = () => { A.claim(); this.closeChest(); };
    setTimeout(() => a.append(eq, again, close), 500);
  }
  closeChest() { this.app.endReveal(); this.go('lobby'); }

  // ---------- MATCHMAKING ----------
  mm(state, data) {
    if (state === 'search') {
      this.overlay('mm', true); $('#mmTitle').textContent = 'FINDING OPPONENT'; $('.radar').style.display = ''; $('#vs').classList.remove('show'); $('#mmCancel').style.display = '';
      const t0 = performance.now(); clearInterval(this.mmTimer);
      this.mmTimer = setInterval(() => { const s = Math.floor((performance.now() - t0) / 1000); $('#mmTime').textContent = `0:${String(s).padStart(2, '0')}`; }, 250);
    } else if (state === 'found') {
      clearInterval(this.mmTimer); A.beep(880, 0.08, 0.25); setTimeout(() => A.beep(1320, 0.15, 0.25), 90); vibe([20, 40, 20]);
      $('#mmTitle').textContent = 'MATCH FOUND!'; $('.radar').style.display = 'none'; $('#mmTime').textContent = ''; $('#mmCancel').style.display = 'none';
      const me = rankOf(profile), T = this.app.thumbs;
      $('#vs').innerHTML = `<div class="pl me"><img class="av" src="${T.char(profile.outfit)}" alt=""><b>YOU</b><small style="color:${me.color}">${rankEmblem(me.idx, 18)}${me.name}</small><img class="kn" src="${T.knife(equippedItem(), 200, 100)}" alt=""></div>
        <div class="x">VS</div>
        <div class="pl op"><img class="av" src="${T.char(data.outfit)}" alt=""><b>${esc(data.name)}<span class="tag ${data.online ? 'live' : ''}">${data.online ? 'LIVE' : 'AI'}</span></b><small style="color:${data.rank.color}">${rankEmblem(data.rank.idx ?? 1, 18)}${data.rank.name}</small><img class="kn" src="${T.knife(data.item, 200, 100)}" alt=""></div>`;
      $('#vs').classList.add('show');
    } else { clearInterval(this.mmTimer); this.overlay('mm', false); }
  }

  mmStatus(text) { const el = $('#mmTime'); if (el) el.textContent = text; clearInterval(this.mmTimer); }
  // ---------- HUD ----------
  startHud(opName) {
    this.go('hud');
    $('#sbOpAv').textContent = opName.slice(0, 3).toUpperCase(); $('#killfeed').innerHTML = ''; $('#floaters').innerHTML = '';
    $('#sbMe').textContent = '0'; $('#sbOp').textContent = '0'; $('#earned span').textContent = '0';
    this._hp = null; this.hintIdx = -1; this.hintT = 0;
    $('#joyGhost').classList.add('on');
  }
  hud(s) {
    const hp = Math.ceil(s.hp);
    if (hp !== this._hp) {
      if (this._hp != null && hp < this._hp) { $('#hpBox').classList.remove('hit'); void $('#hpBox').offsetWidth; $('#hpBox').classList.add('hit'); }
      this._hp = hp; $('#hpNum').textContent = hp; $('#hpBar').style.width = hp + '%'; $('#hpGhost').style.width = hp + '%';
      $('#hpBox').classList.toggle('low', hp <= 35); $('#lowhp').style.opacity = hp > 0 && hp <= 35 ? (1 - hp / 35) * 0.9 + 0.2 : 0;
    }
    const tm = Math.ceil(s.time), ts = `${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`;
    if (ts !== this._ts) { this._ts = ts; $('#sbTime').textContent = ts; }
    const dash = Math.max(0, Math.min(1, s.dash));
    $('#dashRing').style.strokeDashoffset = 113 * (1 - dash); $('#dashBtn').classList.toggle('cool', dash < 1);
    $('#finBtn').classList.toggle('on', s.finisher);
    if (s.finisher && !this._fin) { this._fin = true; A.beep(1600, 0.05, 0.12, 'triangle'); this.hintFinisher(); }
    if (!s.finisher && this._fin) { this._fin = false; this.updateHint(true); }
    const buffs = s.boost > 0 ? `<span>⚡ ENERGY ${Math.ceil(s.boost)}s</span>` : '';
    if (buffs !== this._buffs) { this._buffs = buffs; $('#buffs').innerHTML = buffs; }
    this.hintT += 1 / 60; if (this.hintT > 1.2 && !this._fin) this.updateHint();
  }
  // onboarding hints: one at a time, only until you've done each thing once
  updateHint(force) {
    const touch = this.app.input.touch;
    const idx = HINTS.findIndex(x => !profile.learned[x.id]);
    if (idx === this.hintIdx && !force) return;
    this.hintIdx = idx;
    const chip = $('#hintChip');
    if (idx < 0) { chip.classList.remove('on'); return; }
    const x = HINTS[idx];
    chip.className = 'hint-chip on';
    chip.style.setProperty('--hx', x.hx || '0px'); chip.style.setProperty('--hy', x.hy || '-4px');
    chip.innerHTML = `<span class="hand">${x.icon}</span><span>${touch ? x.touch : x.desk}</span>`;
    $('#joyGhost').classList.toggle('on', touch && x.id === 'move');
  }
  hintFinisher() {
    const chip = $('#hintChip'); chip.className = 'hint-chip on'; chip.style.setProperty('--hy', '-4px');
    chip.innerHTML = `<span class="hand" style="background:linear-gradient(180deg,#ff8fa3,#ff3355)">💀</span><span><b>${this.app.input.touch ? 'Double tap' : 'Double-click'}</b> — FINISH THEM!</span>`;
  }
  learn(id) {
    if (profile.learned[id]) return;
    profile.learned[id] = true; save();
    const cur = HINTS[this.hintIdx];
    if (cur && cur.id === id) {
      const chip = $('#hintChip'); chip.classList.add('done'); chip.querySelector('.hand').textContent = '✓'; A.beep(1500, 0.05, 0.1, 'triangle');
      setTimeout(() => this.updateHint(true), 700);
    }
  }
  roundIntro(round, score) {
    $('#sbRound').textContent = `R${round}`; $('#sbMe').textContent = score[0]; $('#sbOp').textContent = score[1];
    $('#roundRes').classList.remove('on');
    this.banner(`ROUND ${round}`, '#ffffff');
  }
  countdown(v) { const c = $('#countdown'); c.textContent = v; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  roundResult(res, reason, score, over) {
    $('#sbMe').textContent = score[0]; $('#sbOp').textContent = score[1];
    const r = $('#roundRes');
    const txt = res === 'win' ? 'ROUND WON' : res === 'lose' ? 'ROUND LOST' : 'DRAW';
    const why = { traffic: 'Roadkill 🚗', finisher: 'Finisher', backstab: 'Backstab', air: 'Air shank', slash1: 'Slashed', slash2: 'Slashed', stab: 'Stabbed', heavy: 'Heavy stab', Time: 'Time ran out' }[reason] || '';
    r.innerHTML = `<h2 style="color:${res === 'win' ? '#6fb0ff' : res === 'lose' ? '#ff3355' : '#fff'}">${txt}</h2><p>${why}${over ? '' : ` · ${score[0]} – ${score[1]}`}</p>`;
    setTimeout(() => { r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); }, 650);
    vibe(res === 'win' ? [30, 50, 30] : 80);
    if (res === 'win') setTimeout(() => { this.burst(innerWidth / 2, innerHeight * 0.42, ['#6fb0ff', '#ffcc33', '#ffffff'], 50, 0.9); A.pop(); }, 650);
  }
  ping(ang, dist) {
    const el = document.createElement('div'); el.className = 'ping';
    el.innerHTML = `<i style="transform:rotate(${-ang * 180 / Math.PI}deg)"><b>▲</b></i><span>${dist}m</span>`;
    $('#hud').append(el); setTimeout(() => el.remove(), 2200);
  }
  killPop() { this.shock(innerWidth / 2, innerHeight * 0.45, '#ffcc33', 600); this.burst(innerWidth / 2, innerHeight * 0.45, ['#ffcc33', '#ff3355', '#ffffff'], 40, 0.9, true); }
  banner(text, color) { const b = $('#banner'); b.textContent = text; b.style.setProperty('--c', color); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  toast(text, ms = 800) { const t = $('#toast'); t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('on'), ms); }
  floater(text, x, y, cls) {
    const f = h(`<div class="fl ${cls || ''}" style="left:${x * 100}%;top:${y * 100}%">${text}</div>`);
    $('#floaters').append(f); setTimeout(() => f.remove(), 850);
  }
  hit(dmg, crit, x, y, combo) {
    const m = $('#hitmark'); m.classList.toggle('crit', crit); m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
    this.floater(dmg, Math.max(0.1, Math.min(0.9, x + (Math.random() - 0.5) * 0.06)), Math.max(0.15, Math.min(0.8, y - 0.05)), crit ? 'crit' : '');
    if (combo >= 2) { const c = $('#combo'); c.textContent = `x${combo} COMBO`; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  }
  coinPop(n, why) {
    const e = $('#earned'), s = e.querySelector('span'); s.textContent = String(+s.textContent + n);
    e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse');
    if (why) this.floater(`+${n} <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b> ${why}`, 0.5, 0.66, 'coin');
  }
  pickup(name, type) { this.toast(type === 'chicken' ? `🍗 ${name} +35 HP` : `⚡ ${name}!`, 1200); vibe(25); }
  hurt(k, fromAng = 0) {
    const el = $('#hurt'); el.style.transition = 'none'; el.style.opacity = Math.min(1, 0.45 + k * 0.5);
    el.querySelector('.dir').style.setProperty('--a', `${-fromAng * 180 / Math.PI}deg`);
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.9s ease-out'; el.style.opacity = 0; });
    vibe(Math.min(120, 30 + k * 60));
  }
  dashFx() { const s = $('#speedlines'); s.classList.add('dash'); clearTimeout(this._dT); this._dT = setTimeout(() => s.classList.remove('dash'), 180); }
  sprintFx(on) { $('#speedlines').classList.toggle('sprint', on); }
  killfeed(a, b, item, how) {
    const icon = how === 'traffic' ? '<span style="font-size:16px">🚗</span>' : `<img src="${this.app.thumbs.knife(item, 100, 50)}" alt="">`;
    const kf = h(`<div class="kf"><span class="${a === 'You' ? 'me' : 'op'}">${a}</span>${icon}${['finisher', 'backstab', 'air', 'traffic'].includes(how) ? `<em>${how === 'traffic' ? 'ROADKILL' : how.toUpperCase()}</em>` : ''}<span class="${b === 'You' ? 'me' : 'op'}">${b}</span></div>`);
    $('#killfeed').prepend(kf); setTimeout(() => kf.remove(), 6000);
  }
  joy(j, dx, dy, sprint) {
    const el = $('#joy');
    if (!j) { el.style.display = 'none'; el.classList.remove('sprint'); return; }
    el.classList.toggle('sprint', !!sprint);
    el.style.display = 'block'; el.style.left = j.x + 'px'; el.style.top = j.y + 'px';
    el.querySelector('i').style.transform = `translate(${dx}px, ${dy}px)`;
    $('#joyGhost').classList.remove('on');
  }
  swipeTrail() { /* feedback comes from the slash itself */ }

  // ---------- RESULT (staged reward reveal) ----------
  showResult(R) {
    const r = rankOf(profile);
    $('#lowhp').style.opacity = 0; $('#speedlines').className = '';
    $('#resultBox').innerHTML = `<h1 style="color:${R.win ? '#ffcc33' : '#ff3355'}">${R.win ? 'VICTORY' : 'DEFEAT'}</h1>
      <div class="score">${R.score[0]} – ${R.score[1]}</div><div id="rewRows"></div>
      <div class="result-actions"><button class="btn ghost" id="homeBtn">HOME</button><button class="btn-play" id="againBtn"><span>PLAY AGAIN</span></button></div>`;
    $('.result-rays').style.display = R.win ? '' : 'none';
    this.overlay('result', true);
    if (R.win) { A.winSting(); setTimeout(() => this.celebrate('#ffcc33', true), 250); } else A.loseSting();
    const rows = $('#rewRows');
    const row = (icon, label, val, extra = '') => { const e = h(`<div class="rew"><span class="ri">${icon}</span><div class="rt"><small>${label}</small><b>${val}</b>${extra}</div></div>`); rows.append(e); requestAnimationFrame(() => e.classList.add('in')); return e; };
    const steps = [];
    steps.push(() => { const e = row('<b class="coin"></b>', 'COINS', '+0'); this.countUp(e.querySelector('b'), R.coins, v => `+${fmt(v)}`); });
    steps.push(() => {
      const e = row('⭐', `LEVEL ${R.levelBefore}`, `+${R.xp} XP`, `<div class="xpbar"><i style="width:${R.xpBefore / xpFor(R.levelBefore) * 100}%"></i></div>`);
      const bar = e.querySelector('.xpbar i');
      setTimeout(() => { bar.style.width = (R.levels.length ? 100 : profile.xp / xpFor(profile.level) * 100) + '%'; A.swoosh(); }, 100);
      if (R.levels.length) setTimeout(() => { e.querySelector('small').textContent = `LEVEL ${profile.level}`; A.levelUp(); this.flash(); vibe([30, 50, 80]); e.querySelector('b').innerHTML = `LEVEL UP! <span style="color:#ffcc33">${R.levelRewards.join(' · ')}</span>`; }, 1100);
    });
    if (R.win) steps.push(() => {
      const it = equippedItem();
    $('#heroPlate').innerHTML = `<div class="hp-row" style="--rc:${r.color}">${rankEmblem(r.idx, 40)}<div><b>${r.name.toUpperCase()}</b><br><small>LV ${profile.level} · ${profile.wins}W ${profile.losses}L</small></div></div><div class="kn" style="--kc:${rc(itemRarity(it))}">🔪 ${itemName(it)}</div>`;
    $('#tapHint').style.display = profile.learned.flex ? 'none' : '';
    this.app.menu?.setRankColor?.(r.color);
    const pips = [...Array(WIN_CHEST_WINS)].map((_, i) => `<i style="display:inline-block;width:26px;height:12px;border-radius:6px;margin-right:4px;border:2px solid #050a24;background:${i < (R.chestEarned ? WIN_CHEST_WINS : profile.winChest) ? '#ffcc33' : 'rgba(255,255,255,.15)'}"></i>`).join('');
      row('🧰', 'WIN CHEST', R.chestEarned ? 'CHEST EARNED!' : `${profile.winChest} / ${WIN_CHEST_WINS}`, `<div>${pips}</div>`);
      if (R.chestEarned) { A.reveal(3); vibe([30, 40, 60]); }
    });
    steps.push(() => row(rankEmblem(r.idx, 34), 'RANK', `<span style="color:${r.color}">${r.name}</span>`, `<small>${r.placement ? `${r.placement} placements left` : `${(r.pct * 100).toFixed(1)}% win rate · ${profile.wins}W ${profile.losses}L`}</small>`));
    if (R.questsDone.length) steps.push(() => { row('📜', 'QUEST COMPLETE', R.questsDone.join(', '), '<small>Claim in QUESTS</small>'); A.claim(); });
    if (R.rankUp) steps.push(() => setTimeout(() => this.rankUp(R.rankUp), 500));
    steps.forEach((f, i) => setTimeout(f, 500 + i * 650));
    $('#againBtn').onclick = () => { A.uiClick(); this.overlay('result', false); this.app.queue(); };
    $('#homeBtn').onclick = () => { A.uiClick(); this.overlay('result', false); this.app.toMenu(); };
  }
  countUp(el, to, f) {
    const t0 = performance.now(), dur = 900; let i = 0;
    const step = t => { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = f(v); if (i++ % 3 === 0) A.countTick(i); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---------- MODALS ----------
  modal(html, dismissable = true) { $('#modalBox').innerHTML = html; this.modalDismiss = dismissable; this.overlay('modal', true); }
  closeModal() { this.overlay('modal', false); }
  confirm(msg, yes) {
    this.modal(`<h2>SURE?</h2><p style="text-align:center;margin:0">${msg}</p><div class="row"><button class="btn ghost" id="mNo">NAH</button><button class="btn green" id="mYes">YES</button></div>`);
    $('#mNo').onclick = () => this.closeModal(); $('#mYes').onclick = () => { this.closeModal(); yes(); };
  }
  daily() {
    const can = profile.daily.last !== today();
    const day = profile.daily.day % 7;
    const icon = d => d.type === 'chest' ? (d.n > 1 ? '🧰🧰' : '🧰') : d.type === 'drip' ? '🧥' : '<b class="coin"></b>';
    const label = d => d.type === 'coins' ? d.amount : d.type === 'drip' ? 'DRIP' : d.n > 1 ? '2 CHESTS' : 'CHEST';
    this.modal(`<h2>DAILY REWARDS</h2><p style="text-align:center;margin:0;font-size:12px;opacity:.8">Come back every day. Day 7 is stacked.</p>
      <div class="days">${DAILY.map((d, i) => `<div class="day ${i < day ? 'got' : ''} ${i === day && can ? 'today' : ''} ${i === 6 ? 'big' : ''}"><small>DAY ${i + 1}</small><span>${icon(d)}</span>${label(d)}</div>`).join('')}</div>
      <div class="row"><button class="btn ghost" id="mClose">LATER</button><button class="btn gold" id="mClaim" ${can ? '' : 'disabled'}>${can ? 'CLAIM' : 'COME BACK TOMORROW'}</button></div>`);
    $('#mClose').onclick = () => this.closeModal();
    $('#mClaim').onclick = () => {
      if (!can) return;
      const d = DAILY[day]; let msg = '';
      if (d.type === 'coins') { profile.coins += d.amount; msg = `+${d.amount} <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b>`; }
      if (d.type === 'chest') { profile.chests += d.n || 1; msg = `+${d.n || 1} chest${(d.n || 1) > 1 ? 's' : ''} 🧰`; }
      if (d.type === 'drip') { const id = rollDrip('restricted'); if (id) { profile.drip.push(id); msg = `🧥 ${DRIP[id].name}`; } else { profile.coins += 400; msg = '+400 <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b>'; } }
      profile.daily = { last: today(), day: profile.daily.day + 1 }; save();
      A.reveal(3); vibe([30, 50, 80]); this.flash(); this.closeModal(); this.celebrate('#ffcc33', true); this.gToast(`🎁 ${msg}`); this.refreshLobby();
    };
  }
  rankUp(r) {
    this.modal(`<div class="lvlup"><div class="emblem-big">${rankEmblem(r.idx, 190)}</div><div class="big" style="color:${r.color};font-size:64px">RANK UP!</div><p style="margin:0;font-weight:900">You're now <span style="color:${r.color}">${r.name.toUpperCase()}</span></p></div><div class="row"><button class="btn gold" id="mOk">LET'S GO</button></div>`);
    A.rankUp(); this.flash(); this.burst(innerWidth / 2, innerHeight * 0.4, [r.color, '#ffcc33', '#ffffff'], 90); vibe([40, 60, 120]);
    $('#mOk').onclick = () => { this.closeModal(); this.refreshLobby(); };
  }
  levelUp(levels) {
    const lv = levels[levels.length - 1];
    this.modal(`<div class="lvlup"><div class="big">LEVEL ${lv}</div><p>New rewards unlocked</p></div><div class="row"><button class="btn gold" id="mOk">NICE</button></div>`);
    A.levelUp(); this.flash(); this.celebrate('#ffcc33', true); $('#mOk').onclick = () => { this.closeModal(); this.refreshLobby(); };
  }
  settings(inMatch = false) {
    const s = profile.settings, touch = this.app.input.touch;
    this.modal(`<h2>${inMatch ? 'PAUSED' : 'SETTINGS'}</h2>
      <label>Look sensitivity <input type="range" id="sSens" min="0.3" max="2.5" step="0.05" value="${s.sens}"></label>
      <label>Volume <input type="range" id="sVol" min="0" max="1" step="0.05" value="${s.vol}"></label>
      <label>Graphics <select id="sQ"><option value="high">High (bloom)</option><option value="low">Fast</option></select></label>
      <label>Vibration <input type="checkbox" id="sHap" ${s.haptics ? 'checked' : ''}></label>
      ${inMatch ? '' : `<label>Your name <input id="sName" maxlength="16" value="${esc(profile.name)}" style="font:inherit;width:150px;padding:4px 8px;border-radius:8px;border:2px solid #050a24"></label>
      <label>Online matchmaking <input type="checkbox" id="sOnline" ${s.online !== false ? 'checked' : ''}></label>`}
      <div class="controls-list">${touch
        ? '<b>Left stick</b> move · push <b>fully up</b> and hold to sprint<br><b>Right drag</b> look · <b>Tap</b> shank · <b>Double tap</b> finisher<br><b>»</b> dash · <b>JUMP</b> to climb · <b>✦</b> inspect'
        : '<b>WASD</b> move · <b>Mouse</b> look · <b>Space</b> jump · <b>Shift</b> sprint<br><b>LMB</b> shank · <b>Double-click/E</b> finisher · <b>RMB</b> heavy<br><b>Q</b> dash · <b>F</b> inspect'}</div>
      <small style="text-align:center;opacity:.5">Shankmaster v0.6 · online test build</small>
      <div class="row">${inMatch ? '<button class="btn red" id="mQuit">FORFEIT</button><button class="btn green" id="mResume">RESUME</button>' : '<button class="btn ghost small" id="mTut">REPLAY TUTORIAL</button><button class="btn green" id="mClose">DONE</button>'}</div>`);
    $('#sQ').value = s.quality;
    $('#sSens').oninput = e => { s.sens = +e.target.value; this.app.input.sens = s.sens; save(); };
    $('#sVol').oninput = e => { s.vol = +e.target.value; A.setVolume(s.vol); save(); };
    $('#sQ').onchange = e => { s.quality = e.target.value; save(); this.app.applyQuality(); };
    $('#sHap').onchange = e => { s.haptics = e.target.checked; save(); };
    if ($('#sName')) { $('#sName').oninput = e => { const v = e.target.value.replace(/[^\w .-]/g, '').slice(0, 16).trim(); if (v.length >= 2) { profile.name = v; save(); this.refreshLobby(); } }; $('#sName').addEventListener('keydown', e => e.stopPropagation()); }
    if ($('#sOnline')) $('#sOnline').onchange = e => { s.online = e.target.checked; save(); };
    if (inMatch) { $('#mResume').onclick = () => { this.closeModal(); this.app.resume(); }; $('#mQuit').onclick = () => { this.closeModal(); this.app.forfeit(); }; }
    else { $('#mClose').onclick = () => { A.uiClick(); this.closeModal(); }; $('#mTut').onclick = () => { profile.learned = {}; save(); this.closeModal(); this.gToast('Tutorial hints back on'); }; }
  }
}
