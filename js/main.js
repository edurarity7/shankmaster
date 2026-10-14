import * as THREE from 'three';
import { profile, save, equippedItem, rankOf, botName, rollItem, RANKS, PLACEMENT_GAMES, randomOutfit, dailyTick, addXp, levelReward, rollDrip, DRIP, WIN_CHEST_WINS } from './data.js';
import { GameMap } from './map.js';
import { BloodFX, ScreenBlood } from './fx.js';
import { ViewModel } from './viewmodel.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Thumbs } from './thumbs.js';
import { Match } from './game.js';
import { MenuStage } from './menu.js';
import { ChestReveal } from './reveal.js';
import { Post } from './post.js';
import { makeEnvScene } from './textures.js';
import { updateKnifeFX } from './knives.js';
export const VERSION = 'v0.3';
import * as A from './audio.js';

const canvas = document.getElementById('gl');
const tick = () => new Promise(r => setTimeout(r, 0));

class App {
  async init() {
    this.ui = new UI(this);
    this.ui.loading(0.05); await tick();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(makeEnvScene(), 0.03).texture;
    // world
    this.scene = new THREE.Scene(); this.scene.environment = this.env;
    this.scene.fog = new THREE.Fog(0x9fb8f0, 38, 150);
    this.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 600);
    this.scene.add(new THREE.HemisphereLight(0xcfdcff, 0x5a7a4a, 1.2));
    const sun = this.sun = new THREE.DirectionalLight(0xffdcae, 2.9);
    sun.position.set(30, 30, -42); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 140 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.ui.loading(0.2, 'Building the endz…'); await tick();
    this.map = new GameMap(); this.scene.add(this.map.group);
    this.ui.loading(0.5, 'Spilling the blood…'); await tick();
    this.fx = new BloodFX(this.scene, profile.settings.quality);
    this.screen = new ScreenBlood(document.getElementById('screenBlood'));
    this.vm = new ViewModel(innerWidth / innerHeight); this.vm.setEnv(this.env);
    this.input = new Input(canvas, this.ui); this.input.sens = profile.settings.sens;
    this.thumbs = new Thumbs();
    this.ui.loading(0.7, 'Polishing the drip…'); await tick();
    this.menu = new MenuStage(this.env); this.menu.active = true;
    this.reveal = new ChestReveal(this.env);
    this.post = new Post(this.renderer);
    this.loadoutChanged();
    this.applyQuality();
    this.ui.loading(1, 'Ready.'); await tick();
    addEventListener('resize', () => this.resize()); this.resize();
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.match && this.match.state !== 'over' && !this.paused && !this.input.touch) this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !window.__test && this.match && this.match.state !== 'over') this.pause(); });
    const unlock = () => { A.initAudio(profile.settings.vol); A.ambience(this.mode === 'match'); };
    addEventListener('pointerdown', unlock); addEventListener('touchstart', unlock, { passive: true }); addEventListener('keydown', unlock);
    const dailyReady = dailyTick();
    this.mode = 'menu';
    this.ui.go('lobby');
    if (dailyReady) setTimeout(() => { if (this.mode === 'menu' && this.ui.screen === 'lobby') this.ui.daily(); }, 700);
    this.clock = new THREE.Clock(); this.loop();
    document.fonts?.ready.then(() => this.ui.refreshLobby());
  }
  applyQuality() {
    const high = profile.settings.quality === 'high';
    this.usePost = high;
    this.pr = Math.min(devicePixelRatio, high ? 1.75 : 1.25);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.shadowMap.enabled = high; this.sun.castShadow = high;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vm.camera.aspect = this.camera.aspect; this.vm.camera.updateProjectionMatrix();
    this.post?.resize(w, h, this.pr);
  }

  // ---------- menu ----------
  menuMode(m) { this.menu.mode = m; }
  loadoutChanged() { this.menu.setCharacter(profile.outfit, equippedItem()); this.menu.setKnife(equippedItem()); }
  previewOutfit(o) { this.menu.setCharacter(o || profile.outfit, equippedItem()); }
  addXp(n) { const lv = addXp(n); this.applyLevels(lv); return lv; }
  applyLevels(levels) {
    return levels.map(l => {
      const r = levelReward(l);
      if (r.type === 'coins') { profile.coins += r.amount; return `+${r.amount} <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b>`; }
      if (r.type === 'chest') { profile.chests++; return '+1 🧰'; }
      const id = rollDrip('restricted'); if (id) { profile.drip.push(id); return `🧥 ${DRIP[id].name}`; }
      profile.coins += 300; return '+300 <b class="coin" style="width:14px;height:14px;vertical-align:-2px"></b>';
    });
  }
  startReveal(item, tier, cb) { this.mode = 'reveal'; this.reveal.start(item, tier, cb); }
  endReveal() { this.mode = 'menu'; this.loadoutChanged(); }

  // ---------- matchmaking ----------
  queue() {
    A.initAudio(profile.settings.vol);
    this.ui.mm('search');
    clearTimeout(this.mmT);
    this.mmT = setTimeout(() => {
      const r = rankOf(profile), games = profile.wins + profile.losses;
      const diff = games < PLACEMENT_GAMES ? 0.25 + games * 0.05 : Math.max(0.25, Math.min(0.95, 0.15 + r.pct * 0.9));
      const ti = Math.max(0, Math.min(RANKS.length - 1, (r.idx < 0 ? 1 : r.idx) + Math.round(Math.random() * 2 - 1))), tier = { ...RANKS[ti], idx: ti };
      const opp = { name: botName(), outfit: randomOutfit(), item: rollItem(), rank: tier, difficulty: diff };
      this.ui.mm('found', opp);
      this.mmT = setTimeout(() => { this.ui.mm('hide'); this.startMatch(opp); }, 2300);
    }, 1400 + Math.random() * 2000);
  }
  cancelQueue() { clearTimeout(this.mmT); this.ui.mm('hide'); }
  startMatch(opp) {
    this.mode = 'match'; this.menu.active = false;
    this.camera.fov = 80; this.camera.updateProjectionMatrix();
    const matchUI = Object.create(this.ui);
    matchUI.matchOver = (win, score, stats, earned) => this.finishMatch(win, score, stats, earned, opp);
    this.input.enabled = true; this.input.reset();
    this.ui.startHud(opp.name);
    this.match = new Match({
      scene: this.scene, camera: this.camera, vm: this.vm, map: this.map, fx: this.fx, screen: this.screen, ui: matchUI, input: this.input,
      me: { outfit: profile.outfit, item: equippedItem() }, opponent: opp, difficulty: opp.difficulty, finisher: profile.equipped.finisher,
    });
    A.ambience(true);
    if (!this.input.touch) canvas.requestPointerLock?.()?.catch?.(() => {});
  }
  finishMatch(win, score, stats, earned, opp) {
    this.input.enabled = false; document.exitPointerLock?.();
    const rankBefore = rankOf(profile);
    profile.matches = (profile.matches || 0) + 1;
    if (win) { profile.wins++; profile.streak = Math.max(1, profile.streak + 1); } else { profile.losses++; profile.streak = Math.min(-1, profile.streak - 1); }
    profile.best = Math.max(profile.best, profile.streak);
    const coins = earned + (win ? 100 + Math.min(100, (profile.streak - 1) * 25) : 30);
    profile.coins += coins;
    const xp = (win ? 150 : 60) + stats.hits * 3 + stats.kills * 20 + stats.finishers * 25;
    const levelBefore = profile.level, xpBefore = profile.xp;
    const levels = addXp(xp), levelRewards = this.applyLevels(levels);
    let chestEarned = false;
    if (win) { profile.winChest++; if (profile.winChest >= WIN_CHEST_WINS) { profile.winChest = 0; profile.chests++; chestEarned = true; } }
    const add = { wins: win ? 1 : 0, matches: 1, ...stats };
    const questsDone = [];
    profile.quests.list.forEach(q => { const before = q.prog >= q.goal; q.prog += add[q.stat] || 0; if (!before && q.prog >= q.goal) questsDone.push(q.text); });
    profile.history.unshift({ t: Date.now(), win, score, opp: opp.name }); profile.history.length = Math.min(profile.history.length, 30);
    save();
    const rankAfter = rankOf(profile), rankUp = rankAfter.idx > rankBefore.idx ? rankAfter : null;
    this.ui.showResult({ win, score, stats, coins, xp, levels, levelRewards, levelBefore, xpBefore, chestEarned, questsDone, rankUp });
  }
  pause() {
    if (!this.match || this.paused || this.match.state === 'over') return;
    this.paused = true; this.input.enabled = false; this.ui.settings(true);
  }
  resume() { this.paused = false; this.input.enabled = true; this.input.reset(); if (!this.input.touch) canvas.requestPointerLock?.()?.catch?.(() => {}); this.clock.getDelta(); }
  forfeit() {
    this.paused = false;
    if (this.match) { const m = this.match; m.state = 'over'; this.finishMatch(false, [m.score[0], 3], m.stats, m.earned, { name: m.op.name }); }
  }
  toMenu() {
    if (this.match) { this.match.dispose(); this.match = null; }
    this.input.enabled = false; this.fx.clear(); this.screen.clear();
    document.getElementById('lowhp').style.opacity = 0;
    this.mode = 'menu'; this.menu.active = true; A.ambience(false);
    this.ui.tabName = 'home'; this.ui.go('lobby');
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    this.frame(Math.min(0.05, this.clock.getDelta()));
  }
  // If a phone can't hold ~40fps with bloom for a few seconds, drop to Fast graphics automatically.
  watchPerf(dt) {
    if (!this.usePost || window.__test || document.hidden) return;
    this.perf = (this.perf || 0) * 0.97 + dt * 0.03;
    this.slowT = this.perf > 1 / 38 ? (this.slowT || 0) + dt : 0;
    if (this.slowT > 3) { profile.settings.quality = 'low'; save(); this.applyQuality(); this.ui.gToast('⚡ Switched to Fast graphics for smoother play'); }
  }
  frame(dt) {
    const aspect = innerWidth / innerHeight;
    this.time = (this.time || 0) + dt; updateKnifeFX(this.time);
    let scene, cam, over = null, overCam = null;
    if (this.mode === 'match' && this.match) {
      if (!this.paused) this.match.update(dt);
      this.watchPerf(dt);
      scene = this.scene; cam = this.camera;
      if (!this.match.me.dead) { over = this.vm.scene; overCam = this.vm.camera; }
    } else if (this.mode === 'reveal') {
      this.reveal.update(dt, aspect); scene = this.reveal.scene; cam = this.reveal.camera;
    } else {
      this.menu.update(dt, aspect); scene = this.menu.scene; cam = this.menu.camera;
    }
    if (this.usePost) { this.post.set(scene, cam, over, overCam); this.post.render(dt); }
    else {
      const r = this.renderer; r.autoClear = false; r.clear(); r.render(scene, cam);
      if (over) { r.clearDepth(); r.render(over, overCam); }
    }
  }
}

// Testers: any crash shows a friendly reload chip instead of a frozen screen.
let crashShown = false;
const crash = (msg) => {
  if (crashShown) return; crashShown = true; console.error(msg);
  const d = document.createElement('div'); d.className = 'crash'; d.innerHTML = `<b>Something broke 🔪</b><small>${String(msg).slice(0, 120)}</small><button onclick="location.reload()">RELOAD</button>`; document.body.append(d);
};
addEventListener('error', e => crash(e.message)); addEventListener('unhandledrejection', e => crash(e.reason?.message || e.reason));
const app = new App();
window.__app = app;
app.init().catch(e => { console.error(e); document.querySelector('#loadHint').textContent = 'Failed to load: ' + e.message; });
