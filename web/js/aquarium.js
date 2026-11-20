// Ties the world, decorations and creatures together and renders a frame.
import { World } from './world.js';
import { buildDecor, DECOR } from './decor.js';
import { CREATURES } from './creatures.js';
import { Creature } from './fish.js';
import { buildCreatureMesh, loadImage } from './fishmaker.js';
import { createTexture, M4 } from './gl.js';
import { TEMPLATES } from './templates.js';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function stateFromTemplate(key, keepDrawings = []) {
  const t = TEMPLATES[key] || TEMPLATES.reef;
  let seed = 100;
  return {
    version: 1,
    template: key,
    env: { ...t.env },
    decor: t.decor.map(([type, nx, z, scale, rot, hue]) => ({ id: uid(), type, seed: seed++ * 7919, nx, z, scale: +(scale * 1.3).toFixed(2), rot, hue })),
    creatures: [
      ...t.creatures.map(([species, count]) => {
        const c = CREATURES[species];
        return { id: uid(), kind: 'builtin', species, name: c.name, style: c.style, size: c.size, speed: c.speed, chubby: c.chubby, bubbles: !!c.bubbles, count: c.count ? c.count : count };
      }),
      ...keepDrawings,
    ],
  };
}

export class Aquarium {
  constructor(canvas, { wallpaper = false } = {}) {
    this.canvas = canvas;
    this.wallpaper = wallpaper;
    const debug = new URLSearchParams(location.search).has('debug');
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: debug, powerPreference: 'default' });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.world = new World(gl);
    this.decor = new Map();       // id -> item
    this.creatures = [];
    this.groups = new Map();      // spec id -> { sig, list }
    this.looks = new Map();       // key -> { mesh, tex }
    this.pending = new Map();
    this.cursor = null;
    this.paused = false;
    this.ghost = null;
    this.selectedId = null;
    this.hoverCreature = null;
    this.last = performance.now();
    this.lastDraw = 0;
    this.maxFps = wallpaper ? 30 : 60;
    this.onFrame = null;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.wallpaper ? 1 : 1.5);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = dpr;
    this.world.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    for (const item of this.decor.values()) this.placeDecor(item);
  }

  // ---------------- state ----------------
  setState(state) {
    this.state = state;
    this.world.setEnv(state.env);
    this.syncDecor();
    this.syncCreatures();
  }

  setEnv(env) { this.state.env = env; this.world.setEnv(env); }

  syncDecor() {
    const seen = new Set();
    for (const d of this.state.decor) {
      if (!DECOR[d.type]) continue;
      seen.add(d.id);
      let item = this.decor.get(d.id);
      if (!item || item.type !== d.type || item.seed !== d.seed) {
        item = { id: d.id, type: d.type, seed: d.seed, mesh: buildDecor(this.gl, d.type, d.seed), model: M4.create(), phase: Math.random() * 6, emitT: Math.random() * 3 };
        this.decor.set(d.id, item);
      }
      item.spec = d;
      this.placeDecor(item);
    }
    for (const id of [...this.decor.keys()]) if (!seen.has(id)) this.decor.delete(id);
  }

  decorX(d) { return d.nx * Math.max(2, this.world.halfWidthAt(d.z) - 1); }

  placeDecor(item) {
    const d = item.spec;
    const x = this.decorX(d);
    const y = this.world.floorHeight(x, d.z) - 0.08 * d.scale;
    item.pos = [x, y, d.z];
    M4.compose(item.model, x, y, d.z, d.rot || 0, 0, 0, d.scale, d.scale, d.scale);
  }

  async lookFor(spec) {
    const chubby = spec.chubby ?? 0.6;
    const key = spec.kind === 'builtin' ? `b:${spec.species}:${chubby}` : `d:${spec.id}:${chubby}:${spec.faceLeft ? 1 : 0}:${(spec.image || '').length}`;
    if (this.looks.has(key)) return this.looks.get(key);
    if (this.pending.has(key)) return this.pending.get(key);
    const p = (async () => {
      let cv;
      if (spec.kind === 'builtin') cv = CREATURES[spec.species].draw();
      else {
        const img = await loadImage(spec.image);
        cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
      }
      const look = { mesh: buildCreatureMesh(this.gl, cv, { chubby, faceLeft: spec.kind !== 'builtin' && !!spec.faceLeft }), tex: createTexture(this.gl, cv, { mips: true }) };
      this.looks.set(key, look);
      this.pending.delete(key);
      return look;
    })();
    this.pending.set(key, p);
    return p;
  }

  async syncCreatures({ splashNew = false } = {}) {
    const ids = new Set();
    for (const spec of this.state.creatures) {
      if (spec.kind === 'builtin' && !CREATURES[spec.species]) continue;
      ids.add(spec.id);
      const sig = JSON.stringify([spec.style, spec.size, spec.chubby, spec.faceLeft, spec.count, (spec.image || '').length, spec.speed, spec.bubbles]);
      const g = this.groups.get(spec.id);
      if (g && g.sig === sig) { g.list.forEach(c => { c.spec = spec; }); continue; }
      const isNew = !g;
      if (g) this.removeGroup(spec.id);
      const group = { sig, list: [] };
      this.groups.set(spec.id, group);
      try {
        const look = await this.lookFor(spec);
        if (this.groups.get(spec.id) !== group) continue;
        const n = Math.max(1, Math.min(12, spec.count || 1));
        let leader = null;
        for (let i = 0; i < n; i++) {
          const c = new Creature(this.world, spec, look, { leader, splash: splashNew && isNew });
          if (!leader && n > 1) leader = c;
          group.list.push(c);
          this.creatures.push(c);
        }
        if (splashNew && isNew) this.splash(group.list[0].pos);
      } catch (e) { console.warn('creature failed', e); }
    }
    for (const id of [...this.groups.keys()]) if (!ids.has(id)) this.removeGroup(id);
  }

  removeGroup(id) {
    const g = this.groups.get(id);
    if (!g) return;
    this.creatures = this.creatures.filter(c => !g.list.includes(c));
    this.groups.delete(id);
  }

  splash(p) {
    for (let i = 0; i < 40; i++) setTimeout(() => this.world.emitBubble(p[0] + (Math.random() - 0.5) * 2, p[1] - Math.random() * 2, p[2] + (Math.random() - 0.5), 0.05 + Math.random() * 0.15), i * 15);
  }

  // ---------------- interaction helpers ----------------
  setCursor(px, py) {
    this.cursor = this.world.ray(px, py);
    this.cursorPx = [px, py];
    const W = this.world.width, H = this.world.height;
    this.world.parallaxTarget = [(px / W - 0.5) * 2, -(py / H - 0.5) * 2];
  }

  clearCursor() { this.cursor = null; this.world.parallaxTarget = [0, 0]; }

  pickCreature(px, py) {
    let best = null, bestD = Infinity;
    const focal = this.world.height / (2 * Math.tan(21 * Math.PI / 180));
    for (const c of this.creatures) {
      const p = this.world.project(c.pos);
      if (p.w <= 0) continue;
      const r = Math.max(18, c.size * 0.6 * focal / p.w);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < r && p.w < bestD) { best = c; bestD = p.w; }
    }
    return best;
  }

  pickDecor(px, py) {
    const ray = this.world.ray(px, py);
    let best = null, bestT = Infinity;
    for (const item of this.decor.values()) {
      const s = item.spec.scale;
      const c = [item.pos[0], item.pos[1] + item.mesh.height * s * 0.4, item.pos[2]];
      const r = Math.max(0.7, Math.min(item.mesh.radius, item.mesh.height) * s * 0.75);
      const oc = [ray.o[0] - c[0], ray.o[1] - c[1], ray.o[2] - c[2]];
      const b = oc[0] * ray.d[0] + oc[1] * ray.d[1] + oc[2] * ray.d[2];
      const cc = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - r * r;
      const disc = b * b - cc;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bestT) { bestT = t; best = item; }
    }
    return best;
  }

  floorPoint(px, py) {
    const p = this.world.rayFloor(this.world.ray(px, py));
    if (!p) return null;
    p[2] = Math.max(-14, Math.min(7, p[2]));
    return p;
  }

  nxFor(x, z) { return Math.max(-1.05, Math.min(1.05, x / Math.max(2, this.world.halfWidthAt(z) - 1))); }

  pokeOrFeed(px, py) {
    const c = this.pickCreature(px, py);
    const ray = this.world.ray(px, py);
    if (c) { c.poke(ray.o.map((v, i) => v + ray.d[i] * 3)); return 'poke'; }
    const p = this.world.rayPlaneZ(ray, 0);
    if (p) {
      const b = this.world.bounds(0);
      this.world.dropFood(Math.max(-b.xMax, Math.min(b.xMax, p[0])), Math.min(b.yMax + 1, Math.max(this.world.floorHeight(p[0], 0) + 1, p[1])), 0, 6);
    }
    return 'feed';
  }

  // A small picture of the tank (taken right after the next frame is drawn).
  snapshot() {
    return new Promise(res => {
      (this.snapWaiters ||= []).push(res);
      setTimeout(() => res(null), 1500);
    });
  }

  // Small transparent picture of a decoration, for the library.
  thumbnail(type, W = 150, H = 120) {
    const gl = this.gl, w = this.world;
    if (!this.thumbFbo) {
      const fbo = gl.createFramebuffer();
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      this.thumbFbo = fbo;
      this.thumbPixels = new Uint8Array(W * H * 4);
    }
    const mesh = buildDecor(gl, type, 4242);
    const hgt = mesh.height, rad = Math.min(mesh.radius, 6);
    const ext = Math.max(hgt * 0.75, rad * 1.25, 0.6);
    const target = [0, hgt * 0.45, 0];
    const eye = [0, target[1] + ext * 0.9, ext * 3.4];
    const proj = M4.perspective(M4.create(), 0.55, W / H, 0.1, 200);
    const view = M4.lookAt(M4.create(), eye, target, [0, 1, 0]);
    const vp = M4.multiply(M4.create(), proj, view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.thumbFbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    const def = DECOR[type];
    w.progDecor.use().set(w.common({
      uVP: vp, uCamPos: eye, uFog: 0, uLight: 1.15, uLightColor: [1, 0.98, 0.93], uAmbient: [0.42, 0.46, 0.5], uCaustics: 0.4,
      uWaterTop: [0.5, 0.7, 0.8], uWaterDeep: [0.2, 0.3, 0.4], uGlow: 0.2,
      uModel: M4.compose(M4.create(), 0, 0, 0, 0.5, 0, 0, 1, 1, 1), uSway: 0, uPhase: 0, uHue: 0, uEmissive: def.emissive || 0, uHighlight: 0, uGhost: 0,
    }));
    mesh.draw();
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, this.thumbPixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(this.thumbPixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }

  // ---------------- frame ----------------
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    if (this.paused) { this.last = now; return; }
    if (now - this.lastDraw < 1000 / this.maxFps - 2) return;
    this.lastDraw = now;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const gl = this.gl, w = this.world;

    w.update(dt);
    const ctx = { cursor: this.cursor, creatures: this.creatures };
    for (const c of this.creatures) c.update(dt, ctx);

    for (const item of this.decor.values()) {
      const em = DECOR[item.type].emitter;
      if (!em) continue;
      item.emitT -= dt;
      if (item.emitT <= 0) {
        item.emitT = em.every[0] + Math.random() * (em.every[1] - em.every[0]);
        const s = item.spec.scale;
        for (let i = 0; i < em.burst; i++) w.emitBubble(item.pos[0] + (Math.random() - 0.5) * 0.3 * s, item.pos[1] + em.y * s, item.pos[2] + (Math.random() - 0.5) * 0.3 * s, 0.05 + Math.random() * (em.stream ? 0.08 : 0.14));
      }
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    w.drawBackground();
    w.drawFloor();

    const pd = w.progDecor.use();
    pd.set(w.common());
    for (const item of this.decor.values()) {
      const def = DECOR[item.type];
      pd.set({ uModel: item.model, uSway: def.sway || 0, uPhase: item.phase, uHue: item.spec.hue || 0, uEmissive: def.emissive || 0, uHighlight: item.id === this.selectedId ? 1 : 0, uGhost: 0 });
      item.mesh.draw();
    }

    const blobs = this.creatures.map(c => c.shadow());
    for (const f of w.food) if (!f.floor) { const fy = w.floorHeight(f.x, f.z); blobs.push({ x: f.x, y: fy, z: f.z, r: 0.15, a: 0.2 }); }
    const sel = this.selectedId && this.decor.get(this.selectedId);
    if (sel) blobs.push({ x: sel.pos[0], y: sel.pos[1] + 0.05, z: sel.pos[2], r: Math.max(1, Math.min(sel.mesh.radius, 4) * sel.spec.scale * 1.15), a: 1, ring: true });
    w.drawBlobs(blobs);

    const pf = w.progFish.use();
    pf.set(w.common());
    for (const c of this.creatures) { c.highlight = c === this.hoverCreature ? 1 : 0; c.draw(pf); }

    if (this.ghost) {
      const g = this.ghost;
      const mesh = buildDecor(gl, g.type, g.seed);
      const m = M4.compose(M4.create(), g.x, w.floorHeight(g.x, g.z) - 0.08 * g.scale, g.z, g.rot, 0, 0, g.scale, g.scale, g.scale);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      pd.use().set(w.common({ uModel: m, uSway: DECOR[g.type].sway || 0, uPhase: 0, uHue: g.hue || 0, uEmissive: DECOR[g.type].emissive || 0, uHighlight: 0.6, uGhost: 1 }));
      mesh.draw();
      gl.disable(gl.BLEND);
    }

    w.drawEffects();
    if (this.snapWaiters?.length) {
      const cv = document.createElement('canvas');
      cv.width = 240; cv.height = 135;
      cv.getContext('2d').drawImage(this.canvas, 0, 0, 240, 135);
      const url = cv.toDataURL('image/jpeg', 0.75);
      this.snapWaiters.splice(0).forEach(r => r(url));
    }
    if (this.onFrame) this.onFrame(dt);
  }
}
