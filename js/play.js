import { KEY } from './keys.js';
import { keysFromGamepad, diffKeys, isMeaningfulPad, GAMEPAD_LAYOUT } from './gamepad.js';
import { mountTouch } from './touch.js';
import { unlockAudio } from './audio.js';
import { ungzip, untar } from './untar.js';

const GAMES = {
  freedoom1: {
    title: 'Freedoom Phase 1',
    wad: 'wads/freedoom1.wad',
    wadName: 'freedoom1.wad',
    maxWeapon: 8,
    warpArgs: (map) => ['-warp', String(map), '1'],
  },
  freedoom2: {
    title: 'Freedoom Phase 2',
    wad: 'wads/freedoom2.wad',
    wadName: 'freedoom2.wad',
    maxWeapon: 8,
    warpArgs: (map) => ['-warp', String(map)],
  },
  shareware: {
    title: 'Doom Shareware',
    wad: 'wads/doom1.wad',
    wadName: 'doom1.wad',
    maxWeapon: 8,
    warpArgs: (map) => ['-warp', String(map), '1'],
  },
};

const params = new URLSearchParams(location.search);
const gameId = params.get('game') || 'freedoom1';
const game = GAMES[gameId] || GAMES.freedoom1;
const testMode = params.get('test') === '1';
const skill = params.get('skill');
const warp = params.get('warp');

const els = {
  canvas: document.getElementById('canvas'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayText: document.getElementById('overlay-text'),
  startBtn: document.getElementById('start-btn'),
  progress: document.getElementById('progress-bar'),
  touch: document.getElementById('touch'),
  padBadge: document.getElementById('pad-badge'),
  backBtn: document.getElementById('back-btn'),
  fullBtn: document.getElementById('full-btn'),
  status: document.getElementById('status'),
};

let module = null;
let injectKey = null;
let persistTimer = 0;
let musicReady = false;

function setProgress(pct, text) {
  if (els.progress) els.progress.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (text && els.overlayText) els.overlayText.textContent = text;
}

function mkdirp(FS, path) {
  const parts = path.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    try {
      FS.mkdir(cur);
    } catch {
      // exists
    }
  }
}

function writeFile(FS, path, data) {
  mkdirp(FS, path.split('/').slice(0, -1).join('/') || '/');
  FS.writeFile(path, data);
}

function syncfs(FS, populate) {
  return new Promise((resolve, reject) => {
    FS.syncfs(populate, (err) => (err ? reject(err) : resolve()));
  });
}

async function fetchBytes(url, onProgress, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label || url}: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !onProgress) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(received / total);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function mountPersistent(mod) {
  const FS = mod.FS;
  const IDBFS = mod.IDBFS || (FS.filesystems && FS.filesystems.IDBFS);
  if (!IDBFS) throw new Error('IDBFS fehlt in der Engine — Spielstände könnten nicht halten.');
  mkdirp(FS, '/persistent');
  FS.mount(IDBFS, {}, '/persistent');
  await syncfs(FS, true);
}

async function loadMusic(FS) {
  try {
    const gz = await fetchBytes('music/freepats.tar.gz', (t) => {
      setProgress(45 + t * 25, 'Lade Musik-Instrumente …');
    }, 'Musik');
    const tar = await ungzip(gz);
    const files = untar(tar);
    for (const file of files) {
      // tar root is "freepats/..."
      const name = file.name.replace(/^\/+/, '');
      if (!name || name.endsWith('/')) continue;
      const dest = name.startsWith('freepats/') ? `/music/${name}` : `/music/freepats/${name}`;
      writeFile(FS, dest, file.data);
    }
    const cfg = await (await fetch('music/freepats.cfg')).text();
    const wrap = await (await fetch('music/timidity.cfg')).text();
    writeFile(FS, '/music/freepats.cfg', cfg);
    writeFile(FS, '/music/timidity.cfg', wrap);
    writeFile(FS, '/etc/timidity.cfg', wrap);
    musicReady = true;
  } catch (err) {
    console.warn('Musik-Patches nicht geladen, Soundeffekte gehen trotzdem:', err);
    musicReady = false;
  }
}

async function loadWad(FS) {
  const data = await fetchBytes(game.wad, (t) => {
    setProgress(15 + t * 30, `Lade ${game.title} …`);
  }, game.wadName);
  writeFile(FS, `/wads/${game.wadName}`, data);
}

function hookPersistence(FS) {
  const flush = () => syncfs(FS, false).catch((err) => console.warn('Save sync failed', err));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') keepAwake();
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  persistTimer = window.setInterval(flush, 8000);
  return flush;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function requestFullscreen() {
  // On iOS, the JS Fullscreen API is unreliable and can stop Gamepad
  // shoulder/trigger buttons (WebKit bug 311151 on iOS 26.4/26.5).
  // The Home Screen web app is the real fullscreen there.
  if (!isIOS()) {
    const root = document.documentElement;
    const fn = root.requestFullscreen || root.webkitRequestFullscreen;
    if (fn) fn.call(root).catch(() => {});
  }
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

async function keepAwake() {
  try {
    if (navigator.wakeLock) await navigator.wakeLock.request('screen');
  } catch {
    // optional
  }
}

function setupInput(mod) {
  injectKey = mod.cwrap('DG_InjectDoomKey', null, ['number', 'number']);

  let padState = { weaponSlot: 1, nextHeld: false, prevHeld: false };
  let prev = new Set();
  let padSeen = false;

  const inject = (pressed, key) => injectKey(pressed, key);

  const touch = mountTouch(els.touch, inject, {
    maxWeapon: () => game.maxWeapon,
  });

  const poll = () => {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
    const pad = pads.find(isMeaningfulPad);
    if (pad) {
      if (!padSeen) {
        padSeen = true;
        els.touch.hidden = true;
        els.padBadge.hidden = false;
        els.padBadge.textContent = pad.id ? `Controller: ${pad.id}` : 'Controller verbunden';
        touch.releaseAll();
      }
      const { pressed, state } = keysFromGamepad(pad, padState, game.maxWeapon);
      padState = state;
      touch.setWeapon(padState.weaponSlot);
      const { downs, ups } = diffKeys(prev, pressed);
      for (const k of downs) inject(1, k);
      for (const k of ups) inject(0, k);
      prev = pressed;
    } else if (padSeen) {
      padSeen = false;
      els.touch.hidden = false;
      els.padBadge.hidden = true;
      for (const k of prev) inject(0, k);
      prev = new Set();
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  window.addEventListener('gamepadconnected', () => {
    // poll loop picks it up
  });

  return { inject, getWeapon: () => padState.weaponSlot };
}

function startArgs() {
  const args = ['-iwad', `/wads/${game.wadName}`];
  if (skill) args.push('-skill', String(skill));
  if (warp) args.push(...game.warpArgs(Number(warp) || 1));
  return args;
}

async function boot() {
  els.startBtn.hidden = true;
  els.progress.parentElement.hidden = false;
  setProgress(5, 'Starte Audio und Engine …');
  unlockAudio(null);
  requestFullscreen();
  keepAwake();

  const Module = await window.createDoomModule({
    canvas: els.canvas,
    locateFile: (path) => `engine/${path}`,
    noInitialRun: true,
    print: (text) => {
      if (els.status) els.status.textContent = text;
      if (testMode) console.log('[doom]', text);
    },
    printErr: (text) => console.warn('[doom]', text),
  });

  module = Module;
  setProgress(12, 'Lade gespeicherte Stände …');
  await mountPersistent(Module);
  await loadWad(Module.FS);
  await loadMusic(Module.FS);
  const flush = hookPersistence(Module.FS);
  const input = setupInput(Module);
  unlockAudio(Module);

  setProgress(95, 'Starte Spiel …');
  try {
    Module.callMain(startArgs());
  } catch (err) {
    // emscripten_set_main_loop unwinds main by throwing in some builds
    if (err && err.name !== 'ExitStatus' && !String(err).includes('SimulateInfiniteLoop')) {
      throw err;
    }
  }

  unlockAudio(Module);
  els.overlay.hidden = true;
  els.touch.hidden = false;

  window.__doom = {
    inject: input.inject,
    KEY,
    GAMEPAD_LAYOUT,
    keysFromGamepad,
    listSaves() {
      try {
        return Module.FS.readdir('/persistent/.savegame');
      } catch {
        return [];
      }
    },
    listPersistent() {
      const walk = (dir) => {
        const out = [];
        for (const name of Module.FS.readdir(dir)) {
          if (name === '.' || name === '..') continue;
          const path = `${dir}/${name}`.replace('//', '/');
          const stat = Module.FS.stat(path);
          if (Module.FS.isDir(stat.mode)) out.push(...walk(path));
          else out.push(path);
        }
        return out;
      };
      try {
        return walk('/persistent');
      } catch {
        return [];
      }
    },
    async flush() {
      await flush();
    },
    musicReady: () => musicReady,
    game: gameId,
    module: testMode ? Module : undefined,
  };
}

els.startBtn.addEventListener('click', () => {
  boot().catch((err) => {
    console.error(err);
    els.startBtn.hidden = false;
    els.overlay.hidden = false;
    els.overlayTitle.textContent = 'Start fehlgeschlagen';
    els.overlayText.textContent = String(err && err.message ? err.message : err);
  });
});

els.backBtn.addEventListener('click', () => {
  location.href = 'index.html';
});

els.fullBtn.addEventListener('click', () => {
  unlockAudio(module);
  requestFullscreen();
});

document.addEventListener('click', () => unlockAudio(module), { capture: true });
document.addEventListener('touchstart', () => unlockAudio(module), { capture: true });

if (testMode) {
  // Automated tests click #start-btn themselves; keep the overlay visible.
}

export { GAMES, GAMEPAD_LAYOUT };
