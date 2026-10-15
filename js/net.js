// Online play over Supabase Realtime (WebSocket relay, works on mobile networks, no game server needed).
//   Matchmaker: presence in a lobby channel → deterministic pairing → invite / accept.
//   NetSession: one broadcast channel per match carrying state snapshots (20 Hz) and events (hit, dead, fin, round…).
import { NET } from './netconfig.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/+esm';
let clientP = null;
export function client() {
  clientP ??= import(CDN).then(({ createClient }) => createClient(NET.url, NET.key, { realtime: { params: { eventsPerSecond: 60 } } }));
  return clientP;
}
export const myId = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 18);
const rid = () => Math.random().toString(36).slice(2, 10);

export class Matchmaker {
  // card: what the opponent sees about you (name, outfit, item, rank, level)
  async search(card, onStatus = () => {}) {
    this.cancelled = false; this.matched = false;
    const sb = await client();
    if (this.cancelled) return null;
    const lobby = this.lobby = sb.channel(NET.lobby, { config: { presence: { key: myId }, broadcast: { self: false } } });
    const joinedAt = Date.now();
    return new Promise((resolve) => {
      const finish = async (res) => {
        if (this.matched) return; this.matched = true; clearTimeout(this.inviteT); clearInterval(this.beat);
        try { await lobby.untrack(); await sb.removeChannel(lobby); } catch (e) { /* ignore */ }
        resolve(res);
      };
      this.finish = finish;
      const waiting = () => Object.values(lobby.presenceState()).flat().filter(p => p.state === 'waiting' && p.v === NET.protocol)
        .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
      const tryPair = () => {
        if (this.matched || this.pending) return;
        const list = waiting(); onStatus({ online: list.length });
        const i = list.findIndex(p => p.id === myId); if (i < 0) return;
        const partner = list[i % 2 === 0 ? i + 1 : i - 1];
        if (!partner || myId > partner.id) return; // the lower id invites
        const matchId = rid(), seed = Math.floor(Math.random() * 1e9);
        this.pending = { matchId, to: partner.id, seed };
        lobby.send({ type: 'broadcast', event: 'invite', payload: { to: partner.id, from: myId, matchId, seed, card } });
        this.inviteT = setTimeout(() => { this.pending = null; tryPair(); }, 3000);
      };
      lobby.on('presence', { event: 'sync' }, tryPair)
        .on('broadcast', { event: 'invite' }, ({ payload: p }) => {
          if (p.to !== myId || this.matched || this.pending) return;
          lobby.send({ type: 'broadcast', event: 'accept', payload: { to: p.from, from: myId, matchId: p.matchId, card } });
          finish({ matchId: p.matchId, seed: p.seed, role: 'guest', opp: p.card });
        })
        .on('broadcast', { event: 'accept' }, ({ payload: p }) => {
          if (p.to !== myId || !this.pending || p.matchId !== this.pending.matchId) return;
          finish({ matchId: p.matchId, seed: this.pending.seed, role: 'host', opp: p.card });
        })
        .subscribe(async (st) => {
          if (st === 'SUBSCRIBED') { await lobby.track({ id: myId, t: joinedAt, state: 'waiting', v: NET.protocol, name: card.name }); this.beat = setInterval(tryPair, 1500); }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') finish(null);
        });
    });
  }
  cancel() { this.cancelled = true; this.finish?.(null); }
}

export class NetSession {
  constructor(found) {
    Object.assign(this, found); // matchId, seed, role, opp
    this.handlers = {}; this.lastHeard = performance.now(); this.closed = false;
  }
  get host() { return this.role === 'host'; }
  async connect(timeoutMs = 9000) {
    const sb = await client();
    const ch = this.ch = sb.channel('sm-m-' + this.matchId, { config: { presence: { key: myId }, broadcast: { self: false, ack: false } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { this.lastHeard = performance.now(); (this.handlers[payload.e] || []).forEach(f => f(payload.d)); });
    return new Promise((resolve) => {
      const to = setTimeout(() => resolve(false), timeoutMs);
      const check = () => {
        if (Object.keys(ch.presenceState()).length >= 2) {
          clearTimeout(to); this.lastHeard = performance.now();
          // heartbeat independent of rendering, so a stutter or a backgrounded tab isn't mistaken for a quit
          this.hb ??= setInterval(() => this.send('hb', {}), 1000);
          resolve(true);
        }
      };
      ch.on('presence', { event: 'sync' }, check)
        .on('presence', { event: 'leave' }, () => { if (!this.closed) (this.handlers.left || []).forEach(f => f()); })
        .subscribe(async (st) => { if (st === 'SUBSCRIBED') await ch.track({ id: myId }); else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); resolve(false); } });
    });
  }
  on(e, f) { (this.handlers[e] ??= []).push(f); return this; }
  send(e, d) { if (!this.closed) this.ch?.send({ type: 'broadcast', event: 'm', payload: { e, d } }); }
  async close() {
    if (this.closed) return; clearInterval(this.hb);
    try { this.send('bye', {}); } catch (e) { /* ignore */ }
    this.closed = true;
    try { await this.ch?.untrack(); const sb = await client(); await sb.removeChannel(this.ch); } catch (e) { /* ignore */ }
  }
}
