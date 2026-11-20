// The underwater environment: camera, water, sand, light, bubbles, food.
import { M4, createProgram, createMesh, createDynamic, createTexture, hexToRgb, ATTR } from './gl.js';
import * as S from './shaders.js';
import { rng, fbm3, clamp, smoothstep } from './noise.js';

const FOV = 42 * Math.PI / 180;
export const CAM_Z = 21;
export const SURFACE_Y = 14;

function makeCausticTexture(size = 256, cells = 8) {
  const r = rng(7);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + r() * 0.7) / cells, (j + 0.15 + r() * 0.7) / cells, r()]);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + cells) % cells, jj = (cj + dj + cells) % cells;
      const p = pts[jj * cells + ii];
      // wrap-aware offset so the texture tiles seamlessly
      const ox = (ci + di) - ii, oy = (cj + dj) - jj;
      const dx = p[0] + ox / cells - u, dy = p[1] + oy / cells - v;
      const d = Math.hypot(dx, dy) * cells;
      if (d < f1) { f2 = f1; f1 = d; id = p[2]; } else if (d < f2) f2 = d;
    }
    const edge = f2 - f1;
    const caus = Math.exp(-edge * 7.0);
    const k = (y * size + x) * 4;
    img.data[k] = Math.min(255, caus * 255);
    img.data[k + 1] = Math.min(255, f1 / 1.0 * 255);
    img.data[k + 2] = id * 255;
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export class World {
  constructor(gl) {
    this.gl = gl;
    this.time = 0;
    this.aspect = 16 / 9;
    this.cam = { pos: [0, 6.5, CAM_Z], target: [0, 5.6, 0], view: M4.create(), proj: M4.create(), vp: M4.create(), inv: M4.create() };
    this.parallax = [0, 0];
    this.parallaxTarget = [0, 0];

    this.progBg = createProgram(gl, S.BG_VS, S.BG_FS, 'background');
    this.progFloor = createProgram(gl, S.FLOOR_VS, S.FLOOR_FS, 'floor');
    this.progDecor = createProgram(gl, S.DECOR_VS, S.DECOR_FS, 'decor');
    this.progFish = createProgram(gl, S.FISH_VS, S.FISH_FS, 'fish');
    this.progRays = createProgram(gl, S.RAYS_VS, S.RAYS_FS, 'rays');
    this.progSurf = createProgram(gl, S.SURF_VS, S.SURF_FS, 'surface');
    this.progSnow = createProgram(gl, S.SNOW_VS, S.SNOW_FS, 'snow');
    this.progPoints = createProgram(gl, S.POINTS_VS, S.POINTS_FS, 'points');
    this.progBlob = createProgram(gl, S.BLOB_VS, S.BLOB_FS, 'blob');

    this.causticTex = createTexture(gl, makeCausticTexture(), { repeat: true });

    this.fullscreen = createMesh(gl, { position: new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]) });
    this.buildFloor();
    this.buildSurface();
    this.buildRays();
    this.buildSnow();

    this.points = createDynamic(gl, [{ loc: ATTR.aPos, size: 4 }, { loc: ATTR.aColor, size: 4 }], 1200);
    const quad = createMesh(gl, { position: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), index: [0, 2, 1, 0, 3, 2] });
    this.blobs = createDynamic(gl, [{ loc: ATTR.aInst, size: 4 }, { loc: ATTR.aInst2, size: 4 }], 200, { instanced: true, baseMesh: quad });
    this.blobQuad = quad;

    this.bubbles = [];
    this.food = [];
    this.streams = [];
    this.u = {};
    this.setEnv({});
  }

  // ---------- geometry of the tank ----------
  floorHeight(x, z) {
    const back = smoothstep(-8, -40, z);
    return 0.35 * fbm3(x * 0.07, z * 0.09, 1.3, 3) + 0.04 * (-z) + back * (2.5 + 3 * fbm3(x * 0.03, 7.1, 0, 2)) - 0.15;
  }

  buildFloor() {
    const gl = this.gl;
    const nx = 150, nz = 64, x0 = -75, x1 = 75, z0 = -48, z1 = 14;
    const pos = [], nrm = [], idx = [];
    const zs = [];
    for (let j = 0; j <= nz; j++) { const t = j / nz; zs.push(z0 + (z1 - z0) * Math.pow(t, 0.75)); }
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, z = zs[j];
      const y = this.floorHeight(x, z);
      const e = 0.2;
      const dx = this.floorHeight(x + e, z) - this.floorHeight(x - e, z);
      const dz = this.floorHeight(x, z + e) - this.floorHeight(x, z - e);
      const n = [-dx, 2 * e, -dz], l = Math.hypot(...n);
      pos.push(x, y, z); nrm.push(n[0] / l, n[1] / l, n[2] / l);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    this.floorMesh = createMesh(gl, { position: new Float32Array(pos), normal: new Float32Array(nrm), index: idx });
  }

  buildSurface() {
    const s = 160, y = SURFACE_Y;
    this.surfMesh = createMesh(this.gl, { position: new Float32Array([-s, y, -s * 0.6, s, y, -s * 0.6, s, y, CAM_Z + 4, -s, y, CAM_Z + 4]), index: [0, 1, 2, 0, 2, 3] });
  }

  buildRays() {
    const r = rng(11);
    const pos = [], uv = [], col = [], idx = [];
    const n = 11;
    for (let k = 0; k < n; k++) {
      const x = -34 + 68 * (k + r() * 0.8) / n;
      const z = -4 - r() * 14;
      const w = 1.5 + r() * 3.5, slant = 3 + r() * 2;
      const top = SURFACE_Y + 1, bot = -1;
      const b = pos.length / 3;
      pos.push(x - w / 2, top, z, x + w / 2, top, z, x + w / 2 + slant + w * 0.6, bot, z + 2, x - w / 2 + slant - w * 0.2, bot, z + 2);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      const seed = r();
      for (let q = 0; q < 4; q++) col.push(seed, w, 0, 0);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    this.raysMesh = createMesh(this.gl, { position: new Float32Array(pos), uv: new Float32Array(uv), color: new Float32Array(col), index: idx });
  }

  buildSnow() {
    const r = rng(5), n = 900;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r();
      col[i * 4] = r(); col[i * 4 + 1] = r(); col[i * 4 + 2] = r(); col[i * 4 + 3] = r();
    }
    this.snowMesh = createMesh(this.gl, { position: pos, color: col }, this.gl.POINTS);
  }

  // ---------- environment / lighting ----------
  setEnv(env) {
    const e = Object.assign({
      waterColor: '#2aa7c4', deepColor: '#073e66', lightColor: '#fff4dc', lightIntensity: 1, clarity: 0.6,
      caustics: 1, rays: 0.7, bubbles: 0.4, specks: 0.6, floorType: 0, floorColorA: '#e6d4a6', floorColorB: '#c2a777', glow: 0, disco: false,
    }, env);
    this.env = e;
    const streamRand = rng(3);
    const nStreams = Math.round(e.bubbles * 5);
    this.streams = [];
    for (let i = 0; i < nStreams; i++) this.streams.push({ x: streamRand.range(-14, 14), z: streamRand.range(-10, -2), t: streamRand() * 3, rate: streamRand.range(2, 6) });
    this.updateEnvUniforms(0);
  }

  updateEnvUniforms(t) {
    const e = this.env;
    let light = hexToRgb(e.lightColor);
    if (e.disco) {
      const h = (t * 0.06) % 1;
      const k = [0, 4, 2].map(o => clamp(Math.abs(((h * 6 + o) % 6) - 3) - 1, 0, 1));
      light = k.map(v => 0.45 + 0.55 * v);
    }
    const L = e.lightIntensity;
    const bright = 0.18 + 0.82 * Math.min(1, L);
    const tint = light.map(v => 0.7 + 0.3 * v);
    const top = hexToRgb(e.waterColor).map((v, i) => v * bright * tint[i]);
    const deep = hexToRgb(e.deepColor).map((v, i) => v * (0.3 + 0.7 * Math.min(1, L)) * tint[i]);
    this.u = {
      uLightDir: [0.25, 0.92, 0.3].map(v => v / Math.hypot(0.25, 0.92, 0.3)),
      uLightColor: light,
      uLight: L,
      uAmbient: top.map((v, i) => (v * 0.6 + 0.4) * 0.42 * bright * tint[i] + deep[i] * 0.1),
      uWaterTop: top,
      uWaterDeep: deep,
      uFog: 0.042 - 0.034 * e.clarity,
      uCaustics: e.caustics,
      uSurfaceY: SURFACE_Y,
      uCausticTex: this.causticTex,
      uGlow: e.glow,
      uFloorType: e.floorType | 0,
      uFloorA: hexToRgb(e.floorColorA),
      uFloorB: hexToRgb(e.floorColorB),
      uRays: e.rays,
    };
  }

  // ---------- camera ----------
  resize(w, h) {
    this.aspect = w / h;
    this.width = w; this.height = h;
  }

  // Visible half-width of the tank at depth z (keeps fish on screen).
  halfWidthAt(z) { return (CAM_Z - z) * Math.tan(FOV / 2) * this.aspect; }

  bounds(z = 0) {
    return { xMax: this.halfWidthAt(z) - 1.2, yMin: 0.6, yMax: SURFACE_Y - 1.6, zMin: -9, zMax: 6 };
  }

  updateCamera(dt) {
    const c = this.cam;
    const k = Math.min(1, dt * 1.5);
    this.parallax[0] += (this.parallaxTarget[0] - this.parallax[0]) * k;
    this.parallax[1] += (this.parallaxTarget[1] - this.parallax[1]) * k;
    const t = this.time;
    c.pos = [this.parallax[0] * 1.6 + Math.sin(t * 0.05) * 0.4, 6.5 + this.parallax[1] * 0.8 + Math.sin(t * 0.07) * 0.15, CAM_Z];
    c.target = [this.parallax[0] * 0.5, 5.6, 0];
    M4.perspective(c.proj, FOV, this.aspect, 0.5, 220);
    M4.lookAt(c.view, c.pos, c.target, [0, 1, 0]);
    M4.multiply(c.vp, c.proj, c.view);
    M4.invert(c.inv, c.vp);
  }

  // Screen (pixels) -> world ray
  ray(px, py) {
    const nx = px / this.width * 2 - 1, ny = 1 - py / this.height * 2;
    const a = M4.transformPoint(this.cam.inv, [nx, ny, -1]);
    const b = M4.transformPoint(this.cam.inv, [nx, ny, 1]);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
    return { o: a.slice(0, 3), d: d.map(v => v / l) };
  }

  project(p) {
    const c = M4.transformPoint(this.cam.vp, p);
    return { x: (c[0] * 0.5 + 0.5) * this.width, y: (0.5 - c[1] * 0.5) * this.height, w: c[3], z: c[2] };
  }

  rayFloor(ray) {
    // march then refine against the height field
    let t = 0;
    for (let i = 0; i < 200; i++) {
      const p = [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t];
      if (p[1] <= this.floorHeight(p[0], p[2])) {
        let lo = Math.max(0, t - 0.5), hi = t;
        for (let k = 0; k < 12; k++) {
          const m = (lo + hi) / 2, q = [ray.o[0] + ray.d[0] * m, ray.o[1] + ray.d[1] * m, ray.o[2] + ray.d[2] * m];
          if (q[1] <= this.floorHeight(q[0], q[2])) hi = m; else lo = m;
        }
        return [ray.o[0] + ray.d[0] * hi, ray.o[1] + ray.d[1] * hi, ray.o[2] + ray.d[2] * hi];
      }
      t += 0.5;
    }
    return null;
  }

  rayPlaneZ(ray, z) {
    if (Math.abs(ray.d[2]) < 1e-5) return null;
    const t = (z - ray.o[2]) / ray.d[2];
    return [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, z];
  }

  // ---------- bubbles & food ----------
  emitBubble(x, y, z, size = 0.12) {
    if (this.bubbles.length > 700) return;
    this.bubbles.push({ x, y, z, s: size, vy: 0.8 + size * 6, ph: Math.random() * 6, a: 0 });
  }

  dropFood(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      if (this.food.length > 90) this.food.shift();
      this.food.push({
        x: x + (Math.random() - 0.5) * 1.6, y: Math.min(SURFACE_Y - 0.3, y + Math.random() * 0.5), z: z + (Math.random() - 0.5) * 1.6,
        vy: -(0.45 + Math.random() * 0.3), ph: Math.random() * 6, life: 0, floor: false, eaten: false, kind: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  sprinkleFood() {
    const hw = this.halfWidthAt(0) * 0.7;
    for (let i = 0; i < 5; i++) this.dropFood((Math.random() * 2 - 1) * hw, SURFACE_Y - 0.4, Math.random() * 8 - 5, 3);
  }

  update(dt) {
    this.time += dt;
    this.updateEnvUniforms(this.time);
    this.updateCamera(dt);
    const t = this.time;
    for (const s of this.streams) {
      s.t -= dt;
      if (s.t <= 0) {
        s.t = 0.08 + Math.random() * 0.25;
        if (Math.sin(t * 0.3 + s.rate) > -0.3) this.emitBubble(s.x + (Math.random() - 0.5) * 0.2, this.floorHeight(s.x, s.z) + 0.1, s.z, 0.05 + Math.random() * 0.1);
      }
    }
    const bs = this.bubbles;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.y += b.vy * dt;
      b.ph += dt * 6;
      b.x += Math.sin(b.ph) * 0.3 * dt;
      b.z += Math.cos(b.ph * 0.8) * 0.2 * dt;
      b.a = Math.min(1, b.a + dt * 4);
      if (b.y > SURFACE_Y - 0.1) bs.splice(i, 1);
    }
    const fs = this.food;
    for (let i = fs.length - 1; i >= 0; i--) {
      const f = fs[i];
      f.life += dt;
      if (f.eaten) { fs.splice(i, 1); continue; }
      if (!f.floor) {
        f.ph += dt * 2;
        f.y += f.vy * dt;
        f.x += Math.sin(f.ph) * 0.25 * dt;
        const fy = this.floorHeight(f.x, f.z) + 0.06;
        if (f.y <= fy) { f.y = fy; f.floor = true; f.life = 0; }
      } else if (f.life > 30) fs.splice(i, 1);
    }
  }

  // ---------- drawing ----------
  common(extra = {}) {
    return Object.assign({ uCamPos: this.cam.pos, uTime: this.time, uVP: this.cam.vp }, this.u, extra);
  }

  drawBackground() {
    const gl = this.gl;
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    this.progBg.use().set(this.common({ uInvVP: this.cam.inv }));
    this.fullscreen.draw();
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  drawFloor() {
    this.progFloor.use().set(this.common());
    this.floorMesh.draw();
  }

  drawBlobs(list) {
    if (!list.length) return;
    const gl = this.gl, d = this.blobs.data;
    let n = 0;
    for (const b of list) {
      if (n >= 200) break;
      d.set([b.x, b.y, b.z, b.r, b.a, b.ring ? 1 : 0, 0, 0], n * 8);
      n++;
    }
    this.blobs.upload(n);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-2, -2);
    this.progBlob.use().set({ uVP: this.cam.vp, uTime: this.time });
    gl.bindVertexArray(this.blobQuad.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, n);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawEffects() {
    const gl = this.gl;
    const px = this.height / (2 * Math.tan(FOV / 2));
    // surface
    this.progSurf.use().set(this.common());
    this.surfMesh.draw();

    gl.enable(gl.BLEND);
    gl.depthMask(false);

    // points: food + bubbles (premultiplied)
    const d = this.points.data;
    let n = 0;
    for (const f of this.food) {
      const fade = f.floor ? Math.min(1, (30 - f.life) / 3) : 1;
      d.set([f.x, f.y, f.z, 0.2, fade, f.kind, 0, 0], n * 8); n++;
    }
    for (const b of this.bubbles) {
      if (n >= 1200) break;
      d.set([b.x, b.y, b.z, b.s * 2, b.a * 0.9, 0, 0, 0], n * 8); n++;
    }
    if (n) {
      this.points.upload(n);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.progPoints.use().set(this.common({ uPx: px }));
      gl.bindVertexArray(this.points.vao);
      gl.drawArrays(gl.POINTS, 0, n);
    }

    // additive light
    gl.blendFunc(gl.ONE, gl.ONE);
    if (this.env.specks > 0.01) {
      this.progSnow.use().set(this.common({ uPx: px * 0.06, uBoxMin: [-40, -1, -24], uBoxSize: [80, SURFACE_Y + 1, 34], uAmount: this.env.specks }));
      this.snowMesh.draw();
    }
    if (this.env.rays > 0.01) {
      this.progRays.use().set(this.common());
      this.raysMesh.draw();
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
