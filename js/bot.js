// AI opponent. A "brain" drives one fighter by calling the same Match actions a player uses
// (jump / dash / tryAttack / tryFinisher) and exposing a movement `intent`.
// A future NetBrain can implement the same interface with a remote player's inputs.
import * as THREE from 'three';

const RUN = 5.4, SPRINT = 8.0;
const fwdOf = (yaw, out = new THREE.Vector3()) => out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class BotBrain {
  constructor(match) { this.m = match; this.reset(); }
  reset() {
    Object.assign(this, { intent: null, path: [], pathT: 0, last: null, lastSeen: -99, strafe: 1, decideT: 0, dodgeFor: null, wantAtk: 0.6, roam: this.m.map.randomPoint(), heard: 0, stuck: 0, unstick: null, spacing: 2 });
  }
  hear(pos) { this.last = pos.clone(); this.lastSeen = performance.now() / 1000 - 1; this.path = []; }
  update(dt) {
    const M = this.m, b = M.op, p = M.me, ai = this, D = M.difficulty, now = performance.now() / 1000;
    ai.intent = null;
    if (b.dead || b.finLock) return;
    const dist = hdist(b.pos, p.pos), dy = p.pos.y - b.pos.y;
    const toP = yawTo(b.pos, p.pos), facing = Math.abs(angDiff(toP, b.yaw));
    const los = M.map.segClear(b.pos.x, b.pos.z, p.pos.x, p.pos.z, Math.max(b.pos.y, p.pos.y) + 1.5);
    const sees = !p.dead && los && (facing < 1.3 || dist < 5);
    if (sees) { ai.last = p.pos.clone(); ai.lastSeen = now; }
    else if (!p.dead && dist < p.noise && now - ai.heard > 0.6) { ai.heard = now; ai.last = p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)); ai.lastSeen = Math.max(ai.lastSeen, now - 2.5); ai.path = []; }
    const recent = now - ai.lastSeen < 4;
    let goal = null, faceYaw = null;
    // low on health → go for a chicken box if one is close
    const food = b.hp < 55 && !(sees && dist < 4) ? M.pickups.find(q => q.alive && q.type === 'chicken' && hdist(q.holder.position, b.pos) < 14) : null;
    if (sees && dist < 4.4 && !food) {
      faceYaw = toP;
      ai.decideT -= dt;
      if (ai.decideT <= 0) { ai.decideT = 0.4 + Math.random() * 0.6; ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.spacing = 1.6 + Math.random() * 1.0; }
      const fw = fwdOf(toP), right = new THREE.Vector3(-fw.z, 0, fw.x);
      const dir = new THREE.Vector3().addScaledVector(right, ai.strafe * 0.8);
      if (dist > ai.spacing) dir.addScaledVector(fw, 1); else if (dist < 1.3) dir.addScaledVector(fw, -0.8);
      const pFacing = Math.abs(angDiff(yawTo(p.pos, b.pos), p.yaw));
      if (pFacing > 0.9) dir.addScaledVector(right, ai.strafe * 0.6);
      ai.intent = { dir: dir.normalize(), speed: RUN * 0.85 };
      if (dy > 0.6 && dist < 3) { M.jump(b); ai.intent = { dir: fw, speed: RUN }; } // they're up high: jump at them
      if (p.atk && !p.atk.hit && dist < 2.7 && ai.dodgeFor !== p.atk) {
        ai.dodgeFor = p.atk;
        if (Math.random() < 0.12 + D * 0.5) {
          const react = 0.22 - D * 0.14;
          setTimeout(() => { if (M.state === 'live' && !b.dead) { if (Math.random() < 0.25 + D * 0.2) M.jump(b); M.dash(b, Math.random() < 0.5 ? 'back' : (Math.random() < 0.5 ? 'left' : 'right')); } }, react * 1000);
        }
      }
      ai.wantAtk -= dt;
      const punish = p.atk && p.atk.hit && dist < 2.5;
      if (!b.atk && dist < 2.25 && facing < 0.5 && Math.abs(dy) < 1.3 && (ai.wantAtk <= 0 || (punish && Math.random() < D * 0.12))) {
        if (M.canFinish(b, p) && Math.random() < 0.25 + D * 0.3) M.tryFinisher(b, p);
        else {
          const r = Math.random();
          M.tryAttack(b, p, r < 0.12 + (pFacing > 2 ? 0.4 : 0) ? 'heavy' : undefined);
          if (r > 0.45) setTimeout(() => M.state === 'live' && M.tryAttack(b, p), 250);
        }
        ai.wantAtk = 0.9 - D * 0.45 + Math.random() * 0.5;
      }
    } else {
      if (food) goal = { x: food.holder.position.x, z: food.holder.position.z };
      else if (recent && ai.last) goal = ai.last; else goal = ai.roam;
      if (!recent && goal === ai.roam && hdist(b.pos, goal) < 1.5) ai.roam = M.map.randomPoint();
      if (recent && ai.last && hdist(b.pos, ai.last) < 1.2 && !sees) { ai.lastSeen = -99; ai.roam = M.map.randomPoint(); }
      if (sees && dist > 9) { b.sprint = true; b.sprintT = 1; }
      const speed = b.sprint ? SPRINT : (recent ? RUN : RUN * 0.8);
      let target = goal;
      if (!(M.map.segClear(b.pos.x, b.pos.z, goal.x, goal.z, 0, 0.45))) {
        ai.pathT -= dt;
        if (ai.pathT <= 0 || !ai.path.length) { ai.path = M.map.path(b.pos.x, b.pos.z, goal.x, goal.z); ai.pathT = 0.8; }
        while (ai.path.length > 1 && hdist(ai.path[0], b.pos) < 1.2) ai.path.shift();
        if (ai.path.length > 1 && M.map.segClear(b.pos.x, b.pos.z, ai.path[1].x, ai.path[1].z, 0, 0.42)) ai.path.shift();
        if (ai.path.length) target = ai.path[0];
      }
      const dir = new THREE.Vector3(target.x - b.pos.x, 0, target.z - b.pos.z);
      if (dir.lengthSq() > 0.01) { dir.normalize(); ai.intent = { dir, speed }; faceYaw = sees ? toP : Math.atan2(-dir.x, -dir.z); }
    }
    if (ai.intent && ai.intent.speed > 1 && b.speed < 0.6 && !b.atk) ai.stuck += dt; else ai.stuck = 0;
    if (ai.stuck > 0.35 && b.grounded) M.jump(b); // hop over low stuff
    if (ai.stuck > 0.8) {
      ai.stuck = 0; ai.path = []; ai.pathT = 0; ai.roam = M.map.randomPoint();
      if (!sees) ai.lastSeen = -99;
      const side = new THREE.Vector3(-ai.intent.dir.z, 0, ai.intent.dir.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      ai.unstick = { dir: side.addScaledVector(ai.intent.dir, -0.5).normalize(), t: 0.45 };
    }
    if (ai.unstick && ai.unstick.t > 0) { ai.unstick.t -= dt; ai.intent = { dir: ai.unstick.dir, speed: RUN }; }
    if (this.carDanger && b.grounded) { ai.intent = { dir: new THREE.Vector3(this.carDanger.side, 0, 0), speed: RUN }; if (Math.random() < dt * 2) M.jump(b); } // get out of the road
    if (faceYaw !== null) { const turn = (4 + D * 6) * dt, d = angDiff(faceYaw, b.yaw); b.yaw += Math.max(-turn, Math.min(turn, d)); }
  }
}
