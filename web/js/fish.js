// Creature behaviour: swimming, turning, eating, being poked, being curious.
import { M4 } from './gl.js';
import { clamp, lerp } from './noise.js';

export const STYLES = {
  fish: { id: 0, label: 'Fish', hint: 'Swims and wiggles its tail' },
  eel: { id: 1, label: 'Wiggly eel', hint: 'Big wavy wiggles, likes the bottom' },
  jelly: { id: 2, label: 'Jellyfish', hint: 'Pulses and floats up and down' },
  floaty: { id: 3, label: 'Floaty person', hint: 'Stays upright and kicks its legs' },
  crawler: { id: 4, label: 'Crawler', hint: 'Walks along the sand' },
};

const TAU = Math.PI * 2;
const wrapAngle = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export class Creature {
  constructor(world, spec, look, opts = {}) {
    this.world = world;
    this.spec = spec;
    this.look = look;              // { mesh, tex }
    this.style = STYLES[spec.style] ? spec.style : 'fish';
    this.styleId = STYLES[this.style].id;
    this.size = (spec.size || 1.4) * 1.35;
    this.seed = Math.random() * 1000;
    this.curiosity = Math.random();
    this.hunger = 0.4 + Math.random() * 0.5;
    this.leader = opts.leader || null;
    this.offset = [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2];

    const b = world.bounds(0);
    this.pos = [lerp(-b.xMax, b.xMax, Math.random()) * 0.8, lerp(b.yMin + 2, b.yMax - 1, Math.random()), lerp(b.zMin, b.zMax, Math.random())];
    if (opts.splash) { this.pos[1] = b.yMax + 0.5; this.pos[2] = 2; this.splashed = true; }
    if (this.style === 'crawler') this.pos[1] = this.groundY(this.pos[0], this.pos[2]);
    this.vel = [Math.random() < 0.5 ? -0.5 : 0.5, 0, 0];
    this.yaw = this.vel[0] > 0 ? 0 : Math.PI;
    this.pitch = 0; this.roll = 0; this.bend = 0;
    this.phase = Math.random() * 10;
    this.amp = 0.06;
    this.puff = 0; this.flash = 0; this.highlight = 0;
    this.mode = 'wander'; this.modeTime = 0;
    this.pokes = [];
    this.spin = 0;
    this.hop = 0; this.hopV = 0;
    this.bubbleTimer = 1 + Math.random() * 3;
    this.model = M4.create();
    this.pickTarget(true);
  }

  get baseSpeed() {
    const s = this.spec.speed ?? 1;
    const k = { fish: 1, eel: 0.75, jelly: 0.35, floaty: 0.55, crawler: 0.45 }[this.style];
    return (0.8 + this.size * 0.35) * s * k;
  }

  halfHeight() { return (this.look.mesh.sy || 0.5) * this.size * 0.5; }

  groundY(x, z) { return this.world.floorHeight(x, z) + this.halfHeight() * 0.92; }

  limits(z) {
    const b = this.world.bounds(z);
    const half = this.size * 0.5;
    return { xMax: Math.max(1, b.xMax - half), yMin: b.yMin + this.halfHeight(), yMax: b.yMax - this.halfHeight() * 0.5, zMin: b.zMin, zMax: b.zMax };
  }

  pickTarget(first = false) {
    const z = this.style === 'jelly' ? lerp(-8, 3, Math.random()) : lerp(-7, 4.5, Math.random());
    const L = this.limits(z);
    let x = lerp(-L.xMax, L.xMax, Math.random());
    // prefer longer swims across the tank so we see their sides
    if (!first && Math.abs(x - this.pos[0]) < L.xMax * 0.5) x = -Math.sign(this.pos[0] || 1) * Math.random() * L.xMax;
    let y;
    const floorY = this.world.floorHeight(x, z);
    if (this.style === 'eel') y = lerp(floorY + 0.8, floorY + 4, Math.random());
    else if (this.style === 'crawler') y = this.groundY(x, z);
    else y = lerp(Math.max(L.yMin, floorY + this.halfHeight() + 0.6), L.yMax, Math.random());
    this.target = [x, y, z];
    this.targetSpeed = lerp(0.6, 1.0, Math.random());
    this.retarget = 4 + Math.random() * 7;
  }

  poke(from) {
    const now = this.world.time;
    this.pokes = this.pokes.filter(t => now - t < 3);
    this.pokes.push(now);
    this.flash = 1;
    const d = [this.pos[0] - from[0], this.pos[1] - from[1], (this.pos[2] - from[2]) * 0.4];
    const l = Math.hypot(...d) || 1;
    const sp = this.baseSpeed * (this.style === 'jelly' ? 3 : 5);
    this.vel = [d[0] / l * sp, d[1] / l * sp * 0.6, d[2] / l * sp];
    if (this.style === 'crawler') { this.hopV = 4; this.vel[1] = 0; }
    if (this.style === 'jelly') this.spin = 1;
    this.mode = 'flee'; this.modeTime = 0;
    for (let i = 0; i < 6; i++) this.world.emitBubble(this.pos[0] + (Math.random() - 0.5) * this.size * 0.5, this.pos[1], this.pos[2], 0.05 + Math.random() * 0.08);
    if (this.pokes.length >= 3) { this.puff = 1; this.pokes = []; this.spin = 1; }
  }

  forward() {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch);
    return [cy * cp, Math.sin(this.pitch), -sy * cp];
  }

  mouth() {
    const f = this.forward(), h = this.size * 0.45;
    return [this.pos[0] + f[0] * h, this.pos[1] + f[1] * h, this.pos[2] + f[2] * h];
  }

  update(dt, ctx) {
    const w = this.world;
    this.modeTime += dt;
    this.retarget -= dt;
    this.hunger = Math.min(1, this.hunger + dt * 0.012);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.puff = Math.max(0, this.puff - dt * 0.35);
    this.spin = Math.max(0, this.spin - dt * 1.4);
    if (this.splashed && this.modeTime > 1.5) this.splashed = false;

    // ---- decide where to go
    let target = this.target, speed = this.baseSpeed * this.targetSpeed, agility = 1.6;
    if (this.mode === 'flee') {
      speed = this.baseSpeed * lerp(4, 1, Math.min(1, this.modeTime / 1.3));
      agility = 0.6;
      target = [this.pos[0] + this.vel[0], this.pos[1] + this.vel[1], this.pos[2] + this.vel[2]];
      if (this.modeTime > 1.3) { this.mode = 'wander'; this.pickTarget(); }
    } else {
      // food?
      let food = null;
      if (this.style !== 'jelly' && this.hunger > 0.15) {
        let best = 14 * 14;
        const m = this.mouth();
        for (const f of w.food) {
          if (f.eaten || (this.style === 'crawler' && !f.floor)) continue;
          const d2 = (f.x - m[0]) ** 2 + (f.y - m[1]) ** 2 + (f.z - m[2]) ** 2;
          if (d2 < best) { best = d2; food = f; }
        }
      }
      if (food) {
        this.mode = 'food';
        target = [food.x, food.y, food.z];
        speed = this.baseSpeed * 1.6;
        agility = 2.6;
        const m = this.mouth();
        const d = Math.hypot(food.x - m[0], food.y - m[1], food.z - m[2]);
        if (d < 0.3 + this.size * 0.18) {
          food.eaten = true;
          this.hunger -= 0.28;
          this.flash = 0.5;
          if (this.style === 'fish' || this.style === 'eel') this.spin = Math.random() < 0.35 ? 1 : 0;
          if (this.style === 'floaty' || this.style === 'crawler') this.hopV = 2.5;
          for (let i = 0; i < 3; i++) w.emitBubble(m[0], m[1], m[2], 0.04 + Math.random() * 0.05);
        }
      } else if (this.mode === 'food') {
        this.mode = 'wander'; this.pickTarget();
      }

      if (this.mode !== 'food') {
        // curious about the mouse pointer
        const cur = ctx.cursor;
        if (cur && this.curiosity > 0.45 && this.style !== 'crawler') {
          const p = w.rayPlaneZ(cur, this.pos[2]);
          if (p) {
            const d = Math.hypot(p[0] - this.pos[0], p[1] - this.pos[1]);
            if (this.mode === 'curious' || (d < 6 && this.mode === 'wander')) {
              if (this.mode !== 'curious') { this.mode = 'curious'; this.modeTime = 0; }
              const side = this.pos[0] < p[0] ? -1 : 1;
              target = [p[0] + side * this.size * 0.9, p[1], this.pos[2]];
              speed = this.baseSpeed * 0.6;
              agility = 1.4;
              if (this.modeTime > 6 + this.curiosity * 4 || d > 9) { this.mode = 'bored'; this.modeTime = 0; this.pickTarget(); }
            }
          }
        } else if (this.mode === 'curious') { this.mode = 'wander'; this.pickTarget(); }
        if (this.mode === 'bored' && this.modeTime > 8) this.mode = 'wander';

        if (this.leader && this.leader.mode !== 'flee' && this.mode !== 'curious') {
          const lp = this.leader.pos;
          target = [lp[0] + this.offset[0] - Math.sign(this.leader.vel[0] || 1) * 1.2, lp[1] + this.offset[1], lp[2] + this.offset[2]];
          speed = this.leader.baseSpeed * this.leader.targetSpeed * 1.25;
          agility = 2.4;
        } else if (this.mode === 'wander' || this.mode === 'bored') {
          const d = Math.hypot(target[0] - this.pos[0], target[1] - this.pos[1], target[2] - this.pos[2]);
          if (d < 1 || this.retarget < 0) {
            this.pickTarget();
            if (Math.random() < 0.2 && this.style !== 'jelly') { this.targetSpeed = 0.12; this.retarget = 2 + Math.random() * 3; this.target = this.pos.slice(); }
          }
        }
      }
    }

    // ---- move
    const L = this.limits(this.pos[2]);
    if (this.style === 'jelly') this.moveJelly(dt, target, speed, L);
    else {
      const d = [target[0] - this.pos[0], target[1] - this.pos[1], target[2] - this.pos[2]];
      const dist = Math.hypot(...d) || 1;
      const arrive = this.mode === 'flee' ? 1 : Math.min(1, dist / 1.5);
      const want = [d[0] / dist * speed * arrive, d[1] / dist * speed * arrive * 0.7, d[2] / dist * speed * arrive * 0.6];
      // keep a little distance from friends
      for (const o of ctx.creatures) {
        if (o === this) continue;
        const dx = this.pos[0] - o.pos[0], dy = this.pos[1] - o.pos[1], dz = this.pos[2] - o.pos[2];
        const r = (this.size + o.size) * 0.45;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r * r && d2 > 1e-4) { const k = (r - Math.sqrt(d2)) * 1.5; want[0] += dx * k; want[1] += dy * k; want[2] += dz * k; }
      }
      const k = Math.min(1, dt * agility);
      for (let i = 0; i < 3; i++) this.vel[i] += (want[i] - this.vel[i]) * k;
      if (this.style === 'crawler') this.vel[1] = 0;
      for (let i = 0; i < 3; i++) this.pos[i] += this.vel[i] * dt;
    }

    // ---- stay in the tank
    const L2 = this.limits(this.pos[2]);
    this.pos[2] = clamp(this.pos[2], L2.zMin, L2.zMax);
    if (Math.abs(this.pos[0]) > L2.xMax) { this.pos[0] = Math.sign(this.pos[0]) * L2.xMax; this.vel[0] *= -0.3; if (this.mode !== 'food') this.pickTarget(); }
    if (this.style === 'crawler') {
      this.hopV -= 9 * dt;
      this.hop = Math.max(0, this.hop + this.hopV * dt);
      if (this.hop === 0) this.hopV = Math.max(0, this.hopV);
      this.pos[1] = this.groundY(this.pos[0], this.pos[2]) + this.hop;
    } else {
      const floorMin = this.world.floorHeight(this.pos[0], this.pos[2]) + this.halfHeight() + 0.15;
      const yMax = this.splashed ? L2.yMax + 2 : L2.yMax;
      if (this.pos[1] < floorMin) { this.pos[1] = floorMin; this.vel[1] = Math.max(0, this.vel[1]); }
      if (this.pos[1] > yMax) { this.pos[1] = yMax; this.vel[1] = Math.min(0, this.vel[1]); }
    }

    // ---- orientation and animation
    const hs = Math.hypot(this.vel[0], this.vel[2]);
    const spd = Math.hypot(this.vel[0], this.vel[1], this.vel[2]);
    let yawRate = 0;
    if (this.style === 'fish' || this.style === 'eel') {
      if (hs > 0.05) {
        const want = Math.atan2(-this.vel[2], this.vel[0]);
        const diff = wrapAngle(want - this.yaw);
        const maxTurn = (this.mode === 'flee' ? 7 : 2.6) * dt;
        const step = clamp(diff, -maxTurn, maxTurn);
        this.yaw = wrapAngle(this.yaw + step);
        yawRate = step / Math.max(dt, 1e-3);
      }
      const wantPitch = clamp(Math.atan2(this.vel[1], hs + 0.2), -0.55, 0.55);
      this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 3);
      this.bend += (clamp(-yawRate * 0.12, -0.25, 0.25) - this.bend) * Math.min(1, dt * 6);
      const norm = Math.min(1.6, spd / (this.baseSpeed + 0.01));
      const freq = (this.style === 'eel' ? 4 : 5) + norm * 7 / Math.sqrt(this.size);
      this.phase += dt * freq;
      const ampT = this.style === 'eel' ? 0.07 + 0.05 * norm : 0.035 + 0.05 * Math.min(1, norm) + (this.mode === 'flee' ? 0.05 : 0);
      this.amp += (ampT - this.amp) * Math.min(1, dt * 4);
      this.roll = this.spin > 0 ? (1 - this.spin) * TAU : 0;
    } else if (this.style === 'floaty' || this.style === 'crawler') {
      if (Math.abs(this.vel[0]) > 0.08) this.facing = this.vel[0] > 0 ? 0 : Math.PI;
      const wantYaw = this.facing ?? this.yaw;
      const diff = wrapAngle(wantYaw - this.yaw);
      const step = clamp(diff, -3.5 * dt, 3.5 * dt);
      this.yaw = wrapAngle(this.yaw + step);
      this.bend = clamp(this.vel[2] * 0.2, -0.3, 0.3);
      if (this.style === 'floaty') {
        this.pos[1] += Math.sin(w.time * 1.3 + this.seed) * 0.25 * dt;
        this.phase += dt * (2 + spd * 3);
        this.amp = 0.05 + Math.min(0.08, spd * 0.06);
        this.pitch = -clamp(hs * 0.12, 0, 0.25) + (this.spin > 0 ? Math.sin((1 - this.spin) * TAU) * 0.3 : 0);
        if (this.hopV > 0) { this.vel[1] += this.hopV; this.hopV = 0; }
      } else {
        this.phase += dt * (spd * 9 + 0.5);
        this.amp = spd > 0.05 ? 0.03 : 0.006;
        this.pitch = 0;
      }
      this.roll = 0;
    } else {
      // jelly
      this.phase += dt * (1.8 + (this.mode === 'flee' ? 2 : 0));
      this.yaw = Math.sin(w.time * 0.15 + this.seed) * 0.5 + this.spin * TAU;
      this.pitch = clamp(-this.vel[0] * 0.15, -0.3, 0.3);
      this.amp = 0.12;
    }

    // ---- bubbles
    this.bubbleTimer -= dt;
    if (this.bubbleTimer < 0) {
      const breathes = this.spec.bubbles;
      this.bubbleTimer = breathes ? 1.8 + Math.random() * 2 : 6 + Math.random() * 14;
      const m = this.mouth();
      const n = breathes ? 4 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) setTimeout(() => w.emitBubble(m[0], m[1] + this.halfHeight() * 0.4, m[2], 0.05 + Math.random() * 0.09), i * 90);
    }

    const s = this.size * (1 + this.puff * 0.18);
    const sy = s * (1 + this.puff * 0.25);
    M4.compose(this.model, this.pos[0], this.pos[1], this.pos[2], this.yaw, this.pitch, this.roll, s, sy, s);
  }

  moveJelly(dt, target, speed, L) {
    const pulse = Math.sin(this.phase);
    if (pulse > 0) this.vel[1] += pulse * dt * 1.4 * (this.target[1] > this.pos[1] ? 1 : 0.35);
    this.vel[1] -= dt * 0.28;
    const dx = target[0] - this.pos[0], dz = target[2] - this.pos[2];
    const d = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, dt * (this.mode === 'flee' ? 0.4 : 0.6));
    this.vel[0] += (dx / d * speed - this.vel[0]) * k;
    this.vel[2] += (dz / d * speed * 0.5 - this.vel[2]) * k;
    this.vel[1] *= 1 - Math.min(1, dt * 0.8);
    for (let i = 0; i < 3; i++) this.pos[i] += this.vel[i] * dt;
    if (this.pos[1] > L.yMax - 0.5) this.vel[1] -= dt * 2;
  }

  shadow() {
    const fy = this.world.floorHeight(this.pos[0], this.pos[2]);
    const h = this.pos[1] - fy;
    return { x: this.pos[0], y: fy, z: this.pos[2], r: this.size * (0.55 + h * 0.05), a: 0.42 * clamp(1 - h / 13, 0.1, 1) };
  }

  draw(prog) {
    prog.set({
      uModel: this.model, uStyle: this.styleId, uPhase: this.phase, uAmp: this.amp, uBend: this.bend,
      uWaveK: this.style === 'eel' ? 9 : 5.5, uPuff: this.puff, uTex: this.look.tex, uFlash: this.flash, uHighlight: this.highlight,
    });
    this.look.mesh.draw();
  }
}
