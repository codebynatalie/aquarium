// Creature parts you can add in the drawing pad. Each part draws itself
// centred on (0,0) inside a w x h box, using the chosen colour.

const OUT = '#1b1b1f';
const PI = Math.PI;

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
const line = (c, w = 5) => { c.strokeStyle = OUT; c.lineWidth = w; c.stroke(); };
const fs = (c, fill, w = 5) => { c.fillStyle = fill; c.fill(); if (w) line(c, w); };
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, PI * 2); };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, PI * 2); };
const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); };
const shine = (c, x, y, r) => { circle(c, x, y, r); c.fillStyle = '#fff'; c.fill(); };
const grad = (c, y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
const body = (c, col, h) => grad(c, -h / 2, h / 2, shade(col, 0.25), shade(col, -0.2));

function eyeBall(c, r, iris, look = 0.25) {
  circle(c, 0, 0, r); fs(c, '#fff', 4);
  circle(c, r * look, 0, r * 0.55); c.fillStyle = iris; c.fill();
  circle(c, r * look, 0, r * 0.3); c.fillStyle = '#111'; c.fill();
  shine(c, r * look + r * 0.18, -r * 0.2, r * 0.13);
}

function finRibs(c, from, tos, w = 3) {
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = w;
  for (const t of tos) { c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(t[0], t[1]); c.stroke(); }
}

function heart(c, s) {
  c.beginPath();
  c.moveTo(0, s * 0.35);
  c.bezierCurveTo(-s * 0.9, -s * 0.25, -s * 0.45, -s * 0.85, 0, -s * 0.4);
  c.bezierCurveTo(s * 0.45, -s * 0.85, s * 0.9, -s * 0.25, 0, s * 0.35);
}

export const PART_CATS = [
  ['eyes', 'Eyes'], ['mouths', 'Mouths'], ['teeth', 'Teeth'], ['fins', 'Fins'], ['tails', 'Tails'], ['gills', 'Gills & patterns'],
  ['bodies', 'Bodies'], ['tentacles', 'Tentacles & claws'], ['people', 'People'], ['extras', 'Fun extras'],
];

export const PARTS = {
  // ---------------- eyes ----------------
  googly: { cat: 'eyes', name: 'Googly eye', w: 90, h: 90, color: '#3a7bd5', draw(c) { circle(c, 0, 0, 40); fs(c, '#fff', 4); circle(c, 12, 8, 19); c.fillStyle = '#111'; c.fill(); shine(c, 18, 2, 5); } },
  cute: { cat: 'eyes', name: 'Big cute eye', w: 80, h: 100, color: '#7b4a2a', draw(c, col) { ell(c, 0, 0, 34, 44); fs(c, '#111', 4); ell(c, 0, 10, 26, 30); c.fillStyle = col; c.fill(); shine(c, 10, -16, 11); shine(c, -10, 18, 6); } },
  fisheye: { cat: 'eyes', name: 'Fish eye', w: 80, h: 80, color: '#f2b233', draw(c, col) { eyeBall(c, 34, col); } },
  angry: { cat: 'eyes', name: 'Angry eye', w: 100, h: 100, color: '#c0392b', draw(c, col) { c.save(); c.translate(0, 12); eyeBall(c, 32, col, 0.1); c.restore(); poly(c, [[-42, -30], [44, -10], [44, -2], [-42, -20]]); fs(c, OUT, 0); } },
  sleepy: { cat: 'eyes', name: 'Sleepy eye', w: 90, h: 90, color: '#5fae3a', draw(c, col) { eyeBall(c, 38, '#4a6cd5', 0.1); c.beginPath(); c.arc(0, 0, 38, PI, 0); c.lineTo(38, 4); c.lineTo(-38, 4); c.closePath(); fs(c, col, 4); } },
  humaneye: { cat: 'eyes', name: 'Human eye', w: 120, h: 70, color: '#3a8a5a', draw(c, col) {
    c.beginPath(); c.moveTo(-52, 0); c.quadraticCurveTo(0, -42, 52, 0); c.quadraticCurveTo(0, 42, -52, 0); fs(c, '#fff', 4);
    circle(c, 0, 0, 18); c.fillStyle = col; c.fill(); circle(c, 0, 0, 9); c.fillStyle = '#111'; c.fill(); shine(c, 6, -6, 4);
    c.strokeStyle = OUT; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 16, -20 + Math.abs(i) * 3); c.lineTo(i * 20, -32 + Math.abs(i) * 4); c.stroke(); }
  } },
  eyepair: { cat: 'eyes', name: 'Pair of eyes', w: 170, h: 90, color: '#3a7bd5', draw(c, col) { for (const x of [-42, 42]) { c.save(); c.translate(x, 0); eyeBall(c, 36, col); c.restore(); } } },
  cyclops: { cat: 'eyes', name: 'Giant eye', w: 160, h: 160, color: '#9b59b6', draw(c, col) { eyeBall(c, 72, col, 0.15); } },
  hearteyes: { cat: 'eyes', name: 'Heart eye', w: 90, h: 90, color: '#ff3b6b', draw(c, col) { heart(c, 80); fs(c, col, 4); shine(c, -14, -16, 7); } },

  // ---------------- mouths ----------------
  smile: { cat: 'mouths', name: 'Smile', w: 110, h: 50, color: '#e74c3c', draw(c) { c.beginPath(); c.arc(0, -30, 48, 0.25 * PI, 0.75 * PI); c.lineCap = 'round'; line(c, 7); } },
  grin: { cat: 'mouths', name: 'Big grin', w: 130, h: 80, color: '#ff7a9a', draw(c, col) {
    c.beginPath(); c.moveTo(-58, -26); c.quadraticCurveTo(0, -14, 58, -26); c.quadraticCurveTo(50, 40, 0, 40); c.quadraticCurveTo(-50, 40, -58, -26); fs(c, '#3a0d12', 5);
    ell(c, 0, 24, 28, 14); c.fillStyle = col; c.fill();
    c.beginPath(); c.moveTo(-50, -24); c.quadraticCurveTo(0, -12, 50, -24); c.lineTo(46, -10); c.quadraticCurveTo(0, 0, -46, -10); c.closePath(); fs(c, '#fff', 2);
  } },
  lips: { cat: 'mouths', name: 'Fish lips', w: 80, h: 80, color: '#ff5e8a', draw(c, col) { ell(c, 0, -15, 30, 17); fs(c, col, 4); ell(c, 0, 15, 30, 17); fs(c, col, 4); ell(c, -6, -20, 10, 5); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill(); } },
  omouth: { cat: 'mouths', name: 'Surprised', w: 60, h: 80, color: '#e74c3c', draw(c) { ell(c, 0, 0, 22, 32); fs(c, '#3a0d12', 5); ell(c, 0, 16, 12, 8); c.fillStyle = '#ff7a9a'; c.fill(); } },
  grumpy: { cat: 'mouths', name: 'Grumpy', w: 110, h: 50, color: '#e74c3c', draw(c) { c.beginPath(); c.arc(0, 40, 48, 1.25 * PI, 1.75 * PI); c.lineCap = 'round'; line(c, 7); } },
  tongue: { cat: 'mouths', name: 'Tongue out', w: 110, h: 90, color: '#ff6f91', draw(c, col) {
    c.beginPath(); c.moveTo(-34, 6); c.lineTo(-30, 40); c.quadraticCurveTo(0, 62, 26, 40); c.lineTo(28, 6); fs(c, col, 4);
    c.beginPath(); c.moveTo(-2, 10); c.lineTo(-2, 36); line(c, 3);
    c.beginPath(); c.arc(0, -30, 48, 0.2 * PI, 0.8 * PI); c.lineCap = 'round'; line(c, 7);
  } },

  // ---------------- teeth ----------------
  sharkteeth: { cat: 'teeth', name: 'Shark jaws', w: 170, h: 100, color: '#3a0d12', draw(c, col) {
    ell(c, 0, 0, 78, 42); fs(c, col, 5);
    c.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) { const x = -60 + i * 20; poly(c, [[x - 9, -34 + Math.abs(i - 3) * 2], [x + 9, -34 + Math.abs(i - 3) * 2], [x, -10]]); fs(c, '#fff', 2); }
    for (let i = 0; i < 6; i++) { const x = -50 + i * 20; poly(c, [[x - 9, 34 - Math.abs(i - 2.5) * 2], [x + 9, 34 - Math.abs(i - 2.5) * 2], [x, 12]]); fs(c, '#fff', 2); }
  } },
  buck: { cat: 'teeth', name: 'Buck teeth', w: 70, h: 60, color: '#ffffff', draw(c) { for (const x of [-15, 15]) { c.beginPath(); c.roundRect(x - 13, -24, 26, 48, [2, 2, 8, 8]); fs(c, '#fff', 4); } } },
  fangs: { cat: 'teeth', name: 'Fangs', w: 90, h: 60, color: '#ffffff', draw(c) { for (const x of [-26, 26]) { poly(c, [[x - 12, -24], [x + 12, -24], [x, 26]]); fs(c, '#fff', 4); } } },
  teethrow: { cat: 'teeth', name: 'Row of teeth', w: 170, h: 40, color: '#ffffff', draw(c) { c.beginPath(); c.moveTo(-80, -14); for (let i = 0; i <= 8; i++) c.lineTo(-80 + i * 20, i % 2 ? 16 : -14); c.lineTo(80, -18); c.lineTo(-80, -18); c.closePath(); fs(c, '#fff', 4); } },

  // ---------------- fins ----------------
  dorsal: { cat: 'fins', name: 'Top fin', w: 190, h: 110, color: '#ff8c2a', draw(c, col) {
    c.beginPath(); c.moveTo(-90, 50); c.quadraticCurveTo(-60, -60, 40, -50); c.quadraticCurveTo(20, 0, 90, 50); c.closePath(); fs(c, body(c, col, 110));
    finRibs(c, [0, 50], [[-50, -20], [-20, -45], [10, -48], [30, -20]]);
  } },
  sidefin: { cat: 'fins', name: 'Side fin', w: 110, h: 70, color: '#ff8c2a', draw(c, col) {
    c.beginPath(); c.moveTo(50, -10); c.quadraticCurveTo(-10, -40, -52, -6); c.quadraticCurveTo(-30, 30, 50, 10); c.closePath(); fs(c, body(c, col, 70));
    finRibs(c, [48, 0], [[-40, -12], [-36, 4], [-20, 16]]);
  } },
  spiky: { cat: 'fins', name: 'Spiky fin', w: 190, h: 90, color: '#2ecc71', draw(c, col) { c.beginPath(); c.moveTo(-90, 40); for (let i = 0; i < 6; i++) { c.lineTo(-80 + i * 32, -40); c.lineTo(-64 + i * 32, 10); } c.lineTo(90, 40); c.closePath(); fs(c, body(c, col, 90)); } },
  bellyfin: { cat: 'fins', name: 'Belly fin', w: 100, h: 70, color: '#ff8c2a', draw(c, col) { c.beginPath(); c.moveTo(-44, -30); c.lineTo(44, -30); c.quadraticCurveTo(10, 40, -30, 30); c.closePath(); fs(c, body(c, col, 70)); finRibs(c, [0, -30], [[-20, 20], [0, 22], [18, 4]]); } },
  wing: { cat: 'fins', name: 'Wing fin', w: 220, h: 120, color: '#5dade2', draw(c, col) {
    c.beginPath(); c.moveTo(90, 40); c.quadraticCurveTo(0, -70, -100, -50); c.quadraticCurveTo(-60, 0, -100, 30); c.quadraticCurveTo(0, 20, 90, 40); fs(c, body(c, col, 120));
    finRibs(c, [90, 40], [[-90, -45], [-70, -20], [-80, 20]]);
  } },

  // ---------------- tails ----------------
  fantail: { cat: 'tails', name: 'Fan tail', w: 150, h: 180, color: '#ff8c2a', draw(c, col) {
    c.beginPath(); c.moveTo(64, -14); c.quadraticCurveTo(-20, -100, -66, -70); c.quadraticCurveTo(-40, 0, -66, 70); c.quadraticCurveTo(-20, 100, 64, 14); c.closePath(); fs(c, body(c, col, 180));
    finRibs(c, [62, 0], [[-55, -60], [-45, -25], [-45, 25], [-55, 60]]);
  } },
  forktail: { cat: 'tails', name: 'Fork tail', w: 150, h: 170, color: '#ffd23a', draw(c, col) { poly(c, [[66, -12], [-66, -80], [-20, 0], [-66, 80], [66, 12]]); fs(c, body(c, col, 170)); } },
  mermaid: { cat: 'tails', name: 'Mermaid tail', w: 160, h: 200, color: '#1abc9c', draw(c, col) {
    c.beginPath(); c.moveTo(70, -20); c.quadraticCurveTo(0, -20, -20, -10); c.quadraticCurveTo(-60, -95, -76, -60); c.quadraticCurveTo(-60, -10, -30, 0);
    c.quadraticCurveTo(-60, 10, -76, 60); c.quadraticCurveTo(-60, 95, -20, 10); c.quadraticCurveTo(0, 20, 70, 20); c.closePath(); fs(c, body(c, col, 200));
  } },
  flowytail: { cat: 'tails', name: 'Flowy tail', w: 200, h: 200, color: '#ff6b9d', draw(c, col) {
    c.beginPath(); c.moveTo(90, -10); c.bezierCurveTo(10, -110, -60, -70, -95, -40); c.bezierCurveTo(-50, -20, -100, 20, -80, 60); c.bezierCurveTo(-40, 100, 20, 60, 90, 10); c.closePath(); fs(c, body(c, col, 200));
    finRibs(c, [88, 0], [[-80, -40], [-70, 0], [-60, 50]], 2);
  } },
  sharktail: { cat: 'tails', name: 'Shark tail', w: 150, h: 190, color: '#8d9aa8', draw(c, col) { poly(c, [[70, -10], [-60, -90], [-30, 0], [-50, 70], [70, 14]]); fs(c, body(c, col, 190)); } },

  // ---------------- gills & patterns ----------------
  gills: { cat: 'gills', name: 'Gills', w: 70, h: 110, color: '#c0392b', draw(c) { c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-60 + i * 20, 0, 50, -0.6, 0.6); line(c, 5); } } },
  gillflap: { cat: 'gills', name: 'Gill flap', w: 70, h: 120, color: '#e67e22', draw(c, col) { c.beginPath(); c.arc(-40, 0, 58, -0.95, 0.95); c.arc(-62, 0, 52, 0.95, -0.95, true); c.closePath(); fs(c, shade(col, -0.25), 4); } },
  scales: { cat: 'gills', name: 'Scales', w: 170, h: 110, color: '#f39c12', draw(c, col) {
    c.strokeStyle = shade(col, -0.45); c.lineWidth = 3;
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-70 + i * 28 + (r % 2) * 14, -40 + r * 26, 14, 0, PI); c.stroke(); }
  } },
  spots: { cat: 'gills', name: 'Spots', w: 170, h: 110, color: '#2c3e50', draw(c, col) { const pts = [[-60, -30, 14], [-20, 10, 18], [30, -25, 12], [60, 20, 16], [-50, 35, 10], [10, 40, 9], [70, -35, 8]]; for (const [x, y, r] of pts) { circle(c, x, y, r); c.fillStyle = col; c.fill(); } } },
  stripes: { cat: 'gills', name: 'Stripes', w: 150, h: 150, color: '#ffffff', draw(c, col) { for (const x of [-50, 0, 50]) { c.beginPath(); c.roundRect(x - 13, -70, 26, 140, 13); fs(c, col, 4); } } },
  sparkles: { cat: 'gills', name: 'Sparkles', w: 150, h: 110, color: '#ffd23a', draw(c, col) { for (const [x, y, s] of [[-50, -20, 22], [20, 20, 30], [55, -35, 16], [-20, 40, 14]]) { c.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.35 : s; c.lineTo(x + Math.cos(k * PI / 4) * r, y + Math.sin(k * PI / 4) * r); } c.closePath(); fs(c, col, 3); } } },

  // ---------------- bodies ----------------
  ovalbody: { cat: 'bodies', name: 'Fish body', w: 330, h: 200, color: '#ff8c2a', draw(c, col) {
    c.beginPath(); c.moveTo(-160, 0); c.bezierCurveTo(-100, -105, 110, -110, 160, -10); c.quadraticCurveTo(166, 0, 160, 10); c.bezierCurveTo(110, 110, -100, 105, -160, 0); fs(c, body(c, col, 200));
    ell(c, 10, 40, 100, 34); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
  } },
  roundbody: { cat: 'bodies', name: 'Round body', w: 250, h: 240, color: '#f1c40f', draw(c, col) { ell(c, 0, 0, 120, 112); fs(c, body(c, col, 240)); ell(c, -10, 45, 80, 40); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill(); } },
  longbody: { cat: 'bodies', name: 'Long body', w: 430, h: 110, color: '#27ae60', draw(c, col) { c.beginPath(); c.moveTo(-210, 0); c.bezierCurveTo(-150, -60, 150, -60, 210, -5); c.lineTo(210, 5); c.bezierCurveTo(150, 60, -150, 60, -210, 0); fs(c, body(c, col, 110)); } },
  tallbody: { cat: 'bodies', name: 'Tall body', w: 230, h: 270, color: '#9b59b6', draw(c, col) { c.beginPath(); c.moveTo(-110, 0); c.quadraticCurveTo(-20, -150, 110, -10); c.quadraticCurveTo(116, 0, 110, 10); c.quadraticCurveTo(-20, 150, -110, 0); fs(c, body(c, col, 270)); } },
  sharkbody: { cat: 'bodies', name: 'Shark body', w: 390, h: 160, color: '#8d9aa8', draw(c, col) {
    c.beginPath(); c.moveTo(-190, 0); c.bezierCurveTo(-100, -70, 120, -80, 190, -10); c.quadraticCurveTo(195, 10, 160, 20); c.bezierCurveTo(100, 60, -100, 50, -190, 0); fs(c, body(c, col, 160));
    c.beginPath(); c.moveTo(-150, 10); c.bezierCurveTo(-60, 40, 100, 40, 165, 18); c.bezierCurveTo(100, 55, -80, 50, -150, 10); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
  } },
  jellydome: { cat: 'bodies', name: 'Jelly dome', w: 250, h: 170, color: '#ff8fd0', draw(c, col) { c.beginPath(); c.moveTo(-118, 70); c.bezierCurveTo(-130, -110, 130, -110, 118, 70); c.quadraticCurveTo(0, 40, -118, 70); fs(c, body(c, col, 170)); ell(c, -30, -30, 40, 16, -0.3); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill(); } },
  crabshell: { cat: 'bodies', name: 'Shell body', w: 270, h: 170, color: '#e74c3c', draw(c, col) { ell(c, 0, 0, 128, 78); fs(c, body(c, col, 170)); c.beginPath(); c.arc(0, 0, 50, 0.2, PI - 0.2); line(c, 3); } },
  starbody: { cat: 'bodies', name: 'Star body', w: 220, h: 220, color: '#ff7a3a', draw(c, col) { c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 42 : 104, a = -PI / 2 + k * PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); fs(c, body(c, col, 220)); } },

  // ---------------- tentacles & claws ----------------
  tentacle: { cat: 'tentacles', name: 'Curly tentacle', w: 130, h: 230, color: '#9b59b6', draw(c, col) {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([Math.sin(t * 5) * 30 * t + (t > 0.8 ? Math.cos((t - 0.8) * 25) * 20 : 0), -105 + t * 210]); }
    c.lineCap = 'round';
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = OUT; c.lineWidth = 34; c.stroke();
    for (let i = 0; i < pts.length - 1; i++) { const t = i / 40; c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.strokeStyle = col; c.lineWidth = 26 * (1 - t * 0.7); c.stroke(); }
    for (let i = 4; i < 36; i += 5) { circle(c, pts[i][0] + 6, pts[i][1], 4 * (1 - i / 50)); c.fillStyle = shade(col, 0.5); c.fill(); }
  } },
  tentacles: { cat: 'tentacles', name: 'Tentacle bunch', w: 250, h: 230, color: '#e056a0', draw(c, col) {
    c.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const x0 = -90 + k * 45;
      c.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20; c.lineTo(x0 + Math.sin(t * 6 + k) * 18, -100 + t * 200); }
      c.strokeStyle = OUT; c.lineWidth = 26; c.stroke(); c.strokeStyle = col; c.lineWidth = 18; c.stroke();
    }
  } },
  jellystrings: { cat: 'tentacles', name: 'Jelly strings', w: 210, h: 250, color: '#ffb0dd', draw(c, col) {
    c.lineCap = 'round';
    for (let k = 0; k < 7; k++) { const x0 = -90 + k * 30; c.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24; c.lineTo(x0 + Math.sin(t * 8 + k) * 10, -115 + t * 230); } c.strokeStyle = col; c.lineWidth = 7; c.stroke(); }
  } },
  claw: { cat: 'tentacles', name: 'Crab claw', w: 150, h: 120, color: '#e74c3c', draw(c, col) {
    c.beginPath(); c.moveTo(-70, 30); c.lineTo(-20, 20); c.lineTo(-20, 36); c.lineTo(-70, 44); c.closePath(); fs(c, col, 4);
    c.beginPath(); c.moveTo(-25, 30); c.bezierCurveTo(-30, -40, 50, -60, 70, -20); c.lineTo(20, -5); c.lineTo(66, 10); c.bezierCurveTo(40, 55, -10, 55, -25, 30); fs(c, body(c, col, 120));
  } },

  // ---------------- people ----------------
  head: { cat: 'people', name: 'Head', w: 150, h: 160, color: '#f2c29a', draw(c, col) { ell(c, -64, 6, 14, 20); fs(c, col, 4); ell(c, 64, 6, 14, 20); fs(c, col, 4); ell(c, 0, 0, 64, 74); fs(c, col, 5); ell(c, -32, 22, 12, 8); c.fillStyle = 'rgba(255,120,120,0.4)'; c.fill(); ell(c, 32, 22, 12, 8); c.fill(); } },
  hair: { cat: 'people', name: 'Short hair', w: 170, h: 100, color: '#6b3e1e', draw(c, col) { c.beginPath(); c.moveTo(-76, 40); c.bezierCurveTo(-90, -60, 90, -60, 76, 40); c.quadraticCurveTo(50, 0, 10, 4); c.quadraticCurveTo(-30, -10, -40, 10); c.quadraticCurveTo(-60, 0, -76, 40); fs(c, col, 4); } },
  longhair: { cat: 'people', name: 'Long hair', w: 180, h: 230, color: '#f1c40f', draw(c, col) { c.beginPath(); c.moveTo(-80, 110); c.bezierCurveTo(-110, -40, -70, -112, 0, -112); c.bezierCurveTo(70, -112, 110, -40, 80, 110); c.quadraticCurveTo(60, 70, 54, -20); c.quadraticCurveTo(0, -50, -54, -20); c.quadraticCurveTo(-60, 70, -80, 110); fs(c, col, 4); } },
  torso: { cat: 'people', name: 'Body / shirt', w: 160, h: 190, color: '#3498db', draw(c, col) { c.beginPath(); c.moveTo(-50, -90); c.lineTo(50, -90); c.quadraticCurveTo(78, -80, 74, -40); c.lineTo(64, 90); c.lineTo(-64, 90); c.lineTo(-74, -40); c.quadraticCurveTo(-78, -80, -50, -90); fs(c, body(c, col, 190)); c.beginPath(); c.arc(0, -90, 22, 0, PI); line(c, 4); } },
  arm: { cat: 'people', name: 'Arm', w: 170, h: 60, color: '#3498db', draw(c, col) { c.beginPath(); c.roundRect(-80, -18, 120, 36, 18); fs(c, col, 4); circle(c, 58, 0, 22); fs(c, '#f2c29a', 4); } },
  leg: { cat: 'people', name: 'Leg', w: 90, h: 210, color: '#2c3e50', draw(c, col) { c.beginPath(); c.roundRect(-22, -100, 44, 170, 16); fs(c, col, 4); c.beginPath(); c.roundRect(-26, 62, 64, 34, [16, 16, 8, 8]); fs(c, '#e74c3c', 4); } },
  hand: { cat: 'people', name: 'Waving hand', w: 80, h: 90, color: '#f2c29a', draw(c, col) { c.lineCap = 'round'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-18 + i * 12, 0); c.lineTo(-24 + i * 14, -36 + Math.abs(i - 1.5) * 6); c.strokeStyle = OUT; c.lineWidth = 16; c.stroke(); c.strokeStyle = col; c.lineWidth = 10; c.stroke(); } c.beginPath(); c.moveTo(-26, 10); c.lineTo(-38, -10); c.strokeStyle = OUT; c.lineWidth = 16; c.stroke(); c.strokeStyle = col; c.lineWidth = 10; c.stroke(); ell(c, -2, 16, 28, 26); fs(c, col, 4); } },
  person: { cat: 'people', name: 'Whole person', w: 190, h: 370, color: '#e74c3c', draw(c, col) {
    const skin = '#f2c29a';
    c.lineCap = 'round';
    const limb = (x0, y0, x1, y1, w, fill) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = OUT; c.lineWidth = w + 8; c.stroke(); c.strokeStyle = fill; c.lineWidth = w; c.stroke(); };
    limb(-24, 70, -34, 160, 30, '#2c3e50'); limb(24, 70, 34, 160, 30, '#2c3e50');
    limb(-50, -40, -86, 40, 22, col); limb(50, -40, 86, 40, 22, col);
    circle(c, -88, 50, 15); fs(c, skin, 4); circle(c, 88, 50, 15); fs(c, skin, 4);
    c.beginPath(); c.roundRect(-56, -60, 112, 140, 26); fs(c, body(c, col, 140));
    circle(c, 0, -112, 52); fs(c, skin, 5);
    c.beginPath(); c.moveTo(-50, -110); c.bezierCurveTo(-60, -180, 60, -180, 50, -110); c.quadraticCurveTo(10, -140, -50, -110); fs(c, '#6b3e1e', 4);
    circle(c, -18, -110, 6); c.fillStyle = OUT; c.fill(); circle(c, 18, -110, 6); c.fill();
    c.beginPath(); c.arc(0, -96, 16, 0.2 * PI, 0.8 * PI); line(c, 4);
  } },
  swimmer: { cat: 'people', name: 'Swimming person', w: 400, h: 150, color: '#ff8c2a', draw(c, col) {
    const skin = '#f2c29a';
    c.lineCap = 'round';
    const limb = (x0, y0, x1, y1, w, fill) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = OUT; c.lineWidth = w + 8; c.stroke(); c.strokeStyle = fill; c.lineWidth = w; c.stroke(); };
    limb(-60, -6, -170, -30, 28, '#2c3e50'); limb(-60, 14, -170, 30, 28, '#2c3e50');
    poly(c, [[-170, -40], [-198, -66], [-198, -14]]); fs(c, '#ffd400', 4); poly(c, [[-170, 30], [-198, 6], [-198, 56]]); fs(c, '#ffd400', 4);
    limb(60, 0, 150, -40, 20, skin);
    c.beginPath(); c.roundRect(-70, -30, 150, 60, 30); fs(c, body(c, col, 60));
    circle(c, 120, -6, 38); fs(c, skin, 5);
    c.beginPath(); c.arc(120, -6, 40, PI, 1.95 * PI); c.lineTo(120, -6); fs(c, '#6b3e1e', 4);
    circle(c, 140, -4, 5); c.fillStyle = OUT; c.fill();
  } },

  // ---------------- fun extras ----------------
  crown: { cat: 'extras', name: 'Crown', w: 150, h: 100, color: '#ffd23a', draw(c, col) { poly(c, [[-66, 40], [-66, -30], [-34, 4], [0, -44], [34, 4], [66, -30], [66, 40]]); fs(c, body(c, col, 100)); for (const x of [-34, 0, 34]) { circle(c, x, 22, 8); c.fillStyle = ['#e74c3c', '#3498db', '#2ecc71'][(x + 34) / 34]; c.fill(); } } },
  tophat: { cat: 'extras', name: 'Top hat', w: 150, h: 130, color: '#2c2c34', draw(c, col) { c.beginPath(); c.roundRect(-44, -60, 88, 100, 6); fs(c, col, 4); c.fillStyle = '#e74c3c'; c.fillRect(-42, 14, 84, 16); ell(c, 0, 44, 72, 14); fs(c, col, 4); } },
  partyhat: { cat: 'extras', name: 'Party hat', w: 100, h: 130, color: '#9b59b6', draw(c, col) { poly(c, [[-44, 56], [0, -56], [44, 56]]); fs(c, col, 4); for (const [x, y] of [[-10, 30], [12, 0], [-4, -24], [20, 40]]) { circle(c, x, y, 6); c.fillStyle = '#ffd23a'; c.fill(); } circle(c, 0, -58, 12); fs(c, '#ffd23a', 3); } },
  mustache: { cat: 'extras', name: 'Mustache', w: 150, h: 60, color: '#4a2a14', draw(c, col) { c.beginPath(); c.moveTo(0, -8); c.bezierCurveTo(-30, -30, -60, -10, -70, 10); c.bezierCurveTo(-50, 0, -30, 16, 0, 6); c.bezierCurveTo(30, 16, 50, 0, 70, 10); c.bezierCurveTo(60, -10, 30, -30, 0, -8); fs(c, col, 3); } },
  glasses: { cat: 'extras', name: 'Glasses', w: 180, h: 70, color: '#2c2c34', draw(c, col) { for (const x of [-44, 44]) { circle(c, x, 0, 32); c.fillStyle = 'rgba(180,230,255,0.45)'; c.fill(); c.strokeStyle = col; c.lineWidth = 7; c.stroke(); } c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(0, -14, 12, -4); c.stroke(); } },
  sunglasses: { cat: 'extras', name: 'Sunglasses', w: 180, h: 70, color: '#111111', draw(c, col) { for (const x of [-44, 44]) { c.beginPath(); c.roundRect(x - 36, -24, 72, 48, [6, 6, 24, 24]); fs(c, col, 4); c.beginPath(); c.moveTo(x - 24, -14); c.lineTo(x - 8, -14); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 4; c.stroke(); } c.beginPath(); c.moveTo(-8, -14); c.lineTo(8, -14); line(c, 6); } },
  mask: { cat: 'extras', name: 'Scuba mask', w: 150, h: 90, color: '#1abc9c', draw(c, col) { c.beginPath(); c.roundRect(-66, -36, 132, 72, 26); fs(c, col, 5); c.beginPath(); c.roundRect(-52, -24, 104, 48, 18); fs(c, 'rgba(160,225,255,0.85)', 3); c.beginPath(); c.moveTo(-36, -12); c.lineTo(-16, -12); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke(); } },
  snorkel: { cat: 'extras', name: 'Snorkel', w: 70, h: 170, color: '#ff8c2a', draw(c, col) { c.lineCap = 'round'; c.beginPath(); c.moveTo(10, -76); c.lineTo(10, 50); c.quadraticCurveTo(10, 72, -16, 72); c.strokeStyle = OUT; c.lineWidth = 22; c.stroke(); c.strokeStyle = col; c.lineWidth = 14; c.stroke(); } },
  tank: { cat: 'extras', name: 'Air tank', w: 90, h: 210, color: '#ffd23a', draw(c, col) { c.beginPath(); c.roundRect(-34, -80, 68, 176, 30); fs(c, body(c, col, 210)); c.beginPath(); c.roundRect(-10, -100, 20, 22, 4); fs(c, '#7f8c8d', 4); } },
  flippers: { cat: 'extras', name: 'Flippers', w: 170, h: 80, color: '#ffd400', draw(c, col) { for (const y of [-18, 18]) { c.beginPath(); c.moveTo(70, y - 8); c.lineTo(-76, y - 24); c.lineTo(-76, y + 24); c.lineTo(70, y + 8); c.closePath(); fs(c, col, 4); } } },
  bow: { cat: 'extras', name: 'Bow', w: 120, h: 80, color: '#ff4d8d', draw(c, col) { poly(c, [[0, 0], [-52, -30], [-52, 30]]); fs(c, col, 4); poly(c, [[0, 0], [52, -30], [52, 30]]); fs(c, col, 4); circle(c, 0, 0, 12); fs(c, shade(col, -0.2), 4); } },
  horn: { cat: 'extras', name: 'Unicorn horn', w: 70, h: 140, color: '#f8e16c', draw(c, col) { poly(c, [[-24, 60], [0, -64], [24, 60]]); fs(c, body(c, col, 140)); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-20 + i * 4, 44 - i * 28); c.lineTo(18 - i * 4, 34 - i * 28); c.stroke(); } } },
  heart: { cat: 'extras', name: 'Heart', w: 100, h: 90, color: '#ff3b6b', draw(c, col) { c.save(); c.translate(0, 8); heart(c, 96); fs(c, col, 4); c.restore(); } },
  bubbles: { cat: 'extras', name: 'Bubbles', w: 110, h: 140, color: '#bfe9ff', draw(c, col) { for (const [x, y, r] of [[-20, 40, 26], [24, -10, 18], [-6, -50, 12]]) { circle(c, x, y, r); c.fillStyle = 'rgba(200,240,255,0.35)'; c.fill(); c.strokeStyle = col; c.lineWidth = 4; c.stroke(); shine(c, x - r * 0.35, y - r * 0.35, r * 0.2); } } },
};

// Draw a part with the right colour into any 2D context.
export function drawPart(ctx, id, color) {
  const p = PARTS[id];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  p.draw(ctx, color || p.color);
  ctx.restore();
}

const thumbCache = new Map();
export function partThumb(id) {
  if (thumbCache.has(id)) return thumbCache.get(id);
  const p = PARTS[id];
  const S = 72;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const k = (S - 8) / Math.max(p.w, p.h);
  ctx.translate(S / 2, S / 2);
  ctx.scale(k, k);
  drawPart(ctx, id);
  const url = cv.toDataURL();
  thumbCache.set(id, url);
  return url;
}
