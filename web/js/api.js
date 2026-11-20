// Talks to the Doodle Aquarium Windows host. Falls back to browser storage
// when the page is opened some other way (handy for testing).
const H = { 'X-Aquarium': '1' };
const LS_KEY = 'doodle-aquarium-state';
let hostOk = null;

// Big aquariums (lots of drawings) are large; if a transfer gets cut off
// (some antivirus web shields do that), just try again.
async function call(path, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
      if (!r.ok) throw Object.assign(new Error(path + ' ' + r.status), { fatal: true });
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (e.fatal || hostOk === false) break;
      await new Promise(res => setTimeout(res, 150 + attempt * 200));
    }
  }
  throw lastErr;
}

export async function status() {
  try {
    const s = await call('/api/status');
    hostOk = true;
    return s;
  } catch {
    hostOk = false;
    return { host: false, wallpaper: false, autostart: false };
  }
}

// Returns null only when there really is no saved aquarium yet. If the app is
// running but the save can't be read, this throws, so we never replace someone's
// aquarium with a blank one by mistake.
export async function loadState() {
  if (hostOk) return await call('/api/state');
  try { return await call('/api/state'); }
  catch {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
  }
}

// Throws if saving to the app fails, so the editor can warn about it.
export async function saveState(state) {
  const body = JSON.stringify(state);
  if (hostOk) { await call('/api/state', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }); return; }
  localStorage.setItem(LS_KEY, body);
}

// ---------- saved aquariums ("profiles") ----------
const LS_PROF = 'doodle-aquarium-profile-';
const LS_META = 'doodle-aquarium-meta-';

export async function listProfiles() {
  if (hostOk) { try { return await call('/api/profiles'); } catch { return []; } }
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(LS_META)) { try { out.push(JSON.parse(localStorage.getItem(k))); } catch { } }
  }
  return out;
}

export async function getProfile(id) {
  if (hostOk) { try { return await call('/api/profiles/get?id=' + id); } catch { return null; } }
  try { return JSON.parse(localStorage.getItem(LS_PROF + id) || 'null'); } catch { return null; }
}

export async function putProfile(id, state, meta) {
  const post = (part, obj) => call(`/api/profiles/put?id=${id}&part=${part}`, { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } });
  if (hostOk) {
    if (state) await post('state', state);
    if (meta) await post('meta', meta);
    return;
  }
  try {
    if (state) localStorage.setItem(LS_PROF + id, JSON.stringify(state));
    if (meta) localStorage.setItem(LS_META + id, JSON.stringify(meta));
  } catch (e) { console.warn('profile save failed', e); }
}

export async function deleteProfile(id) {
  if (hostOk) { await call('/api/profiles/delete?id=' + id, { method: 'POST' }); return; }
  localStorage.removeItem(LS_PROF + id);
  localStorage.removeItem(LS_META + id);
}

export const wallpaperStart =() => call('/api/wallpaper/start', { method: 'POST' });
export const wallpaperStop = () => call('/api/wallpaper/stop', { method: 'POST' });
export const setAutostart = on => call('/api/autostart?on=' + (on ? 1 : 0), { method: 'POST' });
export const reportChrome = (top, left, right, bottom) =>
  call(`/api/wallpaper/chrome?top=${top}&left=${left}&right=${right}&bottom=${bottom}`, { method: 'POST' }).catch(() => {});

export function events(onEvent) {
  let es;
  const open = () => {
    es = new EventSource('/api/events');
    es.onmessage = e => { try { onEvent(JSON.parse(e.data)); } catch { } };
    es.onerror = () => { es.close(); setTimeout(open, 2000); };
  };
  open();
}
