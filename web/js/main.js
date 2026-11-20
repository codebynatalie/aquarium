import { Aquarium, stateFromTemplate } from './aquarium.js';
import * as api from './api.js';

const params = new URLSearchParams(location.search);
const wallpaper = params.get('mode') === 'wallpaper';

async function boot() {
  document.body.classList.toggle('wallpaper', wallpaper);
  document.title = wallpaper ? 'DoodleAquariumWallpaper' : 'Doodle Aquarium - Editor';

  let aq;
  try {
    aq = new Aquarium(document.getElementById('view'), { wallpaper });
  } catch (e) {
    document.getElementById('fatal').textContent = 'Sorry! This computer could not start the 3D aquarium (' + e.message + ').';
    document.getElementById('fatal').classList.remove('hidden');
    throw e;
  }
  window.aquarium = aq;

  const status = await api.status();
  let state;
  try {
    state = await api.loadState();
  } catch (e) {
    // Never start a blank aquarium on top of one we just couldn't read.
    const box = document.getElementById('fatal');
    box.innerHTML = '<b>Oops! Your saved aquarium couldn’t be opened.</b><br>Nothing has been changed. Please close this window, right-click the little fish near the clock, choose <b>Exit</b>, then open Doodle Aquarium again.';
    box.classList.remove('hidden');
    document.getElementById('loading').classList.add('gone');
    if (wallpaper) setTimeout(() => location.reload(), 10000);
    return;
  }
  if (!state || !state.env) {
    state = stateFromTemplate('reef');
    if (!wallpaper) api.saveState(state);
  }
  aq.setState(state);

  if (wallpaper) {
    // Hide the app window's own title bar by asking the host to shift it off-screen.
    const reportChrome = () => {
      const dpr = window.devicePixelRatio || 1;
      const top = Math.round((window.outerHeight - window.innerHeight) * dpr);
      const side = Math.round((window.outerWidth - window.innerWidth) / 2 * dpr);
      api.reportChrome(top, side, side, 0);
    };
    setTimeout(reportChrome, 300);
    setTimeout(reportChrome, 2500);
    const toPx = (x, y) => [x * window.innerWidth, y * window.innerHeight];
    api.events(async ev => {
      if (ev.t === 'click') { const [x, y] = toPx(ev.x, ev.y); aq.setCursor(x, y); aq.pokeOrFeed(x, y); }
      else if (ev.t === 'move') { const [x, y] = toPx(ev.x, ev.y); aq.setCursor(x, y); }
      else if (ev.t === 'leave') aq.clearCursor();
      else if (ev.t === 'feed') aq.world.sprinkleFood();
      else if (ev.t === 'pause') aq.paused = true;
      else if (ev.t === 'resume') aq.paused = false;
      else if (ev.t === 'state') {
        const s = await api.loadState();
        if (s && s.env) aq.setState(s);
      }
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    return;
  }

  const { startEditor } = await import('./ui.js');
  startEditor(aq, status);
  document.getElementById('loading').classList.add('gone');
}

boot();
