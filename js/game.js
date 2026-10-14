// Match logic: fighters, combat, rounds, bot AI.
import * as THREE from 'three';
import { Character } from './characters.js';
import { FINISHERS } from './data.js';
import * as A from './audio.js';

const WALK = 2.3, RUN = 4.9, SPRINT = 7.0, DASH_SPEED = 13.5, DASH_T = 0.22, DASH_IFRAME = 0.18, DASH_CD = 0.85;
const EYE = 1.62, ROUNDS_TO_WIN = 3, ROUND_TIME = 75;
// hitAt / dur are seconds. Bots get extra windup (a visible "tell") so players can dash-counter.
const ATK = {
  slash1: { hitAt: 0.13, dur: 0.42, dmg: 26, range: 2.15, cone: 1.05, back: 1.8, kind: 'slash1' },
  slash2: { hitAt: 0.13, dur: 0.42, dmg: 26, range: 2.15, cone: 1.05, back: 1.8, kind: 'slash2' },
  stab:   { hitAt: 0.2,  dur: 0.56, dmg: 42, range: 2.3,  cone: 0.6,  back: 2.0, kind: 'stab' },
  heavy:  { hitAt: 0.34, dur: 0.82, dmg: 62, range: 2.3,  cone: 0.6,  back: 9,   kind: 'heavy' },
};
const COMBO = ['slash1', 'slash2', 'stab'];
const FIN_DUR = 1.25, FIN_HP = 40;

const v3 = new THREE.Vector3();
const fwdOf = (yaw, out = new THREE.Vector3()) => out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

class Fighter {
  constructor(isBot, charId, item, name) {
    this.isBot = isBot; this.name = name; this.item = item; this.charId = charId;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
    this.model = new Character(charId, item);
    this.reset();
  }
  reset() {
    this.hp = 100; this.dead = false; this.atk = null; this.combo = 0; this.comboT = 0; this.queued = null;
    this.dashT = 0; this.dashCd = 0; this.dashDir = new THREE.Vector3(); this.sprint = false; this.sprintT = 0;
    this.stun = 0; this.stepT = 0; this.finLock = false; this.speed = 0; this.noise = 0;
  }
  get dashing() { return this.dashT > 0; }
  get iframe() { return this.dashT > DASH_T - DASH_IFRAME; }
  get fwd() { return fwdOf(this.yaw); }
}

export class Match {
  constructor({ scene, camera, vm, map, fx, screen, ui, input, profile, opponent, difficulty, finisher }) {
    Object.assign(this, { scene, camera, vm, map, fx, screen, ui, input, difficulty, finisher });
    this.me = new Fighter(false, profile.equipped.character, profile.item, 'You');
    this.op = new Fighter(true, opponent.character, opponent.item, opponent.name);
    this.op.model.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.op.model.root);
    this.score = [0, 0]; this.round = 0; this.state = 'intro'; this.stateT = 0; this.timeScale = 1; this.hitstop = 0;
    this.shake = 0; this.fov = 78; this.ai = {}; this.kills = []; this.stats = { hits: 0, taken: 0, finishers: 0, backstabs: 0, dashDodges: 0 };
    this.camRoll = 0; this.deathCam = 0;
    vm.setLoadout(profile.equipped.character, profile.item);
    this.startRound();
  }
  dispose() { this.scene.remove(this.op.model.root); }

  // ---------- rounds ----------
  startRound() {
    this.round++;
    const pairs = this.map.spawns, pair = pairs[Math.floor(Math.random() * pairs.length)], swap = Math.random() < 0.5;
    const [a, b] = swap ? [pair[1], pair[0]] : pair;
    [[this.me, a], [this.op, b]].forEach(([f, s]) => {
      f.reset(); f.pos.set(s.x, 0, s.z); f.yaw = yawTo(f.pos, { x: 4, z: 0 }); f.pitch = 0; f.model.revive();
    });
    this.ai = { mode: 'hunt', path: [], pathT: 0, last: null, lastSeen: -99, strafe: 1, decideT: 0, dodgeFor: null, react: 0, wantAtk: 0, roam: this.map.randomPoint(), heard: 0 };
    this.fx.clear(); this.screen.clear(); this.vm.blood = 0; this.vm.addBlood(0);
    this.vm.play('draw', 0.7); A.draw();
    this.state = 'countdown'; this.stateT = 3.2; this.deathCam = 0; this.camRoll = 0;
    this.ui.roundIntro(this.round, this.score);
    this.time = ROUND_TIME;
  }
  endRound(winner, reason) {
    if (this.state !== 'live') return;
    this.state = 'roundEnd'; this.stateT = 3.2;
    if (winner === this.me) this.score[0]++; else if (winner === this.op) this.score[1]++;
    const over = this.score[0] >= ROUNDS_TO_WIN || this.score[1] >= ROUNDS_TO_WIN;
    this.ui.roundResult(winner === this.me ? 'win' : winner ? 'lose' : 'draw', reason, this.score, over);
    if (winner === this.me) A.winSting(); else if (winner) A.loseSting();
    this.matchOver = over;
  }

  // ---------- per-frame ----------
  update(rdt) {
    if (this.hitstop > 0) { this.hitstop -= rdt; rdt *= 0.08; }
    const dt = rdt * this.timeScale;
    this.timeScale += (1 - this.timeScale) * Math.min(1, rdt * 1.5);
    this.input.update();
    const look = this.input.takeLook();
    const me = this.me, op = this.op;
    if (!me.finLock && !me.dead) {
      me.yaw -= look.x; me.pitch = Math.max(-1.3, Math.min(1.3, me.pitch - look.y));
    }
    const events = this.input.drain();
    if (this.state === 'countdown') {
      const before = Math.ceil(this.stateT); this.stateT -= rdt; const after = Math.ceil(this.stateT);
      if (after !== before && after > 0) { A.beep(660, 0.1, 0.25); this.ui.countdown(after); }
      if (this.stateT <= 0) { this.state = 'live'; this.ui.countdown('SHANK!'); A.beep(1320, 0.25, 0.3); A.ambience(true); }
      events.filter(e => e.type === 'inspect').forEach(() => this.vm.play('inspect', 2.2));
    } else if (this.state === 'live') {
      this.time -= dt;
      this.handleEvents(events);
      this.bot(dt);
      if (this.time <= 0) {
        const w = me.hp > op.hp ? me : op.hp > me.hp ? op : null;
        this.endRound(w, 'Time');
      }
    } else if (this.state === 'roundEnd') {
      this.stateT -= rdt;
      if (this.stateT <= 0) {
        if (this.matchOver) { this.state = 'over'; this.ui.matchOver(this.score[0] > this.score[1], this.score, this.stats); }
        else this.startRound();
      }
    }
    if (this.state !== 'live') this.ai.intent = null;
    const frozen = this.state === 'countdown' || this.state === 'over';
    this.moveFighter(me, dt, frozen ? null : this.myMoveIntent());
    this.moveFighter(op, dt, frozen ? null : this.ai.intent);
    this.separate();
    this.tickAttack(me, op, dt); this.tickAttack(op, me, dt);
    this.footsteps(me, dt); this.footsteps(op, dt);
    // models
    op.model.root.position.copy(op.pos); op.model.root.rotation.y = op.yaw;
    op.model.update(dt, { speed: op.speed, attack: op.atk ? { kind: op.atk.def.kind, t: op.atk.t / op.atk.def.dur } : null, dash: op.dashing });
    this.fx.update(dt); this.screen.update(rdt);
    this.camera_(rdt, look);
    this.vm.update(dt, { speed: me.speed, look, dashing: me.dashing, sprint: me.sprint && me.speed > 5 });
    this.hud();
  }
  myMoveIntent() {
    const m = this.input.move, me = this.me;
    if (me.dead || me.finLock) return null;
    const f = fwdOf(me.yaw), r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = new THREE.Vector3().addScaledVector(f, m.y).addScaledVector(r, m.x);
    const mag = Math.min(1, dir.length());
    if (me.sprint && (m.y < 0.3 || me.atk)) me.sprint = false;
    const speed = me.sprint ? SPRINT : (this.input.walk ? WALK : RUN);
    return { dir: mag > 0.01 ? dir.normalize() : dir, speed: speed * (this.input.joy ? Math.max(mag, 0.35) : mag), walk: this.input.walk };
  }
  handleEvents(events) {
    const me = this.me;
    if (me.dead || me.finLock) return;
    for (const e of events) {
      if (e.type === 'attack') this.tryAttack(me, this.op);
      else if (e.type === 'double') { if (!this.tryFinisher(me, this.op)) this.tryAttack(me, this.op, 'heavy'); }
      else if (e.type === 'heavy') this.tryAttack(me, this.op, 'heavy');
      else if (e.type === 'dash') this.dash(me, e.dir);
      else if (e.type === 'sprint') { me.sprint = true; me.sprintT = 4; A.sprintStart(); this.ui.toast('SPRINT', 600); }
      else if (e.type === 'inspect' && !me.atk) this.vm.play('inspect', 2.2);
    }
  }
  dash(f, dir) {
    if (f.dashCd > 0 || f.dead || f.finLock) return false;
    const fw = fwdOf(f.yaw), r = new THREE.Vector3(-fw.z, 0, fw.x);
    f.dashDir.copy(dir === 'left' ? r.negate() : dir === 'right' ? r : dir === 'forward' ? fw : fw.negate());
    f.dashT = DASH_T; f.dashCd = DASH_CD; f.sprint = false;
    // dash cancels attack recovery (not an attack that already hit)
    if (f.atk && f.atk.t > f.atk.def.hitAt) f.atk = null;
    if (f.atk && f.atk.t <= f.atk.def.hitAt) f.atk = null;
    f.noise = Math.max(f.noise, 10);
    A.dashSfx(f.isBot ? { x: f.pos.x, y: 1, z: f.pos.z } : null);
    if (!f.isBot) { this.fov += 8; this.ui.dashFlash(); }
    return true;
  }
  tryAttack(f, target, forced) {
    if (f.dead || f.finLock || f.stun > 0.15) return;
    if (f.atk) { // buffer next combo hit
      if (!forced && f.atk.t > f.atk.def.hitAt) f.queued = true;
      return;
    }
    const kind = forced || COMBO[f.comboT > 0 ? f.combo % 3 : 0];
    if (!forced) f.combo = (f.comboT > 0 ? f.combo : 0) + 1;
    const def = ATK[kind];
    const extra = f.isBot ? (0.16 - 0.1 * this.difficulty) : 0;
    f.atk = { def: { ...def, hitAt: def.hitAt + extra, dur: def.dur + extra }, t: 0, hit: false };
    f.sprint = false; f.noise = Math.max(f.noise, 8);
    // melee magnetism + lunge toward a nearby target in front
    const d = f.pos.distanceTo(target.pos), ad = Math.abs(angDiff(yawTo(f.pos, target.pos), f.yaw));
    if (!target.dead && d < 3.2 && ad < 0.8) {
      f.yaw += angDiff(yawTo(f.pos, target.pos), f.yaw) * (f.isBot ? 0.5 : 0.65);
      if (d > 1.5) f.lunge = Math.min(0.5, d - 1.4);
    }
    if (!f.isBot) {
      const vmName = kind === 'heavy' ? 'heavy' : kind;
      this.vm.play(vmName, f.atk.def.dur * 1.05);
      A.whoosh(kind === 'heavy' ? 1.4 : 1, null, kind === 'stab' ? 0.8 : 1);
    } else {
      setTimeout(() => A.whoosh(1, { x: f.pos.x, y: 1.3, z: f.pos.z }), (f.atk.def.hitAt - 0.08) * 1000);
    }
  }
  canFinish(f, t) {
    if (t.dead || t.hp > FIN_HP || f.atk?.def.kind === 'heavy') return false;
    const d = f.pos.distanceTo(t.pos), ad = Math.abs(angDiff(yawTo(f.pos, t.pos), f.yaw));
    return d < 2.7 && ad < 0.9 && this.map.segClear(f.pos.x, f.pos.z, t.pos.x, t.pos.z, 1.0);
  }
  tryFinisher(f, t) {
    if (!this.canFinish(f, t) || t.iframe) return false;
    const fin = FINISHERS[f.isBot ? 'stitch' : this.finisher] || FINISHERS.stitch;
    f.finLock = t.finLock = true; f.atk = t.atk = null; f.sprint = false;
    f.yaw = yawTo(f.pos, t.pos); t.yaw = yawTo(t.pos, f.pos);
    this.timeScale = 0.45;
    const hitFx = (i, last) => {
      const dir = fwdOf(f.yaw).add(new THREE.Vector3(0, 0.2, 0)), at = t.pos.clone().setY(1.25);
      this.fx.burst(at, dir, last ? 2 : 1.2, fin.gold);
      if (fin.gold) { A.coin(); this.fx.burst(at, dir, 0.6, false); }
      last ? A.stab({ x: at.x, y: at.y, z: at.z }) : A.slice({ x: at.x, y: at.y, z: at.z });
      t.model.flash(); this.hitstop = 0.05;
      if (!f.isBot) { this.screen.splat(last ? 1.6 : 0.9, (Math.random() - 0.5)); this.vm.addBlood(0.3); this.shake = 0.25; }
      else { this.hurtFx(0.9); }
      if (last) this.kill(f, t, 'finisher');
    };
    if (!f.isBot) {
      this.stats.finishers++;
      this.ui.banner(fin.name.toUpperCase(), '#ffd23a');
      this.vm.playFinisher(fin.style, FIN_DUR * 0.6, hitFx, fin.hits);
    } else {
      this.ui.banner('FINISHED', '#ff2d55');
      let i = 0; const n = 3;
      const step = () => { if (this.state !== 'live') return; hitFx(i, i === n - 1); i++; if (i < n) setTimeout(step, 260); };
      f.atk = { def: { ...ATK.slash1, dur: 1.0, hitAt: 99 }, t: 0, hit: true };
      setTimeout(step, 200);
    }
    return true;
  }
  tickAttack(f, t, dt) {
    f.comboT = Math.max(0, f.comboT - dt);
    f.dashCd = Math.max(0, f.dashCd - dt); f.stun = Math.max(0, f.stun - dt); f.noise = Math.max(0, f.noise - dt * 20);
    if (!f.atk) return;
    const a = f.atk; a.t += dt;
    if (!a.hit && a.t >= a.def.hitAt) {
      a.hit = true;
      this.resolveHit(f, t, a.def);
    }
    if (a.t >= a.def.dur) {
      f.atk = null; f.comboT = 0.55;
      if (f.combo >= 3) { f.combo = 0; f.comboT = 0; }
      if (f.queued) { f.queued = false; this.tryAttack(f, t); }
    }
  }
  resolveHit(f, t, def) {
    if (t.dead || f.dead) return;
    const d = f.pos.distanceTo(t.pos);
    const ang = Math.abs(angDiff(yawTo(f.pos, t.pos), f.yaw));
    if (d > def.range || ang > def.cone || !this.map.segClear(f.pos.x, f.pos.z, t.pos.x, t.pos.z, 1.0)) {
      if (!f.isBot) this.ui.whiff?.();
      return;
    }
    if (t.iframe) { // dodged with a dash
      if (!t.isBot) { this.stats.dashDodges++; this.ui.toast('DODGED', 500); }
      return;
    }
    // backstab: attacker is behind the target
    const behind = Math.abs(angDiff(yawTo(t.pos, f.pos), t.yaw)) > 2.0;
    let dmg = def.dmg * (behind ? def.back : 1);
    dmg = Math.round(dmg * (0.92 + Math.random() * 0.16));
    t.hp = Math.max(0, t.hp - dmg);
    t.stun = 0.28; if (t.atk && !t.atk.hit) t.atk = null; // interrupt their windup
    const push = fwdOf(f.yaw).multiplyScalar(0.35); t.pos.add(push); this.map.resolve(t.pos);
    const right = new THREE.Vector3(-Math.cos(f.yaw), 0, Math.sin(f.yaw));
    const sweep = def.kind === 'slash1' ? right.clone().negate() : def.kind === 'slash2' ? right.clone() : fwdOf(f.yaw);
    const dir = sweep.multiplyScalar(0.8).add(fwdOf(f.yaw).multiplyScalar(0.6)).add(new THREE.Vector3(0, 0.15, 0));
    const at = t.pos.clone().setY(def.kind === 'stab' || def.kind === 'heavy' ? 1.15 : 1.3);
    this.fx.burst(at, dir, dmg / 30);
    const P = { x: at.x, y: at.y, z: at.z };
    def.kind === 'stab' || def.kind === 'heavy' ? A.stab(t.isBot ? P : null) : A.slice(t.isBot ? P : null);
    if (behind) { this.ui.banner('BACKSTAB', '#ff2d55'); if (!f.isBot) this.stats.backstabs++; }
    this.hitstop = dmg > 40 ? 0.08 : 0.045;
    if (t.isBot) { // I hit them
      this.stats.hits++;
      t.model.flash(); A.grunt(P, 0.9 + Math.random() * 0.2); A.hitMarker();
      this.vm.addBlood(0.18 + dmg / 300); this.shake = 0.12 + dmg / 300;
      if (d < 2.3) this.screen.splat(0.4 + dmg / 60, def.kind === 'slash1' ? -1 : def.kind === 'slash2' ? 1 : 0);
      this.ui.hitMarker(dmg, behind);
    } else { // they hit me
      this.stats.taken++;
      A.grunt(null, 0.75); this.hurtFx(dmg / 40);
      this.me.yaw += (Math.random() - 0.5) * 0.12; this.me.pitch += 0.05;
    }
    if (t.hp <= 0) this.kill(f, t, behind ? 'backstab' : def.kind);
  }
  hurtFx(k) {
    this.ui.hurt(k); this.screen.splat(0.6 + k * 0.6, (Math.random() - 0.5) * 2); this.vm.flashHit(); this.shake = Math.max(this.shake, 0.2 + k * 0.15);
  }
  kill(f, t, how) {
    if (t.dead) return;
    t.dead = true; t.hp = 0; f.finLock = t.finLock = false; t.atk = null;
    const P = { x: t.pos.x, y: 1, z: t.pos.z };
    if (t.isBot) {
      const back = Math.abs(angDiff(yawTo(t.pos, f.pos), t.yaw)) < 1.6;
      t.model.kill(back); A.grunt(P, 0.8, true); setTimeout(() => A.thud(P), 450);
      const fall = fwdOf(t.yaw).multiplyScalar(back ? 1.0 : -1.0);
      setTimeout(() => this.fx.pool(t.pos.x + fall.x, t.pos.z + fall.z), 500);
    } else {
      A.grunt(null, 0.7, true); setTimeout(() => A.thud(null), 450); this.deathCam = 0.001;
      this.fx.pool(t.pos.x, t.pos.z);
    }
    this.fx.burst(t.pos.clone().setY(1.2), fwdOf(f.yaw).setY(0.3), 2.2);
    this.timeScale = 0.3;
    this.ui.killfeed(f === this.me ? 'You' : f.name, t === this.me ? 'You' : t.name, f.item, how);
    if (t.isBot) this.ui.banner(how === 'finisher' ? 'FINISHED' : 'ELIMINATED', '#ffd23a');
    this.endRound(f, how);
  }

  // ---------- movement ----------
  moveFighter(f, dt, intent) {
    let want = new THREE.Vector3();
    if (f.dashing) { f.dashT -= dt; want.copy(f.dashDir).multiplyScalar(DASH_SPEED * (0.5 + f.dashT / DASH_T)); f.vel.copy(want); }
    else if (intent && !f.dead && !f.finLock) {
      let sp = intent.speed; if (f.atk) sp *= 0.55; if (f.stun > 0) sp *= 0.4;
      want.copy(intent.dir).multiplyScalar(sp);
      f.vel.lerp(want, Math.min(1, dt * (want.lengthSq() > f.vel.lengthSq() ? 10 : 14)));
    } else f.vel.multiplyScalar(Math.max(0, 1 - dt * 12));
    if (f.lunge) { const l = Math.min(f.lunge, dt * 4); f.pos.addScaledVector(fwdOf(f.yaw), l); f.lunge -= l; if (f.lunge < 0.01) f.lunge = 0; }
    f.pos.addScaledVector(f.vel, dt); this.map.resolve(f.pos, 0.38);
    f.speed = f.vel.length();
    if (f.sprint) { f.sprintT -= dt; if (f.sprintT <= 0) f.sprint = false; }
    if (!f.isBot || intent) f.noise = Math.max(f.noise, f.speed > 6 ? 22 : f.speed > 3.5 ? 13 : 2.5);
  }
  separate() {
    const a = this.me.pos, b = this.op.pos, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.8;
    if (d < min && d > 1e-4 && !this.me.dead && !this.op.dead) { const k = (min - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
  }
  footsteps(f, dt) {
    if (f.dead || f.dashing || f.speed < 1.2) { f.stepT = 0.2; return; }
    f.stepT -= dt * (f.speed / 4.9);
    if (f.stepT <= 0) {
      f.stepT = 0.36;
      const loud = f.speed > 6 ? 1.5 : f.speed > 3.5 ? 1 : 0.2;
      if (f.isBot) A.footstep({ x: f.pos.x, y: 0.1, z: f.pos.z }, loud * 1.4); else A.footstep(null, loud * 0.35);
    }
  }

  // ---------- camera ----------
  camera_(dt, look) {
    const me = this.me, cam = this.camera;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const targetFov = 78 + (me.sprint && me.speed > 5 ? 8 : 0) + (me.finLock ? -10 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 8);
    cam.fov = this.fov; cam.updateProjectionMatrix();
    let eye = EYE + Math.sin(performance.now() / 1000 * 9) * 0.02 * Math.min(1, me.speed / 5);
    let roll = (me.dashing ? (me.dashDir.dot(new THREE.Vector3(-Math.cos(me.yaw), 0, Math.sin(me.yaw))) * -0.06) : 0);
    if (this.deathCam > 0) {
      this.deathCam = Math.min(1, this.deathCam + dt * 1.8);
      eye = EYE - (EYE - 0.35) * this.deathCam; roll = 0.9 * this.deathCam;
      const want = yawTo(me.pos, this.op.pos); me.yaw += angDiff(want, me.yaw) * Math.min(1, dt * 4);
      me.pitch += (0.15 - me.pitch) * Math.min(1, dt * 4);
    }
    if (me.finLock && !me.dead) { // keep the target framed during finishers
      const want = yawTo(me.pos, this.op.pos); me.yaw += angDiff(want, me.yaw) * Math.min(1, dt * 10);
      me.pitch += (-0.12 - me.pitch) * Math.min(1, dt * 8);
    }
    // gentle aim assist on touch
    if (this.input.touch && !me.dead && !this.op.dead && this.state === 'live') {
      const d = me.pos.distanceTo(this.op.pos), ad = angDiff(yawTo(me.pos, this.op.pos), me.yaw);
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
      dash: 1 - me.dashCd / DASH_CD, sprint: me.sprint, finisher: this.state === 'live' && this.canFinish(me, op),
    });
    if (me.hp > 0 && me.hp <= 35 && this.state === 'live') A.heartbeat(1 + (35 - me.hp) / 35);
  }

  // ---------- bot ----------
  bot(dt) {
    const b = this.op, p = this.me, ai = this.ai, D = this.difficulty, now = performance.now() / 1000;
    ai.intent = null;
    if (b.dead || b.finLock) return;
    const dist = b.pos.distanceTo(p.pos);
    const toP = yawTo(b.pos, p.pos), facing = Math.abs(angDiff(toP, b.yaw));
    const los = this.map.segClear(b.pos.x, b.pos.z, p.pos.x, p.pos.z, 1.5);
    const sees = !p.dead && los && (facing < 1.3 || dist < 5);
    if (sees) { ai.last = p.pos.clone(); ai.lastSeen = now; }
    else if (!p.dead && dist < p.noise) { // heard
      if (now - ai.heard > 0.6) { ai.heard = now; ai.last = p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)); ai.lastSeen = Math.max(ai.lastSeen, now - 2.5); ai.path = []; }
    }
    const recent = now - ai.lastSeen < 4;
    let goal = null, faceYaw = null, speed = RUN;
    if (sees && dist < 4.2) {
      // ---- duel ----
      faceYaw = toP;
      ai.decideT -= dt;
      if (ai.decideT <= 0) { ai.decideT = 0.4 + Math.random() * 0.6; ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.spacing = 1.6 + Math.random() * 1.0; }
      const fw = fwdOf(toP), right = new THREE.Vector3(-fw.z, 0, fw.x);
      const dir = new THREE.Vector3().addScaledVector(right, ai.strafe * 0.8);
      if (dist > ai.spacing) dir.addScaledVector(fw, 1); else if (dist < 1.3) dir.addScaledVector(fw, -0.8);
      // try to circle behind if they aren't looking at us
      const pFacing = Math.abs(angDiff(yawTo(p.pos, b.pos), p.yaw));
      if (pFacing > 0.9) dir.addScaledVector(right, ai.strafe * 0.6);
      ai.intent = { dir: dir.normalize(), speed: RUN * 0.85 };
      // react to an incoming attack: dodge with a dash
      if (p.atk && !p.atk.hit && dist < 2.6 && ai.dodgeFor !== p.atk) {
        ai.dodgeFor = p.atk;
        if (Math.random() < 0.12 + D * 0.5) {
          const react = 0.22 - D * 0.14;
          setTimeout(() => { if (this.state === 'live' && !b.dead) this.dash(b, Math.random() < 0.5 ? 'back' : (Math.random() < 0.5 ? 'left' : 'right')); }, react * 1000);
        }
      }
      // punish a whiffed attack, else attack on cooldown
      ai.wantAtk -= dt;
      const punish = p.atk && p.atk.hit && dist < 2.4;
      if (!b.atk && dist < 2.2 && facing < 0.5 && (ai.wantAtk <= 0 || (punish && Math.random() < D * 0.12))) {
        if (this.canFinish(b, p) && Math.random() < 0.25 + D * 0.3) this.tryFinisher(b, p);
        else {
          const r = Math.random();
          this.tryAttack(b, p, r < 0.12 + (pFacing > 2 ? 0.4 : 0) ? 'heavy' : undefined);
          if (r > 0.45) setTimeout(() => this.state === 'live' && this.tryAttack(b, p), 250); // chain a combo
        }
        ai.wantAtk = 0.9 - D * 0.45 + Math.random() * 0.5;
      }
    } else {
      // ---- hunt / chase ----
      if (recent && ai.last) goal = ai.last; else goal = ai.roam;
      if (!recent && goal === ai.roam && Math.hypot(b.pos.x - goal.x, b.pos.z - goal.z) < 1.5) ai.roam = this.map.randomPoint();
      if (recent && ai.last && Math.hypot(b.pos.x - ai.last.x, b.pos.z - ai.last.z) < 1.2 && !sees) { ai.lastSeen = -99; ai.roam = this.map.randomPoint(); }
      if (sees && dist > 9) { b.sprint = true; b.sprintT = 1; }
      speed = b.sprint ? SPRINT : (recent ? RUN : RUN * 0.8);
      let target = goal;
      if (!(sees && this.map.segClear(b.pos.x, b.pos.z, goal.x, goal.z, 0, 0.45))) {
        ai.pathT -= dt;
        if (ai.pathT <= 0 || !ai.path.length) { ai.path = this.map.path(b.pos.x, b.pos.z, goal.x, goal.z); ai.pathT = 0.8; }
        while (ai.path.length > 1 && Math.hypot(ai.path[0].x - b.pos.x, ai.path[0].z - b.pos.z) < 1.2) ai.path.shift();
        // skip ahead when the next-next point is directly reachable
        if (ai.path.length > 1 && this.map.segClear(b.pos.x, b.pos.z, ai.path[1].x, ai.path[1].z, 0, 0.42)) ai.path.shift();
        if (ai.path.length) target = ai.path[0];
        if (ai.path.length === 1 && this.map.segClear(b.pos.x, b.pos.z, goal.x, goal.z, 0, 0.42)) target = goal;
      }
      const dir = new THREE.Vector3(target.x - b.pos.x, 0, target.z - b.pos.z);
      if (dir.lengthSq() > 0.01) { dir.normalize(); ai.intent = { dir, speed }; faceYaw = sees ? toP : Math.atan2(-dir.x, -dir.z); }
    }
    // stuck recovery: wanted to move but barely did → pick a new route and sidestep
    if (ai.intent && ai.intent.speed > 1 && b.speed < 0.6 && !b.atk) ai.stuck = (ai.stuck || 0) + dt; else ai.stuck = 0;
    if (ai.stuck > 0.6) {
      ai.stuck = 0; ai.path = []; ai.pathT = 0; ai.roam = this.map.randomPoint();
      if (!sees) ai.lastSeen = -99;
      const side = new THREE.Vector3(-ai.intent.dir.z, 0, ai.intent.dir.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      ai.unstick = { dir: side.addScaledVector(ai.intent.dir, -0.5).normalize(), t: 0.45 };
    }
    if (ai.unstick && ai.unstick.t > 0) { ai.unstick.t -= dt; ai.intent = { dir: ai.unstick.dir, speed: RUN }; }
    if (faceYaw !== null) {
      const turn = (4 + D * 6) * dt; const d = angDiff(faceYaw, b.yaw);
      b.yaw += Math.max(-turn, Math.min(turn, d));
    }
  }
}
