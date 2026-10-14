import * as THREE from 'three';
import { profile, save, equippedItem, rankOf, botName, rollItem, CHARACTERS, RANKS, PLACEMENT_GAMES } from './data.js';
import { GameMap } from './map.js';
import { BloodFX, ScreenBlood } from './fx.js';
import { ViewModel } from './viewmodel.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Thumbs } from './thumbs.js';
import { Character } from './characters.js';
import { buildKnife } from './knives.js';
import { makeEnvScene } from './textures.js';
import { Match } from './game.js';
import * as A from './audio.js';

const canvas = document.getElementById('gl');

const tick = () => new Promise(r => setTimeout(r, 0));

class App {
  async init() {
    this.ui = new UI(this);
    this.ui.loading(0.05); await tick();
    const q = profile.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc59ae6, 35, 140);
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 600);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(makeEnvScene(), 0.03).texture; this.scene.environment = this.env;
    // lights: purple dusk sky, warm sun
    this.scene.add(new THREE.HemisphereLight(0xd6c4ff, 0x5a7a4a, 1.25));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
    sun.position.set(18, 30, 12); sun.target.position.set(0, 0, 0);
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 90 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.ui.loading(0.25); await tick();
    this.map = new GameMap(q); this.scene.add(this.map.group);
    this.ui.loading(0.55); await tick();
    this.fx = new BloodFX(this.scene, q);
    this.screen = new ScreenBlood(document.getElementById('screenBlood'));
    this.vm = new ViewModel(innerWidth / innerHeight); this.vm.setEnv(this.env);
    this.input = new Input(canvas, this.ui); this.input.sens = profile.settings.sens;
    this.thumbs = new Thumbs();
    this.ui.loading(0.75); await tick();
    // menu showcase: your character in the street + a giant floating knife
    this.show = new THREE.Group(); this.scene.add(this.show);
    this.showLight = new THREE.SpotLight(0xffffff, 40, 12, 0.5, 0.6, 1.5); this.scene.add(this.showLight, this.showLight.target);
    this.loadoutChanged();
    this.applyQuality();
    this.ui.loading(1); await tick();
    addEventListener('resize', () => this.resize()); this.resize();
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.match && this.match.state !== 'over' && !this.paused && !this.input.touch) this.pause(); });
    const unlock = () => { A.initAudio(profile.settings.vol); A.ambience(true); };
    addEventListener('pointerdown', unlock, { once: false }); addEventListener('touchstart', unlock, { passive: true }); addEventListener('keydown', unlock);
    this.ui.go('home');
    this.clock = new THREE.Clock(); this.loop();
    document.fonts?.ready.then(() => this.ui.screen === 'home' && this.ui.renderHome());
  }
  applyQuality() {
    const high = profile.settings.quality === 'high';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1.25));
    this.renderer.shadowMap.enabled = high; this.sun.castShadow = high;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.vm.camera.aspect = this.camera.aspect; this.vm.camera.updateProjectionMatrix();
  }

  // ---------- menu showcase ----------
  loadoutChanged() {
    this.show.clear();
    const s = this.map.menuSpot, item = equippedItem();
    this.showChar = new Character(profile.equipped.character, item);
    this.showChar.root.position.set(s.x, 0, s.z); this.showChar.root.rotation.y = Math.PI + 0.5;
    this.showChar.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.show.add(this.showChar.root);
    this.showcaseItem(item);
  }
  showcaseItem(item) {
    if (this.showKnife) this.show.remove(this.showKnife);
    const k = buildKnife(item); k.scale.setScalar(4);
    k.traverse(o => { if (o.material) { o.material.envMap = this.env; o.material.needsUpdate = true; } });
    this.showKnife = k; this.show.add(k); this.inspectT = 0;
  }
  showcaseChar(id) {
    if (this.showChar) this.show.remove(this.showChar.root);
    this.showChar = new Character(id, equippedItem());
    const s = this.map.menuSpot; this.showChar.root.position.set(s.x, 0, s.z); this.showChar.root.rotation.y = Math.PI + 0.5;
    this.showChar.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.show.add(this.showChar.root);
  }
  inspectShowcase() { this.inspectT = 1; A.flipClick(); setTimeout(A.flipClick, 260); }
  menuView(name) { this.menuMode = name; }
  updateMenu(dt, t) {
    const s = this.map.menuSpot, locker = this.menuMode === 'locker' && this.ui.lockerTab === 'knives', store = this.menuMode === 'store';
    this.showChar.update(dt, { speed: 0 });
    this.showChar.arms[1].sh.rotation.x = 0.9 + Math.sin(t * 1.3) * 0.05;
    // knife floats next to the character
    const portrait = this.camera.aspect < 1;
    const k = this.showKnife, kp = locker ? new THREE.Vector3(s.x + 1.7, 1.55, s.z + 1.2)
      : portrait ? new THREE.Vector3(s.x + 1.2, 2.45, s.z + 0.4) : new THREE.Vector3(s.x + 1.55, 1.45, s.z + 0.9);
    k.position.lerp(kp, Math.min(1, dt * 5));
    this.inspectT = Math.max(0, this.inspectT - dt * 0.7);
    k.rotation.set(0.25 + Math.sin(t * 0.9) * 0.15, t * 0.6 + this.inspectT * Math.PI * 4, 0.5 + Math.sin(t * 0.7) * 0.1);
    k.visible = this.menuMode !== 'locker' || this.ui.lockerTab === 'knives' || true;
    // camera
    const cam = this.camera;
    const want = locker ? new THREE.Vector3(s.x + 3.4, 1.65, s.z + 3.6) : store ? new THREE.Vector3(s.x + 2.5, 2.2, s.z + 7) : (portrait ? new THREE.Vector3(s.x + 1.6, 1.5, s.z + 5.6) : new THREE.Vector3(s.x + 2.3 + Math.sin(t * 0.15) * 0.3, 1.65, s.z + 3.6));
    const look = locker ? kp.clone().add(new THREE.Vector3(-0.35, 0, 0)) : new THREE.Vector3(s.x + (portrait ? 0.7 : 0.95), portrait ? 1.35 : 1.2, s.z);
    cam.position.lerp(want, Math.min(1, dt * 3)); cam.fov += ((locker ? 40 : 55) - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
    this._look = (this._look || look.clone()).lerp(look, Math.min(1, dt * 4)); cam.lookAt(this._look);
    this.showLight.position.set(kp.x + 1.5, kp.y + 3, kp.z + 2); this.showLight.target.position.copy(kp);
  }

  // ---------- matchmaking ----------
  queue() {
    A.initAudio(profile.settings.vol);
    this.ui.mm('search');
    clearTimeout(this.mmT);
    const wait = 1600 + Math.random() * 2400;
    this.mmT = setTimeout(() => {
      const r = rankOf(profile), games = profile.wins + profile.losses;
      const diff = games < PLACEMENT_GAMES ? 0.3 + games * 0.05 : Math.max(0.25, Math.min(0.95, 0.15 + r.pct * 0.9));
      const chars = Object.keys(CHARACTERS);
      const tier = RANKS[Math.max(0, Math.min(RANKS.length - 1, (r.idx < 0 ? 1 : r.idx) + Math.round(Math.random() * 2 - 1)))];
      const opp = { name: botName(), character: chars[Math.floor(Math.random() * chars.length)], item: rollItem(), rank: tier, difficulty: diff };
      this.ui.mm('found', opp);
      this.mmT = setTimeout(() => { this.ui.mm('hide'); this.startMatch(opp); }, 2200);
    }, wait);
  }
  cancelQueue() { clearTimeout(this.mmT); this.ui.mm('hide'); }
  startMatch(opp) {
    this.show.visible = false; this.showLight.visible = false;
    this.camera.fov = 78; this.camera.updateProjectionMatrix();
    const matchUI = Object.create(this.ui);
    matchUI.matchOver = (win, score, stats) => this.finishMatch(win, score, stats, opp);
    this.input.enabled = true; this.input.reset();
    this.ui.startHud(opp.name, equippedItem());
    this.match = new Match({
      scene: this.scene, camera: this.camera, vm: this.vm, map: this.map, fx: this.fx, screen: this.screen, ui: matchUI, input: this.input,
      profile: { ...profile, item: equippedItem() }, opponent: opp, difficulty: opp.difficulty, finisher: profile.equipped.finisher,
    });
    if (!this.input.touch) canvas.requestPointerLock?.()?.catch?.(() => {});
  }
  finishMatch(win, score, stats, opp) {
    this.input.enabled = false; document.exitPointerLock?.();
    if (win) { profile.wins++; profile.streak = Math.max(1, profile.streak + 1); } else { profile.losses++; profile.streak = Math.min(-1, profile.streak - 1); }
    profile.best = Math.max(profile.best, profile.streak);
    const coins = win ? 100 + Math.min(100, (profile.streak - 1) * 25) : 30;
    const chest = win && Math.random() < 0.4;
    profile.coins += coins; if (chest) profile.chests++;
    profile.history.unshift({ t: Date.now(), win, score, opp: opp.name }); profile.history.length = Math.min(profile.history.length, 30);
    save();
    this.ui.matchOver.call(this.ui, win, score, stats, { coins, chest });
  }
  pause() {
    if (!this.match || this.paused) return;
    this.paused = true; this.input.enabled = false; this.ui.settings(true);
  }
  resume() { this.paused = false; this.input.enabled = true; this.input.reset(); if (!this.input.touch) canvas.requestPointerLock?.()?.catch?.(() => {}); this.clock.getDelta(); }
  forfeit() {
    this.paused = false;
    if (this.match) { const m = this.match; m.matchOver = true; m.state = 'over'; this.finishMatch(false, [m.score[0], Math.max(m.score[1], 3)], m.stats, m.op); }
  }
  toMenu() {
    if (this.match) { this.match.dispose(); this.match = null; }
    this.input.enabled = false; this.fx.clear(); this.screen.clear();
    this.show.visible = true; this.showLight.visible = true;
    document.getElementById('lowhp').style.opacity = 0;
    this.ui.go('home');
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    const r = this.renderer;
    r.clear();
    if (this.match && !this.paused) {
      this.match.update(dt);
      r.render(this.scene, this.camera);
      if (!this.match.me.dead) { r.clearDepth(); r.render(this.vm.scene, this.vm.camera); }
    } else if (this.match) {
      r.render(this.scene, this.camera); r.clearDepth(); r.render(this.vm.scene, this.vm.camera);
    } else {
      this.updateMenu(dt, t);
      this.fx.update(dt);
      r.render(this.scene, this.camera);
    }
  }
}

const app = new App();
window.__app = app; // handy for debugging in the console
app.init().catch(e => { console.error(e); document.querySelector('#loading .hint').textContent = 'Failed to load: ' + e.message; });
