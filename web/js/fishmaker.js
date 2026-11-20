// Turns a drawing into a cut-out picture, then into a puffy 3D creature mesh.
import { createMesh } from './gl.js';

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not open that picture'));
    img.src = src;
  });
}

function toCanvas(img, maxSide) {
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(img, 0, 0, w, h);
  return cv;
}

// Remove the paper / background. Returns { canvas (cropped cut-out), facing }.
export function cutOut(img, { tolerance = 60, gapFix = 2, maxSide = 420 } = {}) {
  const src = toCanvas(img, 700);
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const N = w * h;

  // Already has transparency? Use it.
  let transparent = 0;
  for (let i = 0; i < N; i += 7) if (d[i * 4 + 3] < 30) transparent++;
  const hasAlpha = transparent > N / 7 * 0.05;

  const keep = new Uint8Array(N);
  if (hasAlpha) {
    for (let i = 0; i < N; i++) keep[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  } else {
    // Background colour = median of the border.
    const rs = [], gs = [], bs = [];
    const sample = i => { rs.push(d[i * 4]); gs.push(d[i * 4 + 1]); bs.push(d[i * 4 + 2]); };
    for (let x = 0; x < w; x += 2) { sample(x); sample((h - 1) * w + x); }
    for (let y = 0; y < h; y += 2) { sample(y * w); sample(y * w + w - 1); }
    const med = a => a.sort((p, q) => p - q)[a.length >> 1];
    const bg = [med(rs), med(gs), med(bs)];
    const bgL = (bg[0] + bg[1] + bg[2]) / 3;
    const tol2 = tolerance * tolerance;
    const isBg = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const dr = r - bg[0], dg = g - bg[1], db = b - bg[2];
      let dist2 = dr * dr + dg * dg + db * db;
      // paper in shadow: low saturation and only a bit darker than the paper
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (r + g + b) / 3;
      if (mx - mn < 28 && L > bgL - tolerance * 1.4 && L > 90) dist2 = Math.min(dist2, tol2 * 0.8);
      isBg[i] = dist2 < tol2 ? 1 : 0;
    }
    // Close small gaps in outlines: grow the drawing a little before flooding.
    let wall = new Uint8Array(N);
    for (let i = 0; i < N; i++) wall[i] = isBg[i] ? 0 : 1;
    wall = dilate(wall, w, h, gapFix);
    // Flood fill background from the borders.
    const outside = new Uint8Array(N);
    const stack = [];
    const pushIf = i => { if (!outside[i] && !wall[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < w; x++) { pushIf(x); pushIf((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { pushIf(y * w); pushIf(y * w + w - 1); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0) pushIf(i - 1);
      if (x < w - 1) pushIf(i + 1);
      if (y > 0) pushIf(i - w);
      if (y < h - 1) pushIf(i + w);
    }
    // Undo the growth: outside region grows back by the same amount.
    const out2 = dilate(outside, w, h, gapFix);
    for (let i = 0; i < N; i++) keep[i] = (!out2[i] || (!isBg[i] && !outside[i])) ? 1 : 0;
  }

  removeSpecks(keep, w, h);

  // Crop.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (keep[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const pad = 3;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  // Soft edge alpha + colour bleed so edges don't show a white halo.
  const alpha = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) alpha[y * cw + x] = keep[(y + y0) * w + x + x0];
  const out = new ImageData(cw, ch);
  const o = out.data;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const si = ((y + y0) * w + x + x0) * 4, k = (y * cw + x) * 4;
    o[k] = d[si]; o[k + 1] = d[si + 1]; o[k + 2] = d[si + 2];
    // average neighbourhood for a soft, anti-aliased edge
    let a = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < cw && yy < ch) { a += alpha[yy * cw + xx]; n++; }
    }
    o[k + 3] = alpha[y * cw + x] ? Math.round(255 * Math.max(0.5, a / n)) : Math.round(255 * Math.min(0.45, a / n));
  }
  bleed(o, cw, ch);

  let cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  cv.getContext('2d').putImageData(out, 0, 0);
  if (Math.max(cw, ch) > maxSide) cv = toCanvas(cv, maxSide);
  return { canvas: cv, facing: guessFacing(keep, w, h, x0, x1, y0, y1) };
}

function dilate(m, w, h, r) {
  if (r <= 0) return m;
  let cur = m;
  for (let k = 0; k < r; k++) {
    const nx = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      nx[i] = cur[i] || (x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w]) ? 1 : 0;
    }
    cur = nx;
  }
  return cur;
}

function removeSpecks(keep, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  for (let s = 0; s < w * h; s++) {
    if (!keep[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    const st = [s];
    label[s] = id;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && keep[j] && label[j] < 0) { label[j] = id; st.push(j); }
      }
    }
    sizes.push(n);
  }
  const biggest = Math.max(0, ...sizes);
  for (let i = 0; i < w * h; i++) if (keep[i] && sizes[label[i]] < biggest * 0.04) keep[i] = 0;
}

function bleed(o, w, h) {
  for (let pass = 0; pass < 6; pass++) {
    const copy = new Uint8ClampedArray(o);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (copy[k + 3] >= 128) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 4;
        if (copy[q + 3] >= 128 || (pass > 0 && copy[q + 3] === 1)) { r += copy[q]; g += copy[q + 1]; b += copy[q + 2]; n++; }
      }
      if (n) { o[k] = r / n; o[k + 1] = g / n; o[k + 2] = b / n; if (o[k + 3] === 0) o[k + 3] = 1; }
    }
  }
}

// A fish's tail usually has a narrow "waist" in front of it.
function guessFacing(keep, w, h, x0, x1, y0, y1) {
  const cols = [];
  for (let x = x0; x <= x1; x++) {
    let top = -1, bot = -1;
    for (let y = y0; y <= y1; y++) if (keep[y * w + x]) { if (top < 0) top = y; bot = y; }
    cols.push(top < 0 ? 0 : bot - top + 1);
  }
  const n = cols.length, max = Math.max(...cols) || 1;
  const waist = (a, b) => { let m = 1e9; for (let i = Math.floor(n * a); i < Math.floor(n * b); i++) m = Math.min(m, cols[i]); return m / max; };
  const leftWaist = waist(0.12, 0.42), rightWaist = waist(0.58, 0.88);
  return leftWaist < rightWaist ? 'right' : 'left';
}

// ---------------------------------------------------------------------------
// Mesh: an "inflated" version of the cut-out, thick in the middle, thin at the
// edges, with the drawing on both sides.  Head points to +x.
export function buildCreatureMesh(gl, canvas, { chubby = 0.6, faceLeft = false } = {}) {
  const W = canvas.width, H = canvas.height;
  const longest = 60;
  const nx = W >= H ? longest : Math.max(8, Math.round(longest * W / H));
  const ny = W >= H ? Math.max(8, Math.round(longest * H / W)) : longest;

  // High-res alpha mask (2x grid) for distance transform.
  const mw = nx * 2, mh = ny * 2;
  const mc = document.createElement('canvas');
  mc.width = mw; mc.height = mh;
  const mctx = mc.getContext('2d', { willReadFrequently: true });
  mctx.drawImage(canvas, 0, 0, mw, mh);
  const md = mctx.getImageData(0, 0, mw, mh).data;
  const inside = new Uint8Array(mw * mh);
  for (let i = 0; i < mw * mh; i++) inside[i] = md[i * 4 + 3] > 110 ? 1 : 0;

  // Chamfer distance to the outside.
  const INF = 1e9;
  const dist = new Float32Array(mw * mh);
  for (let i = 0; i < mw * mh; i++) dist[i] = inside[i] ? INF : 0;
  const D1 = 1, D2 = 1.4142;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const i = y * mw + x;
    if (!dist[i]) continue;
    let v = dist[i];
    v = Math.min(v, x > 0 ? dist[i - 1] + D1 : 0.5, y > 0 ? dist[i - mw] + D1 : 0.5);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - mw - 1] + D2);
    if (x < mw - 1 && y > 0) v = Math.min(v, dist[i - mw + 1] + D2);
    dist[i] = v;
  }
  for (let y = mh - 1; y >= 0; y--) for (let x = mw - 1; x >= 0; x--) {
    const i = y * mw + x;
    if (!dist[i]) continue;
    let v = dist[i];
    v = Math.min(v, x < mw - 1 ? dist[i + 1] + D1 : 0.5, y < mh - 1 ? dist[i + mw] + D1 : 0.5);
    if (x < mw - 1 && y < mh - 1) v = Math.min(v, dist[i + mw + 1] + D2);
    if (x > 0 && y < mh - 1) v = Math.min(v, dist[i + mw - 1] + D2);
    dist[i] = v;
  }
  let maxD = 1;
  for (let i = 0; i < mw * mh; i++) if (dist[i] > maxD) maxD = dist[i];
  const sampleD = (u, v) => {
    const x = Math.min(mw - 1, Math.max(0, u * mw - 0.5)), y = Math.min(mh - 1, Math.max(0, v * mh - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(mw - 1, x0 + 1), y1 = Math.min(mh - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    const a = dist[y0 * mw + x0], b = dist[y0 * mw + x1], c = dist[y1 * mw + x0], d = dist[y1 * mw + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };

  // Cells that touch the drawing.
  const cellOn = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let on = 0;
    for (let dy = -1; dy <= 2 && !on; dy++) for (let dx = -1; dx <= 2 && !on; dx++) {
      const x = i * 2 + dx, y = j * 2 + dy;
      if (x >= 0 && y >= 0 && x < mw && y < mh && md[(y * mw + x) * 4 + 3] > 8) on = 1;
    }
    cellOn[j * nx + i] = on;
  }
  const vid = new Int32Array((nx + 1) * (ny + 1)).fill(-1);
  const aspect = H / W;
  // world size: longest side = 1
  const sx = W >= H ? 1 : W / H, sy = W >= H ? H / W : 1;
  const maxDUnits = maxD / mw * sx;              // inscribed radius in model units
  const T = chubby * maxDUnits * 0.95;
  const pos = [], uv = [], body = [], idx = [];
  const verts = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const used = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].some(([a, b]) => a >= 0 && b >= 0 && a < nx && b < ny && cellOn[b * nx + a]);
    if (!used) continue;
    const u = i / nx, v = j / ny;
    const x = (u - 0.5) * sx, y = (0.5 - v) * sy;
    const dn = Math.min(1, sampleD(u, v) / maxD);
    const prof = Math.sqrt(Math.max(0, 1 - (1 - dn) * (1 - dn)));
    const thin = 0.3 + 0.7 * Math.min(1, dn / 0.45);
    const t = T * prof * thin;
    vid[j * (nx + 1) + i] = verts.length;
    verts.push([x, y, t, u, v]);
  }
  const nv = verts.length;
  for (const side of [1, -1]) {
    for (const [x, y, t, u, v] of verts) {
      const px = faceLeft ? -x : x;
      pos.push(px, y, t * side);
      uv.push(u, v);
      // body x: 0 at head (+x) .. 1 at tail
      body.push(0.5 - px / sx, v);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!cellOn[j * nx + i]) continue;
    const a = vid[j * (nx + 1) + i], b = vid[j * (nx + 1) + i + 1], c = vid[(j + 1) * (nx + 1) + i], d = vid[(j + 1) * (nx + 1) + i + 1];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    idx.push(a, c, b, b, c, d);
    idx.push(a + nv, b + nv, c + nv, b + nv, d + nv, c + nv);
  }
  // normals
  const nrm = new Float32Array(pos.length);
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const q of [a, b, c]) { nrm[q] += n[0]; nrm[q + 1] += n[1]; nrm[q + 2] += n[2]; }
  }
  for (let q = 0; q < nrm.length; q += 3) {
    const l = Math.hypot(nrm[q], nrm[q + 1], nrm[q + 2]) || 1;
    nrm[q] /= l; nrm[q + 1] /= l; nrm[q + 2] /= l;
  }
  const mesh = createMesh(gl, { position: new Float32Array(pos), normal: nrm, uv: new Float32Array(uv), body: new Float32Array(body), index: idx });
  mesh.sx = sx; mesh.sy = sy; mesh.aspect = aspect; mesh.thick = T;
  return mesh;
}
