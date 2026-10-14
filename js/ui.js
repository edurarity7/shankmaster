// DOM UI: menus, locker, store, chest opening, HUD.
import { profile, save, RARITY, RARITY_ORDER, KNIVES, SKINS, CHARACTERS, FINISHERS, CHEST_PRICE, rankOf, itemName, itemRarity, wearName, rollItem, equippedItem, PLACEMENT_GAMES, RANKS } from './data.js';
import * as A from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmt = n => n.toLocaleString('en-GB');
const rc = r => RARITY[r].color;

export class UI {
  constructor(app) {
    this.app = app; this.screen = 'loading'; this.lockerTab = 'knives'; this.sel = null;
    $$('[data-go]').forEach(b => b.addEventListener('click', () => { A.uiClick(); this.go(b.dataset.go); }));
    $('#playBtn').addEventListener('click', () => { A.uiClick(); app.queue(); });
    $('#chestChip').addEventListener('click', () => { A.uiClick(); profile.chests > 0 ? this.openChest(true) : this.go('store'); });
    $('#settingsBtn').addEventListener('click', () => { A.uiClick(); this.settings(); });
    $('#lockerTabs').addEventListener('click', e => { const t = e.target.dataset.tab; if (t) { A.uiClick(); this.lockerTab = t; this.sel = null; this.renderLocker(); } });
    $('#mmCancel').addEventListener('click', () => { A.uiClick(); app.cancelQueue(); });
    $('#pauseBtn').addEventListener('click', () => app.pause());
    $('#inspectBtn').addEventListener('click', () => app.input.emit('inspect'));
    $('#loadoutCard').addEventListener('click', () => { A.uiClick(); this.go('locker'); });
    addEventListener('resize', () => this.orient()); this.orient();
  }
  orient() {
    const portrait = innerHeight > innerWidth && matchMedia('(pointer: coarse)').matches;
    $('#rotateHint').style.display = portrait && (this.screen === 'hud' || this.screen === 'home') ? 'block' : 'none';
  }
  loading(p) { $('.loadbar i').style.width = `${Math.round(p * 100)}%`; }
  go(name) {
    $$('.screen').forEach(s => s.classList.remove('show'));
    $('#' + name).classList.add('show'); this.screen = name;
    if (name === 'home') this.renderHome();
    if (name === 'locker') this.renderLocker();
    if (name === 'store') this.renderStore();
    this.app.menuView(name);
    this.orient();
  }
  overlay(name, on) { $('#' + name).classList.toggle('show', on); }

  // ---------- HOME ----------
  renderHome() {
    const r = rankOf(profile), games = profile.wins + profile.losses;
    $('#coins').textContent = fmt(profile.coins); $$('.coinsMirror').forEach(e => (e.textContent = fmt(profile.coins)));
    $('#chestCount').textContent = profile.chests; $('#chestChip').classList.toggle('has', profile.chests > 0);
    const next = RANKS[r.idx + 1];
    $('#rankCard').innerHTML = `
      <div class="tier"><div class="emblem" style="background:${r.color}">${r.placement ? '?' : r.name[0]}</div>
        <div><h3 style="color:${r.color}">${r.name.toUpperCase()}</h3>
        <div class="sub">${r.placement ? `${r.placement} placement match${r.placement > 1 ? 'es' : ''} left` : next ? `${Math.ceil((next.min - r.pct) * 100)}% to ${next.name}` : 'Top of the ends.'}</div></div></div>
      <div class="stats"><div><b>${profile.wins}</b><small>WINS</small></div><div><b>${profile.losses}</b><small>LOSSES</small></div><div><b>${games ? Math.round(r.pct * 100) : 0}%</b><small>WIN RATE</small></div></div>
      <div class="pctbar"><i style="width:${(r.pct * 100).toFixed(1)}%"></i></div>`;
    const it = equippedItem(), c = CHARACTERS[profile.equipped.character], f = FINISHERS[profile.equipped.finisher];
    $('#loadoutCard').innerHTML = `<img src="${this.app.thumbs.knife(it)}" alt="">
      <div><div class="lname" style="color:${rc(itemRarity(it))}">${itemName(it)}</div><div class="lsub">${c.name} · ${f.name}</div><div class="lsub">Tap to change loadout ›</div></div>`;
  }

  // ---------- LOCKER ----------
  renderLocker() {
    $$('#lockerTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.lockerTab));
    const grid = $('#lockerGrid'); grid.innerHTML = '';
    const T = this.app.thumbs;
    if (this.lockerTab === 'knives') {
      const inv = [...profile.inventory].sort((a, b) => RARITY_ORDER.indexOf(itemRarity(b)) - RARITY_ORDER.indexOf(itemRarity(a)));
      this.sel ??= equippedItem().id;
      inv.forEach(it => {
        const c = h(`<button class="card ${it.id === profile.equipped.item ? 'eq' : ''}" style="--r:${rc(itemRarity(it))}"><img src="${T.knife(it, 240, 120)}" alt=""><div class="nm">${KNIVES[it.knife].name}</div><div class="sk">${SKINS[it.skin].name}</div></button>`);
        c.onclick = () => { A.uiClick(); this.sel = it.id; this.knifeDetail(it); this.app.showcaseItem(it); };
        grid.append(c);
      });
      const it = profile.inventory.find(i => i.id === this.sel) || equippedItem();
      this.knifeDetail(it); this.app.showcaseItem(it);
    } else if (this.lockerTab === 'chars') {
      this.sel ??= profile.equipped.character;
      Object.entries(CHARACTERS).forEach(([id, c]) => {
        const owned = profile.characters.includes(id);
        const card = h(`<button class="card ${id === profile.equipped.character ? 'eq' : ''} ${owned ? '' : 'locked'}" style="--r:${owned ? '#5fd3ff' : '#666'}"><img src="${T.char(id)}" alt=""><div class="nm">${c.name}</div><div class="sk">${owned ? 'Owned' : `${fmt(c.price)} coins`}</div></button>`);
        card.onclick = () => { A.uiClick(); this.sel = id; this.charDetail(id); this.app.showcaseChar(id); };
        grid.append(card);
      });
      this.charDetail(CHARACTERS[this.sel] ? this.sel : profile.equipped.character);
    } else {
      this.sel ??= profile.equipped.finisher;
      Object.entries(FINISHERS).forEach(([id, f]) => {
        const owned = profile.finishers.includes(id);
        const card = h(`<button class="card ${id === profile.equipped.finisher ? 'eq' : ''} ${owned ? '' : 'locked'}" style="--r:${rc(f.rarity)}"><div class="glyph">${['⚔', '🌀', '🗡', '🍞', '🪙'][Object.keys(FINISHERS).indexOf(id)]}</div><div class="nm">${f.name}</div><div class="sk">${owned ? RARITY[f.rarity].name : `${fmt(f.price)} coins`}</div></button>`);
        card.onclick = () => { A.uiClick(); this.sel = id; this.finDetail(id); };
        grid.append(card);
      });
      this.finDetail(FINISHERS[this.sel] ? this.sel : profile.equipped.finisher);
    }
  }
  knifeDetail(it) {
    const r = itemRarity(it), eq = it.id === profile.equipped.item;
    const d = $('#lockerDetail');
    d.innerHTML = `<h3>${KNIVES[it.knife].name}</h3><div class="rar" style="color:${rc(r)}">★ ${SKINS[it.skin].name} · ${RARITY[r].name}</div>
      <img src="${this.app.thumbs.knife(it)}" alt="">
      <div class="meta">${KNIVES[it.knife].desc}<br>Wear: <b>${wearName(it.float)}</b> (${it.float.toFixed(4)})<br>Pattern: <b>#${it.seed}</b></div>
      <div class="floatbar"><i style="left:${it.float * 100}%"></i></div>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"></div>`;
    const row = d.querySelector('.row');
    const eqb = h(`<button class="btn small" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>`);
    eqb.onclick = () => { A.uiClick(); profile.equipped.item = it.id; save(); this.renderLocker(); this.app.loadoutChanged(); };
    row.append(eqb);
    if (!eq && profile.inventory.length > 1) {
      const sell = h(`<button class="btn small ghost">SELL ${RARITY[r].sell}</button>`);
      sell.onclick = () => { if (!confirm(`Sell ${itemName(it)} for ${RARITY[r].sell} coins?`)) return; A.coin(); profile.coins += RARITY[r].sell; profile.inventory = profile.inventory.filter(i => i.id !== it.id); this.sel = null; save(); this.renderLocker(); };
      row.append(sell);
    }
    const insp = h(`<button class="btn small ghost">INSPECT</button>`); insp.onclick = () => this.app.inspectShowcase(); row.append(insp);
  }
  charDetail(id) {
    const c = CHARACTERS[id], owned = profile.characters.includes(id), eq = id === profile.equipped.character;
    const d = $('#lockerDetail');
    d.innerHTML = `<h3>${c.name}</h3><img src="${this.app.thumbs.char(id)}" alt="" style="width:160px;align-self:center"><div class="meta">${c.desc}</div><div class="row"></div>`;
    const b = owned ? h(`<button class="btn small" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>`) : h(`<button class="btn small pink" ${profile.coins < c.price ? 'disabled' : ''}>BUY ${fmt(c.price)}</button>`);
    b.onclick = () => {
      if (!owned) { profile.coins -= c.price; profile.characters.push(id); A.reveal(2); }
      else A.uiClick();
      profile.equipped.character = id; save(); this.renderLocker(); this.app.loadoutChanged();
    };
    d.querySelector('.row').append(b);
    this.app.showcaseChar(id);
  }
  finDetail(id) {
    const f = FINISHERS[id], owned = profile.finishers.includes(id), eq = id === profile.equipped.finisher;
    const d = $('#lockerDetail');
    d.innerHTML = `<h3>${f.name}</h3><div class="rar" style="color:${rc(f.rarity)}">${RARITY[f.rarity].name} finisher</div><div class="meta">${f.desc}<br><br>Double tap (double-click / E) when your opponent is under 40 HP and in reach.</div><div class="row"></div>`;
    const b = owned ? h(`<button class="btn small" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>`) : h(`<button class="btn small pink" ${profile.coins < f.price ? 'disabled' : ''}>BUY ${fmt(f.price)}</button>`);
    b.onclick = () => {
      if (!owned) { profile.coins -= f.price; profile.finishers.push(id); A.reveal(RARITY_ORDER.indexOf(f.rarity)); } else A.uiClick();
      profile.equipped.finisher = id; save(); this.renderLocker();
    };
    d.querySelector('.row').append(b);
  }

  // ---------- STORE ----------
  renderStore() {
    $$('.coinsMirror').forEach(e => (e.textContent = fmt(profile.coins)));
    const b = $('#storeBody');
    const total = RARITY_ORDER.reduce((a, k) => a + RARITY[k].weight, 0);
    b.innerHTML = `<h3>CHESTS</h3>
      <div class="featured"><div class="big-chest"></div><div>
        <h4>ENDZ CHEST</h4><p>One knife with a random skin. Every knife type except the Kitchen Shank can drop. Gems are ★ Rare Special.</p>
        <div class="odds">${RARITY_ORDER.map(k => `<span style="border-color:${rc(k)}">${RARITY[k].name} ${(RARITY[k].weight / total * 100).toFixed(1)}%</span>`).join('')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="buyChest" ${profile.coins < CHEST_PRICE ? 'disabled' : ''}>BUY &amp; OPEN · ${CHEST_PRICE}</button>
        ${profile.chests ? `<button class="btn pink" id="openOwned">OPEN (${profile.chests})</button>` : ''}</div></div></div>
      <h3>FINISHERS</h3><div class="grid" id="finGrid" style="overflow:visible"></div>
      <h3>CHARACTERS</h3><div class="grid" id="charGrid" style="overflow:visible"></div>`;
    $('#buyChest').onclick = () => { if (profile.coins < CHEST_PRICE) return; profile.coins -= CHEST_PRICE; save(); A.coin(); this.openChest(false); };
    $('#openOwned') && ($('#openOwned').onclick = () => this.openChest(true));
    Object.entries(FINISHERS).forEach(([id, f], i) => {
      const owned = profile.finishers.includes(id);
      const c = h(`<button class="card ${owned ? '' : ''}" style="--r:${rc(f.rarity)}"><div class="glyph">${['⚔', '🌀', '🗡', '🍞', '🪙'][i]}</div><div class="nm">${f.name}</div><div class="sk">${f.desc}</div>${owned ? '<span class="price">OWNED</span>' : `<span class="price"><b class="coin"></b>${fmt(f.price)}</span>`}</button>`);
      c.onclick = () => { if (owned || profile.coins < f.price) { A.beep(200, 0.08, 0.2); return; } if (!confirm(`Buy ${f.name} for ${f.price} coins?`)) return; profile.coins -= f.price; profile.finishers.push(id); save(); A.reveal(RARITY_ORDER.indexOf(f.rarity)); this.renderStore(); };
      $('#finGrid').append(c);
    });
    Object.entries(CHARACTERS).forEach(([id, ch]) => {
      const owned = profile.characters.includes(id);
      const c = h(`<button class="card" style="--r:#5fd3ff"><img src="${this.app.thumbs.char(id)}" alt=""><div class="nm">${ch.name}</div><div class="sk">${ch.desc}</div>${owned ? '<span class="price">OWNED</span>' : `<span class="price"><b class="coin"></b>${fmt(ch.price)}</span>`}</button>`);
      c.onclick = () => { if (owned || profile.coins < ch.price) { A.beep(200, 0.08, 0.2); return; } if (!confirm(`Buy ${ch.name} for ${ch.price} coins?`)) return; profile.coins -= ch.price; profile.characters.push(id); save(); A.reveal(2); this.renderStore(); };
      $('#charGrid').append(c);
    });
  }

  // ---------- CHEST OPENING (CS-style reel) ----------
  openChest(fromOwned) {
    if (fromOwned) { if (profile.chests <= 0) return; profile.chests--; }
    const won = rollItem(); profile.inventory.push(won); save();
    this.overlay('caseOpen', true);
    const reel = $('#reel'), T = this.app.thumbs, N = 48, WIN = 42, W = 158;
    const items = [...Array(N)].map((_, i) => i === WIN ? won : rollItem());
    reel.innerHTML = items.map(it => `<div class="ri" style="--r:${rc(itemRarity(it))}"><img src="${T.knife(it, 240, 120)}" alt=""><span>${KNIVES[it.knife].name}<br><em style="color:${rc(itemRarity(it))};font-style:normal">${SKINS[it.skin].name}</em></span></div>`).join('');
    $('#caseResult').innerHTML = ''; $('#caseActions').innerHTML = '';
    const wrap = $('.reel-wrap').clientWidth;
    const target = WIN * W + W / 2 - wrap / 2 + (Math.random() - 0.5) * (W - 30);
    const dur = 5200, t0 = performance.now(); let lastIdx = -1;
    reel.style.transform = 'translateX(0)';
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4), x = target * e;
      reel.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + wrap / 2) / W); if (idx !== lastIdx) { lastIdx = idx; A.tick(); }
      if (k < 1) requestAnimationFrame(step); else this.chestDone(won);
    };
    requestAnimationFrame(step);
  }
  chestDone(it) {
    const r = itemRarity(it);
    A.reveal(RARITY_ORDER.indexOf(r));
    $('#caseResult').innerHTML = `<div style="--r:${rc(r)}"><img src="${this.app.thumbs.knife(it, 640, 320)}" alt=""><h3>${itemName(it)}</h3><div class="rar">${RARITY[r].name} · ${wearName(it.float)} · #${it.seed}</div></div>`;
    const a = $('#caseActions');
    const eq = h(`<button class="btn">EQUIP</button>`); eq.onclick = () => { profile.equipped.item = it.id; save(); this.app.loadoutChanged(); this.closeChest(); };
    const again = h(`<button class="btn pink" ${profile.chests > 0 || profile.coins >= CHEST_PRICE ? '' : 'disabled'}>${profile.chests > 0 ? `OPEN ANOTHER (${profile.chests})` : `ANOTHER · ${CHEST_PRICE}`}</button>`);
    again.onclick = () => { if (profile.chests > 0) this.openChest(true); else if (profile.coins >= CHEST_PRICE) { profile.coins -= CHEST_PRICE; save(); this.openChest(false); } };
    const close = h(`<button class="btn ghost">CLOSE</button>`); close.onclick = () => this.closeChest();
    a.append(eq, again, close);
  }
  closeChest() { A.uiClick(); this.overlay('caseOpen', false); this.go(this.screen === 'caseOpen' ? 'home' : this.screen); }

  // ---------- MATCHMAKING ----------
  mm(state, data) {
    if (state === 'search') {
      this.overlay('mm', true); $('#mmTitle').textContent = 'FINDING OPPONENT'; $('.spinner').style.display = 'block'; $('#vs').classList.remove('show'); $('#mmCancel').style.display = '';
      const t0 = performance.now(); clearInterval(this.mmTimer);
      this.mmTimer = setInterval(() => { const s = Math.floor((performance.now() - t0) / 1000); $('#mmTime').textContent = `0:${String(s).padStart(2, '0')}`; }, 250);
    } else if (state === 'found') {
      clearInterval(this.mmTimer); A.beep(880, 0.08, 0.25); setTimeout(() => A.beep(1320, 0.15, 0.25), 90);
      $('#mmTitle').textContent = 'OPPONENT FOUND'; $('.spinner').style.display = 'none'; $('#mmTime').textContent = ''; $('#mmCancel').style.display = 'none';
      const me = rankOf(profile), T = this.app.thumbs;
      $('#vs').innerHTML = `<div class="pl"><img src="${T.char(profile.equipped.character)}" alt=""><b>YOU</b><small style="color:${me.color}">${me.name}</small><img src="${T.knife(equippedItem(), 240, 120)}" style="height:50px" alt=""></div>
        <div class="x">VS</div>
        <div class="pl"><img src="${T.char(data.character)}" alt=""><b>${data.name}<span class="tag">AI</span></b><small style="color:${data.rank.color}">${data.rank.name}</small><img src="${T.knife(data.item, 240, 120)}" style="height:50px" alt=""></div>`;
      $('#vs').classList.add('show');
    } else { clearInterval(this.mmTimer); this.overlay('mm', false); }
  }

  // ---------- HUD (called by Match) ----------
  startHud(opName, item) {
    this.go('hud');
    $('#sbOpName').textContent = opName; $('#killfeed').innerHTML = ''; $('#knifeName').textContent = itemName(item);
    $('#sbMe').textContent = '0'; $('#sbOp').textContent = '0';
    const touch = this.app.input.touch;
    $('#inspectBtn').style.display = touch ? '' : 'none';
    if (profile.settings.tutorial) this.tutorial(touch);
  }
  tutorial(touch) {
    const t = $('#tutorial');
    t.innerHTML = touch
      ? `<h4>HOW TO SHANK</h4><b>Left thumb</b> move · <b>Right thumb</b> drag to look<br><b>Tap / swipe</b> shank (3-hit combo) · <b>Double tap</b> finisher / heavy stab<br><b>Double swipe ← → ↓</b> dash (dodge) · <b>Double swipe ↑</b> sprint<br><small>Tap here to hide</small>`
      : `<h4>HOW TO SHANK</h4><b>WASD</b> move · <b>Mouse</b> look · <b>Shift</b> walk quietly<br><b>Left click</b> shank (3-hit combo) · <b>Double-click / E</b> finisher · <b>Right click</b> heavy stab<br><b>Double-tap A / D / S</b> or <b>Space</b> dash · <b>Double-tap W</b> sprint · <b>F</b> inspect<br><small>Click to hide · Backstabs do double damage</small>`;
    t.classList.add('on');
    const hide = () => { t.classList.remove('on'); profile.settings.tutorial = false; save(); };
    t.onclick = hide; t.ontouchstart = hide; clearTimeout(this.tutT); this.tutT = setTimeout(() => t.classList.remove('on'), 14000);
  }
  hud(s) {
    const hp = Math.ceil(s.hp);
    if (hp !== this._hp) { this._hp = hp; $('#hpNum').textContent = hp; $('#hpBar').style.width = hp + '%'; $('.hp').classList.toggle('low', hp <= 35); $('#lowhp').style.opacity = hp > 0 && hp <= 35 ? (1 - hp / 35) * 0.9 + 0.2 : 0; }
    const tm = Math.ceil(s.time), ts = `${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`;
    if (ts !== this._ts) { this._ts = ts; $('#sbTime').textContent = ts; }
    $('#abDash i').style.transform = `scaleX(${Math.max(0, Math.min(1, s.dash))})`;
    $('#abSprint').classList.toggle('on', s.sprint);
    $('#finPrompt').classList.toggle('on', s.finisher);
    if (s.finisher && !this._fin) { this._fin = true; $('#finText').textContent = this.app.input.touch ? 'DOUBLE TAP' : 'DOUBLE-CLICK'; A.beep(1600, 0.05, 0.12, 'triangle'); }
    if (!s.finisher) this._fin = false;
  }
  roundIntro(round, score) {
    $('#sbRound').textContent = `ROUND ${round}`; $('#sbMe').textContent = score[0]; $('#sbOp').textContent = score[1];
    $('#roundRes').classList.remove('on');
    this.banner(`ROUND ${round}`, '#fff');
  }
  countdown(v) { const c = $('#countdown'); c.textContent = v; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  roundResult(res, reason, score, over) {
    $('#sbMe').textContent = score[0]; $('#sbOp').textContent = score[1];
    const r = $('#roundRes');
    const txt = res === 'win' ? 'ROUND WON' : res === 'lose' ? 'ROUND LOST' : 'DRAW';
    const why = { finisher: 'Finisher', backstab: 'Backstab', slash1: 'Slashed', slash2: 'Slashed', stab: 'Stabbed', heavy: 'Heavy stab', Time: 'Time ran out' }[reason] || '';
    r.innerHTML = `<h2 style="color:${res === 'win' ? '#5fd3ff' : res === 'lose' ? '#ff2d55' : '#fff'}">${txt}</h2><p>${why}${over ? '' : ` · ${score[0]} – ${score[1]}`}</p>`;
    setTimeout(() => { r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); }, 700);
  }
  banner(text, color) { const b = $('#banner'); b.textContent = text; b.style.setProperty('--c', color); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  toast(text, ms = 800) { const t = $('#toast'); t.textContent = text; t.classList.add('on'); clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('on'), ms); }
  dashFlash() { const a = $('#abDash'); a.style.transform = 'scale(1.15)'; setTimeout(() => (a.style.transform = ''), 120); }
  hitMarker(dmg, crit) {
    const m = $('#hitmark'); m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
    const d = $('#dmgnum'); d.textContent = dmg; d.classList.toggle('crit', crit); d.style.left = `${52 + Math.random() * 6}%`; d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
  }
  hurt(k) {
    const el = $('#hurt'); el.style.transition = 'none'; el.style.opacity = Math.min(1, 0.45 + k * 0.5);
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.9s ease-out'; el.style.opacity = 0; });
    if (navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(Math.min(120, 30 + k * 60)); } catch (e) { /* unsupported */ }
  }
  killfeed(a, b, item, how) {
    const kf = h(`<div class="kf"><span class="${a === 'You' ? 'me' : 'op'}">${a}</span><img src="${this.app.thumbs.knife(item, 120, 60)}" alt="">${how === 'finisher' || how === 'backstab' ? `<em>${how.toUpperCase()}</em>` : ''}<span class="${b === 'You' ? 'me' : 'op'}">${b}</span></div>`);
    $('#killfeed').prepend(kf); setTimeout(() => kf.remove(), 7000);
  }
  joy(j, dx, dy) {
    const el = $('#joy');
    if (!j) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.style.left = j.x + 'px'; el.style.top = j.y + 'px';
    el.querySelector('i').style.transform = `translate(${dx}px, ${dy}px)`;
  }
  matchOver(win, score, stats, reward) {
    const r = rankOf(profile);
    $('#resultBox').innerHTML = `<h1 style="color:${win ? '#ffd23a' : '#ff2d55'}">${win ? 'VICTORY' : 'DEFEAT'}</h1>
      <div class="score">${score[0]} – ${score[1]}</div>
      <div class="reward"><div><b>+${reward.coins}</b>coins</div>${reward.chest ? '<div><b>+1</b>chest</div>' : ''}<div><b style="color:${r.color}">${r.name}</b>${r.placement ? `${r.placement} placements left` : `${Math.round(r.pct * 100)}% win rate`}</div><div><b>${profile.wins}–${profile.losses}</b>W–L</div></div>
      <div class="reward" style="font-size:12px;opacity:.8"><div><b>${stats.hits}</b>hits</div><div><b>${stats.backstabs}</b>backstabs</div><div><b>${stats.finishers}</b>finishers</div><div><b>${stats.dashDodges}</b>dodges</div></div>
      <div class="result-actions"><button class="btn play" id="againBtn">PLAY AGAIN</button><button class="btn ghost" id="homeBtn">HOME</button></div>`;
    this.overlay('result', true);
    $('#againBtn').onclick = () => { A.uiClick(); this.overlay('result', false); this.app.queue(); };
    $('#homeBtn').onclick = () => { A.uiClick(); this.overlay('result', false); this.app.toMenu(); };
  }

  // ---------- modal ----------
  settings(inMatch = false) {
    const s = profile.settings;
    $('#modalBox').innerHTML = `<h2>${inMatch ? 'PAUSED' : 'SETTINGS'}</h2>
      <label>Look sensitivity <input type="range" id="sSens" min="0.3" max="2.5" step="0.05" value="${s.sens}"></label>
      <label>Volume <input type="range" id="sVol" min="0" max="1" step="0.05" value="${s.vol}"></label>
      <label>Graphics <select id="sQ"><option value="high">High</option><option value="low">Low (faster)</option></select></label>
      <div class="controls-list">${this.app.input.touch
        ? '<b>Left thumb</b> move · <b>Right drag</b> look<br><b>Tap/swipe</b> shank · <b>Double tap</b> finisher<br><b>Double swipe ←→↓</b> dash · <b>↑↑</b> sprint'
        : '<b>WASD</b> move · <b>Mouse</b> look · <b>Shift</b> walk<br><b>LMB</b> shank · <b>Double-click/E</b> finisher · <b>RMB</b> heavy<br><b>Double-tap A/D/S</b> or <b>Space</b> dash · <b>W W</b> sprint · <b>F</b> inspect'}</div>
      <div class="row">${inMatch ? '<button class="btn" id="mResume">RESUME</button><button class="btn pink" id="mQuit">FORFEIT</button>' : '<button class="btn" id="mClose">DONE</button><button class="btn ghost small" id="mTut">SHOW TUTORIAL</button>'}</div>`;
    $('#sQ').value = s.quality;
    $('#sSens').oninput = e => { s.sens = +e.target.value; this.app.input.sens = s.sens; save(); };
    $('#sVol').oninput = e => { s.vol = +e.target.value; A.setVolume(s.vol); save(); };
    $('#sQ').onchange = e => { s.quality = e.target.value; save(); this.app.applyQuality(); };
    this.overlay('modal', true);
    if (inMatch) { $('#mResume').onclick = () => { this.overlay('modal', false); this.app.resume(); }; $('#mQuit').onclick = () => { this.overlay('modal', false); this.app.forfeit(); }; }
    else { $('#mClose').onclick = () => { A.uiClick(); this.overlay('modal', false); }; $('#mTut').onclick = () => { s.tutorial = true; save(); this.toast?.('Tutorial on for next match'); this.overlay('modal', false); }; }
  }
}
