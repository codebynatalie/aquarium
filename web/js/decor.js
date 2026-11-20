// Library of procedurally built decorations.
import { Geo, mat } from './geom.js';
import { rng, fbm3, noise3, clamp } from './noise.js';
import { hexToRgb } from './gl.js';

const C = hexToRgb;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const PI = Math.PI;

function curvePath(r, h, n, lean, bend, start = [0, 0, 0], dir = r() * PI * 2) {
  const pts = [];
  const lx = Math.cos(dir), lz = Math.sin(dir);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = lean * t + bend * t * t;
    pts.push([start[0] + lx * off, start[1] + h * t, start[2] + lz * off]);
  }
  return pts;
}

function rockShape(g, r, size, colA, colB, { flat = 0.75, moss = 0, rough = 0.35 } = {}) {
  const seed = r() * 100;
  g.sphere(size, size * flat, size * (0.8 + r() * 0.4), 22, (u, v, p) => {
    const n = fbm3(p[0] * 1.3 + seed, p[1] * 1.3, p[2] * 1.3, 3);
    let c = mix(colA, colB, clamp(0.5 + n, 0, 1));
    if (moss && p[1] > size * flat * 0.35) c = mix(c, C('#4f7a2c'), moss * clamp((p[1] / (size * flat) - 0.35) * 2.5, 0, 1));
    return c;
  }, (x, y, z) => 1 + rough * fbm3(x * 1.6 + seed, y * 1.6, z * 1.6, 4) + 0.12 * noise3(x * 5 + seed, y * 5, z * 5), { yMin: -0.25 });
}

export const DECOR = {
  // ---------------- plants ----------------
  seaweed: {
    name: 'Seaweed', cat: 'plants', icon: '🌿', sway: 0.35,
    build(g, r) {
      g.sway = 1;
      const n = r.int(6, 9);
      for (let i = 0; i < n; i++) {
        const h = r.range(2.4, 4.6);
        const base = [r.range(-0.3, 0.3), 0, r.range(-0.3, 0.3)];
        const pts = curvePath(r, h, 12, r.range(-0.3, 0.6), r.range(0.2, 1.2), base);
        const dark = mix(C('#1f5a23'), C('#2c6e2a'), r()), light = mix(C('#6fb33a'), C('#8ccf4a'), r());
        g.ribbon(pts, t => 0.38 * (1 - t * 0.75) * (0.4 + 0.6 * Math.sin(Math.min(1, t * 4 + 0.15) * PI / 2)), (u, v) => mix(dark, light, v), [Math.cos(i), 0, Math.sin(i)], { fold: 0.25 });
      }
    },
  },
  kelp: {
    name: 'Giant kelp', cat: 'plants', icon: '🎋', sway: 0.9,
    build(g, r) {
      g.sway = 1;
      const n = r.int(2, 4);
      for (let i = 0; i < n; i++) {
        const h = r.range(10, 12.5);
        const base = [r.range(-0.6, 0.6), 0, r.range(-0.6, 0.6)];
        const pts = curvePath(r, h, 18, r.range(-0.8, 0.8), r.range(-1, 1), base);
        g.tube(pts, 0.07, 5, C('#6b5a1e'));
        for (let k = 3; k < 18; k += 1) {
          const p = pts[k];
          const side = k % 2 ? 1 : -1;
          const a = r() * PI * 2;
          const len = r.range(1.2, 2.0) * (1 - k / 26);
          const leaf = curvePath(r, len * 0.6, 6, len * 0.9 * side, 0.2, p, a);
          g.ribbon(leaf, t => 0.45 * Math.sin(PI * Math.min(1, t * 1.1 + 0.05)), (u, v) => mix(C('#5c6b1c'), C('#a9a53a'), v * 0.7 + u * 0.2), [Math.cos(a + 1.5), 0.3, Math.sin(a + 1.5)], { fold: 0.15 });
        }
        const top = pts[pts.length - 1];
        g.push(mat(top[0], top[1], top[2]), () => g.sphere(0.22, 0.3, 0.22, 8, C('#8a7a2a')));
      }
    },
  },
  grass: {
    name: 'Grass tuft', cat: 'plants', icon: '🌱', sway: 0.15,
    build(g, r) {
      g.sway = 1;
      const n = r.int(28, 40);
      for (let i = 0; i < n; i++) {
        const h = r.range(0.7, 1.9);
        const a = r() * PI * 2, d = Math.sqrt(r()) * 0.9;
        const pts = curvePath(r, h, 5, r.range(0, 0.3), r.range(0.1, 0.5), [Math.cos(a) * d, 0, Math.sin(a) * d], a);
        g.ribbon(pts, t => 0.09 * (1 - t), (u, v) => mix(C('#2f6b1f'), C('#9be05a'), v), [-Math.sin(a), 0, Math.cos(a)]);
      }
    },
  },
  sword: {
    name: 'Sword plant', cat: 'plants', icon: '🪴', sway: 0.12,
    build(g, r) {
      g.sway = 1;
      const n = r.int(10, 15);
      for (let i = 0; i < n; i++) {
        const a = i / n * PI * 2 + r() * 0.4;
        const h = r.range(1.8, 3.2);
        const pts = curvePath(r, h, 10, r.range(0.4, 0.9), r.range(0.4, 1.0), [0, 0, 0], a);
        g.ribbon(pts, t => 0.55 * Math.sin(PI * Math.min(1, 0.08 + t * 0.95)) * (t < 0.2 ? t * 3 + 0.2 : 1), (u, v) => mix(C('#24611f'), C('#5fae3a'), v * 0.8 + Math.abs(u - 0.5) * 0.3), [-Math.sin(a), 0.2, Math.cos(a)], { fold: 0.3 });
      }
    },
  },
  redplant: {
    name: 'Red plant', cat: 'plants', icon: '🌺', sway: 0.2,
    build(g, r) {
      g.sway = 1;
      const n = r.int(4, 7);
      for (let i = 0; i < n; i++) {
        const h = r.range(2.2, 3.8);
        const base = [r.range(-0.4, 0.4), 0, r.range(-0.4, 0.4)];
        const pts = curvePath(r, h, 10, r.range(-0.2, 0.3), r.range(0, 0.5), base);
        g.tube(pts, 0.035, 4, C('#7a3a2a'), { capEnd: false });
        for (let k = 2; k <= 10; k++) {
          const p = pts[k];
          const t = k / 10;
          for (const s of [0, PI]) {
            const a = k * 1.3 + s;
            const leaf = [p, [p[0] + Math.cos(a) * 0.25, p[1] + 0.12, p[2] + Math.sin(a) * 0.25], [p[0] + Math.cos(a) * 0.45, p[1] + 0.18, p[2] + Math.sin(a) * 0.45]];
            g.ribbon(leaf, q => 0.2 * Math.sin(PI * Math.min(1, q * 0.9 + 0.1)), mix(C('#4f7d2a'), C('#e0473a'), clamp(t * 1.3, 0, 1)), [-Math.sin(a), 0.4, Math.cos(a)]);
          }
        }
      }
    },
  },
  mossball: {
    name: 'Moss ball', cat: 'plants', icon: '🟢', sway: 0,
    build(g, r) {
      const n = r.int(1, 3);
      for (let i = 0; i < n; i++) {
        const s = r.range(0.35, 0.6), x = i * 0.9 - (n - 1) * 0.45;
        g.push(mat(x, s * 0.85, r.range(-0.3, 0.3)), () => g.sphere(s, s * 0.9, s, 20, (u, v, p) => mix(C('#2e5a1c'), C('#5f9b34'), clamp(0.5 + fbm3(p[0] * 6, p[1] * 6, p[2] * 6) * 1.5, 0, 1)),
          (x2, y2, z2) => 1 + 0.08 * fbm3(x2 * 7, y2 * 7, z2 * 7, 3)));
      }
    },
  },

  // ---------------- coral ----------------
  branchcoral: {
    name: 'Branch coral', cat: 'coral', icon: '🪸', sway: 0,
    build(g, r) {
      const base = mix(C('#ff6f91'), C('#ff9a5a'), r());
      const tip = mix(base, C('#fff0d8'), 0.55);
      const branch = (p, dir, len, rad, depth) => {
        const pts = [];
        let d = dir.slice(), q = p.slice();
        for (let i = 0; i <= 5; i++) {
          pts.push(q.slice());
          d = [d[0] + r.range(-0.15, 0.15), d[1] + 0.06, d[2] + r.range(-0.15, 0.15)];
          const l = Math.hypot(...d); d = d.map(v => v / l);
          q = [q[0] + d[0] * len / 5, q[1] + d[1] * len / 5, q[2] + d[2] * len / 5];
        }
        g.tube(pts, t => rad * (1 - t * 0.45), 6, (u, v) => mix(base, tip, depth === 0 ? v : v * 0.5 + 0.5));
        if (depth > 0) {
          const k = r.int(2, 3);
          for (let i = 0; i < k; i++) {
            const a = r() * PI * 2;
            branch(pts[r.int(3, 5)], [d[0] + Math.cos(a) * 0.7, d[1] + 0.2, d[2] + Math.sin(a) * 0.7], len * r.range(0.6, 0.8), rad * 0.7, depth - 1);
          }
        }
      };
      const n = r.int(3, 5);
      for (let i = 0; i < n; i++) {
        const a = i / n * PI * 2 + r() * 0.5;
        branch([Math.cos(a) * 0.2, -0.1, Math.sin(a) * 0.2], [Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4], r.range(1.0, 1.5), 0.12, 2);
      }
    },
  },
  braincoral: {
    name: 'Brain coral', cat: 'coral', icon: '🧠', sway: 0,
    build(g, r) {
      const seed = r() * 50;
      const ridge = p => Math.sin(fbm3(p[0] * 1.2 + seed, p[1] * 1.2, p[2] * 1.2, 3) * 26);
      const a = mix(C('#b9a35a'), C('#9fb45d'), r()), b = mix(a, C('#f0e2b0'), 0.6);
      g.sphere(1.3, 0.95, 1.2, 40, (u, v, p) => mix(a, b, 0.5 + 0.5 * ridge(p)),
        (x, y, z) => 1 + 0.035 * ridge([x * 1.3, y * 0.95, z * 1.2]) + 0.08 * noise3(x * 2 + seed, y * 2, z * 2), { yMin: -0.15 });
    },
  },
  seafan: {
    name: 'Sea fan', cat: 'coral', icon: '🪭', sway: 0.12,
    build(g, r) {
      g.sway = 1;
      const col = mix(C('#9c3cc4'), C('#d6457a'), r());
      const grow = (p, ang, len, depth) => {
        const end = [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len, p[2] + r.range(-0.05, 0.05)];
        const mid = [(p[0] + end[0]) / 2 + r.range(-0.1, 0.1), (p[1] + end[1]) / 2, (p[2] + end[2]) / 2];
        g.tube([p, mid, end], 0.035 + depth * 0.012, 4, col, { capEnd: false });
        if (depth > 0) for (const s of [-1, 1]) grow(end, ang + s * r.range(0.2, 0.45), len * r.range(0.65, 0.8), depth - 1);
      };
      grow([0, 0, 0], 0, 0.6, 0);
      for (const a of [-0.5, 0, 0.5]) grow([0, 0.55, 0], a, 0.7, 4);
    },
  },
  tubesponge: {
    name: 'Tube sponge', cat: 'coral', icon: '🧽', sway: 0,
    build(g, r) {
      const col = mix(C('#f2b53a'), C('#e86a2c'), r());
      const n = r.int(4, 7);
      for (let i = 0; i < n; i++) {
        const h = r.range(0.9, 2.4), rad = r.range(0.18, 0.3);
        const a = r() * PI * 2, d = r.range(0, 0.45);
        g.push(mat(Math.cos(a) * d, 0, Math.sin(a) * d, 0, r.range(-0.15, 0.15), r.range(-0.15, 0.15)), () => {
          g.lathe([[rad * 0.8, -0.1], [rad, h * 0.3], [rad * 1.1, h * 0.8], [rad * 1.2, h], [rad * 0.9, h * 0.98], [rad * 0.7, h * 0.6]], 10,
            (u, v) => mix(col, mix(col, C('#5a2a10'), 0.6), v > 0.75 ? 1 : 0), { wobble: 0.08, seed: i });
        });
      }
    },
  },
  anemone: {
    name: 'Anemone', cat: 'coral', icon: '🌸', sway: 0.22,
    build(g, r) {
      const body = mix(C('#c84d7a'), C('#e07a3a'), r()), tip = mix(C('#ffd0f0'), C('#c8a0ff'), r());
      g.lathe([[0.45, 0], [0.4, 0.3], [0.48, 0.5], [0.55, 0.55]], 14, mix(body, C('#5a2030'), 0.3), { capTop: true });
      g.sway = 1;
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996, d = Math.sqrt(i / n) * 0.5;
        const p = [Math.cos(a) * d, 0.55, Math.sin(a) * d];
        const len = r.range(0.8, 1.3);
        const pts = curvePath(r, len * 0.8, 5, len * (0.25 + d), 0.2, p, a);
        g.tube(pts, t => 0.055 * (1 - t * 0.7), 4, (u, v) => mix(body, tip, v));
      }
    },
  },
  tablecoral: {
    name: 'Table coral', cat: 'coral', icon: '🍄', sway: 0,
    build(g, r) {
      const col = mix(C('#7fa07a'), C('#c7a46a'), r());
      g.lathe([[0.25, -0.1], [0.18, 0.6], [0.2, 1.0]], 8, mix(col, C('#4a3a2a'), 0.3));
      const R = r.range(1.4, 2.0);
      g.lathe([[0.2, 1.0], [R * 0.5, 1.12], [R, 1.18], [R * 1.02, 1.28], [R * 0.6, 1.3], [0.01, 1.3]], 28, (u, v) => mix(col, C('#f2e6c0'), v * 0.5), { wobble: 0.12, seed: r() * 9 });
    },
  },

  // ---------------- rocks ----------------
  rock: {
    name: 'Rock', cat: 'rocks', icon: '🪨', sway: 0,
    build(g, r) { rockShape(g, r, r.range(0.8, 1.1), C('#6d6a66'), C('#a39d94')); },
  },
  boulder: {
    name: 'Mossy boulder', cat: 'rocks', icon: '⛰️', sway: 0,
    build(g, r) {
      rockShape(g, r, 2.1, C('#5b5853'), C('#8d877d'), { moss: 0.8, flat: 0.7 });
      g.push(mat(1.6, 0, 0.8, 0.5), () => rockShape(g, r, 0.9, C('#5b5853'), C('#8d877d'), { moss: 0.5 }));
    },
  },
  arch: {
    name: 'Rock arch', cat: 'rocks', icon: '🌉', sway: 0,
    build(g, r) {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = PI * i / 16; pts.push([-Math.cos(a) * 2, Math.sin(a) * 2.2 - 0.2, Math.sin(a * 3) * 0.15]); }
      const seed = r() * 9;
      g.tube(pts, t => 0.55 + 0.15 * Math.sin(t * 9 + seed) + 0.25 * Math.abs(t - 0.5) * 2, 10, (u, v, p) => mix(C('#7a6f62'), C('#a89a86'), clamp(0.5 + fbm3(p[0], p[1], p[2] + seed), 0, 1)));
      g.push(mat(-2, 0, 0), () => rockShape(g, r, 0.9, C('#6d655b'), C('#9a8f80')));
      g.push(mat(2, 0, 0), () => rockShape(g, r, 0.9, C('#6d655b'), C('#9a8f80')));
    },
  },
  pebbles: {
    name: 'Pebbles', cat: 'rocks', icon: '⚪', sway: 0,
    build(g, r) {
      const cols = ['#d9d2c5', '#8e8a85', '#c78c5a', '#5f6b75', '#e8e3da', '#9b6b4a'].map(C);
      const n = r.int(9, 15);
      for (let i = 0; i < n; i++) {
        const s = r.range(0.12, 0.3), a = r() * PI * 2, d = Math.sqrt(r()) * 1.1;
        g.push(mat(Math.cos(a) * d, s * 0.25, Math.sin(a) * d, r() * PI), () => g.sphere(s, s * 0.5, s * 0.8, 10, r.pick(cols)));
      }
    },
  },
  driftwood: {
    name: 'Driftwood', cat: 'rocks', icon: '🪵', sway: 0,
    build(g, r) {
      const wood = (u, v, p) => mix(C('#4a3220'), C('#8a6a48'), clamp(0.5 + 0.5 * Math.sin(p[0] * 9 + fbm3(p[0], p[1], p[2]) * 4), 0, 1));
      const main = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; main.push([-2.4 + 4.8 * t, 0.25 + Math.sin(t * PI) * 0.6 + t * t * 1.2, Math.sin(t * 5) * 0.3]); }
      g.tube(main, t => 0.3 * (1 - t * 0.6), 8, wood);
      for (let k = 0; k < 4; k++) {
        const p = main[2 + k * 2];
        const a = r() * PI * 2;
        const br = curvePath(r, r.range(1, 2.2), 6, r.range(0.5, 1.2), 0.3, p, a);
        g.tube(br, t => 0.13 * (1 - t * 0.8), 6, wood);
      }
    },
  },

  // ---------------- ornaments ----------------
  chest: {
    name: 'Treasure chest', cat: 'ornaments', icon: '💰', sway: 0, emitter: { y: 1.3, every: [3, 7], burst: 6 },
    build(g, r) {
      const wood = C('#6b4426'), band = C('#c9a440'), gold = C('#ffd04a');
      g.box(2.0, 0.9, 1.2, (u, v, p) => mix(wood, C('#8a5a32'), Math.abs(Math.sin(p[1] * 18)) * 0.5));
      for (const x of [-0.75, 0.75]) g.push(mat(x, -0.01, 0), () => g.box(0.12, 0.94, 1.24, band));
      g.push(mat(0, 0.9, -0.55, 0, 0, -0.65), () => {
        g.grid(6, 10, (u, v) => { const a = v * PI; return [(u - 0.5) * 2.0, Math.sin(a) * 0.55, 0.6 - Math.cos(a) * 0.6]; }, wood);
      });
      for (let i = 0; i < 14; i++) g.push(mat(r.range(-0.8, 0.8), 0.92 + r() * 0.1, r.range(-0.4, 0.4), 0, r.range(-0.4, 0.4), r.range(-0.4, 0.4)), () => g.lathe([[0.12, 0], [0.12, 0.04]], 10, gold, { capTop: true }));
    },
  },
  castle: {
    name: 'Castle', cat: 'ornaments', icon: '🏰', sway: 0,
    build(g, r) {
      const stone = (u, v, p) => mix(C('#9c968c'), C('#c4beb2'), clamp(0.5 + 0.8 * noise3(p[0] * 3, p[1] * 3, p[2] * 3), 0, 1));
      const roof = C('#b8483c');
      const tower = (x, z, h, rad) => g.push(mat(x, 0, z), () => {
        g.lathe([[rad, 0], [rad, h], [rad * 1.15, h], [rad * 1.15, h + 0.3]], 12, stone, { capTop: true });
        g.lathe([[rad * 1.2, h + 0.3], [0.01, h + 0.3 + rad * 2.2]], 12, roof);
      });
      tower(-1.5, -1, 3.0, 0.5); tower(1.5, -1, 3.0, 0.5); tower(-1.5, 1, 2.6, 0.45); tower(1.5, 1, 2.6, 0.45);
      tower(0, -0.3, 4.2, 0.75);
      for (const [x, z, w, d] of [[0, 1, 3, 0.35], [0, -1, 3, 0.35], [-1.5, 0, 0.35, 2], [1.5, 0, 0.35, 2]]) {
        g.push(mat(x, 0, z), () => g.box(w, 1.8, d, stone));
        const n = Math.round(Math.max(w, d) / 0.45);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5;
          if (i % 2 === 0) g.push(mat(x + (w > d ? t * w : 0), 1.8, z + (w > d ? 0 : t * d)), () => g.box(0.25, 0.25, 0.4, stone));
        }
      }
      g.push(mat(0, 0, 1.19), () => g.box(0.7, 1.1, 0.06, C('#2a1d14')));
    },
  },
  shipwreck: {
    name: 'Shipwreck', cat: 'ornaments', icon: '🚢', sway: 0,
    build(g, r) {
      const plank = (u, v, p) => mix(C('#3d2a1c'), C('#6e5238'), clamp(0.5 + 0.5 * Math.sin(p[1] * 14) + 0.3 * noise3(p[0], p[1], p[2]), 0, 1));
      g.push(mat(0, -0.5, 0, 0, 0.12, 0.35), () => {
        g.grid(10, 18, (u, v) => {
          const x = (u - 0.5) * 8;
          const ends = Math.pow(Math.abs(u - 0.5) * 2, 2.2);
          const w = 1.6 * (1 - ends * 0.85);
          const a = PI * (0.08 + v * 0.84);
          return [x, 1.8 - Math.sin(a) * 1.6 * (1 - ends * 0.4), Math.cos(a) * w];
        }, plank);
        // deck
        g.grid(1, 10, (u, v) => { const x = (u - 0.5) * 7.4; const w = 1.4 * (1 - Math.pow(Math.abs(u - 0.5) * 2, 2.2) * 0.85); return [x, 1.75, (v - 0.5) * 2 * w]; }, C('#4a3524'));
        g.tube([[0.8, 1.7, 0], [0.9, 4.0, 0.1], [1.0, 5.2, 0.2]], t => 0.13 * (1 - t * 0.4), 6, C('#3b2a1c'));
        g.tube([[0.9, 4.0, -1.0], [0.9, 4.1, 1.1]], 0.06, 5, C('#3b2a1c'));
        g.tube([[-2.6, 1.7, 0], [-2.8, 3.0, 0.2]], 0.1, 6, C('#3b2a1c'));
      });
    },
  },
  helmet: {
    name: 'Diver helmet', cat: 'ornaments', icon: '🤿', sway: 0,
    build(g, r) {
      const brass = (u, v, p) => mix(C('#9a7330'), C('#d9b45a'), clamp(0.5 + noise3(p[0] * 4, p[1] * 4, p[2] * 4), 0, 1));
      g.lathe([[1.0, 0], [1.05, 0.25], [0.8, 0.3]], 16, brass);
      g.push(mat(0, 1.05, 0), () => g.sphere(0.85, 0.85, 0.85, 22, brass));
      g.push(mat(0, 1.05, 0.72, 0, 0, PI / 2), () => g.lathe([[0.42, -0.08], [0.42, 0.16], [0.3, 0.16], [0.3, 0.1]], 16, brass));
      g.push(mat(0, 1.05, 0.8, 0, 0, PI / 2), () => g.disc(0.3, 0.05, 16, C('#1d3540'), true));
      for (const s of [-1, 1]) g.push(mat(s * 0.78, 1.1, 0.1, 0, 0, s * PI / 2), () => g.lathe([[0.22, 0], [0.22, 0.12]], 12, brass, { capTop: true }));
    },
  },
  anchor: {
    name: 'Anchor', cat: 'ornaments', icon: '⚓', sway: 0,
    build(g, r) {
      const iron = (u, v, p) => mix(C('#3c3a38'), C('#6e5a44'), clamp(0.5 + noise3(p[0] * 3, p[1] * 3, p[2] * 3) * 0.8, 0, 1));
      g.push(mat(0, 0.25, 0, 0.3, 0, PI / 2 - 0.25), () => {
        g.tube([[0, -1.6, 0], [0, 1.6, 0]], 0.13, 8, iron);
        const ring = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * PI * 2; ring.push([Math.sin(a) * 0.35, 1.95 + Math.cos(a) * 0.35, 0]); }
        g.tube(ring, 0.07, 6, iron, { capEnd: false });
        const arm = []; for (let i = 0; i <= 12; i++) { const a = PI * (0.1 + 0.8 * i / 12); arm.push([-Math.cos(a) * 1.3, -1.6 + (1 - Math.sin(a)) * 1.0, 0]); }
        g.tube(arm, t => 0.12 + 0.05 * Math.abs(t - 0.5), 8, iron);
        g.tube([[-0.9, 1.2, 0], [0.9, 1.2, 0]], 0.08, 6, iron);
      });
    },
  },
  amphora: {
    name: 'Old vase', cat: 'ornaments', icon: '🏺', sway: 0,
    build(g, r) {
      const clay = (u, v) => mix(C('#9b4f2a'), C('#c97a45'), v > 0.45 && v < 0.55 ? 0 : 0.7);
      g.push(mat(0, 0.75, 0, r() * PI, PI / 2 - 0.15), () => g.lathe([[0.05, -1.2], [0.35, -1.0], [0.75, -0.4], [0.72, 0.3], [0.3, 0.75], [0.22, 1.1], [0.3, 1.2], [0.2, 1.18]], 16, clay));
    },
  },
  column: {
    name: 'Broken column', cat: 'ornaments', icon: '🏛️', sway: 0,
    build(g, r) {
      const marble = (u, v, p) => mix(C('#cfc8bb'), C('#f1ece2'), clamp(0.5 + 0.6 * fbm3(p[0] * 2, p[1] * 2, p[2] * 2), 0, 1));
      g.box(1.5, 0.3, 1.5, marble);
      const prof = [[0.55, 0.3]]; for (let i = 1; i <= 6; i++) prof.push([0.5 - i * 0.01, 0.3 + i * 0.5]);
      g.lathe(prof, 20, marble, { wobble: 0.04, capTop: true });
      g.push(mat(1.4, 0.45, 0.8, 0.7, PI / 2), () => g.lathe([[0.48, -0.9], [0.47, 0.9]], 20, marble, { capTop: true, capBottom: true }));
    },
  },
  bubbler: {
    name: 'Bubble stone', cat: 'ornaments', icon: '🫧', sway: 0, emitter: { y: 0.3, every: [0.05, 0.12], burst: 1, stream: true },
    build(g, r) { rockShape(g, r, 0.45, C('#4a5560'), C('#7d8a95'), { flat: 0.5 }); },
  },
  volcano: {
    name: 'Bubble volcano', cat: 'ornaments', icon: '🌋', sway: 0, emissive: 0.4, emitter: { y: 2.1, every: [0.08, 0.2], burst: 1, stream: true },
    build(g, r) {
      g.lathe([[2.2, -0.1], [1.6, 0.6], [0.9, 1.6], [0.55, 2.05], [0.45, 2.0], [0.3, 1.6]], 22, (u, v) => v > 0.8 ? C('#ff7a2a') : mix(C('#3a2e2a'), C('#6a564a'), v), { wobble: 0.1, seed: r() * 5 });
    },
  },
  shell: {
    name: 'Seashell', cat: 'ornaments', icon: '🐚', sway: 0,
    build(g, r) {
      const col = mix(C('#f3d6c6'), C('#f6b0a0'), r());
      g.push(mat(0, 0.05, 0, r() * PI, 0, -0.2), () => {
        g.grid(6, 18, (u, v) => {
          const a = (u - 0.5) * PI * 0.9, rad = 0.1 + v * 0.7;
          const ridge = 0.04 * Math.abs(Math.sin(u * PI * 9)) * v;
          return [Math.sin(a) * rad, ridge + 0.25 * v * (1 - v) * 2, Math.cos(a) * rad];
        }, (u, v) => mix(col, C('#ffffff'), Math.abs(Math.sin(u * PI * 9)) * 0.5));
      });
    },
  },
  starfish: {
    name: 'Starfish', cat: 'ornaments', icon: '⭐', sway: 0,
    build(g, r) {
      const col = mix(C('#ff7a3a'), C('#e8457a'), r());
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * PI * 2;
        g.tube([[0, 0.12, 0], [Math.cos(a) * 0.4, 0.12, Math.sin(a) * 0.4], [Math.cos(a) * 0.85, 0.08, Math.sin(a) * 0.85]], t => 0.17 * (1 - t * 0.75), 6, (u, v, p) => mix(col, C('#ffd0a0'), (noise3(p[0] * 12, 0, p[2] * 12) > 0.4) ? 0.6 : 0));
      }
      g.push(mat(0, 0.1, 0), () => g.sphere(0.2, 0.08, 0.2, 10, col));
    },
  },
  mushroom: {
    name: 'Glow mushrooms', cat: 'ornaments', icon: '🍄', sway: 0.05, emissive: 1,
    build(g, r) {
      const n = r.int(3, 6);
      const cap = mix(C('#3ad6ff'), C('#b26bff'), r());
      for (let i = 0; i < n; i++) {
        const h = r.range(0.4, 1.4), rad = h * r.range(0.4, 0.6), a = r() * PI * 2, d = r.range(0, 0.7);
        g.push(mat(Math.cos(a) * d, 0, Math.sin(a) * d, 0, r.range(-0.2, 0.2), r.range(-0.2, 0.2)), () => {
          g.lathe([[0.08 * h, 0], [0.06 * h + 0.03, h]], 8, C('#d8e8e0'));
          g.lathe([[0.05, h - 0.05], [rad, h], [rad * 0.85, h + rad * 0.35], [0.01, h + rad * 0.55]], 14, (u, v) => mix(cap, C('#ffffff'), v * 0.3));
        });
      }
    },
  },
  crystal: {
    name: 'Crystals', cat: 'ornaments', icon: '💎', sway: 0, emissive: 0.8,
    build(g, r) {
      const col = mix(C('#ff7ad9'), C('#6ad8ff'), r());
      const n = r.int(4, 7);
      for (let i = 0; i < n; i++) {
        const h = r.range(0.8, 2.4), w = h * r.range(0.15, 0.22);
        g.push(mat(r.range(-0.4, 0.4), -0.1, r.range(-0.4, 0.4), r() * PI, r.range(-0.5, 0.5), r.range(-0.5, 0.5)), () => g.lathe([[w, 0], [w, h * 0.75], [0.01, h]], 6, (u, v) => mix(col, C('#ffffff'), v * 0.5)));
      }
    },
  },
};

export const DECOR_CATS = [
  { id: 'plants', name: 'Plants' },
  { id: 'coral', name: 'Coral' },
  { id: 'rocks', name: 'Rocks & wood' },
  { id: 'ornaments', name: 'Ornaments' },
];

const cache = new Map();

// Builds (and caches) a decoration mesh for a type + seed.
export function buildDecor(gl, type, seed) {
  const key = type + ':' + seed;
  if (cache.has(key)) return cache.get(key);
  const def = DECOR[type];
  const r = rng(seed);
  const g = new Geo(r);
  def.build(g, r);
  const mesh = g.build(gl);
  cache.set(key, mesh);
  return mesh;
}
