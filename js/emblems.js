// Rank emblems drawn as knives: the higher the rank, the bigger and sexier the blade(s).
// Bronze: one small knife · Silver: bigger · Gold: gold blade + laurels · Platinum: crossed akimbo knives
// Diamond: big crossed blades + diamond · Shankmaster: crossed karambits, crown, flames.
const PAL = [
  { a: '#f3b37a', b: '#b8662a', c: '#6e3a14', glow: '#d08a4c' },   // bronze
  { a: '#ffffff', b: '#c3ccd8', c: '#6f7b8c', glow: '#d6dde6' },   // silver
  { a: '#fff6b8', b: '#ffcc33', c: '#b07a00', glow: '#ffcc33' },   // gold
  { a: '#e9fffb', b: '#7ff0e0', c: '#1f8f84', glow: '#5ff0dc' },   // platinum
  { a: '#ffffff', b: '#9cc8ff', c: '#2d5cc8', glow: '#7ab4ff' },   // diamond
  { a: '#fff1c2', b: '#ff4060', c: '#7a0016', glow: '#ff3b5c' },   // shankmaster
];
let uid = 0;
function blade(id, p, s = 1, curve = false) {
  // a knife pointing up, centred on (0,0), scale s
  const bl = curve
    ? `<path d="M-6 8 C -10 -14, 2 -34, 18 -46 C 6 -30, 4 -14, 6 8 Z" fill="url(#bl${id})" stroke="#050a24" stroke-width="2.6" stroke-linejoin="round"/>`
    : `<path d="M-7 6 L-7 -38 Q-6 -48 0 -56 Q6 -48 7 -38 L7 6 Z" fill="url(#bl${id})" stroke="#050a24" stroke-width="2.6" stroke-linejoin="round"/>
       <path d="M0 -52 L0 2" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>`;
  return `<g transform="scale(${s})">${bl}
    <rect x="-14" y="5" width="28" height="7" rx="3" fill="${p.c}" stroke="#050a24" stroke-width="2.4"/>
    <rect x="-5.5" y="11" width="11" height="24" rx="4" fill="#1a1d33" stroke="#050a24" stroke-width="2.4"/>
    ${curve ? `<circle cx="0" cy="40" r="6" fill="none" stroke="${p.b}" stroke-width="3.2"/>` : `<circle cx="0" cy="37" r="4" fill="${p.b}" stroke="#050a24" stroke-width="2"/>`}
  </g>`;
}
export function rankEmblem(idx, size = 96) {
  const id = ++uid;
  if (idx < 0) return `<svg viewBox="-60 -60 120 120" width="${size}" height="${size}"><path d="M0 -50 L42 -26 L42 24 L0 50 L-42 24 L-42 -26Z" fill="#2a3566" stroke="#050a24" stroke-width="4"/><text x="0" y="16" text-anchor="middle" font-family="Lilita One" font-size="46" fill="#9aa6c8" stroke="#050a24" stroke-width="5" paint-order="stroke">?</text></svg>`;
  const p = PAL[idx];
  const defs = `<defs>
    <linearGradient id="bl${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.c}"/><stop offset=".45" stop-color="${p.a}"/><stop offset=".55" stop-color="${p.b}"/><stop offset="1" stop-color="${p.c}"/></linearGradient>
    <radialGradient id="gl${id}"><stop offset="0" stop-color="${p.glow}" stop-opacity=".75"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="sh${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f4fd8"/><stop offset="1" stop-color="#0a1a5e"/></linearGradient>
  </defs>`;
  const shield = `<path d="M0 -50 L44 -27 L44 25 L0 52 L-44 25 L-44 -27Z" fill="url(#sh${id})" stroke="${p.b}" stroke-width="${3 + idx * 0.6}"/>`;
  const glow = idx >= 2 ? `<circle r="${44 + idx * 5}" fill="url(#gl${id})" class="em-pulse"/>` : '';
  let art = '';
  if (idx === 0) art = blade(id, p, 0.8);
  else if (idx === 1) art = blade(id, p, 1.0);
  else if (idx === 2) art = laurel(p, 1.05) + blade(id, p, 1.08);
  else if (idx === 3) art = `<g transform="rotate(-32)">${blade(id, p, 1.0)}</g><g transform="rotate(32)">${blade(id, p, 1.0)}</g>`;
  else if (idx === 4) art = `<g transform="rotate(-36)">${blade(id, p, 1.18)}</g><g transform="rotate(36)">${blade(id, p, 1.18)}</g>
     <path d="M0 -18 L14 -4 L0 18 L-14 -4Z" fill="#dff0ff" stroke="#050a24" stroke-width="2.6"/><path d="M0 -18 L5 -4 L0 18 M-14 -4 L14 -4" stroke="#7ab4ff" stroke-width="1.6" fill="none"/>
     ${sparkle(30, -36, 6)}${sparkle(-34, 30, 5)}`;
  else art = `<g class="em-flame">${flames()}</g>
     <g transform="rotate(-38)">${blade(id, p, 1.28)}</g><g transform="rotate(38)">${blade(id, p, 1.28)}</g>
     <circle r="11" fill="#ff1f3d" stroke="#050a24" stroke-width="2.6"/><circle r="4.5" cx="-3" cy="-3" fill="#fff" opacity=".7"/>
     <path d="M-20 -46 L-13 -64 L-5 -51 L0 -68 L5 -51 L13 -64 L20 -46 Z" fill="#ffcc33" stroke="#050a24" stroke-width="2.6"/>
     ${sparkle(34, -30, 6)}${sparkle(-36, -20, 5)}${sparkle(30, 34, 5)}`;
  return `<svg class="emblem-svg tier${idx}" viewBox="-70 -72 140 140" width="${size}" height="${size}">${defs}${glow}${shield}${art}</svg>`;
}
function laurel(p, s) {
  let out = '';
  for (let i = 0; i < 6; i++) [-1, 1].forEach(sd => { const a = (100 + i * 22) * Math.PI / 180, x = Math.cos(a) * 38 * sd, y = Math.sin(a) * 38 - 4;
    out += `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.2" transform="rotate(${(sd > 0 ? 180 - (100 + i * 22) : 100 + i * 22) + 90 * sd} ${x} ${y})" fill="${p.b}" stroke="#050a24" stroke-width="1.6"/>`; });
  return `<g transform="scale(${s})">${out}</g>`;
}
function sparkle(x, y, r) { return `<path class="em-spark" d="M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5}Z" fill="#fff"/>`; }
function flames() {
  return [-34, -17, 0, 17, 34].map((x, i) => `<path d="M${x} 46 Q${x - 12} ${20 - i % 2 * 8} ${x} ${-2 - (i === 2 ? 16 : i % 2 * 6)} Q${x + 12} ${20 - i % 2 * 8} ${x} 46Z" fill="${i % 2 ? '#ff8a1a' : '#ff3b2e'}" opacity=".85"/>`).join('');
}
