// Procedural geometry builder used for decorations.
import { M4, createMesh } from './gl.js';

export function mat(tx = 0, ty = 0, tz = 0, ry = 0, rz = 0, rx = 0, sx = 1, sy = sx, sz = sx) {
  return M4.compose(M4.create(), tx, ty, tz, ry, rz, rx, sx, sy, sz);
}

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class Geo {
  constructor(seedRand = Math.random) {
    this.p = []; this.c = []; this.s = []; this.i = [];
    this.m = M4.create();
    this.sway = 0;        // sway multiplier for primitives added now
    this.jitter = 0.08;   // per-vertex brightness variation
    this.rand = seedRand;
  }

  push(m, fn) { const prev = this.m; this.m = M4.multiply(M4.create(), prev, m); fn(); this.m = prev; }

  vert(x, y, z, col) {
    const m = this.m;
    this.p.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    const j = 1 + (this.rand() - 0.5) * this.jitter * 2;
    this.c.push(col[0] * j, col[1] * j, col[2] * j);
    this.s.push(this.sway);
    return this.p.length / 3 - 1;
  }

  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }

  static colorOf(col, u, v, p) { return typeof col === 'function' ? col(u, v, p) : col; }

  // Grid helper: rows x cols of vertices from fn(u,v)->[x,y,z]; wrapU closes the seam.
  grid(rows, cols, fn, col, wrapU = false) {
    const base = this.p.length / 3;
    const cu = wrapU ? cols : cols + 1;
    for (let r = 0; r <= rows; r++) for (let c = 0; c < cu; c++) {
      const u = c / cols, v = r / rows;
      const p = fn(u, v);
      this.vert(p[0], p[1], p[2], Geo.colorOf(col, u, v, p));
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const c1 = wrapU ? (c + 1) % cols : c + 1;
      const a = base + r * cu + c, b = base + r * cu + c1, d = base + (r + 1) * cu + c, e = base + (r + 1) * cu + c1;
      this.quad(a, d, e, b);
    }
    return base;
  }

  // Lathe around Y from profile [[radius, y], ...] (bottom to top).
  lathe(profile, segs, col, { wobble = 0, seed = 0, capTop = false, capBottom = false } = {}) {
    const rows = profile.length - 1;
    this.grid(rows, segs, (u, v) => {
      const k = Math.min(rows, Math.round(v * rows));
      const [r, y] = profile[k];
      const a = u * Math.PI * 2;
      const w = wobble ? 1 + wobble * Math.sin(a * 3 + seed + y * 2) * Math.cos(a * 2 - seed) : 1;
      return [Math.cos(a) * r * w, y, Math.sin(a) * r * w];
    }, col, true);
    if (capTop) this.disc(profile[rows][0], profile[rows][1], segs, col, true);
    if (capBottom) this.disc(profile[0][0], profile[0][1], segs, col, false);
  }

  disc(r, y, segs, col, up) {
    const c = this.vert(0, y, 0, Geo.colorOf(col, 0.5, up ? 1 : 0, [0, y, 0]));
    const start = this.p.length / 3;
    for (let s = 0; s < segs; s++) {
      const a = s / segs * Math.PI * 2;
      this.vert(Math.cos(a) * r, y, Math.sin(a) * r, Geo.colorOf(col, s / segs, up ? 1 : 0, [0, y, 0]));
    }
    for (let s = 0; s < segs; s++) {
      const a = start + s, b = start + (s + 1) % segs;
      if (up) this.tri(c, b, a); else this.tri(c, a, b);
    }
  }

  // Ellipsoid with optional displacement fn(nx,ny,nz)->scale.
  sphere(rx, ry, rz, segs, col, displace = null, { yMin = -1 } = {}) {
    const rows = Math.max(4, Math.round(segs / 2));
    this.grid(rows, segs, (u, v) => {
      const th = u * Math.PI * 2;
      const phi = Math.acos(1 - v * (1 - yMin));   // v=0 top
      const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
      const d = displace ? displace(nx, ny, nz) : 1;
      return [nx * rx * d, ny * ry * d, nz * rz * d];
    }, col, true);
  }

  box(w, h, d, col) {
    const x = w / 2, z = d / 2;
    const faces = [
      [[-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]],
      [[x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]],
      [[x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z]],
      [[-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z]],
      [[-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z]],
      [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]],
    ];
    for (const f of faces) {
      const idx = f.map(p => this.vert(p[0], p[1], p[2], Geo.colorOf(col, 0, p[1] / h, p)));
      this.quad(idx[0], idx[1], idx[2], idx[3]);
    }
  }

  // Tube along a path with radius(t). Parallel-transport frames.
  tube(points, radius, segs, col, { capEnd = true } = {}) {
    const n = points.length;
    const T = points.map((p, i) => norm(sub(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)])));
    let N = Math.abs(T[0][1]) < 0.9 ? norm(cross(T[0], [0, 1, 0])) : norm(cross(T[0], [1, 0, 0]));
    const frames = [];
    for (let i = 0; i < n; i++) {
      if (i > 0) { const d = dot(N, T[i]); N = norm([N[0] - d * T[i][0], N[1] - d * T[i][1], N[2] - d * T[i][2]]); }
      frames.push([N, cross(T[i], N)]);
    }
    const base = this.p.length / 3;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = typeof radius === 'function' ? radius(t) : radius;
      const [Nn, B] = frames[i], p = points[i];
      for (let s = 0; s < segs; s++) {
        const a = s / segs * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        const v = [p[0] + Nn[0] * ca + B[0] * sa, p[1] + Nn[1] * ca + B[1] * sa, p[2] + Nn[2] * ca + B[2] * sa];
        this.vert(v[0], v[1], v[2], Geo.colorOf(col, s / segs, t, v));
      }
    }
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < segs; s++) {
      const a = base + i * segs + s, b = base + i * segs + (s + 1) % segs;
      const c = base + (i + 1) * segs + s, d = base + (i + 1) * segs + (s + 1) % segs;
      this.quad(a, b, d, c);
    }
    if (capEnd) {
      const last = points[n - 1];
      const tip = this.vert(last[0] + T[n - 1][0] * 0.01, last[1] + T[n - 1][1] * 0.01, last[2] + T[n - 1][2] * 0.01, Geo.colorOf(col, 0, 1, last));
      for (let s = 0; s < segs; s++) this.tri(base + (n - 1) * segs + s, base + (n - 1) * segs + (s + 1) % segs, tip);
    }
  }

  // Flat ribbon (leaf / blade) along a path. side: horizontal direction of width.
  ribbon(points, width, col, side = [1, 0, 0], { fold = 0 } = {}) {
    const n = points.length;
    const base = this.p.length / 3;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const w = (typeof width === 'function' ? width(t) : width) / 2;
      const p = points[i];
      const T = norm(sub(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]));
      let S = norm(sub(side, T.map(x => x * dot(side, T))));
      const F = cross(T, S);
      for (const k of [-1, 0, 1]) {
        const f = fold * w * (k === 0 ? 1 : 0);
        const v = [p[0] + S[0] * w * k + F[0] * f, p[1] + S[1] * w * k + F[1] * f, p[2] + S[2] * w * k + F[2] * f];
        this.vert(v[0], v[1], v[2], Geo.colorOf(col, (k + 1) / 2, t, v));
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 3;
      this.quad(a, a + 3, a + 4, a + 1);
      this.quad(a + 1, a + 4, a + 5, a + 2);
    }
  }

  build(gl) {
    const pos = new Float32Array(this.p);
    const nv = pos.length / 3;
    const nrm = new Float32Array(nv * 3);
    const idx = this.i;
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
      const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const n = cross(e1, e2);
      for (const v of [a, b, c]) { nrm[v] += n[0]; nrm[v + 1] += n[1]; nrm[v + 2] += n[2]; }
    }
    let maxY = 0.001, rad = 0.1;
    for (let v = 0; v < nv; v++) {
      const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1;
      nrm[v * 3] /= l; nrm[v * 3 + 1] /= l; nrm[v * 3 + 2] /= l;
      maxY = Math.max(maxY, pos[v * 3 + 1]);
      rad = Math.max(rad, Math.hypot(pos[v * 3], pos[v * 3 + 2]));
    }
    const color = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      color[v * 4] = this.c[v * 3]; color[v * 4 + 1] = this.c[v * 3 + 1]; color[v * 4 + 2] = this.c[v * 3 + 2];
      const h = Math.max(0, pos[v * 3 + 1]) / maxY;
      color[v * 4 + 3] = this.s[v] * h;
    }
    const mesh = createMesh(gl, { position: pos, normal: nrm, color, index: idx });
    mesh.height = maxY;
    mesh.radius = rad;
    return mesh;
  }
}
