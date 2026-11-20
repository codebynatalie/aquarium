// "Bring your drawing to life" dialog: background removal + creature settings.
import { cutOut, loadImage } from './fishmaker.js';
import { STYLES } from './fish.js';
import { uid } from './aquarium.js';

const STYLE_ICONS = { fish: '🐟', eel: '🐍', jelly: '🎐', floaty: '🏊', crawler: '🦀' };
const NAMES = ['Bubbles', 'Finn', 'Coral', 'Splash', 'Nemo-ish', 'Pebble', 'Squiggle', 'Sunny', 'Wiggles', 'Blue', 'Captain', 'Noodle', 'Sprinkle', 'Puddle', 'Ziggy'];

function toSourceDataUrl(src) {
  const s = Math.min(1, 800 / Math.max(src.width, src.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(src.width * s); cv.height = Math.round(src.height * s);
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  // keep transparency if the picture has it
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 64) if (d[i] < 250) { clear++; if (clear > 20) break; }
  return clear > 20 ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
}

export async function openFishMaker({ source = null, spec = null, onRedraw = null } = {}) {
  const editing = !!spec;
  const s = Object.assign({
    id: uid(), kind: 'drawing', name: NAMES[Math.floor(Math.random() * NAMES.length)], style: 'fish', size: 1.8, speed: 1, chubby: 0.6,
    bubbles: false, faceLeft: false, tolerance: 60, gapFix: 2,
  }, spec || {});
  let sourceUrl = s.source;
  let srcImg;
  if (source) { sourceUrl = toSourceDataUrl(source); srcImg = await loadImage(sourceUrl); }
  else if (s.source) srcImg = await loadImage(s.source);
  else srcImg = await loadImage(s.image);

  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `
      <div class="modal fishmaker">
        <div class="modal-head"><h2>${editing ? '✏️ Change your creature' : '✨ Bring it to life'}</h2></div>
        <div class="fm-body">
          <div class="fm-left">
            <div class="fm-preview checker"><div class="fm-swim"><img alt=""></div><div class="fm-empty hidden">Hmm, I couldn't find a drawing. Try moving the "background remover" slider.</div></div>
            <div class="fm-row">
              <label>Background remover <span class="muted small">(more = removes more)</span></label>
              <input type="range" min="10" max="160" step="2" data-k="tolerance">
            </div>
            <div class="fm-row">
              <label>Fix gaps in the outline</label>
              <input type="range" min="0" max="8" step="1" data-k="gapFix">
            </div>
            <div class="fm-row buttons">
              <button class="btn small" data-act="redraw">🖍️ Fix it in the drawing pad</button>
            </div>
          </div>
          <div class="fm-right">
            <div class="fm-row"><label>Name</label><input type="text" maxlength="24" data-k="name"></div>
            <div class="fm-row"><label>Which way is its face looking?</label>
              <div class="chips"><button class="chip" data-face="left">⬅️ Left</button><button class="chip" data-face="right">Right ➡️</button></div>
            </div>
            <div class="fm-row"><label>How does it move?</label>
              <div class="chips styles">${Object.entries(STYLES).map(([k, v]) => `<button class="chip" data-style="${k}" title="${v.hint}">${STYLE_ICONS[k]} ${v.label}</button>`).join('')}</div>
              <div class="muted small style-hint"></div>
            </div>
            <div class="fm-row"><label>Size</label><input type="range" min="0.6" max="5" step="0.1" data-k="size"></div>
            <div class="fm-row"><label>Speed</label><input type="range" min="0.3" max="2.2" step="0.1" data-k="speed"></div>
            <div class="fm-row"><label>Chubbiness</label><input type="range" min="0.2" max="1.3" step="0.05" data-k="chubby"></div>
            <div class="fm-row"><label class="check"><input type="checkbox" data-k="bubbles"> Blows bubbles (great for divers!)</label></div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="ok">${editing ? 'Save changes' : 'Release into the tank! 🐠'}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const $ = q => wrap.querySelector(q);
    const img = $('.fm-swim img');
    let cut = null;
    let faceGuessed = editing;

    const process = () => {
      cut = cutOut(srcImg, { tolerance: s.tolerance, gapFix: s.gapFix });
      $('.fm-empty').classList.toggle('hidden', !!cut);
      img.classList.toggle('hidden', !cut);
      if (!cut) return;
      img.src = cut.canvas.toDataURL('image/png');
      if (!faceGuessed) { s.faceLeft = cut.facing === 'left'; faceGuessed = true; refresh(); }
    };

    const refresh = () => {
      wrap.querySelectorAll('[data-face]').forEach(b => b.classList.toggle('on', (b.dataset.face === 'left') === !!s.faceLeft));
      wrap.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === s.style));
      $('.style-hint').textContent = STYLES[s.style].hint;
      $('.fm-swim').className = 'fm-swim swim-' + s.style + (s.faceLeft ? ' face-left' : '');
    };

    wrap.querySelectorAll('[data-k]').forEach(el => {
      const k = el.dataset.k;
      if (el.type === 'checkbox') el.checked = !!s[k]; else el.value = s[k];
      el.addEventListener('input', () => {
        s[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
        if (k === 'tolerance' || k === 'gapFix') { clearTimeout(el._t); el._t = setTimeout(process, 120); }
      });
    });
    wrap.querySelectorAll('[data-face]').forEach(b => b.onclick = () => { s.faceLeft = b.dataset.face === 'left'; refresh(); });
    wrap.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
      s.style = b.dataset.style;
      if (s.style === 'floaty' && !spec) s.bubbles = true, $('[data-k=bubbles]').checked = true;
      refresh();
    });
    $('[data-act=redraw]').onclick = async () => {
      if (!onRedraw) return;
      wrap.style.display = 'none';
      const cv = await onRedraw(srcImg);
      wrap.style.display = '';
      if (cv) { sourceUrl = toSourceDataUrl(cv); srcImg = await loadImage(sourceUrl); s.tolerance = 60; $('[data-k=tolerance]').value = 60; process(); }
    };
    const close = r => { wrap.remove(); resolve(r); };
    $('[data-act=cancel]').onclick = () => close(null);
    $('[data-act=ok]').onclick = () => {
      if (!cut) return;
      const out = { ...s, image: cut.canvas.toDataURL('image/png'), source: sourceUrl };
      if (!out.name.trim()) out.name = 'My creature';
      close(out);
    };

    refresh();
    process();
  });
}
