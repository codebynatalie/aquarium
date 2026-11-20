// Editor user interface.
import { stateFromTemplate, uid } from './aquarium.js';
import { TEMPLATES, LIGHTS, WATER_SWATCHES, FLOORS } from './templates.js';
import { DECOR, DECOR_CATS } from './decor.js';
import { CREATURES } from './creatures.js';
import { STYLES } from './fish.js';
import { openDrawPad } from './drawpad.js';
import { openFishMaker } from './fishmodal.js';
import * as api from './api.js';

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function startEditor(aq, initialStatus) {
  let status = initialStatus;
  let mode = 'play';
  let placing = null;
  let drag = null;
  let saveTimer = null;
  let decorCat = 'plants';
  let lastMeta = 0;

  if (!aq.state.profile) aq.state.profile = { id: uid(), name: 'My aquarium' };

  // Saves the aquarium that is showing (also used by the wallpaper) and its
  // copy in "My aquariums". The name card + picture are refreshed now and then.
  // "Saved ✓" / "Saving…" / "Not saved!" shown under the app name.
  let dirty = false, saving = 0, failed = false;
  const showSave = () => {
    const el = $('#save-status');
    if (!el) return;
    el.className = failed ? 'bad' : (dirty || saving) ? 'busy' : 'ok';
    el.textContent = failed ? '⚠️ Not saved! Try again' : (dirty || saving) ? 'Saving…' : '✓ All saved';
  };

  const persist = async (withMeta = false) => {
    clearTimeout(saveTimer);
    saveTimer = null;
    const s = aq.state;
    dirty = false;
    saving++;
    showSave();
    try {
      await api.saveState(s);
      let meta = null;
      if (withMeta || Date.now() - lastMeta > 15000) {
        lastMeta = Date.now();
        const thumb = await aq.snapshot();
        meta = { id: s.profile.id, name: s.profile.name, updated: Date.now(), template: s.template, creatures: s.creatures.reduce((a, c) => a + (c.count || 1), 0), thumb: thumb || s.profile.thumb || '' };
        if (thumb) s.profile.thumb = thumb;
      }
      await api.putProfile(s.profile.id, s, meta);
      failed = false;
    } catch (e) {
      console.warn('save failed', e);
      failed = true;
      dirty = true;
      toast('⚠️ Your aquarium could not be saved just now. I’ll keep trying!', 6000);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => persist(), 5000);
    } finally {
      saving--;
      showSave();
    }
  };
  const save = (delay = 400) => {
    dirty = true;
    showSave();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(), delay);
  };
  $('#save-status')?.addEventListener('click', () => persist(true));
  // Closing the window with a change still on its way: save it, and ask the
  // window to wait a moment so it can finish.
  window.addEventListener('beforeunload', e => {
    if (dirty || saving) {
      if (dirty) persist();
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ---------------- toast ----------------
  let toastTimer;
  const toast = (msg, ms = 3200) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  const ask = (title, text, ok = 'OK') => new Promise(res => {
    const w = h(`<div class="modal-back"><div class="modal small"><div class="modal-head"><h2>${title}</h2></div><p>${text}</p>
      <div class="modal-foot"><button class="btn" data-a="no">Cancel</button><button class="btn primary" data-a="yes">${ok}</button></div></div></div>`);
    document.body.appendChild(w);
    w.querySelector('[data-a=no]').onclick = () => { w.remove(); res(false); };
    w.querySelector('[data-a=yes]').onclick = () => { w.remove(); res(true); };
  });

  // ---------------- tabs ----------------
  $$('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  function showTab(id) {
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    $$('.tab-body').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + id));
    $('#panel').classList.remove('collapsed');
    if (id === 'saved') persist(true).then(renderProfiles);
  }
  $('#collapse').onclick = () => $('#panel').classList.toggle('collapsed');

  // ---------------- tanks ----------------
  function renderTanks() {
    const box = $('#tank-list');
    box.innerHTML = '';
    for (const [key, t] of Object.entries(TEMPLATES)) {
      const card = h(`<button class="tank-card ${aq.state.template === key ? 'on' : ''}">
        <div class="tank-swatch" style="background:linear-gradient(180deg, ${t.swatch[0]} 0%, ${t.swatch[0]} 55%, ${t.swatch[1]} 56%, ${t.swatch[1]} 100%)"><i style="background:${t.swatch[2]}"></i><i style="background:${t.swatch[2]}"></i></div>
        <div><b>${esc(t.name)}</b><span>${esc(t.blurb)}</span></div></button>`);
      card.onclick = async () => {
        if (!(await ask(`Switch to “${t.name}”?`, 'The decorations and built-in animals will be replaced. Your own drawn creatures will move in too!<br><br>Want to keep this aquarium as well? Go to <b>Saved</b> and press <b>Save a copy</b> first.', 'Switch tank'))) return;
        const drawings = aq.state.creatures.filter(c => c.kind === 'drawing');
        const ns = stateFromTemplate(key, drawings);
        Object.assign(aq.state, ns);
        aq.selectedId = null;
        aq.setState(aq.state);
        renderAll();
        save(0);
        toast(`Welcome to the ${t.name}! 🐠`);
      };
      box.appendChild(card);
    }
  }

  // ---------------- pictures for the library ----------------
  const thumbs = new Map();
  const decorThumb = type => {
    if (!thumbs.has(type)) thumbs.set(type, aq.thumbnail(type));
    return thumbs.get(type);
  };
  const creatureThumb = species => {
    const key = 'c:' + species;
    if (!thumbs.has(key)) {
      const src = CREATURES[species].draw();
      const cv = document.createElement('canvas');
      const s = Math.min(150 / src.width, 110 / src.height);
      cv.width = Math.round(src.width * s); cv.height = Math.round(src.height * s);
      cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
      thumbs.set(key, cv.toDataURL());
    }
    return thumbs.get(key);
  };

  // ---------------- decorate ----------------
  function renderDecor() {
    const chips = $('#decor-cats');
    chips.innerHTML = '';
    for (const c of [...DECOR_CATS, { id: 'animals', name: 'Animals' }]) {
      const b = h(`<button class="chip ${decorCat === c.id ? 'on' : ''}">${c.name}</button>`);
      b.onclick = () => { decorCat = c.id; renderDecor(); };
      chips.appendChild(b);
    }
    const grid = $('#decor-grid');
    grid.innerHTML = '';
    if (decorCat === 'animals') {
      for (const [key, c] of Object.entries(CREATURES)) {
        const b = h(`<button class="tile"><img class="thumb" src="${creatureThumb(key)}" alt=""><span>${esc(c.name)}</span></button>`);
        b.onclick = () => addAnimal(key);
        grid.appendChild(b);
      }
      $('#decor-hint').textContent = 'Click an animal to drop it into your tank.';
      return;
    }
    for (const [key, d] of Object.entries(DECOR)) {
      if (d.cat !== decorCat) continue;
      const b = h(`<button class="tile ${placing && placing.type === key ? 'on' : ''}"><img class="thumb" src="${decorThumb(key)}" alt=""><span>${esc(d.name)}</span></button>`);
      b.onclick = () => startPlacing(key);
      grid.appendChild(b);
    }
    $('#decor-hint').textContent = 'Pick something, then click on the sand to put it there.';
  }

  function addAnimal(species) {
    if (countCreatures() >= 40) { toast('Your tank is very full! Remove some creatures first.'); return; }
    const c = CREATURES[species];
    aq.state.creatures.push({ id: uid(), kind: 'builtin', species, name: c.name, style: c.style, size: c.size, speed: c.speed, chubby: c.chubby, bubbles: !!c.bubbles, count: c.count || 1 });
    aq.syncCreatures({ splashNew: true });
    renderCreatures();
    save();
    toast(`${c.name} jumped in! 💦`);
  }

  function countCreatures() { return aq.state.creatures.reduce((a, c) => a + (c.count || 1), 0); }

  function startPlacing(type) {
    setMode('arrange');
    placing = { type, seed: Math.floor(Math.random() * 1e6), scale: 1.3, rot: Math.random() * Math.PI * 2, hue: 0 };
    aq.selectedId = null;
    showInspector();
    renderDecor();
    toast(`Click on the sand to place: ${DECOR[type].name}. Hold Shift to place lots. Esc to stop.`, 4500);
  }

  function stopPlacing() {
    placing = null;
    aq.ghost = null;
    renderDecor();
  }

  // ---------------- inspector ----------------
  function showInspector() {
    const box = $('#inspector');
    const item = aq.selectedId && aq.decor.get(aq.selectedId);
    if (!item) { box.classList.add('hidden'); return; }
    const d = item.spec, def = DECOR[d.type];
    box.classList.remove('hidden');
    box.innerHTML = `<div class="insp-head"><img class="thumb" src="${decorThumb(d.type)}" alt=""><b>${esc(def.name)}</b><button class="x" title="Close">✕</button></div>
      <label>Size<input type="range" min="0.3" max="3" step="0.05" data-k="scale" value="${d.scale}"></label>
      <label>Turn<input type="range" min="0" max="6.283" step="0.05" data-k="rot" value="${((d.rot || 0) % 6.283 + 6.283) % 6.283}"></label>
      <label>Colour<input type="range" min="-3.14" max="3.14" step="0.05" data-k="hue" value="${d.hue || 0}" class="hue"></label>
      <div class="row"><button class="btn small" data-a="shuffle" title="Make a new random version">🎲 New shape</button><button class="btn small" data-a="copy">📄 Copy</button><button class="btn small danger" data-a="del">🗑️ Remove</button></div>
      <div class="muted small">Drag it to move. Mouse wheel turns it.</div>`;
    box.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => {
      d[inp.dataset.k] = +inp.value;
      aq.placeDecor(item);
      save();
    });
    box.querySelector('.x').onclick = () => { aq.selectedId = null; showInspector(); };
    box.querySelector('[data-a=shuffle]').onclick = () => { d.seed = Math.floor(Math.random() * 1e6); aq.syncDecor(); save(); };
    box.querySelector('[data-a=copy]').onclick = () => {
      const c = { ...d, id: uid(), nx: Math.min(1, d.nx + 0.12), z: d.z + 0.5 };
      aq.state.decor.push(c); aq.syncDecor(); aq.selectedId = c.id; showInspector(); save();
    };
    box.querySelector('[data-a=del]').onclick = () => deleteSelected();
  }

  function deleteSelected() {
    if (!aq.selectedId) return;
    aq.state.decor = aq.state.decor.filter(d => d.id !== aq.selectedId);
    aq.selectedId = null;
    aq.syncDecor();
    showInspector();
    save();
  }

  // ---------------- creatures ----------------
  function renderCreatures() {
    const list = $('#creature-list');
    list.innerHTML = '';
    const items = aq.state.creatures;
    if (!items.length) list.appendChild(h(`<div class="muted empty">No creatures yet. Draw one!</div>`));
    for (const c of [...items].reverse()) {
      const thumb = c.kind === 'drawing' ? `<img src="${c.image}" alt="">` : `<img src="${CREATURES[c.species] ? creatureThumb(c.species) : ''}" alt="">`;
      const row = h(`<div class="creature-row">
        <div class="thumb checker">${thumb}</div>
        <div class="info"><b>${esc(c.name)}${c.count > 1 ? ' ×' + c.count : ''}</b><span>${STYLES[c.style]?.label || ''}${c.kind === 'drawing' ? ' · your drawing' : ''}</span></div>
        <div class="acts">${c.kind === 'drawing' ? '<button class="btn icon" data-a="edit" title="Change">✏️</button>' : ''}<button class="btn icon" data-a="del" title="Take out of the tank">🗑️</button></div></div>`);
      row.querySelector('[data-a=del]').onclick = async () => {
        if (c.kind === 'drawing' && !(await ask(`Say goodbye to ${esc(c.name)}?`, 'This removes your drawn creature from the tank.', 'Remove'))) return;
        aq.state.creatures = aq.state.creatures.filter(x => x !== c);
        aq.syncCreatures();
        renderCreatures();
        save();
      };
      const e = row.querySelector('[data-a=edit]');
      if (e) e.onclick = async () => {
        const updated = await openFishMaker({ spec: c, onRedraw: img => openDrawPad({ startImage: img }) });
        if (!updated) return;
        Object.assign(c, updated);
        aq.syncCreatures();
        renderCreatures();
        save();
      };
      list.appendChild(row);
    }
  }

  async function newCreatureFrom(source) {
    if (countCreatures() >= 40) { toast('Your tank is very full! Remove some creatures first.'); return; }
    const spec = await openFishMaker({ source, onRedraw: img => openDrawPad({ startImage: img }) });
    if (!spec) return;
    aq.state.creatures.push(spec);
    await aq.syncCreatures({ splashNew: true });
    renderCreatures();
    save(0);
    toast(`${spec.name} is alive! Say hi! 👋`);
  }

  $('#btn-draw').onclick = async () => {
    const cv = await openDrawPad();
    if (cv) newCreatureFrom(cv);
  };
  $('#file-pic').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      await newCreatureFrom(img);
    } catch { toast('Sorry, that picture could not be opened.'); }
    finally { URL.revokeObjectURL(url); }
  };

  // drag & drop a picture anywhere
  window.addEventListener('dragover', e => { e.preventDefault(); });
  window.addEventListener('drop', async e => {
    e.preventDefault();
    const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/'));
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = async () => { await newCreatureFrom(img); URL.revokeObjectURL(url); };
    img.src = url;
  });

  // ---------------- lights ----------------
  function renderLights() {
    const env = aq.state.env;
    const pre = $('#light-presets');
    pre.innerHTML = '';
    for (const [k, p] of Object.entries(LIGHTS)) {
      const b = h(`<button class="tile"><span class="ico">${p.icon}</span><span>${p.name}</span></button>`);
      b.onclick = () => { Object.assign(env, p.set); aq.setEnv(env); syncLightInputs(); save(); };
      pre.appendChild(b);
    }
    const sw = $('#water-swatches');
    sw.innerHTML = '';
    for (const [top, deep] of WATER_SWATCHES) {
      const b = h(`<button class="swatch big" style="background:linear-gradient(${top}, ${deep})" title="${top}"></button>`);
      b.onclick = () => { env.waterColor = top; env.deepColor = deep; aq.setEnv(env); syncLightInputs(); save(); };
      sw.appendChild(b);
    }
    const fl = $('#floor-types');
    fl.innerHTML = '';
    for (const f of FLOORS) {
      const b = h(`<button class="chip"><i class="dot" style="background:linear-gradient(135deg, ${f.a}, ${f.b})"></i>${f.name}</button>`);
      b.onclick = () => { env.floorType = f.type; env.floorColorA = f.a; env.floorColorB = f.b; aq.setEnv(env); syncLightInputs(); save(); };
      fl.appendChild(b);
    }
    $$('#tab-lights [data-env]').forEach(inp => {
      inp.oninput = () => {
        const k = inp.dataset.env;
        env[k] = inp.type === 'range' ? +inp.value : inp.type === 'checkbox' ? inp.checked : inp.value;
        if (k === 'lightColor' || k === 'lightIntensity') env.disco = false;
        aq.setEnv(env);
        save();
      };
    });
    syncLightInputs();
  }

  function syncLightInputs() {
    const env = aq.state.env;
    $$('#tab-lights [data-env]').forEach(inp => {
      const v = env[inp.dataset.env];
      if (inp.type === 'checkbox') inp.checked = !!v; else if (v !== undefined) inp.value = v;
    });
  }

  // ---------------- wallpaper ----------------
  async function renderWallpaper() {
    const box = $('#wallpaper');
    if (!status.host) {
      box.innerHTML = `<div class="wp-off">To use this as your wallpaper, open it with the <b>Doodle Aquarium</b> app.</div>`;
      return;
    }
    if (status.wallpaper) {
      box.innerHTML = `<div class="wp-live"><span class="dot-live"></span><div><b>Live on your desktop!</b><span>Click the fish on your desktop to poke them, or empty water to feed them.</span></div></div>
        <div class="wp-row"><button class="btn small" data-a="stop">Stop wallpaper</button><label class="check small"><input type="checkbox" ${status.autostart ? 'checked' : ''} data-a="auto"> Start with Windows</label></div>`;
      box.querySelector('[data-a=stop]').onclick = async () => { await api.wallpaperStop(); status.wallpaper = false; renderWallpaper(); toast('Wallpaper stopped. Your normal background is back.'); };
    } else {
      box.innerHTML = `<button class="btn publish" data-a="go">🖥️ Make it my wallpaper</button>
        <label class="check small"><input type="checkbox" ${status.autostart ? 'checked' : ''} data-a="auto"> Start with Windows</label>`;
      box.querySelector('[data-a=go]').onclick = async () => {
        await persist(true);
        await api.wallpaperStart();
        status.wallpaper = true;
        renderWallpaper();
        toast('✨ Your aquarium is now your wallpaper! Minimise this window to see it.', 6000);
      };
    }
    const auto = box.querySelector('[data-a=auto]');
    if (auto) auto.onchange = async () => { await api.setAutostart(auto.checked); status.autostart = auto.checked; };
  }

  // ---------------- toolbar / modes ----------------
  function setMode(m) {
    mode = m;
    $$('#toolbar [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    document.body.dataset.mode = m;
    if (m === 'play') { stopPlacing(); aq.selectedId = null; showInspector(); }
  }
  $$('#toolbar [data-mode]').forEach(b => b.onclick = () => {
    setMode(b.dataset.mode);
    toast(b.dataset.mode === 'play' ? 'Click a creature to poke it. Click the water to drop food.' : 'Click a decoration to move, turn, resize or remove it.');
  });
  $('#btn-feed').onclick = () => { aq.world.sprinkleFood(); toast('Dinner time! 🍤'); };
  $('#btn-watch').onclick = () => { document.body.classList.add('watch'); toast('Press Esc or click the eye to show the controls again.'); };
  $('#unwatch').onclick = () => document.body.classList.remove('watch');

  // ---------------- canvas interaction ----------------
  const cv = aq.canvas;
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const tag = $('#name-tag');

  cv.addEventListener('pointermove', e => {
    const [x, y] = local(e);
    aq.setCursor(x, y);
    if (placing) {
      const p = aq.floorPoint(x, y);
      aq.ghost = p ? { ...placing, x: p[0], z: p[2] } : null;
      cv.style.cursor = p ? 'copy' : 'not-allowed';
      return;
    }
    if (drag) {
      const p = aq.floorPoint(x, y);
      if (p) {
        const d = drag.item.spec;
        d.z = p[2] + drag.dz;
        d.nx = aq.nxFor(p[0] + drag.dx, d.z);
        aq.placeDecor(drag.item);
        drag.moved = true;
      }
      return;
    }
    if (mode === 'play') {
      const c = aq.pickCreature(x, y);
      aq.hoverCreature = c;
      if (c) {
        tag.textContent = c.spec.name;
        tag.style.transform = `translate(${x + 14}px, ${y - 30}px)`;
        tag.classList.add('show');
      } else tag.classList.remove('show');
      cv.style.cursor = c ? 'pointer' : 'crosshair';
    } else {
      const it = aq.pickDecor(x, y);
      cv.style.cursor = it ? 'grab' : 'default';
      tag.classList.remove('show');
    }
  });
  cv.addEventListener('pointerleave', () => { aq.clearCursor(); aq.hoverCreature = null; tag.classList.remove('show'); aq.ghost = null; });

  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const [x, y] = local(e);
    if (placing) {
      const p = aq.floorPoint(x, y);
      if (!p) return;
      const d = { id: uid(), type: placing.type, seed: placing.seed, nx: aq.nxFor(p[0], p[2]), z: p[2], scale: placing.scale, rot: placing.rot, hue: placing.hue };
      aq.state.decor.push(d);
      aq.syncDecor();
      save();
      if (e.shiftKey) { placing.seed = Math.floor(Math.random() * 1e6); placing.rot = Math.random() * Math.PI * 2; }
      else { stopPlacing(); aq.selectedId = d.id; showInspector(); }
      return;
    }
    if (mode === 'play') {
      const r = aq.pokeOrFeed(x, y);
      if (r === 'poke') tag.classList.remove('show');
      return;
    }
    const it = aq.pickDecor(x, y);
    aq.selectedId = it ? it.id : null;
    showInspector();
    if (it) {
      const p = aq.floorPoint(x, y) || it.pos;
      drag = { item: it, dx: it.pos[0] - p[0], dz: it.pos[2] - p[2], moved: false };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
    }
  });
  cv.addEventListener('pointerup', () => { if (drag) { if (drag.moved) save(); drag = null; } });
  cv.addEventListener('wheel', e => {
    if (placing) { placing.rot += e.deltaY * 0.004; if (aq.ghost) aq.ghost.rot = placing.rot; e.preventDefault(); return; }
    const item = aq.selectedId && aq.decor.get(aq.selectedId);
    if (!item) return;
    e.preventDefault();
    if (e.shiftKey) item.spec.scale = Math.max(0.3, Math.min(3, item.spec.scale * (1 - e.deltaY * 0.001)));
    else item.spec.rot = (item.spec.rot || 0) + e.deltaY * 0.004;
    aq.placeDecor(item);
    showInspector();
    save();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target.matches('input[type=text]')) return;
    if (e.key === 'Escape') {
      if (document.body.classList.contains('watch')) { document.body.classList.remove('watch'); return; }
      if (placing) { stopPlacing(); return; }
      aq.selectedId = null; showInspector();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && aq.selectedId && !document.querySelector('.modal-back')) deleteSelected();
  });

  // ---------------- saved aquariums ----------------
  const ago = t => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const hrs = Math.round(m / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    const d = Math.round(hrs / 24);
    return d === 1 ? 'yesterday' : d + ' days ago';
  };

  function showName() {
    $('#prof-name').value = aq.state.profile.name;
    $('.brand span').textContent = '🐠 ' + aq.state.profile.name;
  }

  async function renderProfiles() {
    showName();
    const list = $('#prof-list');
    const items = (await api.listProfiles()).filter(p => p && p.id).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    list.innerHTML = '';
    for (const p of items) {
      const current = p.id === aq.state.profile.id;
      const card = h(`<div class="prof-card ${current ? 'on' : ''}">
        <div class="prof-thumb">${p.thumb ? `<img src="${p.thumb}" alt="">` : '🐟'}</div>
        <div class="info"><b>${esc(current ? aq.state.profile.name : p.name)}</b><span>${current ? 'Showing now' : 'Changed ' + ago(p.updated || 0)} · ${p.creatures || 0} creatures</span></div>
        <div class="acts">${current ? '<span class="badge">✓ Here</span>' : '<button class="btn small primary" data-a="open">Open</button><button class="btn icon" data-a="del" title="Delete">🗑️</button>'}</div></div>`);
      const o = card.querySelector('[data-a=open]');
      if (o) o.onclick = () => openProfile(p.id);
      const d = card.querySelector('[data-a=del]');
      if (d) d.onclick = async () => {
        if (!(await ask(`Delete “${esc(p.name)}”?`, 'This aquarium and everything in it will be gone for good.', 'Delete it'))) return;
        await api.deleteProfile(p.id);
        renderProfiles();
      };
      list.appendChild(card);
    }
  }

  async function switchTo(state, msg) {
    aq.selectedId = null;
    stopPlacing();
    aq.setState(state);
    renderAll();
    await persist(true);
    renderProfiles();
    toast(msg, 3500);
  }

  async function openProfile(id) {
    await persist(true);                       // keep the one we are leaving
    const s = await api.getProfile(id);
    if (!s || !s.env) { toast('Sorry, that aquarium could not be opened.'); return; }
    if (!s.profile) s.profile = { id, name: 'My aquarium' };
    await switchTo(s, `Now showing “${s.profile.name}” 🐠`);
  }

  $('#prof-name').addEventListener('input', e => {
    aq.state.profile.name = e.target.value.slice(0, 30) || 'My aquarium';
    $('.brand span').textContent = '🐠 ' + aq.state.profile.name;
    clearTimeout(e.target._t);
    e.target._t = setTimeout(async () => { await persist(true); renderProfiles(); }, 700);
  });

  $('#prof-copy').onclick = async () => {
    await persist(true);
    const copy = JSON.parse(JSON.stringify(aq.state));
    copy.profile = { id: uid(), name: (aq.state.profile.name + ' copy').slice(0, 30), thumb: aq.state.profile.thumb };
    await api.putProfile(copy.profile.id, copy, { id: copy.profile.id, name: copy.profile.name, updated: Date.now() - 1000, template: copy.template, creatures: countCreatures(), thumb: copy.profile.thumb || '' });
    renderProfiles();
    toast(`Saved a copy called “${copy.profile.name}”. You can keep changing this one!`, 4500);
  };

  $('#prof-new').onclick = () => {
    const w = h(`<div class="modal-back"><div class="modal small">
      <div class="modal-head"><h2>➕ New aquarium</h2></div>
      <div class="new-prof">
        <label>Name<input type="text" maxlength="30" value="My new aquarium"></label>
        <label>Start with</label>
        <div class="chips">${Object.entries(TEMPLATES).map(([k, t], i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-t="${k}"><i class="dot" style="background:linear-gradient(${t.swatch[0]}, ${t.swatch[1]})"></i>${esc(t.name)}</button>`).join('')}</div>
        <p class="muted small">Your current aquarium stays saved in “My aquariums”.</p>
      </div>
      <div class="modal-foot"><button class="btn" data-a="no">Cancel</button><button class="btn primary" data-a="yes">Make it!</button></div></div></div>`);
    document.body.appendChild(w);
    let tpl = Object.keys(TEMPLATES)[0];
    const name = w.querySelector('input');
    name.select();
    w.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = b.dataset.t; w.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); });
    w.querySelector('[data-a=no]').onclick = () => w.remove();
    w.querySelector('[data-a=yes]').onclick = async () => {
      w.remove();
      await persist(true);
      const ns = stateFromTemplate(tpl);
      ns.profile = { id: uid(), name: name.value.trim().slice(0, 30) || 'My new aquarium' };
      await switchTo(ns, `Made “${ns.profile.name}”! Start decorating ✨`);
    };
  };

  // ---------------- boot ----------------
  function renderAll() { renderTanks(); renderDecor(); renderCreatures(); renderLights(); showInspector(); showName(); }
  renderAll();
  setTimeout(async () => { await persist(true); renderProfiles(); }, 1200);
  renderWallpaper();
  setMode('play');
  showTab('tanks');

  // keep wallpaper status fresh (e.g. turned off from the tray)
  setInterval(async () => {
    const s = await api.status();
    if (s.host && (s.wallpaper !== status.wallpaper || s.autostart !== status.autostart)) { status = s; renderWallpaper(); }
  }, 5000);
}
