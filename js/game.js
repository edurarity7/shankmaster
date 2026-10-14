// Match logic: fighters, movement physics, combat, pickups, rounds, bot AI.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Character } from './characters.js';
import { FINISHERS } from './data.js';
import { STEP } from './map.js';
import * as A from './audio.js';
import { BotBrain } from './bot.js';
import { save } from './data.js';

const WALK = 2.4, RUN = 5.4, SPRINT = 8.0, DASH_SPEED = 17, DASH_T = 0.2, DASH_IFRAME = 0.18, DASH_CD = 0.8;
const GRAV = 24, JUMP_V = 7.6, COYOTE = 0.12, JUMP_BUF = 0.14;
const EYE = 1.62, ROUNDS_TO_WIN = 3, ROUND_TIME = 75;
const ATK = {
  slash1: { hitAt: 0.13, dur: 0.42, dmg: 26, range: 2.2, cone: 1.05, back: 1.8, kind: 'slash1' },
  slash2: { hitAt: 0.13, dur: 0.42, dmg: 26, range: 2.2, cone: 1.05, back: 1.8, kind: 'slash2' },
  stab:   { hitAt: 0.2,  dur: 0.56, dmg: 42, range: 2.35, cone: 0.6, back: 2.0, kind: 'stab' },
  heavy:  { hitAt: 0.34, dur: 0.82, dmg: 62, range: 2.35, cone: 0.6, back: 9,   kind: 'heavy' },
};
const COMBO = ['slash1', 'slash2', 'stab'];
const FIN_DUR = 1.25, FIN_HP = 40;
const PICKUPS = { chicken: { name: 'CHICKEN BOX', color: 0xff3b2e }, drink: { name: 'ENERGY DRINK', color: 0x2ee6ff } };

const fwdOf = (yaw, out = new THREE.Vector3()) => out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const buzz = ms => { if (navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(ms); } catch (e) { /* unsupported */ } };
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

class Fighter {
  constructor(isBot, outfit, item, name) {
    this.isBot = isBot; this.name = name; this.item = item;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
    this.model = new Character(outfit, item);
    this.reset();
  }
  reset() {
    this.hp = 100; this.dead = false; this.atk = null; this.combo = 0; this.comboT = 0; this.queued = false;
    this.dashT = 0; this.dashCd = 0; this.dashDir = new THREE.Vector3(); this.sprint = false; this.sprintT = 0;
    this.stun = 0; this.stepT = 0; this.finLock = false; this.speed = 0; this.noise = 0; this.lunge = 0;
    this.vy = 0; this.grounded = true; this.coyote = 0; this.jumpBuf = 0; this.airDash = false; this.boost = 0; this.vel.set(0, 0, 0);
  }
  get dashing() { return this.dashT > 0; }
  get iframe() { return this.dashT > DASH_T - DASH_IFRAME; }
}

export class Match {
  constructor({ scene, camera, vm, map, fx, screen, ui, input, me, opponent, difficulty, finisher }) {
    Object.assign(this, { scene, camera, vm, map, fx, screen, ui, input, difficulty, finisher });
    this.me = new Fighter(false, me.outfit, me.item, 'You');
    this.op = new Fighter(true, opponent.outfit, opponent.item, opponent.name);
    this.op.model.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.op.model.root);
    this.brain = new BotBrain(this);
    this.score = [0, 0]; this.round = 0; this.state = 'intro'; this.stateT = 0; this.timeScale = 1; this.hitstop = 0;
    this.shake = 0; this.fov = 80; this.dip = 0; this.camRoll = 0; this.deathCam = 0; this.myCombo = 0; this.myComboT = 0;
    this.stats = { hits: 0, taken: 0, finishers: 0, backstabs: 0, dashDodges: 0, airHits: 0, pickups: 0, kills: 0, damage: 0 };
    this.earned = 0;
    this.pickups = []; this.pickupGroup = new THREE.Group(); scene.add(this.pickupGroup);
    vm.setLoadout(me.outfit, me.item);
    this.startRound();
  }
  dispose() { this.op.model.dispose(); this.scene.remove(this.pickupGroup); }

  // ---------- rounds ----------
  startRound() {
    this.round++;
    const pairs = this.map.spawns, pair = pairs[Math.floor(Math.random() * pairs.length)], swap = Math.random() < 0.5;
    const [a, b] = swap ? [pair[1], pair[0]] : pair;
    [[this.me, a], [this.op, b]].forEach(([f, s]) => {
      f.reset(); f.pos.set(s.x, this.map.groundAt(s.x, s.z, 5).h, s.z); f.yaw = yawTo(f.pos, { x: 4, z: 0 }); f.pitch = 0; f.model.revive();
    });
    this.brain.reset();
    this.fx.clear(); this.screen.clear(); this.vm.blood = 0; this.vm.addBlood(0);
    this.vm.play('draw', 0.7); A.draw();
    this.spawnPickups();
    this.pingT = 0;
    this.state = 'countdown'; this.stateT = 3.2; this.deathCam = 0; this.camRoll = 0; this.timeScale = 1;
    this.ui.roundIntro(this.round, this.score);
    this.time = ROUND_TIME;
  }
  endRound(winner, reason) {
    if (this.state !== 'live') return;
    this.state = 'roundEnd'; this.stateT = 3.4;
    if (winner === this.me) this.score[0]++; else if (winner === this.op) this.score[1]++;
    const over = this.score[0] >= ROUNDS_TO_WIN || this.score[1] >= ROUNDS_TO_WIN;
    this.ui.roundResult(winner === this.me ? 'win' : winner ? 'lose' : 'draw', reason, this.score, over);
    if (winner === this.me) { A.winSting(); this.coins(20, 'ROUND'); } else if (winner) A.loseSting();
    this.matchOver = over;
  }
  ping() {
    const me = this.me, op = this.op;
    if (me.dead || op.dead) return;
    this.brain.hear?.(me.pos);
    const ang = Math.atan2(-(op.pos.x - me.pos.x), -(op.pos.z - me.pos.z)) - me.yaw;
    this.ui.ping?.(ang, Math.round(hdist(me.pos, op.pos)));
    A.ping?.();
  }
  coins(n, why) { this.earned += n; this.ui.coinPop(n, why); }

  // ---------- pickups ----------
  spawnPickups() {
    this.pickupGroup.clear(); this.pickups = [];
    const spots = [...this.map.pickupSpots].sort(() => Math.random() - 0.5).slice(0, 3);
    spots.forEach((s, i) => this.addPickup(s, i === 0 ? 'chicken' : Math.random() < 0.5 ? 'chicken' : 'drink'));
  }
  addPickup(spot, type) {
    const g = new THREE.Group();
    const col = PICKUPS[type].color;
    if (type === 'chicken') {
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.22, 0.3, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0xe8261c, roughness: 0.5 }));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.05, 0.31), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      const lid = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.04, 0.32, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0xffcc33 }));
      lid.position.y = 0.12; g.add(box, stripe, lid);
    } else {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0x1238c9, metalness: 0.8, roughness: 0.25, emissive: 0x0a3a6a }));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.08, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 2.6) }));
      g.add(can, band);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.5), transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 1.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2), transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.55;
    const holder = new THREE.Group(); holder.add(g, beam, ring);
    const y = spot.y ?? this.map.groundAt(spot.x, spot.z, 5).h;
    holder.position.set(spot.x, y + 0.6, spot.z);
    this.pickupGroup.add(holder);
    this.pickups.push({ spot, type, holder, item: g, y, alive: true, t: Math.random() * 6 });
  }
  tickPickups(dt) {
    for (const p of this.pickups) {
      p.t += dt;
      if (!p.alive) { p.respawn -= dt; if (p.respawn <= 0) { this.pickupGroup.remove(p.holder); this.pickups.splice(this.pickups.indexOf(p), 1); const free = this.map.pickupSpots.filter(s => !this.pickups.some(q => q.spot === s)); this.addPickup(free[Math.floor(Math.random() * free.length)], Math.random() < 0.55 ? 'chicken' : 'drink'); } continue; }
      p.item.rotation.y += dt * 2; p.item.position.y = Math.sin(p.t * 3) * 0.08;
      for (const f of [this.me, this.op]) {
        if (f.dead || this.state !== 'live') continue;
        if (hdist(f.pos, p.holder.position) < 0.95 && Math.abs(f.pos.y - p.y) < 1.2) this.grab(f, p);
      }
    }
  }
  grab(f, p) {
    if (p.type === 'chicken' && f.hp >= 100) return;
    p.alive = false; p.respawn = 12; p.holder.visible = false;
    if (p.type === 'chicken') f.hp = Math.min(100, f.hp + 35); else { f.boost = 6; f.dashCd = 0; }
    if (!f.isBot) { this.stats.pickups++; this.ui.pickup(PICKUPS[p.type].name, p.type); A.pickup(p.type); this.vm.flashColor?.(p.type === 'chicken' ? 0xff4444 : 0x2ee6ff); }
    else A.pickup(p.type, { x: f.pos.x, y: 1, z: f.pos.z });
  }

  // ---------- per-frame ----------
  update(rdt) {
    if (this.hitstop > 0) { this.hitstop -= rdt; rdt *= 0.08; }
    const dt = rdt * this.timeScale;
    this.timeScale += (1 - this.timeScale) * Math.min(1, rdt * 1.5);
    this.input.update(rdt);
    const look = this.input.takeLook(rdt);
    const me = this.me, op = this.op;
    if (!me.finLock && !me.dead) { me.yaw -= look.x; me.pitch = Math.max(-1.3, Math.min(1.3, me.pitch - look.y)); }
    if (look.x || look.y) this.ui.learn('look');
    const events = this.input.drain();
    if (this.state === 'countdown') {
      const before = Math.ceil(this.stateT); this.stateT -= rdt; const after = Math.ceil(this.stateT);
      if (after !== before && after > 0) { A.beep(660, 0.1, 0.25); this.ui.countdown(after); }
      if (this.stateT <= 0) { this.state = 'live'; this.ui.countdown('FIGHT!'); A.beep(1320, 0.25, 0.3); A.ambience(true); }
      events.filter(e => e.type === 'inspect').forEach(() => this.vm.play('inspect', 2.4));
    } else if (this.state === 'live') {
      this.time -= dt;
      // radar ping keeps rounds snappy: after 20s both sides learn roughly where the other is
      if (ROUND_TIME - this.time > 20) { this.pingT = (this.pingT ?? 0) - dt; if (this.pingT <= 0) { this.pingT = 10; this.ping(); } }
      this.handleEvents(events);
      this.brain.update(dt);
      if (this.time <= 0) this.endRound(me.hp > op.hp ? me : op.hp > me.hp ? op : null, 'Time');
    } else if (this.state === 'roundEnd') {
      this.stateT -= rdt;
      if (this.stateT <= 0) {
        if (this.matchOver) { this.state = 'over'; this.ui.matchOver(this.score[0] > this.score[1], this.score, this.stats, this.earned); }
        else this.startRound();
      }
    }
    if (this.state !== 'live') this.brain.intent = null;
    const frozen = this.state === 'countdown' || this.state === 'over';
    this.moveFighter(me, dt, frozen ? null : this.myMoveIntent());
    this.moveFighter(op, dt, frozen ? null : this.brain.intent);
    this.separate();
    this.tickAttack(me, op, dt); this.tickAttack(op, me, dt);
    this.footsteps(me, dt); this.footsteps(op, dt);
    this.tickPickups(dt);
    this.myComboT -= dt; if (this.myComboT <= 0) this.myCombo = 0;
    op.model.root.position.copy(op.pos); op.model.root.rotation.y = op.yaw;
    op.model.update(dt, { speed: Math.hypot(op.vel.x, op.vel.z), attack: op.atk ? { kind: op.atk.def.kind, t: op.atk.t / op.atk.def.dur } : null, dash: op.dashing, air: !op.grounded, vy: op.vy });
    this.map.update(performance.now() / 1000);
    this.fx.update(dt); this.screen.update(rdt);
    this.camera_(rdt, look);
    this.vm.update(dt, { speed: me.grounded ? Math.hypot(me.vel.x, me.vel.z) : 0, look, dashing: me.dashing, sprint: me.sprint && me.speed > 6, air: !me.grounded, dip: this.dip });
    this.hud();
  }
  myMoveIntent() {
    const m = this.input.move, me = this.me;
    if (me.dead || me.finLock) return null;
    const f = fwdOf(me.yaw), r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = new THREE.Vector3().addScaledVector(f, m.y).addScaledVector(r, m.x);
    let mag = Math.min(1, dir.length());
    if (mag > 0.05) this.ui.learn('move');
    if (this.input.sprintHeld && m.y > 0.2) { if (!me.sprint) { me.sprintAge = 0; this.ui.sprintFx(true); this.ui.learn('sprint'); } me.sprint = true; me.sprintT = Math.max(me.sprintT, 0.25); }
    if (me.sprint && (m.y < 0.2 || mag < 0.2) && (me.sprintAge || 0) > 0.2) { me.sprint = false; this.ui.sprintFx(false); }
    const base = me.sprint ? SPRINT : (this.input.walk ? WALK : RUN);
    const speed = base * (me.boost > 0 ? 1.25 : 1) * (this.input.joy && !me.sprint ? Math.max(mag, 0.4) : mag);
    return { dir: mag > 0.01 ? dir.normalize() : dir, speed };
  }
  handleEvents(events) {
    const me = this.me;
    if (me.dead || me.finLock) return;
    for (const e of events) {
      if (e.type === 'attack') { this.tryAttack(me, this.op); this.ui.learn('attack'); }
      else if (e.type === 'double') { if (this.tryFinisher(me, this.op)) this.ui.learn('finisher'); else this.tryAttack(me, this.op, 'heavy'); }
      else if (e.type === 'heavy') this.tryAttack(me, this.op, 'heavy');
      else if (e.type === 'dash') { if (this.dash(me, e.dir)) this.ui.learn('dash'); }
      else if (e.type === 'jump') { me.jumpBuf = JUMP_BUF; }
      else if (e.type === 'sprint') {
        // the first swipe of the double-swipe started a slash — cancel it so sprint takes over cleanly
        if (me.atk && !me.atk.hit) { me.atk = null; this.vm.cancel(); }
        me.sprint = true; me.sprintT = 8; me.sprintAge = 0; A.sprintStart(); this.ui.sprintFx(true); this.ui.learn('sprint');
      }
      else if (e.type === 'inspect' && !me.atk) { this.vm.play('inspect', 2.4); this.ui.learn('inspect'); }
    }
  }
  dash(f, dir) {
    if (f.dashCd > 0 || f.dead || f.finLock || (!f.grounded && f.airDash)) return false;
    const fw = fwdOf(f.yaw), r = new THREE.Vector3(-fw.z, 0, fw.x);
    if (dir === 'auto') { const mv = this.input.move; const d = new THREE.Vector3().addScaledVector(fw, mv.y).addScaledVector(r, mv.x); f.dashDir.copy(d.lengthSq() > 0.04 ? d.normalize() : fw.clone().negate()); }
    else f.dashDir.copy(dir === 'left' ? r.clone().negate() : dir === 'right' ? r : dir === 'forward' ? fw : fw.clone().negate());
    f.dashT = DASH_T; f.dashCd = DASH_CD; f.sprint = false;
    if (!f.grounded) { f.airDash = true; f.vy = Math.max(f.vy, 1.5); }
    if (f.atk && !(f.atk.hit && f.atk.t < f.atk.def.hitAt + 0.05)) { f.atk = null; if (!f.isBot) this.vm.cancel(); }
    f.noise = Math.max(f.noise, 10);
    A.dashSfx(f.isBot ? { x: f.pos.x, y: 1, z: f.pos.z } : null);
    if (!f.isBot) { this.fov += 14; this.ui.dashFx(); this.ui.sprintFx(false); }
    return true;
  }
  jump(f) {
    if (!(f.grounded || f.coyote > 0) || f.dead || f.finLock) return false;
    f.vy = JUMP_V * (f.boost > 0 ? 1.08 : 1); f.grounded = false; f.coyote = 0; f.jumpBuf = 0;
    A.jumpSfx(f.isBot ? { x: f.pos.x, y: 0.2, z: f.pos.z } : null);
    if (!f.isBot) this.ui.learn('jump');
    return true;
  }
  tryAttack(f, target, forced) {
    if (f.dead || f.finLock || f.stun > 0.15) return;
    if (f.atk) { if (!forced && f.atk.t > f.atk.def.hitAt) f.queued = true; return; }
    const kind = forced || COMBO[f.comboT > 0 ? f.combo % 3 : 0];
    if (!forced) f.combo = (f.comboT > 0 ? f.combo : 0) + 1;
    const def = ATK[kind];
    const extra = f.isBot ? (0.16 - 0.1 * this.difficulty) : 0;
    f.atk = { def: { ...def, hitAt: def.hitAt + extra, dur: def.dur + extra }, t: 0, hit: false };
    if (f.sprint) { f.lunge = 0.9; f.sprint = false; if (!f.isBot) this.ui.sprintFx(false); } // sprint-slash lunge
    f.noise = Math.max(f.noise, 8);
    const d = hdist(f.pos, target.pos), ad = Math.abs(angDiff(yawTo(f.pos, target.pos), f.yaw));
    if (!target.dead && d < 3.4 && ad < 0.8 && f.pos.y - target.pos.y < 2.3 && f.pos.y - target.pos.y > -1.5) {
      f.yaw += angDiff(yawTo(f.pos, target.pos), f.yaw) * (f.isBot ? 0.5 : 0.65);
      if (d > 1.5) f.lunge = Math.max(f.lunge, Math.min(0.6, d - 1.4));
    }
    if (!f.isBot) { this.vm.play(kind, f.atk.def.dur * 1.05); A.whoosh(kind === 'heavy' ? 1.4 : 1, null, kind === 'stab' ? 0.8 : 1); }
    else setTimeout(() => A.whoosh(1, { x: f.pos.x, y: 1.3, z: f.pos.z }), (f.atk.def.hitAt - 0.08) * 1000);
  }
  canFinish(f, t) {
    if (t.dead || t.hp > FIN_HP || f.atk?.def.kind === 'heavy') return false;
    const d = hdist(f.pos, t.pos), ad = Math.abs(angDiff(yawTo(f.pos, t.pos), f.yaw));
    return d < 2.8 && ad < 0.9 && Math.abs(f.pos.y - t.pos.y) < 1.2 && this.map.segClear(f.pos.x, f.pos.z, t.pos.x, t.pos.z, 1.0);
  }
  tryFinisher(f, t) {
    if (!this.canFinish(f, t) || t.iframe) return false;
    const fin = FINISHERS[f.isBot ? 'stitch' : this.finisher] || FINISHERS.stitch;
    f.finLock = t.finLock = true; f.atk = t.atk = null; f.sprint = false;
    f.yaw = yawTo(f.pos, t.pos); t.yaw = yawTo(t.pos, f.pos);
    this.timeScale = 0.45;
    const hitFx = (i, last) => {
      const dir = fwdOf(f.yaw).add(new THREE.Vector3(0, 0.2, 0)), at = t.pos.clone().setY(t.pos.y + 1.25);
      this.fx.burst(at, dir, last ? 2 : 1.2, fin.gold);
      if (fin.gold) { A.coin(); this.fx.burst(at, dir, 0.6, false); }
      last ? A.stab({ x: at.x, y: at.y, z: at.z }) : A.slice({ x: at.x, y: at.y, z: at.z });
      t.model.flash(); this.hitstop = 0.05;
      if (!f.isBot) { this.screen.splat(last ? 1.6 : 0.9, (Math.random() - 0.5)); this.vm.addBlood(0.3); this.shake = 0.3; A.grunt({ x: at.x, y: at.y, z: at.z }, 1.05); buzz(30); }
      else { this.hurtFx(0.9); A.hurt(); }
      if (last) this.kill(f, t, 'finisher');
    };
    if (!f.isBot) {
      this.stats.finishers++;
      this.ui.banner(fin.name.toUpperCase(), '#ffcc33');
      this.vm.playFinisher(fin.style, FIN_DUR * 0.6, hitFx, fin.hits);
    } else {
      this.ui.banner('FINISHED', '#ff3355');
      let i = 0; const n = 3;
      const step = () => { if (this.state !== 'live') return; hitFx(i, i === n - 1); i++; if (i < n) setTimeout(step, 260); };
      f.atk = { def: { ...ATK.slash1, dur: 1.0, hitAt: 99 }, t: 0, hit: true };
      setTimeout(step, 200);
    }
    return true;
  }
  tickAttack(f, t, dt) {
    f.comboT = Math.max(0, f.comboT - dt);
    f.dashCd = Math.max(0, f.dashCd - dt); f.stun = Math.max(0, f.stun - dt); f.noise = Math.max(0, f.noise - dt * 20); f.boost = Math.max(0, f.boost - dt);
    if (!f.atk) return;
    const a = f.atk; a.t += dt;
    if (!a.hit && a.t >= a.def.hitAt) { a.hit = true; this.resolveHit(f, t, a.def); }
    if (a.t >= a.def.dur) {
      f.atk = null; f.comboT = 0.55;
      if (f.combo >= 3) { f.combo = 0; f.comboT = 0; }
      if (f.queued) { f.queued = false; this.tryAttack(f, t); }
    }
  }
  resolveHit(f, t, def) {
    if (t.dead || f.dead) return;
    const d = hdist(f.pos, t.pos), dy = f.pos.y - t.pos.y;
    const ang = Math.abs(angDiff(yawTo(f.pos, t.pos), f.yaw));
    if (d > def.range || ang > def.cone || dy > 2.3 || dy < -1.4 || !this.map.segClear(f.pos.x, f.pos.z, t.pos.x, t.pos.z, Math.max(f.pos.y, t.pos.y) + 1.0)) return;
    if (t.iframe) { if (!t.isBot) { this.stats.dashDodges++; this.ui.toast('DODGED!', 600); A.dodge(); this.coins(3, 'DODGE'); } return; }
    const behind = Math.abs(angDiff(yawTo(t.pos, f.pos), t.yaw)) > 2.0;
    const air = !f.grounded && dy > 0.25;
    let dmg = def.dmg * (behind ? def.back : 1) * (air ? 1.35 : 1);
    dmg = Math.round(dmg * (0.92 + Math.random() * 0.16));
    t.hp = Math.max(0, t.hp - dmg);
    t.stun = 0.28; if (t.atk && !t.atk.hit) t.atk = null;
    t.pos.add(fwdOf(f.yaw).multiplyScalar(0.4)); this.map.resolve(t.pos, 0.38, t.pos.y);
    if (t.grounded) { t.vy = 2.2; t.grounded = false; } // little knock-up pop
    const right = new THREE.Vector3(-Math.cos(f.yaw), 0, Math.sin(f.yaw));
    const sweep = def.kind === 'slash1' ? right.clone().negate() : def.kind === 'slash2' ? right.clone() : fwdOf(f.yaw);
    const dir = sweep.multiplyScalar(0.8).add(fwdOf(f.yaw).multiplyScalar(0.6)).add(new THREE.Vector3(0, 0.15, 0));
    const at = t.pos.clone().setY(t.pos.y + (def.kind === 'stab' || def.kind === 'heavy' ? 1.15 : 1.3));
    this.fx.burst(at, dir, dmg / 30);
    const P = { x: at.x, y: at.y, z: at.z };
    def.kind === 'stab' || def.kind === 'heavy' ? A.stab(t.isBot ? P : null) : A.slice(t.isBot ? P : null);
    if (behind) { this.ui.banner('BACKSTAB!', '#ff3355'); if (!f.isBot) this.stats.backstabs++; }
    if (air) { this.ui.banner('AIR SHANK!', '#3de0ff'); if (!f.isBot) this.stats.airHits++; }
    this.hitstop = dmg > 40 ? 0.085 : 0.05;
    if (t.isBot) {
      this.stats.hits++; this.stats.damage += dmg;
      this.myCombo = this.myComboT > 0 ? this.myCombo + 1 : 1; this.myComboT = 1.6;
      t.model.flash(); A.grunt(P, 0.95 + Math.random() * 0.15); A.hitMarker(dmg > 40);
      this.vm.addBlood(0.18 + dmg / 300); this.shake = 0.14 + dmg / 260;
      if (d < 2.4) this.screen.splat(0.4 + dmg / 60, def.kind === 'slash1' ? -1 : def.kind === 'slash2' ? 1 : 0);
      const sp = at.clone().project(this.camera);
      this.ui.hit(dmg, behind || air, (sp.x + 1) / 2, (1 - sp.y) / 2, this.myCombo);
      this.coins(behind || air ? 10 : 5);
      if (this.input.touch) buzz(dmg > 40 ? 35 : 18);
    } else {
      this.stats.taken++;
      A.hurt(); this.hurtFx(dmg / 40, yawTo(t.pos, f.pos) - t.yaw);
      this.me.yaw += (Math.random() - 0.5) * 0.12; this.me.pitch += 0.05;
    }
    if (t.hp <= 0) this.kill(f, t, behind ? 'backstab' : air ? 'air' : def.kind);
  }
  hurtFx(k, fromAng = 0) {
    this.ui.hurt(k, fromAng); this.screen.splat(0.5 + k * 0.5, (Math.random() - 0.5) * 2); this.vm.flashHit(); this.shake = Math.max(this.shake, 0.22 + k * 0.15);
  }
  kill(f, t, how) {
    if (t.dead) return;
    t.dead = true; t.hp = 0; f.finLock = t.finLock = false; t.atk = null;
    const P = { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z };
    if (t.isBot) {
      const back = Math.abs(angDiff(yawTo(t.pos, f.pos), t.yaw)) < 1.6;
      t.model.kill(back); A.grunt(P, 0.8, true); setTimeout(() => A.thud(P), 450);
      const fall = fwdOf(t.yaw).multiplyScalar(back ? 1.0 : -1.0);
      setTimeout(() => this.fx.pool(t.pos.x + fall.x, t.pos.z + fall.z, t.pos.y), 500);
      if (f.item.trak != null) { f.item.trak++; save(); this.vm.setTrak(f.item.trak); this.ui.toast(`ShankTrak™ ${f.item.trak}`, 900); }
      this.stats.kills++; this.coins(how === 'finisher' ? 40 : 25, how === 'finisher' ? 'FINISHER' : 'KILL');
      this.ui.banner(how === 'finisher' ? 'FINISHED' : 'ELIMINATED', '#ffcc33'); this.ui.killPop?.();
    } else {
      A.grunt(null, 0.7, true); setTimeout(() => A.thud(null), 450); this.deathCam = 0.001;
      this.fx.pool(t.pos.x, t.pos.z, t.pos.y);
    }
    this.fx.burst(t.pos.clone().setY(t.pos.y + 1.2), fwdOf(f.yaw).setY(0.3), 2.2);
    this.timeScale = 0.25;
    this.ui.killfeed(f === this.me ? 'You' : f.name, t === this.me ? 'You' : t.name, f.item, how);
    this.endRound(f, how);
  }

  // ---------- movement physics ----------
  moveFighter(f, dt, intent) {
    const want = new THREE.Vector3();
    if (f.dashing) {
      f.dashT -= dt; f.vel.copy(f.dashDir).multiplyScalar(DASH_SPEED * (0.55 + 0.45 * f.dashT / DASH_T));
      if (!f.grounded) f.vy = Math.max(f.vy - GRAV * dt * 0.3, -2);
    } else if (intent && !f.dead && !f.finLock) {
      let sp = intent.speed; if (f.atk) sp *= 0.6; if (f.stun > 0) sp *= 0.45;
      want.copy(intent.dir).multiplyScalar(sp);
      const accel = f.grounded ? (want.lengthSq() > f.vel.lengthSq() ? 42 : 34) : 14;
      const dv = want.sub(f.vel); const len = dv.length(), maxd = accel * dt;
      if (len > maxd) dv.multiplyScalar(maxd / len);
      f.vel.add(dv);
    } else {
      const k = f.grounded ? 14 : 2; f.vel.multiplyScalar(Math.max(0, 1 - dt * k));
    }
    if (f.lunge) { const l = Math.min(f.lunge, dt * 5); f.pos.addScaledVector(fwdOf(f.yaw), l); f.lunge -= l; if (f.lunge < 0.01) f.lunge = 0; }
    // jump input (buffered) + coyote time
    f.jumpBuf = Math.max(0, f.jumpBuf - dt); f.coyote = Math.max(0, f.coyote - dt);
    if (f.jumpBuf > 0) this.jump(f);
    if (!f.grounded && !f.dashing) f.vy -= GRAV * dt;
    f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt;
    f.pos.y += f.vy * dt;
    this.map.resolve(f.pos, 0.38, f.pos.y);
    const g = this.map.groundAt(f.pos.x, f.pos.z, f.pos.y);
    if (f.pos.y <= g.h + 0.001 && f.vy <= 0) {
      const impact = -f.vy;
      if (!f.grounded) this.landed(f, impact);
      f.pos.y = g.h; f.vy = 0; f.grounded = true; f.airDash = false;
      if (g.pad) { // jump pad / mattress
        f.vy = g.pad.power; f.grounded = false; g.pad.squash = 1; A.boing(f.isBot ? { x: f.pos.x, y: 0.3, z: f.pos.z } : null);
        if (!f.isBot) { this.ui.toast('BOING!', 500); this.fov += 10; }
      }
    } else if (f.grounded && f.pos.y - g.h < STEP && f.pos.y > g.h) {
      f.pos.y = g.h; // step down stairs/kerbs
    } else if (f.pos.y > g.h + 0.001) {
      if (f.grounded) f.coyote = COYOTE;
      f.grounded = false;
    }
    if (f.pos.y < 0) { f.pos.y = 0; f.vy = 0; f.grounded = true; }
    f.speed = Math.hypot(f.vel.x, f.vel.z);
    if (f.sprint && f.isBot) { f.sprintT -= dt; if (f.sprintT <= 0) f.sprint = false; }
    if (!f.isBot) { if (f.sprint) { f.sprintT -= dt; f.sprintAge = (f.sprintAge || 0) + dt; if (f.sprintT <= 0 || (f.sprintAge > 0.5 && f.speed < 1)) { f.sprint = false; this.ui.sprintFx(false); } } else f.sprintAge = 0; }
    if (!f.isBot || intent) f.noise = Math.max(f.noise, f.speed > 6.5 ? 22 : f.speed > 3.5 ? 13 : 2.5);
  }
  landed(f, impact) {
    if (impact < 3) return;
    if (!f.isBot) { this.dip = Math.min(0.28, impact * 0.025); A.land(null, impact / 10); }
    else { f.model.land = 1; A.land({ x: f.pos.x, y: f.pos.y, z: f.pos.z }, impact / 10); }
  }
  separate() {
    const a = this.me.pos, b = this.op.pos, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.8;
    if (d < min && d > 1e-4 && Math.abs(a.y - b.y) < 1.5 && !this.me.dead && !this.op.dead) { const k = (min - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
  }
  footsteps(f, dt) {
    if (f.dead || f.dashing || !f.grounded || f.speed < 1.2) { f.stepT = 0.15; return; }
    f.stepT -= dt * (f.speed / 5.2);
    if (f.stepT <= 0) {
      f.stepT = 0.34;
      const loud = f.speed > 6.5 ? 1.5 : f.speed > 3.5 ? 1 : 0.2;
      if (f.isBot) A.footstep({ x: f.pos.x, y: f.pos.y + 0.1, z: f.pos.z }, loud * 1.4); else A.footstep(null, loud * 0.35);
    }
  }

  // ---------- camera ----------
  camera_(dt, look) {
    const me = this.me, cam = this.camera;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.dip += (0 - this.dip) * Math.min(1, dt * 7);
    const sprinting = me.sprint && me.speed > 6;
    const targetFov = 80 + (sprinting ? 10 : 0) + (me.finLock ? -12 : 0) + (me.boost > 0 ? 4 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 7);
    cam.fov = this.fov; cam.updateProjectionMatrix();
    const bobAmt = me.grounded ? Math.min(1, me.speed / 5.2) : 0;
    this.bobT = (this.bobT || 0) + dt * (6 + me.speed * 1.4) * (bobAmt > 0.1 ? 1 : 0);
    let eye = me.pos.y + EYE + Math.abs(Math.sin(this.bobT)) * 0.045 * bobAmt - this.dip;
    const strafe = this.input.move.x;
    let roll = -strafe * 0.02 + (me.dashing ? (me.dashDir.dot(new THREE.Vector3(-Math.cos(me.yaw), 0, Math.sin(me.yaw))) * -0.07) : 0) + Math.sin(this.bobT) * 0.006 * bobAmt;
    if (this.deathCam > 0) {
      this.deathCam = Math.min(1, this.deathCam + dt * 1.8);
      eye = me.pos.y + EYE - (EYE - 0.35) * this.deathCam; roll = 0.9 * this.deathCam;
      const want = yawTo(me.pos, this.op.pos); me.yaw += angDiff(want, me.yaw) * Math.min(1, dt * 4);
      me.pitch += (0.15 - me.pitch) * Math.min(1, dt * 4);
    }
    if (me.finLock && !me.dead) {
      const want = yawTo(me.pos, this.op.pos); me.yaw += angDiff(want, me.yaw) * Math.min(1, dt * 10);
      me.pitch += (-0.12 - me.pitch) * Math.min(1, dt * 8);
    }
    if (this.input.touch && !me.dead && !this.op.dead && this.state === 'live') {
      const d = hdist(me.pos, this.op.pos), ad = angDiff(yawTo(me.pos, this.op.pos), me.yaw);
      if (d < 7 && Math.abs(ad) < 0.45 && this.map.segClear(me.pos.x, me.pos.z, this.op.pos.x, this.op.pos.z)) me.yaw += ad * Math.min(1, dt * 3.5);
    }
    this.camRoll += (roll - this.camRoll) * Math.min(1, dt * 10);
    const s = this.shake * this.shake;
    cam.position.set(me.pos.x + (Math.random() - 0.5) * s * 0.3, eye + (Math.random() - 0.5) * s * 0.3, me.pos.z);
    cam.rotation.order = 'YXZ'; cam.rotation.set(me.pitch + (Math.random() - 0.5) * s * 0.1, me.yaw, this.camRoll);
    A.setListener({ x: cam.position.x, y: cam.position.y, z: cam.position.z }, fwdOf(me.yaw));
  }
  hud() {
    const me = this.me, op = this.op;
    this.ui.hud({
      hp: me.hp, time: Math.max(0, this.time), score: this.score, round: this.round,
      dash: 1 - me.dashCd / DASH_CD, sprint: me.sprint, boost: me.boost, air: !me.grounded,
      finisher: this.state === 'live' && this.canFinish(me, op), earned: this.earned,
    });
    if (me.hp > 0 && me.hp <= 35 && this.state === 'live') A.heartbeat(1 + (35 - me.hp) / 35);
  }
}
