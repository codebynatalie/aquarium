// Built-in sea creatures, drawn with the canvas so they get the same
// "drawing comes to life" treatment as your own fish.

const OUT = '#2b1b16';

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  return [cv, ctx];
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function fill(ctx, path, style, outline = OUT, lw = 5) {
  ctx.fillStyle = style; ctx.fill(path);
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = lw; ctx.stroke(path); }
}

function eye(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r * 0.15, y, r * 0.62, 0, Math.PI * 2); ctx.fillStyle = '#16121a'; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
}

// Generic fish body: nose at right.
function fishBody(cx, cy, rx, ry, nose = 0.35) {
  const p = new Path2D();
  p.moveTo(cx - rx, cy);
  p.bezierCurveTo(cx - rx * 0.6, cy - ry * 1.05, cx + rx * (0.55 + nose * 0.2), cy - ry * 1.1, cx + rx, cy - ry * nose * 0.3);
  p.quadraticCurveTo(cx + rx * 1.03, cy, cx + rx, cy + ry * nose * 0.3);
  p.bezierCurveTo(cx + rx * (0.55 + nose * 0.2), cy + ry * 1.1, cx - rx * 0.6, cy + ry * 1.05, cx - rx, cy);
  p.closePath();
  return p;
}

function tail(type, x, cy, len, spread) {
  const p = new Path2D();
  if (type === 'fork') {
    p.moveTo(x + 10, cy);
    p.lineTo(x - len, cy - spread); p.quadraticCurveTo(x - len * 0.55, cy, x - len, cy + spread); p.closePath();
  } else if (type === 'flowing') {
    p.moveTo(x + 10, cy - 10);
    p.bezierCurveTo(x - len * 0.6, cy - spread * 1.4, x - len * 1.2, cy - spread * 0.6, x - len, cy - spread * 0.1);
    p.bezierCurveTo(x - len * 0.8, cy + spread * 0.1, x - len * 1.25, cy + spread * 0.9, x - len * 0.9, cy + spread * 1.2);
    p.bezierCurveTo(x - len * 0.5, cy + spread, x - 10, cy + 20, x + 10, cy + 10);
    p.closePath();
  } else {
    p.moveTo(x + 10, cy - 8);
    p.quadraticCurveTo(x - len * 0.5, cy - spread * 1.2, x - len, cy - spread);
    p.quadraticCurveTo(x - len * 0.75, cy, x - len, cy + spread);
    p.quadraticCurveTo(x - len * 0.5, cy + spread * 1.2, x + 10, cy + 8);
    p.closePath();
  }
  return p;
}

function finPath(points) {
  const p = new Path2D();
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length - 1; i += 2) p.quadraticCurveTo(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  p.closePath();
  return p;
}

function genericFish(o) {
  const [cv, ctx] = canvas(o.w || 512, o.h || 300);
  const cx = o.cx, cy = o.cy, rx = o.rx, ry = o.ry;
  const finFill = o.finFill || o.body[1];
  // fins behind body
  fill(ctx, tail(o.tail || 'fan', cx - rx + 18, cy, o.tailLen || 110, o.tailSpread || 80), o.tailFill ? o.tailFill(ctx) : finFill);
  if (o.dorsal) fill(ctx, finPath(o.dorsal), finFill);
  if (o.anal) fill(ctx, finPath(o.anal), finFill);
  const body = fishBody(cx, cy, rx, ry, o.nose);
  fill(ctx, body, grad(ctx, 0, cy - ry, 0, cy + ry, o.body));
  if (o.pattern) { ctx.save(); ctx.clip(body); o.pattern(ctx); ctx.restore(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(body); }
  // belly shine
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(cx + rx * 0.1, cy - ry * 0.45, rx * 0.6, ry * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (o.pectoral !== false) fill(ctx, finPath([[cx + rx * 0.35, cy + ry * 0.15], [cx + rx * 0.1, cy + ry * 0.55], [cx + rx * 0.08, cy + ry * 0.35]]), finFill, OUT, 3);
  eye(ctx, cx + rx * 0.62, cy - ry * 0.18, o.eye || ry * 0.2);
  ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx + rx * 0.9, cy + ry * 0.18, ry * 0.12, Math.PI * 0.6, Math.PI * 1.2); ctx.stroke();
  return cv;
}

export const CREATURES = {
  clownfish: {
    name: 'Clownfish', icon: '🐠', style: 'fish', size: 1.3, speed: 1, chubby: 0.6,
    draw() {
      return genericFish({
        cx: 280, cy: 150, rx: 180, ry: 88, body: ['#ff9d3c', '#ff6a12', '#e0500a'], finFill: '#ff7a1c',
        tail: 'round', tailLen: 100, tailSpread: 70,
        dorsal: [[170, 80], [240, 20], [330, 66], [370, 40], [400, 78]],
        anal: [[210, 220], [250, 270], [310, 225]],
        pattern(ctx) {
          for (const [x, w] of [[385, 34], [262, 40], [140, 30]]) {
            ctx.fillStyle = '#1b1414'; ctx.fillRect(x - w / 2 - 7, 0, w + 14, 300);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w / 2, 0, w, 300);
          }
        },
      });
    },
  },
  bluetang: {
    name: 'Blue tang', icon: '🐟', style: 'fish', size: 1.6, speed: 1.1, chubby: 0.5,
    draw() {
      return genericFish({
        cx: 280, cy: 160, rx: 175, ry: 105, nose: 0.5, body: ['#3a7bff', '#1f4fd8', '#173aa8'], finFill: '#2148c0',
        tail: 'fork', tailLen: 110, tailSpread: 85, tailFill: ctx => grad(ctx, 0, 0, 160, 0, ['#ffd23a', '#ffb800']),
        dorsal: [[150, 90], [260, 30], [400, 85]], anal: [[160, 230], [270, 290], [380, 235]],
        pattern(ctx) {
          ctx.fillStyle = '#10163a';
          ctx.beginPath(); ctx.moveTo(150, 130); ctx.bezierCurveTo(220, 60, 330, 80, 400, 120); ctx.bezierCurveTo(330, 110, 300, 170, 360, 200); ctx.bezierCurveTo(260, 170, 220, 150, 150, 130); ctx.fill();
        },
      });
    },
  },
  goldfish: {
    name: 'Goldfish', icon: '🐡', style: 'fish', size: 1.4, speed: 0.8, chubby: 0.7,
    draw() {
      return genericFish({
        w: 560, h: 330, cx: 330, cy: 165, rx: 160, ry: 100, body: ['#ffb347', '#ff7f11', '#e85d04'], finFill: 'rgba(255,140,40,0.95)',
        tail: 'flowing', tailLen: 170, tailSpread: 100,
        dorsal: [[230, 85], [300, 10], [380, 75]], anal: [[260, 245], [290, 300], [330, 255]],
        pattern(ctx) { ctx.fillStyle = 'rgba(255,230,180,0.35)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(200 + (i * 37) % 250, 90 + (i * 53) % 160, 10, 0, 7); ctx.fill(); } },
      });
    },
  },
  angelfish: {
    name: 'Angelfish', icon: '🐠', style: 'fish', size: 1.7, speed: 0.75, chubby: 0.4,
    draw() {
      return genericFish({
        w: 420, h: 520, cx: 240, cy: 260, rx: 130, ry: 105, nose: 0.6, body: ['#f7f1d8', '#e6dcb0', '#cdbf8a'], finFill: '#d9cc96',
        tail: 'fork', tailLen: 100, tailSpread: 70,
        dorsal: [[160, 190], [150, 30], [300, 175]], anal: [[160, 330], [150, 500], [300, 345]],
        pattern(ctx) { ctx.fillStyle = '#2a2420'; for (const x of [170, 245, 315]) ctx.fillRect(x - 12, 0, 24, 520); ctx.fillStyle = 'rgba(255,200,60,0.5)'; ctx.fillRect(300, 0, 120, 200); },
      });
    },
  },
  neon: {
    name: 'Neon tetras', icon: '✨', style: 'fish', size: 0.65, speed: 1.3, chubby: 0.5, count: 7,
    draw() {
      return genericFish({
        w: 480, h: 220, cx: 260, cy: 110, rx: 190, ry: 62, body: ['#c9d6e6', '#b8c4d4', '#e8eef5'], finFill: 'rgba(220,230,240,0.9)',
        tail: 'fork', tailLen: 80, tailSpread: 55,
        dorsal: [[230, 60], [260, 15], [300, 55]], anal: [[220, 160], [250, 200], [290, 165]],
        pattern(ctx) {
          ctx.fillStyle = grad(ctx, 80, 0, 450, 0, ['#1ad6ff', '#13a0ff', '#33e0ff']); ctx.fillRect(60, 80, 400, 26);
          ctx.fillStyle = '#ff2a3a'; ctx.fillRect(60, 106, 230, 40);
        },
      });
    },
  },
  puffer: {
    name: 'Pufferfish', icon: '🐡', style: 'fish', size: 1.3, speed: 0.6, chubby: 1.15,
    draw() {
      return genericFish({
        w: 460, h: 380, cx: 250, cy: 195, rx: 150, ry: 140, nose: 0.7, body: ['#e9d67a', '#d4b84a', '#f4efd6'], finFill: '#d9c26a',
        tail: 'round', tailLen: 80, tailSpread: 55, eye: 32,
        pattern(ctx) { ctx.fillStyle = '#6a5426'; for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.arc(120 + (i * 61) % 260, 70 + (i * 37) % 200, 7, 0, 7); ctx.fill(); } },
      });
    },
  },
  shark: {
    name: 'Reef shark', icon: '🦈', style: 'fish', size: 3.6, speed: 1.2, chubby: 0.45,
    draw() {
      const [cv, ctx] = canvas(640, 260);
      const body = new Path2D();
      body.moveTo(110, 130);
      body.bezierCurveTo(200, 70, 420, 60, 560, 105);
      body.quadraticCurveTo(625, 125, 560, 150);
      body.bezierCurveTo(420, 185, 220, 180, 110, 135);
      body.closePath();
      fill(ctx, finPath([[130, 130], [20, 30], [70, 128], [15, 210], [130, 138]]), '#7f8c99');
      fill(ctx, finPath([[300, 85], [330, 0], [390, 78]]), '#748290');
      fill(ctx, finPath([[360, 160], [330, 240], [420, 165]]), '#748290');
      fill(ctx, body, grad(ctx, 0, 70, 0, 180, ['#8d9aa8', '#7a8796', '#e9eef2']));
      ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(470 - i * 14, 110); ctx.lineTo(462 - i * 14, 140); ctx.stroke(); }
      eye(ctx, 535, 112, 11);
      ctx.beginPath(); ctx.moveTo(545, 142); ctx.quadraticCurveTo(570, 150, 595, 138); ctx.stroke();
      return cv;
    },
  },
  turtle: {
    name: 'Sea turtle', icon: '🐢', style: 'fish', size: 2.6, speed: 0.55, chubby: 0.55,
    draw() {
      const [cv, ctx] = canvas(560, 360);
      const skin = grad(ctx, 0, 0, 0, 360, ['#9ccf7a', '#6fae4f']);
      fill(ctx, finPath([[300, 200], [200, 330], [150, 340], [190, 300], [260, 190]]), skin);
      fill(ctx, finPath([[350, 180], [470, 300], [520, 330], [480, 260], [380, 170]]), skin);
      fill(ctx, finPath([[160, 190], [80, 240], [60, 220], [90, 200], [150, 175]]), skin);
      const head = new Path2D(); head.ellipse(470, 150, 60, 42, -0.15, 0, Math.PI * 2);
      fill(ctx, head, skin);
      const shell = new Path2D(); shell.moveTo(110, 190); shell.bezierCurveTo(140, 60, 400, 40, 430, 170); shell.bezierCurveTo(350, 215, 200, 220, 110, 190); shell.closePath();
      fill(ctx, shell, grad(ctx, 0, 60, 0, 220, ['#8a6a3a', '#5e4424']));
      ctx.save(); ctx.clip(shell); ctx.strokeStyle = '#3b2a16'; ctx.lineWidth = 4; ctx.fillStyle = 'rgba(200,170,100,0.35)';
      for (const [x, y] of [[200, 130], [280, 110], [360, 135], [240, 180], [320, 180], [160, 170]]) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 34); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(shell);
      eye(ctx, 492, 138, 11);
      return cv;
    },
  },
  jelly: {
    name: 'Jellyfish', icon: '🪼', style: 'jelly', size: 1.4, speed: 0.5, chubby: 0.75, glowy: true,
    draw() {
      const [cv, ctx] = canvas(320, 460);
      ctx.strokeStyle = 'rgba(255,170,220,0.95)'; ctx.lineWidth = 7;
      for (let i = 0; i < 7; i++) {
        const x = 70 + i * 30;
        ctx.beginPath(); ctx.moveTo(x, 160);
        for (let y = 160; y < 450; y += 20) ctx.lineTo(x + Math.sin(y * 0.05 + i) * 14, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,200,235,1)';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(110 + i * 33, 230, 14, 70, Math.sin(i) * 0.2, 0, Math.PI * 2); ctx.fill(); }
      const bell = new Path2D(); bell.moveTo(30, 175); bell.bezierCurveTo(20, 20, 300, 20, 290, 175); bell.quadraticCurveTo(160, 150, 30, 175); bell.closePath();
      fill(ctx, bell, grad(ctx, 0, 30, 0, 180, ['#ffd6f2', '#ff8fd0', '#d65aa8']), '#a03a7a', 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(120, 80, 60, 25, -0.3, 0, Math.PI * 2); ctx.fill();
      return cv;
    },
  },
  crab: {
    name: 'Crab', icon: '🦀', style: 'crawler', size: 1.1, speed: 0.7, chubby: 0.55,
    draw() {
      const [cv, ctx] = canvas(480, 320);
      const red = grad(ctx, 0, 60, 0, 260, ['#ff6a4a', '#d8341e']);
      ctx.strokeStyle = OUT; ctx.lineWidth = 16;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = '#c23020';
        ctx.beginPath(); ctx.moveTo(240 + s * 80, 200 + i * 10); ctx.lineTo(240 + s * (150 + i * 20), 230 + i * 15); ctx.lineTo(240 + s * (175 + i * 22), 300); ctx.stroke();
      }
      for (const s of [-1, 1]) {
        ctx.strokeStyle = '#c23020'; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(240 + s * 90, 160); ctx.lineTo(240 + s * 160, 110); ctx.stroke();
        const claw = new Path2D(); claw.ellipse(240 + s * 170, 80, 45, 38, s * 0.4, 0, Math.PI * 2);
        fill(ctx, claw, red);
        ctx.fillStyle = '#fff3'; ctx.beginPath(); ctx.moveTo(240 + s * 170, 80); ctx.lineTo(240 + s * 215, 45); ctx.lineTo(240 + s * 200, 85); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(240 + s * 175, 78); ctx.lineTo(240 + s * 212, 52); ctx.stroke();
      }
      const shell = new Path2D(); shell.ellipse(240, 185, 115, 75, 0, 0, Math.PI * 2);
      fill(ctx, shell, red);
      ctx.strokeStyle = OUT; ctx.lineWidth = 6;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(240 + s * 30, 120); ctx.lineTo(240 + s * 40, 70); ctx.stroke(); eye(ctx, 240 + s * 40, 62, 16); }
      ctx.beginPath(); ctx.arc(240, 190, 30, 0.2, Math.PI - 0.2); ctx.stroke();
      return cv;
    },
  },
  snail: {
    name: 'Snail', icon: '🐌', style: 'crawler', size: 0.9, speed: 0.35, chubby: 0.6,
    draw() {
      const [cv, ctx] = canvas(420, 300);
      const foot = new Path2D(); foot.moveTo(30, 260); foot.quadraticCurveTo(200, 230, 330, 250); foot.quadraticCurveTo(380, 180, 360, 130); foot.quadraticCurveTo(400, 120, 400, 160); foot.quadraticCurveTo(400, 230, 360, 275); foot.quadraticCurveTo(200, 290, 30, 260);
      fill(ctx, foot, grad(ctx, 0, 120, 0, 290, ['#e8d6b8', '#c9ae86']));
      ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      for (const dx of [0, 25]) { ctx.beginPath(); ctx.moveTo(370 + dx * 0.3, 140); ctx.lineTo(375 + dx, 70); ctx.stroke(); eye(ctx, 375 + dx, 66, 10); }
      const shell = new Path2D(); shell.arc(190, 160, 105, 0, Math.PI * 2);
      fill(ctx, shell, grad(ctx, 90, 60, 290, 260, ['#ffcf6a', '#d9822b', '#9a4a1a']));
      ctx.strokeStyle = '#5a2a10'; ctx.lineWidth = 6; ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.1) { const r = 95 * (1 - a / (Math.PI * 5.4)); ctx.lineTo(190 + Math.cos(a) * r, 160 + Math.sin(a) * r); }
      ctx.stroke();
      return cv;
    },
  },
  seahorse: {
    name: 'Seahorse', icon: '🐉', style: 'floaty', size: 1.3, speed: 0.4, chubby: 0.55,
    draw() {
      const [cv, ctx] = canvas(300, 480);
      const b = new Path2D();
      b.moveTo(150, 60); b.bezierCurveTo(230, 40, 270, 110, 230, 140); b.lineTo(290, 150); b.lineTo(285, 175); b.lineTo(215, 170);
      b.bezierCurveTo(240, 230, 230, 300, 180, 340); b.bezierCurveTo(140, 380, 150, 440, 200, 430); b.bezierCurveTo(230, 425, 225, 395, 200, 395);
      b.bezierCurveTo(170, 400, 180, 420, 195, 418); b.bezierCurveTo(120, 450, 100, 380, 140, 330);
      b.bezierCurveTo(170, 290, 130, 240, 110, 200); b.bezierCurveTo(90, 150, 100, 80, 150, 60); b.closePath();
      fill(ctx, finPath([[110, 220], [50, 250], [70, 300], [60, 250], [125, 270]]), '#ffd35a');
      fill(ctx, b, grad(ctx, 0, 60, 300, 400, ['#ffe36a', '#ffb02e', '#e8781a']));
      ctx.save(); ctx.clip(b); ctx.strokeStyle = 'rgba(120,60,0,0.45)'; ctx.lineWidth = 4;
      for (let y = 150; y < 440; y += 22) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(260, y + 10); ctx.stroke(); }
      ctx.restore(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(b);
      eye(ctx, 190, 100, 14);
      ctx.fillStyle = '#ffb02e'; for (const [x, y] of [[150, 52], [130, 60], [170, 50]]) { ctx.beginPath(); ctx.moveTo(x - 8, y + 8); ctx.lineTo(x, y - 14); ctx.lineTo(x + 8, y + 8); ctx.fill(); }
      return cv;
    },
  },
  diver: {
    name: 'Scuba diver', icon: '🤿', style: 'fish', size: 3.0, speed: 0.6, chubby: 0.5, bubbles: true,
    draw() {
      const [cv, ctx] = canvas(620, 260);
      const suit = grad(ctx, 0, 60, 0, 200, ['#2f3a4a', '#1a2230']);
      // fins
      fill(ctx, finPath([[110, 105], [10, 60], [30, 100], [10, 130], [110, 125]]), '#ffd400');
      fill(ctx, finPath([[110, 145], [15, 160], [35, 190], [20, 220], [110, 165]]), '#ffd400');
      // legs
      ctx.strokeStyle = '#1a2230'; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(300, 120); ctx.lineTo(200, 115); ctx.lineTo(110, 115); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(300, 140); ctx.lineTo(200, 160); ctx.lineTo(110, 155); ctx.stroke();
      // tank
      const tank = new Path2D(); tank.roundRect(270, 50, 170, 44, 22);
      fill(ctx, tank, grad(ctx, 0, 50, 0, 94, ['#ffd25a', '#e8a21a']));
      // torso
      const body = new Path2D(); body.roundRect(260, 85, 230, 80, 40);
      fill(ctx, body, suit);
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(300, 92); ctx.lineTo(450, 92); ctx.stroke();
      // arm
      ctx.strokeStyle = '#1a2230'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(440, 140); ctx.lineTo(520, 190); ctx.lineTo(580, 170); ctx.stroke();
      ctx.fillStyle = '#f2c29a'; ctx.beginPath(); ctx.arc(588, 168, 15, 0, 7); ctx.fill();
      // head + mask
      ctx.fillStyle = '#f2c29a'; ctx.beginPath(); ctx.arc(525, 110, 42, 0, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#1a2230'; ctx.beginPath(); ctx.arc(520, 100, 44, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      const mask = new Path2D(); mask.roundRect(522, 92, 48, 34, 10);
      fill(ctx, mask, 'rgba(120,210,255,0.95)', '#222', 5);
      eye(ctx, 548, 108, 8);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(545, 140); ctx.quadraticCurveTo(500, 160, 440, 80); ctx.stroke();
      return cv;
    },
  },
};
