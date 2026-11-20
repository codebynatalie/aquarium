// Drawing pad: brush, eraser, paint bucket, undo, plus creature parts
// (eyes, fins, teeth, people...) that you can move, resize, turn and flip.
import { loadImage } from './fishmaker.js';
import { PARTS, PART_CATS, drawPart, partThumb } from './parts.js';

const COLORS = ['#1b1b1f', '#ffffff', '#7a7a80', '#e53935', '#ff7043', '#ff9800', '#ffd600', '#c6ff00', '#43a047', '#00bfa5',
  '#00b0ff', '#2962ff', '#7c4dff', '#d500f9', '#ff4081', '#f8bbd0', '#8d6e63', '#f2c29a'];
const HANDLE = 22;

export function openDrawPad({ startImage = null } = {}) {
  return new Promise(resolve => {
    const W = 960, H = 600;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `
      <div class="modal drawpad">
        <div class="modal-head"><h2>🖍️ Draw a creature</h2><span class="muted">Draw it big, facing right if you can. Add eyes, fins, teeth and more from the parts box!</span></div>
        <div class="dp-body">
          <div class="dp-tools">
            <div class="dp-group">
              <button class="tool on" data-tool="brush" title="Brush">🖌️</button>
              <button class="tool" data-tool="fill" title="Paint bucket (fill an area)">🎨</button>
              <button class="tool" data-tool="eraser" title="Eraser">🧽</button>
              <button class="tool" data-tool="move" title="Move parts">✋</button>
            </div>
            <div class="dp-group sizes">
              ${[4, 9, 18, 34].map((s, i) => `<button class="size ${i === 1 ? 'on' : ''}" data-size="${s}"><i style="width:${Math.min(26, s)}px;height:${Math.min(26, s)}px"></i></button>`).join('')}
            </div>
            <div class="dp-colors">
              ${COLORS.map((c, i) => `<button class="swatch ${i === 0 ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
              <label class="swatch custom" title="Any colour"><input type="color" value="#ff8800"></label>
            </div>
            <div class="dp-group">
              <button class="btn small" data-act="undo">↩️ Undo</button>
              <button class="btn small" data-act="clear">🗑️ Clear</button>
            </div>
            <label class="btn small file">🖼️ Put a picture in<input type="file" accept="image/*" hidden></label>
            <div class="dp-partbar hidden">
              <b>This part</b>
              <div class="dp-group">
                <button class="btn icon" data-p="flip" title="Flip">↔️</button>
                <button class="btn icon" data-p="left" title="Turn left">↩️</button>
                <button class="btn icon" data-p="right" title="Turn right">↪️</button>
                <button class="btn icon" data-p="smaller" title="Smaller">➖</button>
                <button class="btn icon" data-p="bigger" title="Bigger">➕</button>
              </div>
              <div class="dp-group">
                <button class="btn small" data-p="color" title="Paint this part with the chosen colour">🎨 Colour it</button>
                <button class="btn small" data-p="copy">📄 Copy</button>
                <button class="btn small" data-p="front">⬆️ To front</button>
                <button class="btn small" data-p="back">⬇️ To back</button>
                <button class="btn small" data-p="stick" title="Glue it onto the drawing so you can draw over it">📌 Stick down</button>
                <button class="btn small danger" data-p="del">🗑️ Remove</button>
              </div>
            </div>
          </div>
          <div class="dp-canvas-wrap"><canvas width="${W}" height="${H}"></canvas></div>
          <div class="dp-parts">
            <b>🧩 Parts</b>
            <div class="chips dp-cats">${PART_CATS.map(([k, n], i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('')}</div>
            <div class="dp-part-grid"></div>
            <p class="muted small">Pick a colour first, then a part. Drag the part to move it; drag the round handle to make it bigger and turn it.</p>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="done">Done – bring it to life! ✨</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const $ = q => wrap.querySelector(q);
    const $$ = q => [...wrap.querySelectorAll(q)];
    const cv = $('canvas');
    const view = cv.getContext('2d');

    // the painted picture lives here; parts float on top until "stuck down"
    const paint = document.createElement('canvas');
    paint.width = W; paint.height = H;
    const ctx = paint.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    let tool = 'brush', color = COLORS[0], size = 9;
    const stickers = [];
    let sel = null;
    const history = [];
    const push = a => { history.push(a); if (history.length > 40) history.shift(); };
    const snapPaint = () => push({ t: 'paint', img: ctx.getImageData(0, 0, W, H) });

    // ---------- drawing the view ----------
    const handlePos = s => {
      const p = PARTS[s.part];
      const hx = p.w / 2 * s.scale + 6, hy = p.h / 2 * s.scale + 6;
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      return [s.x + hx * c - hy * sn, s.y + hx * sn + hy * c];
    };
    const drawSticker = (c, s) => {
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.rot);
      c.scale(s.flip ? -s.scale : s.scale, s.scale);
      drawPart(c, s.part, s.color);
      c.restore();
    };
    const render = () => {
      view.drawImage(paint, 0, 0);
      for (const s of stickers) drawSticker(view, s);
      if (sel) {
        const p = PARTS[sel.part];
        view.save();
        view.translate(sel.x, sel.y);
        view.rotate(sel.rot);
        view.setLineDash([8, 6]);
        view.strokeStyle = '#00a3ff';
        view.lineWidth = 2;
        view.strokeRect(-p.w / 2 * sel.scale - 6, -p.h / 2 * sel.scale - 6, p.w * sel.scale + 12, p.h * sel.scale + 12);
        view.restore();
        const [hx, hy] = handlePos(sel);
        view.beginPath(); view.arc(hx, hy, HANDLE / 2, 0, Math.PI * 2);
        view.fillStyle = '#00a3ff'; view.fill();
        view.strokeStyle = '#fff'; view.lineWidth = 3; view.stroke();
        view.fillStyle = '#fff'; view.font = 'bold 13px Segoe UI'; view.textAlign = 'center'; view.textBaseline = 'middle'; view.fillText('⤡', hx, hy + 1);
      }
      $('.dp-partbar').classList.toggle('hidden', !sel);
    };

    const setTool = t => {
      tool = t;
      $$('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === t));
      cv.style.cursor = t === 'move' ? 'grab' : 'crosshair';
      if (t !== 'move' && sel) { sel = null; render(); }
    };

    const placeImage = img => {
      snapPaint();
      const s = Math.min(W / img.width, H / img.height) * 0.92;
      const w = img.width * s, h = img.height * s;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      render();
    };
    if (startImage) { placeImage(startImage); history.length = 0; }

    // ---------- parts picker ----------
    const showCat = cat => {
      $$('[data-cat]').forEach(x => x.classList.toggle('on', x.dataset.cat === cat));
      const grid = $('.dp-part-grid');
      grid.innerHTML = '';
      for (const [id, p] of Object.entries(PARTS)) {
        if (p.cat !== cat) continue;
        const b = document.createElement('button');
        b.className = 'part-tile';
        b.title = p.name;
        b.innerHTML = `<img src="${partThumb(id)}" alt=""><span>${p.name}</span>`;
        b.onclick = () => addPart(id);
        grid.appendChild(b);
      }
    };
    $$('[data-cat]').forEach(b => b.onclick = () => showCat(b.dataset.cat));
    showCat(PART_CATS[0][0]);

    const chosenColor = id => (color === COLORS[0] || color === COLORS[1]) ? PARTS[id].color : color;
    const addPart = id => {
      const p = PARTS[id];
      const scale = Math.min(1, 380 / Math.max(p.w, p.h));
      const s = { part: id, x: W / 2 + (Math.random() - 0.5) * 120, y: H / 2 + (Math.random() - 0.5) * 80, scale, rot: 0, flip: false, color: chosenColor(id) };
      stickers.push(s);
      push({ t: 'add', s });
      sel = s;
      setTool('move');
      sel = s;
      render();
    };

    const xfOf = s => ({ x: s.x, y: s.y, scale: s.scale, rot: s.rot, flip: s.flip, color: s.color });
    const partAction = a => {
      if (!sel) return;
      const s = sel;
      if (a === 'del') { push({ t: 'del', s, i: stickers.indexOf(s) }); stickers.splice(stickers.indexOf(s), 1); sel = null; }
      else if (a === 'stick') {
        push({ t: 'stick', s, i: stickers.indexOf(s), img: ctx.getImageData(0, 0, W, H) });
        drawSticker(ctx, s);
        stickers.splice(stickers.indexOf(s), 1);
        sel = null;
      } else if (a === 'copy') {
        const c = { ...s, x: s.x + 30, y: s.y + 30 };
        stickers.push(c); push({ t: 'add', s: c }); sel = c;
      } else if (a === 'front' || a === 'back') {
        const i = stickers.indexOf(s);
        stickers.splice(i, 1);
        if (a === 'front') stickers.push(s); else stickers.unshift(s);
      } else {
        push({ t: 'xf', s, prev: xfOf(s) });
        if (a === 'flip') s.flip = !s.flip;
        if (a === 'left') s.rot -= Math.PI / 12;
        if (a === 'right') s.rot += Math.PI / 12;
        if (a === 'bigger') s.scale = Math.min(4, s.scale * 1.15);
        if (a === 'smaller') s.scale = Math.max(0.15, s.scale / 1.15);
        if (a === 'color') s.color = chosenColor(s.part);
      }
      render();
    };
    $$('[data-p]').forEach(b => b.onclick = () => partAction(b.dataset.p));

    // ---------- tools ----------
    $$('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    $$('[data-size]').forEach(b => b.onclick = () => {
      size = +b.dataset.size;
      $$('[data-size]').forEach(x => x.classList.toggle('on', x === b));
    });
    const pickColor = (c, el) => {
      color = c;
      if (tool === 'eraser') setTool('brush');
      $$('.swatch').forEach(x => x.classList.toggle('on', x === el));
    };
    $$('[data-color]').forEach(b => b.onclick = () => pickColor(b.dataset.color, b));
    const custom = $('.custom input');
    custom.oninput = () => { custom.parentElement.style.background = custom.value; pickColor(custom.value, custom.parentElement); };
    $('[data-act=undo]').onclick = () => {
      const a = history.pop();
      if (!a) return;
      if (a.t === 'paint') ctx.putImageData(a.img, 0, 0);
      else if (a.t === 'add') { const i = stickers.indexOf(a.s); if (i >= 0) stickers.splice(i, 1); if (sel === a.s) sel = null; }
      else if (a.t === 'del') stickers.splice(a.i, 0, a.s);
      else if (a.t === 'xf') Object.assign(a.s, a.prev);
      else if (a.t === 'stick') { ctx.putImageData(a.img, 0, 0); stickers.splice(a.i, 0, a.s); }
      render();
    };
    $('[data-act=clear]').onclick = () => {
      snapPaint();
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      stickers.length = 0; sel = null;
      render();
    };
    $('.file input').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      try { placeImage(await loadImage(url)); } finally { URL.revokeObjectURL(url); }
    };

    // ---------- pointer ----------
    const pos = e => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
    };
    const hit = (s, x, y) => {
      const p = PARTS[s.part];
      const dx = x - s.x, dy = y - s.y, c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      return Math.abs(lx) <= p.w / 2 * s.scale + 6 && Math.abs(ly) <= p.h / 2 * s.scale + 6;
    };
    let drawing = false, last = null, grab = null;

    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch { }
      const p = pos(e);
      // parts can always be grabbed by their handle, and with the move tool by their body
      if (sel) {
        const [hx, hy] = handlePos(sel);
        if (Math.hypot(p[0] - hx, p[1] - hy) < HANDLE) {
          grab = { mode: 'resize', s: sel, prev: xfOf(sel), d0: Math.hypot(hx - sel.x, hy - sel.y), a0: Math.atan2(hy - sel.y, hx - sel.x), scale0: sel.scale, rot0: sel.rot };
          return;
        }
      }
      if (tool === 'move') {
        const s = [...stickers].reverse().find(st => hit(st, p[0], p[1]));
        sel = s || null;
        if (s) { grab = { mode: 'move', s, prev: xfOf(s), dx: s.x - p[0], dy: s.y - p[1] }; cv.style.cursor = 'grabbing'; }
        render();
        return;
      }
      snapPaint();
      if (tool === 'fill') { floodFill(ctx, W, H, Math.round(p[0]), Math.round(p[1]), color); render(); return; }
      drawing = true; last = p;
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? size * 2 : size;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 0.01, p[1]); ctx.stroke();
      render();
    });
    cv.addEventListener('pointermove', e => {
      if (grab) {
        const p = pos(e), s = grab.s;
        if (grab.mode === 'move') { s.x = p[0] + grab.dx; s.y = p[1] + grab.dy; }
        else {
          const d = Math.hypot(p[0] - s.x, p[1] - s.y), a = Math.atan2(p[1] - s.y, p[0] - s.x);
          s.scale = Math.max(0.15, Math.min(4, grab.scale0 * d / grab.d0));
          s.rot = grab.rot0 + (a - grab.a0);
        }
        render();
        return;
      }
      if (!drawing) return;
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      for (const ev of evs) { const p = pos(ev); ctx.lineTo(p[0], p[1]); last = p; }
      ctx.stroke();
      render();
    });
    const end = () => {
      if (grab) { push({ t: 'xf', s: grab.s, prev: grab.prev }); grab = null; if (tool === 'move') cv.style.cursor = 'grab'; }
      drawing = false;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    const onKey = e => {
      if (!sel || e.target.matches('input')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { partAction('del'); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    const close = result => { window.removeEventListener('keydown', onKey); wrap.remove(); resolve(result); };
    $('[data-act=cancel]').onclick = () => close(null);
    $('[data-act=done]').onclick = () => {
      for (const s of stickers) drawSticker(ctx, s);   // glue every part onto the picture
      close(paint);
    };
    render();
  });
}

function floodFill(ctx, W, H, x0, y0, hex) {
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const n = parseInt(hex.slice(1), 16);
  const fr = (n >> 16) & 255, fg = (n >> 8) & 255, fb = n & 255;
  const i0 = (y0 * W + x0) * 4;
  const sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2];
  if (Math.abs(sr - fr) + Math.abs(sg - fg) + Math.abs(sb - fb) < 6) return;
  const tol = 90;
  const match = i => Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) < tol;
  const seen = new Uint8Array(W * H);
  const stack = [x0, y0];
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let xl = x;
    while (xl >= 0 && !seen[y * W + xl] && match((y * W + xl) * 4)) xl--;
    xl++;
    let up = false, down = false;
    for (let xx = xl; xx < W; xx++) {
      const p = y * W + xx;
      if (seen[p] || !match(p * 4)) break;
      seen[p] = 1;
      d[p * 4] = fr; d[p * 4 + 1] = fg; d[p * 4 + 2] = fb; d[p * 4 + 3] = 255;
      if (y > 0) { const q = p - W; const m = !seen[q] && match(q * 4); if (m && !up) { stack.push(xx, y - 1); up = true; } else if (!m) up = false; }
      if (y < H - 1) { const q = p + W; const m = !seen[q] && match(q * 4); if (m && !down) { stack.push(xx, y + 1); down = true; } else if (!m) down = false; }
    }
  }
  ctx.putImageData(img, 0, 0);
}
