import {
  LIKED_ID, shuffle, uniqueByUri, capPlaylist, normalizeEntries, normalizePlaylist, sortTracks, SORT_KEYS,
  filterByAdded, findDuplicates, removeIndexes, buildBackup, toCsv, validateBackup, MAX_BACKUP_BYTES, MAX_BACKUP_PLAYLISTS,
  EXPLICIT_MODES, emptyFilters, hasFilters, filterTracks, sanitizeFilters, organizePlaylists, parsePlaylistRef,
  SPLIT_MODES, MAX_SPLIT_PARTS, splitTracks, MULTI_KEYS, sortTracksBy, normalizeAlbum, normalizeFollowedArtist, toLibraryCsv,
  pickThumb,
} from './core.js';
import { sanitizeMix, sanitizeMixes, upsertMix, removeMix, newMixId, mixSources } from './mixes.js';
import {
  sourceKey, generatedName, snapshotName, generatedDescription, tagFor, withTag, isAppPlaylist, timeName,
} from './targets.js';
import { SpotifyApi, ApiError } from './api.js';
import * as auth from './auth.js';
import { KEYS, OBSOLETE_KEYS, getItem, setItem, removeItem } from './storage.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { REPO_URL, APP_NAME, APP_VERSION } from './config.js';
import { idbGet, idbSet, idbClear, idbPrune } from './idb.js';
import {
  countRequest, requestStats, beginAction, endAction, actionSpent, logError, getErrors, clearErrors, buildReport,
} from './diag.js';
import { pickDevice, playProblem, checkPlayback } from './player.js';
import { registerUpdates } from './update.js';
import { makeCover } from './cover.js';
import { parseDeepLink, buildDeepLink, withoutDeepLink, LINK_PARAMS } from './links.js';
import {
  createShakeDetector, pickIndex, spinSequence, spinDelays, naiveShuffle, fairShuffle, firstSongHistogram, maxDeviation,
} from './random.js';
import { imageDominantColor, rgbCss } from './color.js';
import {
  MINUTE, TIME_PRESETS, presetByKey, MIN_MINUTES, SLIDER_MAX, sanitizeMinutes, fitDuration, forgottenTracks, FORGOTTEN_YEARS,
  pickArtists, recentAlbums, RELEASE_DAYS, albumsFromListening, withoutUris, CACHE_TTL_MS,
  DISCOVER_COUNTS, DISCOVER_MINUTES, DEFAULT_DISCOVER_COUNT, MAX_DISCOVER_ARTISTS, takeAmount, topGenres,
  artistsFromTracks, notInLibrary, ARTISTS_PER_SEARCH, READ_BUDGET, MIN_TRACKS_ON_QUOTA, sanitizeArtistsPerSearch,
} from './generators.js';
import { renderSummary } from './summary.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const root = document.getElementById('app');
const S = { api: null, me: null, playlists: [], raw: [], sourceCache: new Map(), loaded: false, busy: false, tab: 'home', pickers: [], scroll: {} };
let pickerSeq = 0;

// ---------- DOM ----------

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

/** replaceChildren convierte null y false en el texto "null"/"false"; aquí se descartan. */
const setKids = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

function icon(...paths) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

const ICONS = {
  snap: ['M4 7h3l2-3h6l2 3h3v13H4Z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  orphans: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z'],
  split: ['M12 3v18', 'M3 8l4 4-4 4', 'M21 8l-4 4 4 4'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  mic: ['M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0Z', 'M5 10v1a7 7 0 0 0 14 0v-1', 'M12 18v4', 'M8 22h8'],
  roulette: ['M4 4h16v16H4Z', 'M8.5 8.5h.01', 'M15.5 8.5h.01', 'M12 12h.01', 'M8.5 15.5h.01', 'M15.5 15.5h.01'],
  proof: ['M3 21h18', 'M6 21v-8', 'M10.5 21V9', 'M15 21v-6', 'M19.5 21V5'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'],
  home: ['M3 11 12 3l9 8', 'M5 9.5V21h14V9.5'],
  shuffle: ['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  sort: ['m21 16-4 4-4-4', 'M17 20V4', 'm3 8 4-4 4 4', 'M7 4v16'],
  dups: ['M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  backup: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  discover: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'm15.5 8.5-2 5-5 2 2-5Z'],
  compass: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'm15.5 8.5-2 5-5 2 2-5Z'],
  more: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  spark: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'm6 6 2.5 2.5', 'm15.5 15.5 2.5 2.5', 'm6 18 2.5-2.5', 'm15.5 8.5 2.5-2.5'],
  calendar: ['M4 6h16v15H4Z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v5l3 2'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0Z', 'M8 6H4a3 3 0 0 0 4 4', 'M16 6h4a3 3 0 0 1-4 4', 'M12 13v4', 'M8 21h8', 'M10 17h4v4h-4Z'],
  album: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
  pin: ['M12 17v5', 'M9 4h6l-1 6 3 3H7l3-3Z'],
  diag: ['M3 12h4l3-8 4 16 3-8h4'],
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
};

/** Ilustración de los estados vacíos: tres naipes abiertos en abanico con una nota (SVG, sin imágenes externas). */
function emptyArt() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 80');
  svg.setAttribute('class', 'empty-art');
  svg.setAttribute('aria-hidden', 'true');
  const card = (rot, cls) => {
    const r = document.createElementNS(SVGNS, 'rect');
    for (const [k, v] of Object.entries({ x: '45', y: '12', width: '30', height: '44', rx: '5', class: cls, transform: `rotate(${rot} 60 70)` })) r.setAttribute(k, v);
    return r;
  };
  const note = document.createElementNS(SVGNS, 'path');
  note.setAttribute('d', 'M57 42V27l9-2v13 M57 42a3 3 0 1 1-3-3 3 3 0 0 1 3 3 M66 38a3 3 0 1 1-3-3 3 3 0 0 1 3 3');
  note.setAttribute('class', 'empty-note');
  svg.append(card(-16, 'empty-card back'), card(16, 'empty-card back'), card(0, 'empty-card'), note);
  return svg;
}

const fmt = (n) => Number(n).toLocaleString(getLang());
const spotifyUrl = (id) => `https://open.spotify.com/playlist/${encodeURIComponent(id)}`;

/**
 * Atribución obligatoria junto a carátulas y metadatos: logo completo oficial sin modificar, enlazado a Spotify.
 * Blanco en tema oscuro y negro en claro (el verde solo vale sobre negro o blanco puros); el CSS elige cuál se ve.
 */
const spotifyAttribution = (href = 'https://open.spotify.com/') =>
  h('a', { class: 'spotify-attrib', href, target: '_blank', rel: 'noopener', 'aria-label': t('contentFromSpotify') },
    h('img', { class: 'on-dark', src: 'icons/spotify/full-logo-white.svg', alt: '', width: '88', height: '24' }),
    h('img', { class: 'on-light', src: 'icons/spotify/full-logo-black.svg', alt: '', width: '88', height: '24' }));
const nowLabel = () => new Date().toLocaleString(getLang(), { dateStyle: 'short', timeStyle: 'short' });
const artistsOf = (tr) => tr.artists.join(', ');

/** Error explicado al usuario. `code` es la clave de texto: va al registro en vez del mensaje (que puede llevar nombres). */
class UserError extends Error {
  constructor(message, code = 'user', cause = undefined) {
    super(message, { cause });
    this.code = code;
  }
}

const isQuota = (e) => e instanceof ApiError && e.reason === 'QUOTA_EXCEEDED';
const isNetworkError = (e) => (e instanceof TypeError && /fetch|network|load failed|internet/i.test(e.message ?? ''))
  || (typeof navigator !== 'undefined' && navigator.onLine === false && !(e instanceof UserError));

/**
 * Qué clase de error es, para elegir el mensaje, la acción («Reintentar», «Volver a conectar») y el registro.
 * Nunca se enseña un código ni un texto técnico de Spotify.
 */
function errorKind(e) {
  if (e instanceof UserError) return 'user';
  if (e instanceof auth.AuthError) return e.code === 'invalid_grant' ? 'session' : 'auth';
  if (e instanceof ApiError) {
    const msg = String(e.apiMessage ?? '');
    if (e.status === 0) return 'incomplete';
    if (e.reason === 'QUOTA_EXCEEDED') return 'quota';
    if (e.reason === 'PREMIUM_REQUIRED') return 'premium';
    if (e.status === 401) return 'session';
    if (e.status === 403 && /scope/i.test(msg)) return 'scope';
    if (e.status === 403 && /regist|dashboard|user may not/i.test(msg)) return 'notRegistered';
    if (e.status === 403) return 'forbidden';
    if (e.status === 404) return 'notFound';
    if (e.status === 429) return 'rate';
    if (e.status >= 500) return 'server';
    return 'other';
  }
  if (isNetworkError(e)) return 'network';
  return 'bug';
}

const ERROR_TEXT = {
  session: 'errSession', scope: 'errScope', notRegistered: 'err403', forbidden: 'errForbidden', premium: 'errPremiumPlayer',
  notFound: 'err404', rate: 'errRate', server: 'errServer', network: 'errNetwork', quota: 'errQuota', incomplete: 'errIncomplete',
  other: 'errBug', bug: 'errBug',
};
/** Se arreglan solos reintentando (red, Spotify caído o lento). La cuota no: reintentar solo gasta más. */
const TRANSIENT = new Set(['network', 'server', 'rate', 'incomplete', 'other', 'bug']);
const RECONNECT = new Set(['session', 'scope', 'auth', 'forbidden']);

function errorInfo(e) {
  const kind = errorKind(e);
  const text = kind === 'user' ? e.message : kind === 'auth' ? t(`authErr_${e.code}`) : t(ERROR_TEXT[kind]);
  // Un error explicado («no se pudo crear…») hereda la acción de su causa: sin permiso, «Volver a conectar».
  const base = kind === 'user' && e.cause ? errorKind(e.cause) : kind;
  return { kind, base, text, transient: kind !== 'user' && TRANSIENT.has(kind), reconnect: RECONNECT.has(base) };
}

const errorMessage = (e) => errorInfo(e).text;
/** El motivo dentro de otra frase («No se pudo crear la playlist: {reason}.»): sin el punto final. */
const reasonOf = (e) => errorMessage(e).replace(/[.\s]+$/, '');

/** Guarda el error en el registro local (Más → Diagnóstico) sin nombres ni tokens. */
function recordError(e) {
  const { kind, base } = errorInfo(e);
  logError(e.cause instanceof ApiError ? e.cause : e, kind === 'user' ? `user:${e.code}${base !== 'user' ? `/${base}` : ''}` : kind);
}

// ---------- Estado de tarea (progreso y errores) ----------

/**
 * Con `loader` muestra los naipes mezclándose; su barra sigue el progreso real. `phase(clave)` enseña un paso sin cifras
 * (barajando, quitando las antiguas…), y `fail(e, retry)` añade «Reintentar».
 */
function createStatus({ loader = false } = {}) {
  const bar = h('progress', { hidden: true, max: '1', value: '0' });
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' });
  const retryBtn = h('button', { class: 'btn primary', type: 'button', hidden: true }, t('retry'));
  const reconnectBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => reconnect() }, t('reconnectBtn'));
  const openLink = h('a', { class: 'btn', href: 'https://open.spotify.com/', target: '_blank', rel: 'noopener', hidden: true }, t('openInSpotify'));
  const err = h('div', { class: 'error-box', role: 'alert', hidden: true }, h('p', { class: 'error' }), h('div', { class: 'error-actions' }, retryBtn, reconnectBtn, openLink));
  const cards = loader
    ? h('div', { class: 'loader', 'aria-hidden': 'true' }, h('div', { class: 'deck' }, h('div', { class: 'lcard' }), h('div', { class: 'lcard' }), h('div', { class: 'lcard' })), h('div', { class: 'loader-bar' }))
    : null;
  const showCards = (on) => cards?.classList.toggle('on', on);
  return {
    el: h('div', { class: 'status' }, cards, live, bar, err),
    say(msg) { live.textContent = msg; err.hidden = true; showCards(false); },
    phase(key) {
      live.textContent = t(`phase_${key}`);
      err.hidden = true;
      bar.hidden = true;
      showCards(true);
    },
    progress(key, done, total) {
      live.textContent = t(key, { done: fmt(done), total: fmt(total) });
      bar.hidden = false;
      bar.max = Math.max(total, 1);
      bar.value = done;
      if (cards) { showCards(true); cards.style.setProperty('--p', String(Math.min(1, done / Math.max(total, 1)))); }
    },
    stop() { bar.hidden = true; showCards(false); },
    clear() { live.textContent = ''; bar.hidden = true; err.hidden = true; showCards(false); },
    /**
     * Enseña el error en palabras normales y una acción que lo resuelve: «Reintentar» (si se pasa `retry`),
     * «Volver a conectar» (sesión caducada o falta un permiso) y, con `open`, «Abrir en Spotify».
     */
    fail(e, retry = null, { open = null } = {}) {
      console.error(e);
      recordError(e);
      const info = errorInfo(e);
      live.textContent = '';
      bar.hidden = true;
      showCards(false);
      err.firstChild.textContent = info.text;
      retryBtn.hidden = !retry;
      retryBtn.onclick = retry;
      reconnectBtn.hidden = !info.reconnect;
      openLink.hidden = !open;
      if (open) openLink.href = open;
      err.hidden = false;
    },
  };
}

/**
 * Ejecuta una acción con su estado. Cuenta sus peticiones (Diagnóstico) y, si falla por algo pasajero (red, Spotify
 * lento o caído), ofrece «Reintentar», que repite la acción entera, igual que volver a pulsar el botón.
 */
async function task(status, fn, name = S.tab) {
  if (S.busy) return;
  S.busy = true;
  document.body.classList.add('busy');
  beginAction(name);
  status.clear();
  try {
    await fn();
  } catch (e) {
    status.fail(e, errorInfo(e).transient ? () => task(status, fn, name) : null);
  } finally {
    endAction();
    S.busy = false;
    document.body.classList.remove('busy');
    status.stop();
  }
}

// ---------- Datos ----------

const likedEntry = (prev) => ({
  id: LIKED_ID, name: t('liked'), total: prev?.total ?? null, image: '', owner: '', owned: false,
  collaborative: false, readable: true, isLiked: true, error: prev?.error ?? false,
});

async function loadPlaylists() {
  const raw = (await S.api.getMyPlaylists()).filter(Boolean);
  S.raw = raw;
  S.loadedAt = Date.now();
  // Las playlists de Shuffl se borran antes de crear la siguiente: no se ofrecen como origen en ningún selector.
  S.playlists = organizePlaylists([likedEntry(S.playlists.find((p) => p.isLiked)), ...raw.filter((p) => !isAppPlaylist(p, S.me.id)).map((p) => normalizePlaylist(p, S.me.id))]);
  S.loaded = true;
  S.sourceCache.clear();
  S.pickers.forEach((p) => p.update());
}

const getMixes = () => sanitizeMixes(getItem(KEYS.mixes, []));
const setMixes = (list) => setItem(KEYS.mixes, list);
const nameLabels = () => ({ liked: t('liked'), library: t('allMyMusic') });

/** Hoja inferior con un campo de texto. Devuelve el texto o null si se cancela. */
function askName({ title, value = '' }) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', class: 'text', id: 'ask-name', maxlength: '60', value, 'aria-label': title });
    const onKey = (e) => { if (e.key === 'Escape') close(null); if (e.key === 'Enter') close(input.value.trim() || null); };
    const close = (v) => { document.removeEventListener('keydown', onKey); sheet.remove(); resolve(v); };
    const sheet = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) close(null); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', {}, title), input,
        h('button', { class: 'btn primary', type: 'button', id: 'ask-ok', onclick: () => close(input.value.trim() || null) }, t('save')),
        h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, t('cancel'))));
    document.addEventListener('keydown', onKey);
    document.body.append(sheet);
    input.focus();
    input.select();
  });
}

let tintToken = 0;

/** El fondo toma un degradado suave del color dominante de la portada seleccionada. */
function setTint(pl) {
  return tintFrom(pl && !pl.isLiked ? pl.image : null);
}

/** Fondo sutil con el color dominante de una carátula (la del origen o la primera del resultado). */
async function tintFrom(url) {
  const token = ++tintToken;
  const root = document.documentElement;
  const color = typeof url === 'string' && url.startsWith('https://') ? await imageDominantColor(url) : null;
  if (token !== tintToken) return;
  if (color) root.style.setProperty('--tint', rgbCss(color)); else root.style.removeProperty('--tint');
}

async function probeLiked() {
  const liked = S.playlists.find((p) => p.isLiked);
  try {
    liked.total = (await S.api.request('GET', '/me/tracks?limit=1')).total;
    liked.error = false;
  } catch (e) {
    console.warn('Tus me gusta no disponible', e.status);
    liked.error = true;
  }
  S.pickers.forEach((p) => p.update());
}

// ---------- Caché en el dispositivo (IndexedDB): gastar poca cuota de Spotify ----------

const DAY_MS = CACHE_TTL_MS;
/** Canciones de una playlist (válidas mientras no cambie su snapshot_id) y de álbumes (no cambian). */
const LONG_TTL_MS = 30 * DAY_MS;
/** Las claves llevan el id de la cuenta: otra cuenta en el mismo navegador no ve ni usa los datos de la anterior. */
const cacheKey = (k) => `${S.me.id}:${k}`;

async function cacheRead(k, maxAge) {
  const v = await idbGet(cacheKey(k));
  const now = Date.now();
  return v && typeof v.t === 'number' && now - v.t < maxAge && now >= v.t ? v.d : undefined;
}

/** Lee de la caché o pide a Spotify y guarda (artistas y lanzamientos 24 h; canciones de álbumes 30 días). */
async function cached(rawKey, fetcher, maxAge = DAY_MS) {
  const hit = await cacheRead(rawKey, maxAge);
  if (hit !== undefined) return hit;
  const data = await fetcher();
  idbSet(cacheKey(rawKey), data);
  return data;
}

/**
 * Canciones de una playlist o de Tus me gusta. Con `useCache`, si no ha cambiado desde la última lectura no se vuelve a
 * pedir: las playlists por su snapshot_id y Tus me gusta por el total y la más reciente (una petición en vez de todas).
 * Lo que escribe en su propio origen (Ordenar, Duplicados, «Barajar la misma playlist»…) lee siempre de Spotify.
 */
async function readSource(pl, onProgress, { useCache = false } = {}) {
  if (pl.isLiked) {
    const head = useCache ? await S.api.getLikedHead() : null;
    if (head) {
      const hit = await cacheRead('liked', LONG_TTL_MS);
      if (hit && hit.total === head.total && hit.first === head.first) return { tracks: hit.tracks, skipped: hit.skipped };
    }
    const r = normalizeEntries(await S.api.getLikedTracks(onProgress));
    if (head) idbSet(cacheKey('liked'), { total: head.total, first: head.first, tracks: r.tracks, skipped: r.skipped });
    return r;
  }
  const snap = S.raw.find((p) => p?.id === pl.id)?.snapshot_id;
  if (useCache && snap) {
    const hit = await cacheRead(`pl:${pl.id}`, LONG_TTL_MS);
    if (hit?.snap === snap) return { tracks: hit.tracks, skipped: hit.skipped };
  }
  const r = normalizeEntries(await S.api.getPlaylistItems(pl.id, onProgress));
  if (snap) idbSet(cacheKey(`pl:${pl.id}`), { snap, tracks: r.tracks, skipped: r.skipped });
  return r;
}

/**
 * Antes de fiarse de la caché, la lista de playlists (con sus snapshot_id) tiene que ser reciente: si cambiaste una en
 * Spotify y vuelves a Shuffl, su snapshot_id ya no coincide y se vuelve a leer. Cuesta una petición por cada 50 playlists.
 */
const LIBRARY_FRESH_MS = 60000;
async function ensureFreshLibrary() {
  if (!S.loadedAt || Date.now() - S.loadedAt > LIBRARY_FRESH_MS) await loadPlaylists();
}

async function readSources(list, status, opts = {}) {
  if (opts.useCache && list.some((p) => !p.isLiked)) await ensureFreshLibrary();
  const grand = list.reduce((n, p) => n + (p.total ?? 0), 0);
  const tracks = [];
  const skipped = { local: 0, empty: 0 };
  let base = 0;
  for (const pl of list) {
    const r = await readSource(pl, (d, tot) => status.progress('reading', base + d, Math.max(grand, base + tot)), opts);
    tracks.push(...r.tracks);
    skipped.local += r.skipped.local;
    skipped.empty += r.skipped.empty;
    base += r.tracks.length + r.skipped.local + r.skipped.empty;
  }
  return { tracks, skipped };
}

const skippedCount = (s) => s.local + s.empty;

// ---------- Deshacer ----------

/** Con `soft` no pisa un Deshacer ya guardado (así no se pierde el estado original). */
function saveUndo(playlistId, name, uris, { soft = false } = {}) {
  const prev = getItem(KEYS.undo);
  if (soft && prev) return;
  if (prev?.pending) throw new UserError(t('errPending', { name: prev.name || prev.playlistId }), 'errPending');
  const entry = { playlistId, name, uris, pending: true, date: new Date().toISOString() };
  if (setItem(KEYS.undo, entry, { strict: true })) return;
  // Deshacer va antes que el registro de errores: si el almacenamiento está lleno, se vacía el registro.
  clearErrors();
  if (!setItem(KEYS.undo, entry, { strict: true })) throw new UserError(t('errUndoStorage'), 'errUndoStorage');
}

/** Marca el Deshacer como seguro de aplicar: la escritura terminó y la playlist tiene `count` elementos. */
function finishUndo(playlistId, count) {
  const u = getItem(KEYS.undo);
  if (u?.playlistId === playlistId) setItem(KEYS.undo, { ...u, pending: false, after: count });
}

/** Vuelve a marcar el Deshacer como pendiente antes de tocar su playlist, por si la escritura falla a medias. */
function markUndoPending(playlistId) {
  const u = getItem(KEYS.undo);
  if (u?.playlistId !== playlistId || u.pending) return;
  if (!setItem(KEYS.undo, { ...u, pending: true }, { strict: true })) throw new UserError(t('errUndoStorage'), 'errUndoStorage');
}

async function overwritePlaylist(id, uris, status) {
  markUndoPending(id);
  await S.api.replaceItems(id, uris, (d, tot) => status.progress('saving', d, tot));
  finishUndo(id, uris.length);
}

/** Comprueba el total y la primera página (si se pasa `expected`) antes de escribir con datos leídos antes. */
async function assertUnchanged(playlistId, expectedTotal, expected) {
  const page = await S.api.request('GET', `/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track,episode`);
  if (page.total !== expectedTotal) throw new UserError(t('errChanged'), 'errChanged');
  if (!expected) return;
  if (!Array.isArray(page.items)) throw new ApiError(0, 'incomplete');
  const head = normalizeEntries(page.items).tracks;
  if (head.some((x, i) => x.uri !== expected[i]?.uri)) throw new UserError(t('errChanged'), 'errChanged');
}

function confirmOverwrite(name, skipped) {
  const lost = skipped ? ` ${t('confirmLost', { n: fmt(skipped) })}` : '';
  return confirm(t('confirmOverwrite', { name }) + lost);
}

async function applyUndo(status, expectedId) {
  const u = getItem(KEYS.undo);
  if (!u) return false;
  if (expectedId && u.playlistId !== expectedId) throw new UserError(t('errUndoOther'), 'errUndoOther');
  if (!u.pending && Number.isInteger(u.after)) await assertUnchanged(u.playlistId, u.after);
  if (!confirm(t('confirmUndo', { name: u.name || u.playlistId, date: new Date(u.date).toLocaleString(getLang()) }))) return false;
  await withWriteLock(async () => {
    if (!u.pending && Number.isInteger(u.after)) await assertUnchanged(u.playlistId, u.after);
    markUndoPending(u.playlistId);
    await S.api.replaceItems(u.playlistId, u.uris, (d, tot) => status.progress('saving', d, tot));
  });
  removeItem(KEYS.undo);
  await loadPlaylists();
  return true;
}

// ---------- Playlists de Shuffl: solo una en tu cuenta, la última (v1.3.1) ----------

/** Borrar las antiguas antes de crear (por defecto sí; se desactiva en Ajustes). */
const purgeEnabled = () => getItem(KEYS.purge) !== false;
/** La primera vez se enseña la lista y se pide confirmación; el «no volver a preguntar» es de esta cuenta. */
const purgeConfirmed = () => getItem(KEYS.purgeOk)?.me === S.me?.id;

/** Hoja con lo que se va a borrar y un único botón «Borrar y no volver a preguntar» (y Cancelar). Devuelve si se acepta. */
function confirmPurge(list) {
  return new Promise((resolve) => {
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const close = (ok) => { document.removeEventListener('keydown', onKey); sheet.remove(); resolve(ok); };
    const sheet = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) close(false); } },
      h('div', { class: 'sheet', id: 'purge-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('purgeTitle') },
        h('h2', { class: 'sheet-title' }, t('purgeTitle')),
        h('p', {}, t('purgeLead')),
        h('ul', { class: 'purge-list', id: 'purge-list' }, list.map((p) => h('li', {}, p.name))),
        h('p', { class: 'muted small' }, t('purgeRecover')),
        h('button', { class: 'btn primary', type: 'button', id: 'purge-ok', onclick: () => close(true) }, t('purgeOk')),
        h('button', { class: 'btn', type: 'button', id: 'purge-cancel', onclick: () => close(false) }, t('cancel'))));
    document.addEventListener('keydown', onKey);
    document.body.append(sheet);
    sheet.querySelector('#purge-ok').focus();
  });
}

class CancelledError extends UserError {}

class RetryableError extends Error {
  constructor(cause, retry) {
    super(cause?.message, { cause });
    this.retry = retry;
  }
}

/** Las playlists de Shuffl de tu biblioteca ahora mismo (lectura fresca), salvo las de `exclude` (los orígenes). */
async function appPlaylistsNow(exclude) {
  return (await S.api.getMyPlaylists()).filter((p) => isAppPlaylist(p, S.me.id) && !exclude.includes(p.id));
}

/**
 * Quita `ids` de tu biblioteca y comprueba con GET /me/library/contains que de verdad se han quitado: si Spotify
 * respondiera bien sin quitar nada, se vería el error en vez de ir acumulando playlists. Si un Deshacer apuntaba a una
 * de ellas, se descarta (ya no se puede aplicar). Lanza un error con el motivo real si algo falla.
 */
async function removePlaylists(ids) {
  try {
    await S.api.unfollowPlaylists(ids);
    const uris = ids.map((id) => `spotify:playlist:${id}`);
    // Spotify puede tardar un momento en reflejar el borrado: se mira otra vez antes de dar el error.
    let still = await S.api.libraryContains(uris);
    if (still.some(Boolean)) {
      await wait(1500);
      still = await S.api.libraryContains(uris);
    }
    if (still.some(Boolean)) throw new UserError(t('purgeStillThere'), 'purgeStillThere');
  } catch (e) {
    throw new UserError(t('purgeFailed', { reason: reasonOf(e) }), 'purgeFailed', e);
  }
  if (ids.includes(getItem(KEYS.undo)?.playlistId)) removeItem(KEYS.undo);
  S.raw = S.raw.filter((p) => !ids.includes(p?.id));
}

/**
 * Crea una playlist de Shuffl con `uris` (ya leídas y barajadas, en memoria). Antes quita de tu biblioteca TODAS las
 * playlists de Shuffl (`isAppPlaylist`), salvo `protect` (los orígenes de esta baraja).
 * - La hoja de la primera vez va fuera del candado; dentro se vuelve a leer la biblioteca y solo se quita lo que sigue
 *   siendo de Shuffl y estaba en la lista que viste (si renombras una mientras la hoja está abierta, se salva).
 * - Si borrar o crear falla, lanza un error con «Reintentar», que repite solo lo que falta sin volver a leer: si la
 *   playlist llegó a crearse, se rellena esa en vez de crear otra.
 * Devuelve { id, notes }.
 */
async function createAppPlaylist({ key, name, description, uris, protect = [] }, status) {
  const tag = await tagFor(key ?? 'none');
  const full = withTag(description, tag, name);
  let createdId = null;
  const step = async () => {
    const notes = [];
    let confirmed = null;
    if (purgeEnabled() && !purgeConfirmed()) {
      status.phase('cleaning');
      // La playlist de un intento anterior se rellena, no se quita: no se enseña en la hoja.
      const old = await appPlaylistsNow([...protect, createdId].filter(Boolean));
      if (old.length) {
        if (!await confirmPurge(old)) throw new CancelledError(t('purgeCancelled'));
        confirmed = new Set(old.map((p) => p.id));
      }
    }
    const id = await withWriteLock(async () => {
      // Una sola lectura fresca: sirve para saber si la playlist de un intento anterior sigue ahí y para borrar.
      // Con el borrado desactivado y sin intento anterior no hace falta leer la biblioteca.
      const fresh = purgeEnabled() || createdId ? await appPlaylistsNow(protect) : [];
      if (createdId && !fresh.some((p) => p.id === createdId)) createdId = null;
      if (purgeEnabled()) {
        status.phase('cleaning');
        // Sin la hoja aceptada en esta cuenta solo se borra lo que se enseñó en ella (nada, si no se enseñó).
        const allowed = confirmed ?? (purgeConfirmed() ? null : new Set());
        const old = fresh.filter((p) => p.id !== createdId && (allowed === null || allowed.has(p.id)));
        if (old.length) {
          await removePlaylists(old.map((p) => p.id));
          notes.push(t('purgeDone', { n: fmt(old.length) }));
        }
        // Solo cuando el borrado ha ido bien: si falla, la próxima vez se vuelve a enseñar la lista.
        if (confirmed) setItem(KEYS.purgeOk, { me: S.me.id });
      }
      status.phase('creating');
      try {
        if (createdId) {
          await S.api.replaceItems(createdId, uris, (d, tot) => status.progress('saving', d, tot));
        } else {
          createdId = (await S.api.createPlaylist(name, full)).id;
          await S.api.addItems(createdId, uris, (d, tot) => status.progress('saving', d, tot));
        }
      } catch (e) {
        throw new UserError(t('createFailed', { reason: reasonOf(e) }), 'createFailed', e);
      }
      return createdId;
    });
    setItem(KEYS.lastTarget, id);
    return { id, notes };
  };
  const attempt = async () => {
    try {
      return await step();
    } catch (e) {
      if (e instanceof CancelledError) throw e;
      throw new RetryableError(e, attempt);
    }
  };
  return attempt();
}

/**
 * «Buscar más» y «Volver a barajar» escriben en la playlist que se acaba de crear. Si otra pestaña o dispositivo la ha
 * quitado o la has renombrado, no se toca y se avisa.
 */
async function assertStillAppPlaylist(id) {
  // Dos peticiones en vez de leer toda tu biblioteca: sus datos y si sigue en tu biblioteca.
  let info = null;
  try {
    info = await S.api.getPlaylistInfo(id);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
  }
  const [inLibrary] = info ? await S.api.libraryContains([`spotify:playlist:${id}`]) : [false];
  if (!inLibrary || !isAppPlaylist(info, S.me.id)) throw new UserError(t('playlistGone'), 'playlistGone');
}

/**
 * Crea la playlist y sigue con `after(written)`. Si crear falla, enseña el error real con «Reintentar», que repite
 * solo lo que falló (las canciones siguen en memoria) y después continúa con `after`.
 */
async function commitApp(args, status, after, attempt = () => createAppPlaylist(args, status)) {
  let written;
  try {
    written = await attempt();
  } catch (e) {
    if (!(e instanceof RetryableError)) throw e;
    status.fail(e.cause, () => task(status, () => commitApp(args, status, after, e.retry)));
    return null;
  }
  await after(written);
  return written.id;
}

/** Aviso en lo alto de Inicio con «Entendido». `once`: clave que lo marca como visto para siempre. */
function showNotice(id, text, once = null) {
  document.getElementById(id)?.remove();
  const home = document.getElementById('panel-home');
  if (!home || (once && getItem(once))) return;
  const box = h('div', { class: 'notice', id, role: 'note' },
    h('p', {}, text),
    h('div', { class: 'notice-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => { box.remove(); if (once) setItem(once, true); } }, t('gotIt'))));
  home.prepend(box);
}


// ---------- Selector de playlists ----------

function createPicker({ multi, disabledReason, onChange }) {
  const group = `pick-${++pickerSeq}`;
  const selected = new Set();
  const list = h('ul', { class: 'picker' });
  const search = h('input', {
    type: 'search', class: 'search', placeholder: t('search'), 'aria-label': t('search'),
    oninput: () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll('li').forEach((li) => { li.hidden = q !== '' && !(li.dataset.name ?? '').includes(q); });
    },
  });

  function followedRow(pl) {
    const cover = pl.image.startsWith('https://') ? h('img', { class: 'cover', src: pl.image, alt: '', loading: 'lazy' }) : h('span', { class: 'cover', 'aria-hidden': 'true' }, '♪');
    return h('li', { 'data-name': pl.name.toLowerCase(), class: 'followed' },
      h('button', { class: 'row', type: 'button', onclick: () => showFollowedHelp(pl) }, cover,
        h('span', { class: 'row-text' }, h('span', { class: 'row-name' }, pl.name),
          h('span', { class: 'row-meta' }, [t('cannotRead'), pl.hasCopy !== undefined ? t('hasCopyShort') : ''].filter(Boolean).join(' · ')))));
  }

  function row(pl) {
    if (!pl.isLiked && !pl.readable) return followedRow(pl);
    const reason = disabledReason?.(pl);
    const input = h('input', { type: multi ? 'checkbox' : 'radio', name: group, value: pl.id, disabled: !!reason, onchange: () => {
      if (multi) { if (input.checked) selected.add(pl.id); else selected.delete(pl.id); } else { selected.clear(); selected.add(pl.id); }
      setTint(input.checked ? pl : picker.getSelected().at(-1));
      onChange?.(picker.getSelected());
    } });
    input.checked = selected.has(pl.id);
    const cover = pl.isLiked
      ? h('span', { class: 'cover liked', 'aria-hidden': 'true' }, '♥')
      : pl.image.startsWith('https://') ? h('img', { class: 'cover', src: pl.image, alt: '', loading: 'lazy' }) : h('span', { class: 'cover', 'aria-hidden': 'true' }, '♪');
    const songs = pl.total != null ? t('songs', { n: fmt(pl.total) }) : '';
    const meta = reason || (pl.copyOf !== undefined ? [t('yourCopyOf', { name: pl.copyOf }), songs].filter(Boolean).join(' · ') : songs);
    return h('li', { 'data-name': pl.name.toLowerCase(), class: reason ? 'disabled' : '' },
      h('label', { class: 'row' }, input, cover,
        h('span', { class: 'row-text' }, h('span', { class: 'row-name' }, pl.name), h('span', { class: 'row-meta' }, meta))));
  }

  const picker = {
    el: h('div', { class: 'picker-wrap' }, search, list, spotifyAttribution()),
    getSelected: () => S.playlists.filter((p) => selected.has(p.id)),
    /** Sustituye la selección por las playlists de `ids` que se puedan elegir. Devuelve cuántas quedaron. */
    setSelected(ids) {
      selected.clear();
      for (const id of ids) if (S.playlists.some((p) => p.id === id && !disabledReason?.(p))) selected.add(id);
      picker.update();
      return selected.size;
    },
    update(silent = false) {
      for (const id of [...selected]) if (!S.playlists.some((p) => p.id === id && !disabledReason?.(p))) selected.delete(id);
      if (!S.loaded) {
        list.replaceChildren(...Array.from({ length: 6 }, () => h('li', { class: 'skeleton-row' }, h('div', { class: 'sk sk-cover' }), h('div', { class: 'sk sk-line' }))));
        list.classList.add('skeleton');
        return;
      }
      list.classList.remove('skeleton');
      let headed = false;
      list.replaceChildren(...S.playlists.flatMap((pl) => {
        const followed = !pl.isLiked && !pl.readable;
        const head = followed && !headed ? [h('li', { class: 'picker-group' }, t('followedGroup'))] : [];
        if (followed) headed = true;
        return [...head, row(pl)];
      }));
      search.dispatchEvent(new Event('input'));
      if (!silent) onChange?.(picker.getSelected());
    },
  };
  S.pickers.push(picker);
  picker.update(true);
  return picker;
}

function baseReason(pl) {
  if (pl.isLiked) return pl.error ? t('likedUnavailable') : '';
  return pl.readable ? '' : t('notReadable');
}

// ---------- Playlists de otras personas ----------

/** Explica por qué no se puede leer y cómo hacerse una copia propia en Spotify. */
function showFollowedHelp(pl) {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); sheet.remove(); };
  const cover = pl.image?.startsWith('https://') ? h('img', { class: 'cover', src: pl.image, alt: '', loading: 'lazy' }) : null;
  const sheet = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet', id: 'followed-help', role: 'dialog', 'aria-modal': 'true', 'aria-label': pl.name },
      h('div', { class: 'row' }, cover, h('span', { class: 'row-text' }, h('strong', {}, pl.name), pl.owner ? h('span', { class: 'row-meta' }, pl.owner) : null)),
      spotifyAttribution(spotifyUrl(pl.id)),
      h('p', {}, t('followedWhy')),
      pl.hasCopy !== undefined ? h('p', { class: 'note', id: 'followed-has-copy' }, t('followedHasCopy', { name: pl.hasCopy })) : null,
      h('h2', {}, t('copyGuideTitle')),
      h('p', {}, h('strong', {}, `${t('onPhone')}: `), t('copyPhone')),
      h('p', {}, h('strong', {}, `${t('onComputer')}: `), t('copyComputer')),
      h('p', { class: 'muted' }, t('copyThenRefresh')),
      h('div', { class: 'actions' },
        h('a', { class: 'btn primary', href: spotifyUrl(pl.id), target: '_blank', rel: 'noopener', id: 'followed-open' }, t('openInSpotify')),
        h('button', { class: 'btn', type: 'button', id: 'followed-close', onclick: close }, t('close')))));
  document.addEventListener('keydown', onKey);
  document.body.append(sheet);
  sheet.querySelector('#followed-close').focus();
}

/** Comparte el enlace de la playlist: hoja de compartir del sistema, o copiar el enlace, o mostrarlo para copiarlo a mano. */
async function shareLink(playlistId, info) {
  const url = spotifyUrl(playlistId);
  try {
    if (navigator.share) {
      await navigator.share({ title: APP_NAME, url });
    } else {
      await navigator.clipboard.writeText(url);
      setKids(info, h('p', { id: 'share-done' }, t('linkCopied')));
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
    setKids(info, copyBox(url));
  }
}

// ---------- Reproducir ahora ----------

function chooseDevice(devices) {
  return new Promise((resolve) => {
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      sheet.remove();
      resolve(value);
    };
    const sheet = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) close(null); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('chooseDevice') },
        h('h2', {}, t('chooseDevice')),
        devices.map((d) => h('button', { class: 'btn device', type: 'button', onclick: () => close(d) }, `${d.name} · ${d.type}`)),
        h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, t('cancel'))));
    document.addEventListener('keydown', onKey);
    document.body.append(sheet);
    sheet.querySelector('button').focus();
  });
}

/** Espera antes de mirar qué suena: Spotify tarda un momento en cambiar de playlist. */
const VERIFY_DELAY_MS = 1200;
/** Merece la pena repetir la orden una vez (el móvil estaba dormido, o Spotify la aceptó sin hacerla). */
const PLAY_RETRY = new Set(['shuffle', 'paused', 'idle', 'other', 'asleep', 'device']);

/**
 * Da la orden (reproducir desde la primera y apagar el aleatorio) y mira con GET /me/player si de verdad suena esta
 * playlist en orden. Devuelve 'ok', 'sent' (no se pudo comprobar) o el problema (ver player.js).
 */
async function startAndVerify(playlistId, device) {
  try {
    await S.api.play(playlistId, device.id);
    await S.api.setShuffle(false, device.id);
  } catch (e) {
    const problem = playProblem(e);
    if (problem) return problem;
    throw e;
  }
  await wait(VERIFY_DELAY_MS);
  try {
    return checkPlayback(await S.api.getPlayer(), playlistId);
  } catch (e) {
    if (isQuota(e)) throw e;
    return 'sent';
  }
}

/** Mensaje claro de lo que ha pasado al reproducir, con la acción que lo arregla («Abrir en Spotify», «Volver a intentar»). */
function showPlayOutcome(info, outcome, { device, playlistId, again }) {
  const open = h('a', { class: 'btn', href: spotifyUrl(playlistId), target: '_blank', rel: 'noopener', id: 'play-open' }, t('openInSpotify'));
  const retry = h('button', { class: 'btn primary', type: 'button', id: 'play-again', onclick: again }, t('playAgain'));
  const name = device?.name ?? '';
  const msg = {
    ok: t('playOk', { device: name }), sent: t('playSent', { device: name }),
    none: t('playNoDevice'), device: t('playNoDevice'), asleep: t('playAsleep', { device: name || 'Spotify' }),
    restricted: t('playRestricted'), premium: t('playPremium'), forbidden: t('playForbidden'),
    shuffle: t('playShuffleOn', { device: name }), paused: t('playNotStarted'), idle: t('playNotStarted'), other: t('playNotStarted'),
  }[outcome] ?? t('playNotStarted');
  const ok = outcome === 'ok' || outcome === 'sent';
  const canRetry = ['none', 'device', 'asleep', 'paused', 'idle', 'other'].includes(outcome);
  setKids(info,
    h('p', { class: ok ? 'play-ok' : 'play-warn', id: 'play-msg' }, msg),
    ok ? null : h('div', { class: 'actions' }, canRetry ? retry : null, open));
}

async function playNow(playlistId, info, status) {
  setKids(info);
  const again = () => playNow(playlistId, info, status);
  await task(status, async () => {
    status.phase('devices');
    const pick = pickDevice(await S.api.getDevices());
    if (pick.problem) { status.clear(); showPlayOutcome(info, pick.problem, { playlistId, again }); return; }
    const device = pick.device ?? await chooseDevice(pick.choose);
    if (!device) { status.clear(); return; }
    status.phase('starting');
    let outcome = await startAndVerify(playlistId, device);
    if (PLAY_RETRY.has(outcome)) outcome = await startAndVerify(playlistId, device);
    status.clear();
    showPlayOutcome(info, outcome, { device, playlistId, again });
  }, 'play');
}

// ---------- Resultado compartido ----------

/** «1 h 23 min» o «45 min». */
function formatDuration(ms) {
  const min = Math.max(0, Math.round(ms / MINUTE));
  return min >= 60 ? t('durationHours', { h: Math.floor(min / 60), m: min % 60 }) : t('minutesShort', { n: min });
}

/**
 * Hueco de carátula de 48 px: siempre ocupa lo mismo (nada salta al cargar). Dentro, la imagen que ya trae la respuesta
 * de Spotify, entera (sin recortar, deformar ni nada encima) y en diferido; si no hay o falla, queda el hueco con ♪.
 */
function coverSlot(url) {
  const slot = h('span', { class: 'cover-slot', 'aria-hidden': 'true' }, h('span', { class: 'cover-note' }, '♪'));
  if (typeof url === 'string' && url.startsWith('https://')) {
    const img = h('img', { class: 'track-cover', src: url, alt: '', loading: 'lazy', decoding: 'async', width: '48', height: '48' });
    img.addEventListener('error', () => img.remove(), { once: true });
    slot.append(img);
  }
  return slot;
}

/** Fila común de canción (o álbum, o artista): carátula, título y debajo artistas u otro dato. */
function trackRow(tr, i = 0, { extra = null } = {}) {
  return h('li', { class: 'track', style: `--i:${Math.min(i, 12)}` },
    coverSlot(tr.thumb),
    h('span', { class: 'track-text' }, h('span', { class: 'track-name' }, tr.name), h('span', { class: 'track-artist' }, tr.sub ?? artistsOf(tr))),
    extra);
}

const RESULT_ROWS = 30;

/**
 * Deslizar una fila hacia la izquierda (o tocar su ×) la quita de la lista. `onRemove(tr)` hace el resto.
 * Solo se mueve la propia fila con transform (sin tocar el layout hasta que se va): fluido en el iPhone.
 */
function makeRemovable(li, tr, onRemove) {
  const btn = h('button', { class: 'track-remove', type: 'button', 'aria-label': t('removeSong', { name: tr.name }), onclick: () => go() }, '×');
  li.append(btn);
  li.classList.add('removable');
  let x0 = null;
  let y0 = 0;
  let dx = 0;
  const go = () => {
    if (li.classList.contains('gone')) return;
    if (S.busy) { li.style.transform = ''; return; }
    li.classList.add('gone');
    onRemove(tr);
    if (prefersReducedMotion()) li.remove(); else setTimeout(() => li.remove(), 220);
  };
  li.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; li.style.transition = 'none'; }, { passive: true });
  li.addEventListener('touchmove', (e) => {
    if (x0 === null) return;
    const p = e.touches[0];
    // Si el dedo va más en vertical, es scroll: la fila no se mueve.
    if (Math.abs(p.clientY - y0) > Math.abs(p.clientX - x0)) { dx = 0; li.style.transform = ''; return; }
    dx = Math.min(0, p.clientX - x0);
    li.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  li.addEventListener('touchend', () => {
    li.style.transition = '';
    if (dx < -90) go(); else li.style.transform = '';
    x0 = null;
  }, { passive: true });
}

/**
 * Resultado común: arriba el nombre de la playlist, canciones y duración, «▶ Reproducir ahora» y «Abrir en Spotify»;
 * después avisos, la lista con carátulas y el resto de acciones. `kicker`: línea corta encima del nombre («Listo»).
 */
function renderResult(container, status, o) {
  const undoBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => task(status, async () => {
    if (await applyUndo(status, o.playlistId)) { status.say(t('undone')); undoBtn.hidden = true; }
  }) }, t('undo'));
  const sync = () => { const u = getItem(KEYS.undo); undoBtn.hidden = !(u && u.playlistId === o.playlistId); };
  sync();
  const info = h('div', { class: 'play-info', role: 'status' });
  const name = o.name ?? S.raw.find((p) => p.id === o.playlistId)?.name ?? '';
  let tracks = [...o.tracks];
  const meta = h('p', { class: 'result-meta', id: 'result-meta' });
  const moreNote = h('p', { class: 'muted small', id: 'more-tracks' });
  const syncMeta = () => {
    meta.textContent = t('resultMeta', { n: fmt(tracks.length), dur: formatDuration(tracks.reduce((n, tr) => n + (tr.durationMs || 0), 0)) });
    moreNote.textContent = tracks.length > RESULT_ROWS ? t('moreTracks', { n: fmt(tracks.length - RESULT_ROWS) }) : '';
    moreNote.hidden = tracks.length <= RESULT_ROWS;
  };
  syncMeta();

  // Quitar canciones (solo en playlists de Shuffl): se guarda en Spotify un momento después del último gesto, de una vez.
  container.cancelPending?.();
  let saveTimer = null;
  let pending = false;
  let rev = 0;
  /** Guarda lo quitado. «Pendiente» solo se limpia cuando Spotify lo ha guardado entero: si falla, «Reintentar» lo repite. */
  const writeRemovals = async () => {
    clearTimeout(saveTimer);
    if (!pending) return;
    const v = ++rev;
    const uris = tracks.map((x) => x.uri);
    if (!uris.length) throw new UserError(t('errEmpty'), 'errEmpty');
    status.phase('saving');
    await withWriteLock(async () => {
      await assertStillAppPlaylist(o.playlistId);
      await overwritePlaylist(o.playlistId, uris, status);
    });
    if (rev === v) pending = false;
  };
  const saveRemovals = () => {
    if (S.busy) { saveTimer = setTimeout(saveRemovals, 800); return; }
    task(status, async () => { await writeRemovals(); status.say(t('removedSaved')); }, 'remove');
  };
  const back = () => {
    if (!pending) { o.onBack?.(); return; }
    clearTimeout(saveTimer);
    task(status, writeRemovals, 'remove').then(() => { if (!pending) o.onBack?.(); });
  };
  const onRemove = (tr) => {
    tracks = tracks.filter((x) => x !== tr);
    o.onTracks?.(tracks, tr);
    syncMeta();
    pending = true;
    rev++;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveRemovals, 1200);
  };
  const rows = o.tracks.slice(0, RESULT_ROWS).map((tr, i) => {
    const li = trackRow(tr, i);
    if (o.editable) makeRemovable(li, tr, onRemove);
    return li;
  });

  setKids(container,
    h('header', { class: 'result-head' },
      h('p', { class: 'result-kicker' }, o.kicker ?? o.title ?? t('resultDone')),
      h('h2', { class: 'result-title', id: 'result-playlist' }, name),
      meta,
      h('div', { class: 'result-main' },
        h('button', { class: 'btn primary', type: 'button', id: 'play-now', onclick: () => playNow(o.playlistId, info, status) }, t('playNow')),
        h('a', { class: 'btn', href: spotifyUrl(o.playlistId), target: '_blank', rel: 'noopener', id: 'open-spotify' }, t('openInSpotify'))),
      o.headExtra ?? null,
      info),
    ...o.notes.map((n) => h('p', { class: 'note' }, n)),
    o.editable ? h('p', { class: 'muted small', id: 'swipe-hint' }, t(o.reshuffle ? 'swipeHintPull' : 'swipeHint')) : null,
    h('ol', { class: 'tracks', 'aria-label': t('preview') }, rows),
    moreNote,
    spotifyAttribution(spotifyUrl(o.playlistId)),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', id: 'share-link', onclick: () => shareLink(o.playlistId, info) }, t('share')),
      ...(o.extra ?? []),
      undoBtn,
      h('button', { class: 'btn', type: 'button', onclick: () => back() }, t('back'))),
  );
  container.playNow = () => playNow(o.playlistId, info, status);
  // Tirar hacia abajo en el resultado rebaraja (si la pantalla lo permite); fuera del resultado, refresca las playlists.
  container.pullAction = o.reshuffle ?? null;
  container.lastOptions = o;
  container.cancelPending = () => { clearTimeout(saveTimer); pending = false; };
  /** Para usar dentro de otra tarea (p. ej. «Buscar más») antes de escribir en la misma playlist. */
  container.flushPending = writeRemovals;
  container.hidden = false;
  window.scrollTo(0, 0);
  if (o.tint !== false) tintFrom(o.tintUrl ?? tracks.find((x) => x.thumb)?.thumb);
  celebrate(container);
  return sync;
}

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * Web Locks: si dos pestañas (por ejemplo, dos órdenes de Siri seguidas) barajan a la vez, escriben una detrás de otra.
 * Espera como mucho 30 s: iOS congela pestañas en segundo plano y una podría no soltar nunca el candado.
 */
async function withWriteLock(fn) {
  if (!navigator.locks) return fn();
  try {
    return await navigator.locks.request('shuffl-write', { signal: AbortSignal.timeout(30000) }, fn);
  } catch (e) {
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw new UserError(t('errOtherTab'), 'errOtherTab');
    throw e;
  }
}
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Celebración discreta al terminar: unos naipes lima que caen y se desvanecen (nada con movimiento reducido). */
function celebrate(container) {
  if (prefersReducedMotion()) return;
  const burst = h('div', { class: 'confetti', 'aria-hidden': 'true' },
    Array.from({ length: 14 }, (_, i) => h('span', { style: `--x:${(i * 37) % 100}%;--r:${(i * 53) % 90 - 45}deg;--d:${(i % 5) * 60}ms` })));
  // Debajo de la cabecera: los naipes no caen sobre «Reproducir ahora».
  const head = container.querySelector('.result-head');
  if (head) head.after(burst); else container.prepend(burst);
  setTimeout(() => burst.remove(), 1600);
}

// ---------- Agitar para barajar ----------

const shakeEnabled = () => getItem(KEYS.shake) !== false;
/** En iOS el permiso del acelerómetro solo se puede pedir tras un toque. */
const motionNeedsPermission = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
const SHAKE = { granted: false, tried: false, listening: false, feed: createShakeDetector() };

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || !SHAKE.feed(a.x, a.y, a.z, e.timeStamp)) return;
  if (S.tab === 'home' && !S.busy && shakeEnabled()) S.shakeShuffle?.();
}

function syncShake() {
  const want = typeof DeviceMotionEvent !== 'undefined' && shakeEnabled() && (!motionNeedsPermission() || SHAKE.granted);
  if (want && !SHAKE.listening) window.addEventListener('devicemotion', onMotion);
  if (!want && SHAKE.listening) window.removeEventListener('devicemotion', onMotion);
  SHAKE.listening = want;
}

async function requestMotion() {
  try {
    SHAKE.granted = (await DeviceMotionEvent.requestPermission()) === 'granted';
  } catch {
    SHAKE.granted = false;
  }
  syncShake();
  return SHAKE.granted;
}

const coverEnabled = () => getItem(KEYS.cover) !== false;

const skipNotes = (s) => (skippedCount(s) ? [t('skipped', { n: fmt(skippedCount(s)) })] : []);

/** La portada nunca hace fallar la baraja: si algo va mal solo devuelve un aviso. */
async function uploadCover(playlistId, title) {
  if (!coverEnabled()) return [];
  try {
    await S.api.setPlaylistImage(playlistId, await makeCover({ title, label: `SHUFFLE · ${nowLabel()}` }));
    return [];
  } catch (e) {
    console.warn('Portada no subida:', e?.status ?? e?.message);
    return [t('coverFailed')];
  }
}

/** Grupo de opciones excluyentes con aspecto de pastillas (radios nativos: teclado y lector de pantalla gratis). */
function segmented(name, label, options, onChange) {
  const inputs = new Map();
  const el = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label, id: name },
    options.map(([value, text], i) => {
      const input = h('input', { type: 'radio', name, value, id: `${name}-${value}`, onchange: () => onChange?.(value) });
      if (i === 0) input.checked = true;
      inputs.set(value, input);
      return h('label', { class: 'seg', for: `${name}-${value}` }, input, h('span', {}, text));
    }));
  return {
    el,
    get value() { return [...inputs.values()].find((i) => i.checked)?.value ?? options[0][0]; },
    set(value) { const i = inputs.get(value); if (i) i.checked = true; },
  };
}

// ---------- Álbumes ----------

/** Lo que se guarda de un álbum: sus imágenes con tamaño (para elegir la miniatura) y su fecha. */
const albumInfo = (a) => ({
  id: a.id, name: a.name ?? '', release_date: a.release_date ?? '', release_date_precision: a.release_date_precision ?? '', album_type: a.album_type ?? '',
  images: (Array.isArray(a.images) ? a.images : []).filter((i) => typeof i?.url === 'string').map(({ url, width, height }) => ({ url, width, height })),
});

/** Canciones completas de un álbum (las devuelve sin datos del álbum: se los añadimos). */
async function albumTracks(album) {
  const items = await cached(`album:${album.id}`, async () => (await S.api.getAlbumTracks(album.id))
    .map((tr) => ({ id: tr.id, uri: tr.uri, name: tr.name, type: 'track', artists: (tr.artists ?? []).map((x) => ({ id: x.id, name: x.name })), duration_ms: tr.duration_ms, explicit: tr.explicit, disc_number: tr.disc_number, track_number: tr.track_number, is_local: tr.is_local })), LONG_TTL_MS);
  return normalizeEntries(items.map((tr) => ({ track: { ...tr, album: albumInfo(album) } }))).tracks;
}

// ---------- Barajar ----------

function shufflePanel() {
  const status = createStatus({ loader: true });
  const result = h('div', { class: 'result', hidden: true });
  const dedupe = h('input', { type: 'checkbox', id: 'sh-dedupe', checked: true });
  const radios = {};
  const mkRadio = (value, label, hint) => {
    const input = h('input', { type: 'radio', name: 'sh-dest', value });
    radios[value] = input;
    return h('label', { class: 'choice' }, input, h('span', {}, h('strong', {}, label), h('small', {}, hint)));
  };
  const destBox = h('div', { class: 'choices' },
    mkRadio('reuse', t('destReuse'), t('destReuseHint')), mkRadio('self', t('destSelf'), t('destSelfHint')));
  radios.reuse.checked = true;
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'shuffle-go', disabled: true, onclick: () => run() }, t('shuffleBtn'));

  // Toda la playlist o por tiempo (v1.3.2: a la vista, junto al botón). Por tiempo: accesos rápidos o personalizado.
  const kindSel = segmented('sh-kind', t('kindLabel'), [['songs', t('kindAll')], ['time', t('kindTime')]], () => syncTime());
  let preset = 'gym';
  const presetBtns = new Map();
  const presetBtn = (key, emoji, label, sub) => {
    const b = h('button', { type: 'button', class: 'preset', id: `sh-preset-${key}`, 'aria-pressed': 'false', onclick: () => { preset = key; syncTime(); } },
      h('span', { class: 'preset-emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'preset-name' }, label), sub ? h('span', { class: 'preset-min' }, sub) : null);
    presetBtns.set(key, b);
    return b;
  };
  const slider = h('input', { type: 'range', id: 'sh-slider', min: String(MIN_MINUTES), max: String(SLIDER_MAX), step: '5', value: '45', 'aria-label': t('timeCustomLabel'), oninput: () => syncTime() });
  const sliderOut = h('output', { id: 'sh-slider-out', for: 'sh-slider' });
  const customBox = h('label', { class: 'slider-box', id: 'sh-custom', hidden: true }, h('span', { class: 'slider-head' }, t('timeCustomLabel'), sliderOut), slider);
  const timeBox = h('div', { id: 'time-box', hidden: true },
    h('div', { class: 'presets', role: 'group', 'aria-label': t('presetsLabel') },
      TIME_PRESETS.map((p) => presetBtn(p.key, p.emoji, t(`preset_${p.key}`), t('minutesShort', { n: p.minutes }))),
      presetBtn('custom', '⏱️', t('timeCustom'), '')),
    customBox,
    h('p', { class: 'muted small' }, t('timeHint')));
  const isTime = () => kindSel.value === 'time';
  const readPreset = () => (isTime() && preset !== 'custom' && presetByKey(preset) ? preset : null);
  const readMinutes = () => (!isTime() ? null : readPreset() ? presetByKey(preset).minutes : sanitizeMinutes(Number(slider.value)));
  function syncTime() {
    timeBox.hidden = !isTime();
    for (const [key, b] of presetBtns) b.setAttribute('aria-pressed', String(key === preset));
    customBox.hidden = preset !== 'custom';
    sliderOut.textContent = t('minutesShort', { n: slider.value });
    go.textContent = isTime() && readMinutes() ? t('shuffleTimeBtn', { n: readMinutes() }) : t('shuffleBtn');
    syncDestination();
  }

  // Filtros (se aplican antes de barajar; el barajado sigue siendo uniforme sobre lo que queda)
  const fields = {};
  const field = (key, label, props) => {
    fields[key] = h('input', { class: 'text', id: `f-${key}`, ...props });
    fields[key].addEventListener('input', onFilterChange);
    return h('label', {}, label, fields[key]);
  };
  fields.explicit = h('select', { id: 'f-explicit', onchange: () => onFilterChange() },
    EXPLICIT_MODES.map((k) => h('option', { value: k }, t(`explicit_${k}`))));
  const countEl = h('p', { class: 'muted', id: 'filter-count', role: 'status', 'aria-live': 'polite' });
  const filtersBox = h('details', { class: 'more', id: 'filters-box', ontoggle: () => { if (filtersBox.open) refreshCount(); } },
    h('summary', {}, t('filters')),
    h('div', { class: 'dates' },
      field('yearFrom', t('yearFrom'), { type: 'number', inputmode: 'numeric', min: '1900', max: '2100' }),
      field('yearTo', t('yearTo'), { type: 'number', inputmode: 'numeric', min: '1900', max: '2100' }),
      field('addedFrom', t('addedFrom'), { type: 'date' }),
      field('addedTo', t('addedTo'), { type: 'date' }),
      field('minMin', t('minMinutes'), { type: 'number', inputmode: 'decimal', min: '0', step: '0.5' }),
      field('maxMin', t('maxMinutes'), { type: 'number', inputmode: 'decimal', min: '0', step: '0.5' })),
    h('label', { class: 'field-wide' }, t('explicitLabel'), fields.explicit),
    countEl);
  const readFilters = () => sanitizeFilters(Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.value])));
  const setFilters = (f) => { for (const [k, el] of Object.entries(fields)) el.value = f[k] ?? ''; };

  // Origen: toda la biblioteca, resumen y contador
  let libraryMode = false;
  let programmatic = false;
  const libraryIds = () => S.playlists.filter((p) => !baseReason(p)).map((p) => p.id);
  const selInfo = h('p', { class: 'muted', id: 'selection-info', role: 'status' });
  const libBtn = h('button', { class: 'btn shortcut', type: 'button', id: 'select-library', onclick: () => {
    libraryMode = true;
    programmatic = true;
    picker.setSelected(libraryIds());
    programmatic = false;
    syncSelection(picker.getSelected());
  } }, t('selectLibrary'));

  let countTimer = null;
  let countToken = 0;
  function onFilterChange() {
    syncDestination();
    clearTimeout(countTimer);
    countTimer = setTimeout(refreshCount, 250);
  }
  async function refreshCount() {
    const token = ++countToken;
    const sel = picker.getSelected();
    if (!filtersBox.open || !sel.length) { countEl.textContent = ''; return; }
    countEl.textContent = t('counting');
    try {
      const tracks = [];
      for (const pl of sel) {
        const key = `${pl.id}:${pl.total}`;
        if (!S.sourceCache.has(key)) S.sourceCache.set(key, readSource(pl, null, { useCache: true }).then((r) => r.tracks));
        tracks.push(...await S.sourceCache.get(key));
      }
      if (token !== countToken) return;
      const base = dedupe.checked ? uniqueByUri(tracks) : tracks;
      countEl.textContent = t('filterCount', { n: fmt(filterTracks(base, readFilters()).length), m: fmt(base.length) });
    } catch (e) {
      S.sourceCache.clear();
      if (token === countToken) countEl.textContent = t('countFailed');
    }
  }
  function syncDestination() {
    const sel = picker.getSelected();
    const selfOk = !isTime() && !libraryMode && sel.length === 1 && sel[0].owned && !sel[0].isLiked && !hasFilters(readFilters());
    radios.self.disabled = !selfOk;
    if (!selfOk && radios.self.checked) radios.reuse.checked = true;
  }
  function syncSelection(sel) {
    go.disabled = sel.length === 0;
    saveMixBtn.disabled = sel.length === 0;
    const songs = sel.reduce((n, p) => n + (p.total ?? 0), 0);
    const unreadable = S.playlists.filter((p) => !p.isLiked && !p.readable).length;
    setKids(selInfo, sel.length ? t('selectionSummary', { n: fmt(sel.length), m: fmt(songs) }) : '',
      libraryMode && unreadable ? ` ${t('librarySkipped', { n: fmt(unreadable) })}` : '');
    syncDestination();
    refreshCount();
  }

  const picker = createPicker({
    multi: true,
    disabledReason: baseReason,
    onChange(sel) {
      if (!programmatic) libraryMode = false;
      syncSelection(sel);
    },
  });
  dedupe.addEventListener('change', refreshCount);

  // Mezclas guardadas
  let editingId = null;
  const saveMixBtn = h('button', { class: 'btn', type: 'button', id: 'save-mix', disabled: true, onclick: () => saveMix() }, t('saveMix'));
  const cancelEditBtn = h('button', { class: 'btn', type: 'button', id: 'cancel-edit-mix', hidden: true, onclick: () => setEditing(null) }, t('cancelEdit'));
  function setEditing(mix) {
    editingId = mix?.id ?? null;
    saveMixBtn.textContent = mix ? t('mixUpdate', { name: mix.name }) : t('saveMix');
    cancelEditBtn.hidden = !mix;
    if (mix) moreBox.open = true;
  }
  const currentConfig = () => {
    const sel = picker.getSelected();
    const minutes = readMinutes();
    return {
      library: libraryMode, ids: sel.map((p) => p.id), names: sel.map((p) => p.name), filters: readFilters(), dedupe: dedupe.checked, mode: dest(),
      kind: minutes ? 'time' : 'songs', ...(minutes ? { minutes } : {}), ...(readPreset() ? { preset: readPreset() } : {}),
    };
  };
  async function saveMix() {
    const cfg = currentConfig();
    const existing = getMixes().find((m) => m.id === editingId);
    const name = await askName({ title: t('mixName'), value: existing?.name ?? (libraryMode ? t('libraryName') : cfg.names.join(' + ')).slice(0, 60) });
    if (!name) return;
    const mix = sanitizeMix({ ...cfg, id: editingId ?? newMixId(), name });
    const { list, ok } = upsertMix(getMixes(), mix);
    if (!ok) { status.fail(new UserError(t('errMixLimit'), 'errMixLimit')); return; }
    setMixes(list);
    setEditing(null);
    status.say(t('mixSaved', { name: mix.name }));
  }

  // Enlace de una playlist pública o de otra persona: solo metadatos y la guía de copia
  const linkIn = h('input', { type: 'text', class: 'text', id: 'link-input', placeholder: t('linkPlaceholder'), 'aria-label': t('linkTitle'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const linkMsg = h('p', { class: 'muted', id: 'link-msg', role: 'status' });
  async function checkLink() {
    linkMsg.textContent = '';
    const id = parsePlaylistRef(linkIn.value);
    if (!id) { linkMsg.textContent = t('linkInvalid'); return; }
    const known = S.playlists.find((p) => p.id === id);
    if (known?.readable) { linkMsg.textContent = t('linkOwn', { name: known.name }); return; }
    let meta = null;
    await task(status, async () => {
      try {
        meta = await S.api.getPlaylistMeta(id);
      } catch (e) {
        if (!(e instanceof ApiError) || ![403, 404].includes(e.status)) throw e;
        linkMsg.textContent = t('linkNotFound');
      }
    });
    if (!meta) return;
    if (meta.owner?.id === S.me.id || meta.collaborative) { linkMsg.textContent = t('linkOwn', { name: meta.name }); return; }
    const images = meta.images ?? [];
    showFollowedHelp({
      id, name: meta.name ?? '', owner: meta.owner?.display_name ?? meta.owner?.id ?? '',
      image: images.length ? images[images.length - 1].url : '',
      hasCopy: S.playlists.find((p) => p.copyOf !== undefined && p.copyOf === meta.name)?.name,
    });
  }
  const linkBox = h('details', { class: 'more', id: 'link-box' },
    h('summary', {}, t('linkTitle')), h('p', { class: 'muted small' }, t('linkLead')), linkIn,
    h('button', { class: 'btn', type: 'button', id: 'link-check', onclick: () => checkLink() }, t('linkCheck')), linkMsg);

  const sourceBox = h('div', {}, h('h2', {}, t('source')), libBtn, picker.el, selInfo);
  const kindBox = h('div', { class: 'kind-box' }, h('h2', {}, t('kindTitle')), kindSel.el, timeBox);
  const moreBox = h('details', { class: 'more', id: 'shuffle-more' },
    h('summary', {}, t('moreOptions')),
    h('label', { class: 'check' }, dedupe, h('span', {}, t('dedupeOpt'))),
    filtersBox,
    h('h2', {}, t('destination')), destBox,
    linkBox,
    h('div', { class: 'actions' }, saveMixBtn, cancelEditBtn));
  const form = h('div', {},
    h('h2', { class: 'tool-title' }, t('tabShuffle')),
    h('p', { class: 'lead' }, t('shuffleLead')),
    sourceBox, kindBox, go, moreBox);
  const rouletteCard = h('button', { class: 'card compact', type: 'button', id: 'card-roulette', onclick: () => S.show('roulette') },
    h('span', { class: 'card-icon' }, icon(...ICONS.roulette)),
    h('span', {}, h('span', { class: 'card-title' }, t('rouletteTitle')), h('span', { class: 'card-sub' }, t('cardRouletteSub'))));
  // Mientras se baraja, el formulario se oculta y queda la pantalla «Barajando…» con los naipes y el paso real.
  const working = h('h2', { class: 'tool-title', id: 'shuffle-working', hidden: true }, t('working'));
  const showForm = () => { result.hidden = true; working.hidden = true; form.hidden = false; rouletteCard.hidden = false; };
  const back = h('button', { class: 'btn', type: 'button', id: 'working-back', hidden: true, onclick: () => { status.clear(); back.hidden = true; showForm(); } }, t('back'));

  let last = null;

  /** Carga una mezcla en el formulario. Devuelve si todas sus playlists siguen disponibles. */
  function applyMix(mix) {
    S.show('shuffle');
    showForm();
    const timed = mix.kind === 'time' && !!mix.minutes;
    kindSel.set(timed ? 'time' : 'songs');
    if (timed) {
      preset = presetByKey(mix.preset)?.minutes === mix.minutes ? mix.preset : 'custom';
      if (preset === 'custom') slider.value = String(Math.min(mix.minutes, SLIDER_MAX));
    }
    syncTime();
    const ids = mix.library ? libraryIds() : mix.ids;
    programmatic = true;
    const n = picker.setSelected(ids);
    programmatic = false;
    libraryMode = !!mix.library;
    setFilters(mix.filters ?? emptyFilters());
    if (hasFilters(mix.filters)) moreBox.open = true;
    if (hasFilters(mix.filters)) filtersBox.open = true;
    dedupe.checked = mix.dedupe !== false;
    syncSelection(picker.getSelected());
    if (radios[mix.mode] && !radios[mix.mode].disabled) radios[mix.mode].checked = true;
    return mix.library ? n > 0 : n === ids.length;
  }
  /** `origin.mixId`/`origin.mixName`: la mezcla guardada de la que viene, para nombrar su playlist. */
  S.runMix = (mix, origin = null, opts = {}) => {
    if (applyMix(mix)) return run(origin, opts);
    status.fail(new UserError(t('mixMissing'), 'mixMissing'));
    return Promise.resolve(null);
  };

  /**
   * Enlace profundo (Siri, Atajos): solo con sesión válida (lo garantiza boot) y si la mezcla o la playlist
   * existen en este dispositivo. Siempre crea una playlist de Shuffl, nunca escribe en el origen.
   * Sin la clave de este dispositivo (un enlace de otra web, o el atajo abierto en otro navegador) pide confirmación.
   */
  S.openDeepLink = async (link) => {
    S.show('shuffle');
    const trusted = !!link.key && link.key === getItem(KEYS.linkKey);
    let mix;
    let origin = null;
    if (link.kind === 'mix') {
      const saved = getMixes().find((m) => m.id === link.id);
      if (!saved) { status.fail(new UserError(t('deepLinkMixMissing'), 'deepLinkMixMissing')); return; }
      mix = saved;
      origin = mixOrigin(saved);
    } else {
      const pl = S.playlists.find((p) => p.id === link.id && !baseReason(p));
      if (!pl) { status.fail(new UserError(t('deepLinkSourceMissing'), 'deepLinkSourceMissing')); return; }
      mix = { name: pl.name, library: false, ids: [pl.id], filters: emptyFilters(), dedupe: true, mode: 'reuse' };
    }
    if (!trusted && !confirm(t(link.play ? 'deepLinkConfirmPlay' : 'deepLinkConfirm', { name: mix.name }))) {
      status.say(t('deepLinkCancelled'));
      return;
    }
    const written = await S.runMix(mix, origin, { modeOverride: 'reuse' });
    if (written && link.play) await result.playNow?.();
  };
  S.editMix = (mix) => {
    if (!applyMix(mix)) status.fail(new UserError(t('mixMissing'), 'mixMissing'));
    setEditing(mix);
  };

  const dest = () => Object.values(radios).find((r) => r.checked).value;

  /** Texto grande de la portada: el origen sin el sufijo. */
  const coverTitle = (sel, origin) => origin?.mixName || (origin?.library ? t('allMyMusic')
    : sel.length === 1 ? (sel[0].isLiked ? t('liked') : sel[0].name) : 'Mix');

  /** Orden final: Fisher-Yates; con tiempo, barajar y llenar la duración. */
  function arrange(base, minutes) {
    if (minutes) {
      const fit = fitDuration(base, minutes);
      if (!fit.tracks.length) throw new UserError(t('errTimeEmpty'), 'errTimeEmpty');
      return { order: fit.tracks, truncated: 0, notes: fit.reached ? [] : [t('timeShort', { got: fmt(Math.round(fit.totalMs / MINUTE)), m: fmt(minutes) })] };
    }
    const capped = capPlaylist(shuffle(base));
    return { order: capped.tracks, truncated: capped.truncated, notes: [] };
  }

  function showResult(info) {
    form.hidden = true;
    working.hidden = true;
    back.hidden = true;
    rouletteCard.hidden = false;
    last = info;
    const notes = [...(info.purgeNotes ?? []), ...skipNotes(info.skipped), ...(info.kindNotes ?? []), ...(info.coverNotes ?? [])];
    if (info.dedupRemoved) notes.push(t('dedupRemoved', { n: fmt(info.dedupRemoved) }));
    if (info.filteredOut) notes.push(t('filteredOut', { n: fmt(info.filteredOut) }));
    if (info.truncated) notes.push(t('truncated', { n: fmt(info.truncated) }));
    const app = info.mode !== 'self';
    renderResult(result, status, {
      name: info.name, notes, tracks: info.order, playlistId: info.playlistId,
      kicker: info.minutes ? t('timeKicker', { n: info.minutes }) : null,
      headExtra: h('button', { class: 'btn reshuffle', type: 'button', id: 'reshuffle', onclick: () => reshuffle() },
        icon(...ICONS.shuffle), h('span', {}, t('reshuffle'))),
      extra: [h('button', { class: 'btn', type: 'button', id: 'open-pin-result', onclick: () => S.show('pin') }, t('pinTitle'))],
      // Quitar canciones deslizando solo en la playlist de Shuffl, nunca en tu propia playlist.
      editable: app,
      onTracks: (list) => {
        const keep = new Set(list);
        last.removed = new Set([...(last.removed ?? []), ...info.order.filter((x) => !keep.has(x)).map((x) => x.uri)]);
        last.order = list;
      },
      reshuffle: () => reshuffle(),
      tintUrl: info.tintUrl,
      onBack: () => { status.clear(); showForm(); },
    });
  }

  /** Devuelve una promesa con el id de la playlist escrita (o null si no se barajó). */
  function run(fromMix = null, { modeOverride } = {}) {
    let written = null;
    if (S.busy) return Promise.resolve(null);
    // Respuesta inmediata: la pantalla de trabajo sale antes de la primera petición.
    form.hidden = true;
    result.hidden = true;
    rouletteCard.hidden = true;
    back.hidden = true;
    working.textContent = t('working');
    working.hidden = false;
    status.phase('reading');
    window.scrollTo(0, 0);
    return task(status, async () => {
      // Todo el formulario se lee antes de esperar a la red: si otra pantalla lo cambia a mitad, esta baraja no se ve afectada.
      const sel = picker.getSelected();
      const minutes = readMinutes();
      const origin = { mixId: fromMix?.mixId, mixName: fromMix?.mixName, library: libraryMode };
      const mode = minutes && (modeOverride ?? dest()) === 'self' ? 'reuse' : modeOverride ?? dest();
      const filters = readFilters();
      const doDedupe = dedupe.checked;
      const presetKey = readPreset();
      const config = { ...currentConfig(), mode, mixId: origin.mixId, at: new Date().toISOString() };
      if (isTime() && !minutes) throw new UserError(t('errMinutes', { min: MIN_MINUTES, max: SLIDER_MAX }), 'errMinutes');
      status.phase('reading');
      // Si una playlist no ha cambiado desde la última vez, no se vuelve a leer (cuota). Para escribir en ella misma, sí.
      const { tracks, skipped } = await readSources(sel, status, { useCache: mode !== 'self' });
      if (mode === 'self' && !confirmOverwrite(sel[0].name, skippedCount(skipped))) { status.clear(); showForm(); return; }
      status.phase('shuffling');
      const unique = doDedupe ? uniqueByUri(tracks) : tracks;
      const base = filterTracks(unique, filters);
      if (!base.length) throw hasFilters(filters) ? new UserError(t('errFiltersEmpty'), 'errFiltersEmpty') : new UserError(t('errEmpty'), 'errEmpty');
      const { order, truncated, notes: kindNotes } = arrange(base, minutes);
      const source = coverTitle(sel, origin);
      const presetLabel = presetKey ? t(`preset_${presetKey}`) : '';
      // «Gym 45 min · Shuffle» con un acceso rápido; «Rock · 45 min · Shuffle» si es personalizado.
      const name = minutes ? timeName({ minutes, presetLabel, base: source })
        : generatedName({ mixName: origin.mixName, library: origin.library, sources: sel }, nameLabels());
      const title = minutes ? (presetLabel ? `${presetLabel} ${t('minutesShort', { n: minutes })}` : `${source} · ${t('minutesShort', { n: minutes })}`) : source;
      const uris = order.map((x) => x.uri);
      const tintUrl = sel.length === 1 && !sel[0].isLiked ? sel[0].image : null;
      const finish = async (w, purgeNotes) => {
        const coverNotes = mode === 'self' ? [] : await uploadCover(w.id, title);
        setItem(KEYS.lastMix, config);
        written = w.id;
        // Solo al escribir en tu propia playlist cambia tu biblioteca: la de Shuffl no sale en los selectores.
        if (mode === 'self') await loadPlaylists();
        status.clear();
        showResult({
          base, order, skipped, truncated, dedupRemoved: tracks.length - unique.length, filteredOut: unique.length - base.length,
          playlistId: w.id, name: mode === 'self' ? sel[0].name : name, mode, coverNotes, kindNotes, purgeNotes, title, minutes, tintUrl,
        });
      };
      if (mode === 'self') {
        await withWriteLock(async () => {
          saveUndo(sel[0].id, sel[0].name, tracks.map((x) => x.uri));
          status.phase('saving');
          await overwritePlaylist(sel[0].id, uris, status);
        });
        await finish({ id: sel[0].id }, []);
        return;
      }
      const description = generatedDescription(t('shuffleDescFrom'), origin.library ? [t('allMyMusic')] : sel.map((p) => (p.isLiked ? t('liked') : p.name)));
      const key = sourceKey({ mixId: origin.mixId, library: origin.library, ids: sel.map((p) => p.id) });
      await commitApp({ key, name, description, uris, protect: sel.map((p) => p.id) }, status, (w) => finish(w, w.notes));
    }).then(() => {
      // Si no hubo resultado (error o cancelación), «Volver» lleva al formulario; el error y «Reintentar» siguen arriba.
      if (result.hidden && !working.hidden) {
        back.hidden = false;
        working.textContent = t('workingStopped');
      }
      return written;
    });
  }
  S.shuffleWith = run;

  /**
   * «Volver a barajar» (botón 🔀 o tirar hacia abajo) reordena la misma playlist sin crear otra. Las canciones que
   * quitaste no vuelven. En la playlist de Shuffl basta con comprobar que sigue siendo de Shuffl; en la tuya, además,
   * que nadie la ha cambiado desde que se leyó.
   */
  function reshuffle() {
    if (S.busy || !last) return;
    result.cancelPending?.();
    task(status, async () => {
      const base = last.removed?.size ? last.base.filter((x) => !last.removed.has(x.uri)) : last.base;
      const { order, truncated, notes: kindNotes } = arrange(base, last.minutes);
      await withWriteLock(async () => {
        if (last.mode !== 'self') {
          await assertStillAppPlaylist(last.playlistId);
          saveUndo(last.playlistId, '', last.order.map((x) => x.uri), { soft: true });
          await overwritePlaylist(last.playlistId, order.map((x) => x.uri), status);
        } else {
          await assertUnchanged(last.playlistId, last.order.length, last.order);
          saveUndo(last.playlistId, '', last.order.map((x) => x.uri), { soft: true });
          await overwritePlaylist(last.playlistId, order.map((x) => x.uri), status);
        }
      });
      status.clear();
      navigator.vibrate?.(20);
      showResult({ ...last, base, order, truncated, kindNotes, coverNotes: [], purgeNotes: [], removed: null });
    }, 'reshuffle');
  }

  syncTime();
  return h('section', { class: 'panel', id: 'panel-shuffle' }, working, status.el, back, form, result, rouletteCard);
}


// ---------- Ordenar ----------

function sortPanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const sortSel = h('select', { id: 'sort-key', 'aria-label': t('sortBy') }, SORT_KEYS.map((k) => h('option', { value: k }, t(`sort_${k}`))));
  const thenSelect = (id) => h('select', { id, 'aria-label': t('thenBy') }, h('option', { value: '' }, t('thenNone')), MULTI_KEYS.map((k) => h('option', { value: k }, t(`sort_${k}`))));
  const then1 = thenSelect('sort-then1');
  const then2 = thenSelect('sort-then2');
  const criteria = () => [sortSel.value, then1.value, then2.value].filter(Boolean);
  const criteriaLabel = () => criteria().map((k) => t(`sort_${k}`).toLowerCase()).join(' → ');
  const syncCriteria = () => {
    const multi = MULTI_KEYS.includes(sortSel.value);
    then1.disabled = !multi;
    if (!multi) then1.value = '';
    then2.disabled = !multi || !then1.value;
    if (then2.disabled) then2.value = '';
  };
  const from = h('input', { type: 'date', id: 'sort-from', 'aria-label': t('addedFrom') });
  const to = h('input', { type: 'date', id: 'sort-to', 'aria-label': t('addedTo') });
  const nameIn = h('input', { type: 'text', id: 'sort-name', class: 'text', maxlength: '100', 'aria-label': t('newName') });
  const rNew = h('input', { type: 'radio', name: 'sort-dest', value: 'new', checked: true });
  const rOver = h('input', { type: 'radio', name: 'sort-dest', value: 'over', disabled: true });
  const go = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => run() }, t('sortBtn'));
  let touched = false;

  const suggest = () => {
    if (touched) return;
    const sel = picker.getSelected()[0];
    nameIn.value = sel ? `${sel.name} (${criteriaLabel()})`.slice(0, 100) : '';
  };
  const refresh = () => {
    const sel = picker.getSelected();
    go.disabled = sel.length === 0;
    const overOk = sel.length === 1 && sel[0].owned && !sel[0].isLiked && !from.value && !to.value;
    rOver.disabled = !overOk;
    if (!overOk && rOver.checked) rNew.checked = true;
    suggest();
  };
  const picker = createPicker({ multi: false, disabledReason: baseReason, onChange: refresh });
  [from, to].forEach((el) => el.addEventListener('change', refresh));
  for (const el of [sortSel, then1, then2]) el.addEventListener('change', () => { syncCriteria(); suggest(); });
  syncCriteria();
  nameIn.addEventListener('input', () => { touched = true; });

  const likedShortcut = h('button', { class: 'btn shortcut', type: 'button', onclick: () => copyLiked() }, t('copyLikedShortcut'));
  const form = h('div', {},
    h('p', { class: 'lead' }, t('sortLead')), likedShortcut,
    h('h2', {}, t('source')), picker.el,
    h('h2', {}, t('sortBy')), sortSel,
    h('label', { class: 'field-wide' }, t('thenBy'), then1),
    h('label', { class: 'field-wide' }, t('thenBy'), then2),
    h('details', { class: 'more' }, h('summary', {}, t('dateFilter')),
      h('div', { class: 'dates' }, h('label', {}, t('addedFrom'), from), h('label', {}, t('addedTo'), to))),
    h('h2', {}, t('destination')),
    h('div', { class: 'choices' },
      h('label', { class: 'choice' }, rNew, h('span', {}, h('strong', {}, t('destNew')), nameIn)),
      h('label', { class: 'choice' }, rOver, h('span', {}, h('strong', {}, t('destOverwrite')), h('small', {}, t('destOverwriteHint'))))),
    go);

  const finish = (title, tracks, playlistId, skipped) => {
    form.hidden = true;
    renderResult(result, status, {
      title, notes: skipNotes(skipped), tracks, playlistId,
      onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
    });
  };

  function run() {
    task(status, async () => {
      const sel = picker.getSelected()[0];
      const overwrite = rOver.checked;
      const { tracks, skipped } = await readSources([sel], status);
      if (overwrite && !confirmOverwrite(sel.name, skippedCount(skipped))) { status.clear(); return; }
      const keys = criteria();
      if (new Set(keys).size !== keys.length) throw new UserError(t('sortDup'), 'sortDup');
      const filtered = filterByAdded(tracks, from.value, to.value);
      const sorted = keys.length === 1 ? sortTracks(filtered, keys[0]) : sortTracksBy(filtered, keys);
      if (!sorted.length) throw new UserError(t('errEmpty'), 'errEmpty');
      let playlistId;
      if (overwrite) {
        saveUndo(sel.id, sel.name, tracks.map((x) => x.uri));
        playlistId = sel.id;
        await overwritePlaylist(playlistId, sorted.map((x) => x.uri), status);
      } else {
        playlistId = (await S.api.createPlaylist(nameIn.value.trim() || sel.name, t('barajaDesc'))).id;
        await S.api.addItems(playlistId, sorted.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
      }
      await loadPlaylists();
      status.clear();
      finish(t('sortedDone', { n: fmt(sorted.length) }), sorted, playlistId, skipped);
    });
  }

  function copyLiked() {
    task(status, async () => {
      const liked = S.playlists.find((p) => p.isLiked);
      const { tracks, skipped } = await readSource(liked, (d, tot) => status.progress('reading', d, tot));
      if (!tracks.length) throw new UserError(t('errEmpty'), 'errEmpty');
      const id = (await S.api.createPlaylist(t('likedCopyName'), t('barajaDesc'))).id;
      await S.api.addItems(id, tracks.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
      await loadPlaylists();
      status.clear();
      finish(t('copiedDone', { n: fmt(tracks.length) }), tracks, id, skipped);
    });
  }

  return h('section', { class: 'panel', id: 'panel-sort', hidden: true }, backBar(), h('h2', { class: 'tool-title' }, t('tabSort')), form, result, status.el);
}

// ---------- Duplicados ----------

function dupsPanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const modeExact = h('input', { type: 'radio', name: 'dup-mode', value: 'exact' });
  const modeSmart = h('input', { type: 'radio', name: 'dup-mode', value: 'smart', checked: true });
  const analyze = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => scan() }, t('analyze'));
  const picker = createPicker({
    multi: false,
    disabledReason: (pl) => (pl.isLiked ? t('likedNoDup') : pl.readable ? '' : t('notReadable')),
    onChange: (sel) => { analyze.disabled = sel.length === 0; },
  });
  const form = h('div', {},
    h('p', { class: 'lead' }, t('dupsLead')),
    h('h2', {}, t('source')), picker.el,
    h('h2', {}, t('dupMode')),
    h('div', { class: 'choices' },
      h('label', { class: 'choice' }, modeExact, h('span', {}, h('strong', {}, t('modeExact')), h('small', {}, t('modeExactHint')))),
      h('label', { class: 'choice' }, modeSmart, h('span', {}, h('strong', {}, t('modeSmart')), h('small', {}, t('modeSmartHint'))))),
    analyze);

  const back = () => { result.hidden = true; form.hidden = false; status.clear(); };

  function scan() {
    task(status, async () => {
      const pl = picker.getSelected()[0];
      const { tracks, skipped } = await readSources([pl], status);
      const groups = findDuplicates(tracks, modeSmart.checked ? 'smart' : 'exact');
      status.clear();
      form.hidden = true;
      if (!groups.length) {
        setKids(result,h('h2', { class: 'result-title' }, t('noDups')), ...skipNotes(skipped).map((n) => h('p', { class: 'note' }, n)),
          h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: back }, t('back'))));
        result.hidden = false;
        return;
      }
      showGroups(pl, tracks, groups, skipped);
    });
  }

  function showGroups(pl, tracks, groups, skipped) {
    const boxes = [];
    const count = h('p', { class: 'note', 'aria-live': 'polite' });
    const items = groups.map((g) => h('li', { class: 'dup-group' },
      h('div', { class: 'dup-head track' }, coverSlot(g.keep.track.thumb),
        h('span', { class: 'track-text' }, h('strong', { class: 'track-name' }, g.keep.track.name), h('span', { class: 'track-artist' }, artistsOf(g.keep.track)))),
      h('p', { class: 'dup-keep' }, t('keeps', { pos: g.keep.index + 1 })),
      g.dupes.map((d) => {
        const box = h('input', { type: 'checkbox', 'data-index': String(d.index) });
        box.checked = true;
        box.addEventListener('change', update);
        boxes.push(box);
        return h('label', { class: 'check' }, box, h('span', {}, t('dupAt', { pos: d.index + 1 }), d.track.name !== g.keep.track.name ? ` · ${d.track.name}` : ''));
      })));
    const chosen = () => boxes.filter((b) => b.checked).map((b) => Number(b.dataset.index));
    function update() {
      const n = chosen().length;
      count.textContent = t('dupSelected', { n: fmt(n), g: fmt(groups.length) });
      removeBtn.disabled = copyBtn.disabled = n === 0;
    }
    const removeBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => remove() }, t('removeFromOriginal'));
    const copyBtn = h('button', { class: 'btn', type: 'button', onclick: () => clean() }, t('makeCleanCopy'));

    const finishWith = (title, remaining, playlistId) => renderResult(result, status, {
      title, notes: skipNotes(skipped), tracks: remaining, playlistId, onBack: back,
    });

    function remove() {
      if (!confirmOverwrite(pl.name, skippedCount(skipped))) return;
      task(status, async () => {
        await assertUnchanged(pl.id, tracks.length + skippedCount(skipped), tracks);
        const remaining = removeIndexes(tracks, chosen());
        saveUndo(pl.id, pl.name, tracks.map((x) => x.uri));
        await overwritePlaylist(pl.id, remaining.map((x) => x.uri), status);
        await loadPlaylists();
        status.clear();
        finishWith(t('dupsRemoved', { n: fmt(tracks.length - remaining.length) }), remaining, pl.id);
      });
    }

    function clean() {
      task(status, async () => {
        const remaining = removeIndexes(tracks, chosen());
        const id = (await S.api.createPlaylist(`${pl.name} (${t('cleanSuffix')})`, t('barajaDesc'))).id;
        await S.api.addItems(id, remaining.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
        await loadPlaylists();
        status.clear();
        finishWith(t('cleanDone', { n: fmt(remaining.length) }), remaining, id);
      });
    }

    setKids(result,
      h('h2', { class: 'result-title' }, t('dupsFound', { n: fmt(groups.length) })),
      h('ul', { class: 'dup-list' }, items), spotifyAttribution(spotifyUrl(pl.id)), count,
      h('div', { class: 'actions' }, removeBtn, copyBtn, h('button', { class: 'btn', type: 'button', onclick: back }, t('back'))));
    result.hidden = false;
    update();
  }

  return h('section', { class: 'panel', id: 'panel-dups', hidden: true }, backBar(), h('h2', { class: 'tool-title' }, t('tabDups')), form, result, status.el);
}

// ---------- Más herramientas: instantáneas, Me gusta sin playlist y dividir ----------

const SNAPS = [
  ['top_short', 'snapTop4w', 'short_term'], ['top_medium', 'snapTop6m', 'medium_term'],
  ['top_long', 'snapTopAll', 'long_term'], ['recent', 'snapRecent', null],
];


function toolPanel(id, title, lead, status, ...body) {
  return h('section', { class: 'panel', id, hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, title), h('p', { class: 'lead' }, lead), ...body, status.el);
}

/** «‹ Más», «‹ Descubrir»…: vuelve a la pantalla de la que se vino (o a su pestaña). */
function backBar(id) {
  const label = h('span', {});
  const btn = h('button', { class: 'back-link', type: 'button', id, onclick: () => S.back() }, h('span', { 'aria-hidden': 'true' }, '‹ '), label);
  btn.sync = () => { label.textContent = t('backTo', { name: t(TAB_LABEL[S.backTarget()] ?? 'tabHome') }); };
  BACK_BARS.add(btn);
  return btn;
}
const BACK_BARS = new Set();

function snapPanel() {
  const status = createStatus({ loader: true });
  const result = h('div', { class: 'result', hidden: true });
  const radios = SNAPS.map(([key, label]) => ({ key, input: h('input', { type: 'radio', name: 'snap-kind', value: key, id: `snap-${key}` }), label }));
  radios[0].input.checked = true;
  const shuffleBox = h('input', { type: 'checkbox', id: 'snap-shuffle' });
  const form = h('div', {},
    h('div', { class: 'choices' }, radios.map(({ input, label }) => h('label', { class: 'choice' }, input, h('span', {}, h('strong', {}, t(label)))))),
    h('label', { class: 'check' }, shuffleBox, h('span', {}, t('snapShuffle'))),
    h('button', { class: 'btn primary big', type: 'button', id: 'snap-go', onclick: () => run() }, t('snapBtn')));

  /** Como cualquier playlist de Shuffl: se borran las anteriores y se crea la instantánea nueva. */
  function run() {
    task(status, async () => {
      const [kind, labelKey, range] = SNAPS.find(([k]) => radios.find((r) => r.key === k).input.checked);
      status.phase('reading');
      const entries = range ? (await S.api.getTopTracks(range)).map((track) => ({ track })) : await S.api.getRecentlyPlayed();
      const tracks = uniqueByUri(normalizeEntries(entries).tracks);
      if (!tracks.length) throw new UserError(t('errEmpty'), 'errEmpty');
      const order = shuffleBox.checked ? shuffle(tracks) : tracks;
      const name = snapshotName(t(labelKey));
      await commitApp({ key: `snap:${kind}`, name, description: t('snapDesc'), uris: order.map((x) => x.uri) }, status, async (w) => {
        status.clear();
        form.hidden = true;
        renderResult(result, status, {
          name, notes: w.notes, tracks: order, playlistId: w.id, editable: true,
          onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
        });
      });
    });
  }
  return toolPanel('panel-snap', t('snapTitle'), t('snapLead'), status, form, result);
}

function orphansPanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const shuffleBox = h('input', { type: 'checkbox', id: 'orphans-shuffle' });
  const found = h('div', { id: 'orphans-found', hidden: true });
  let orphans = [];
  const form = h('div', {},
    h('p', { class: 'muted' }, t('orphansNote')),
    h('button', { class: 'btn primary big', type: 'button', id: 'orphans-scan', onclick: () => scan() }, t('orphansScan')),
    found);

  function scan() {
    task(status, async () => {
      await ensureFreshLibrary();
      const liked = S.playlists.find((p) => p.isLiked);
      const mine = S.playlists.filter((p) => !p.isLiked && p.readable);
      const likedRead = await readSource(liked, (d, tot) => status.progress('reading', d, tot), { useCache: true });
      const inPlaylists = new Set();
      let done = 0;
      for (const pl of mine) {
        status.say(t('orphansReading', { i: fmt(++done), n: fmt(mine.length) }));
        for (const tr of (await readSource(pl, null, { useCache: true })).tracks) inPlaylists.add(tr.uri);
      }
      orphans = uniqueByUri(likedRead.tracks.filter((tr) => !inPlaylists.has(tr.uri)));
      status.clear();
      if (!orphans.length) { setKids(found, h('div', { class: 'empty' }, emptyArt(), h('p', { class: 'note', id: 'orphans-none' }, t('orphansNone')))); found.hidden = false; return; }
      setKids(found,
        h('h2', { class: 'result-title', id: 'orphans-count' }, t('orphansFound', { n: fmt(orphans.length), p: fmt(mine.length) })),
        h('label', { class: 'check' }, shuffleBox, h('span', {}, t('snapShuffle'))),
        h('button', { class: 'btn primary big', type: 'button', id: 'orphans-create', onclick: () => create() }, t('orphansCreate')));
      found.hidden = false;
    });
  }

  function create() {
    task(status, async () => {
      const order = shuffleBox.checked ? shuffle(orphans) : orphans;
      const { tracks, truncated } = capPlaylist(order);
      const id = (await S.api.createPlaylist(`${t('orphansName')} · ${nowLabel()}`, t('barajaDesc'))).id;
      await S.api.addItems(id, tracks.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
      await loadPlaylists();
      status.clear();
      form.hidden = true;
      renderResult(result, status, {
        title: t('orphansDone', { n: fmt(tracks.length) }), notes: truncated ? [t('truncated', { n: fmt(truncated) })] : [], tracks, playlistId: id,
        onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
      });
    });
  }
  return toolPanel('panel-orphans', t('orphansTitle'), t('orphansLead'), status, form, result);
}

function splitPanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const modeSel = h('select', { id: 'split-mode', 'aria-label': t('splitBy') }, SPLIT_MODES.map((k) => h('option', { value: k }, t(`split_${k}`))));
  const partsIn = h('input', { type: 'number', class: 'text', id: 'split-parts', min: '2', max: String(MAX_SPLIT_PARTS), value: '3', 'aria-label': t('splitParts') });
  const minIn = h('input', { type: 'number', class: 'text', id: 'split-min', min: '1', max: '1000', value: '5', 'aria-label': t('splitMinArtist') });
  const partsLabel = h('label', { class: 'field-wide' }, t('splitParts'), partsIn);
  const minLabel = h('label', { class: 'field-wide', hidden: true }, t('splitMinArtist'), minIn);
  const preview = h('div', { id: 'split-preview', hidden: true });
  const syncMode = () => { partsLabel.hidden = modeSel.value !== 'parts'; minLabel.hidden = modeSel.value !== 'artist'; preview.hidden = true; };
  modeSel.addEventListener('change', syncMode);
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'split-preview-btn', disabled: true, onclick: () => scan() }, t('splitPreview'));
  const picker = createPicker({
    multi: false,
    disabledReason: (pl) => (pl.isLiked ? t('likedNoDup') : pl.readable ? '' : t('notReadable')),
    onChange: (sel) => { go.disabled = sel.length === 0; preview.hidden = true; },
  });
  const form = h('div', {}, h('h2', {}, t('source')), picker.el, h('h2', {}, t('splitBy')), modeSel, partsLabel, minLabel, go, preview);

  const nameOf = (base, mode, g) => {
    const part = mode === 'parts' ? t('splitPartName', { n: g.label })
      : g.key === 'none' ? t('splitNoDate') : g.key === 'others' ? t('splitOthers') : g.label;
    return `${base} · ${part}`.slice(0, 100);
  };

  function scan() {
    task(status, async () => {
      const pl = picker.getSelected()[0];
      const { tracks, skipped } = await readSources([pl], status);
      const mode = modeSel.value;
      let groups;
      try {
        groups = splitTracks(tracks, mode, { parts: partsIn.value, minArtist: minIn.value });
      } catch (e) {
        if (e.code === 'tooMany') throw new UserError(t('splitTooMany', { n: fmt(e.count), max: fmt(MAX_SPLIT_PARTS) }), 'splitTooMany');
        throw e;
      }
      if (groups.length < 2) throw new UserError(t('splitOneGroup'), 'splitOneGroup');
      status.clear();
      const rows = groups.map((g) => ({ g, input: h('input', { type: 'text', class: 'text', maxlength: '100', value: nameOf(pl.name, mode, g), 'aria-label': t('newName') }), done: false }));
      const createBtn = h('button', { class: 'btn primary big', type: 'button', id: 'split-create', onclick: () => create() }, t('splitCreate', { n: fmt(groups.length) }));
      setKids(preview,
        h('h2', { class: 'result-title', id: 'split-summary' }, t('splitSummary', { n: fmt(groups.length), m: fmt(tracks.length) })),
        skippedCount(skipped) ? h('p', { class: 'note' }, t('skipped', { n: fmt(skippedCount(skipped)) })) : null,
        h('ul', { class: 'restore-list split-list' }, rows.map(({ g, input }) => h('li', { class: 'split-row' }, coverSlot(g.tracks.find((x) => x.thumb)?.thumb),
          h('span', { class: 'split-fields' }, input, h('span', { class: 'muted small' }, t('songs', { n: fmt(g.tracks.length) })))))),
        createBtn);
      preview.hidden = false;

      function create() {
        task(status, async () => {
          let made = 0;
          for (const row of rows) {
            if (row.done) continue;
            const name = row.input.value.trim() || row.input.getAttribute('value');
            const id = (await S.api.createPlaylist(name.slice(0, 100), t('barajaDesc'))).id;
            await S.api.addItems(id, row.g.tracks.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
            row.done = true;
            row.input.disabled = true;
            made++;
          }
          await loadPlaylists();
          status.clear();
          status.say(t('splitDone', { n: fmt(made) }));
          createBtn.hidden = true;
        });
      }
    });
  }
  return toolPanel('panel-split', t('splitTitle'), t('splitLead'), status, form, result);
}

// ---------- Copia de seguridad ----------

function download(blob, filename) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function saveFile(blob, filename, status) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.warn('share falló, se descarga', e.name);
    }
  }
  download(blob, filename);
  status.say(t('downloaded', { name: filename }));
}

function backupPanel() {
  const status = createStatus();
  const out = h('div', { class: 'result', hidden: true });
  const exportBtn = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => prepare() }, t('exportBtn'));
  const incAlbums = h('input', { type: 'checkbox', id: 'inc-albums', checked: true });
  const incArtists = h('input', { type: 'checkbox', id: 'inc-artists', checked: true });
  const refreshExport = () => { exportBtn.disabled = picker.getSelected().length === 0 && !incAlbums.checked && !incArtists.checked; };
  const picker = createPicker({ multi: true, disabledReason: baseReason, onChange: refreshExport });
  [incAlbums, incArtists].forEach((el) => el.addEventListener('change', refreshExport));
  const restoreBox = h('div', { class: 'restore', hidden: true });
  const fileIn = h('input', { type: 'file', id: 'restore-file', accept: '.json,application/json', 'aria-label': t('restoreChoose'), onchange: () => loadRestore() });

  function prepare() {
    task(status, async () => {
      const sel = picker.getSelected();
      if (sel.length > MAX_BACKUP_PLAYLISTS) throw new UserError(t('errBackupLimit'), 'errBackupLimit');
      const lists = [];
      let skippedTotal = 0;
      for (const pl of sel) {
        const { tracks, skipped } = await readSources([pl], status);
        skippedTotal += skippedCount(skipped);
        lists.push({ id: pl.id, name: pl.name, isLiked: pl.isLiked, tracks });
      }
      let albums = [];
      let artists = [];
      if (incAlbums.checked) {
        status.say(t('backupReadingAlbums'));
        albums = (await S.api.getSavedAlbums()).map(normalizeAlbum).filter(Boolean);
      }
      if (incArtists.checked) {
        status.say(t('backupReadingArtists'));
        artists = (await S.api.getFollowedArtists()).map(normalizeFollowedArtist).filter(Boolean);
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const mixes = getMixes();
      const extra = { ...(mixes.length ? { mixes } : {}), ...(incAlbums.checked ? { albums } : {}), ...(incArtists.checked ? { artists } : {}) };
      const jsonBlob = new Blob([JSON.stringify(buildBackup(lists, new Date(), extra))], { type: 'application/json' });
      if (jsonBlob.size > MAX_BACKUP_BYTES) throw new UserError(t('errBackupLimit'), 'errBackupLimit');
      const csvBlob = new Blob(['﻿', toCsv(lists)], { type: 'text/csv' });
      const libraryBlob = new Blob(['﻿', toLibraryCsv(albums, artists)], { type: 'text/csv' });
      const total = lists.reduce((n, p) => n + p.tracks.length, 0);
      status.clear();
      setKids(out,
        h('h2', { class: 'result-title' }, t('backupReady', { n: fmt(total), p: fmt(lists.length) })),
        albums.length || artists.length ? h('p', { class: 'note', id: 'backup-extra' }, t('backupExtra', { a: fmt(albums.length), b: fmt(artists.length) })) : null,
        skippedTotal ? h('p', { class: 'note' }, t('skipped', { n: fmt(skippedTotal) })) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', id: 'save-json', onclick: () => saveFile(jsonBlob, `shuffl-${stamp}.json`, status) }, t('saveJson')),
          lists.length ? h('button', { class: 'btn', type: 'button', id: 'save-csv', onclick: () => saveFile(csvBlob, `shuffl-${stamp}.csv`, status) }, t('saveCsv')) : null,
          albums.length || artists.length ? h('button', { class: 'btn', type: 'button', id: 'save-library-csv', onclick: () => saveFile(libraryBlob, `shuffl-biblioteca-${stamp}.csv`, status) }, t('saveLibraryCsv')) : null));
      out.hidden = false;
    });
  }

  async function loadRestore() {
    status.clear();
    restoreBox.hidden = true;
    const file = fileIn.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new UserError(t('errBackupSize'), 'errBackupSize');
      const parsed = JSON.parse(await file.text());
      showRestore(validateBackup(parsed), sanitizeMixes(parsed.mixes), [parsed.albums, parsed.artists].map((x) => (Array.isArray(x) ? x.length : 0)));
    } catch (e) {
      status.fail(e instanceof UserError ? e : e instanceof SyntaxError ? new UserError(t('restoreBad_notBackup'), 'restoreBad_notBackup') : new UserError(t(`restoreBad_${typeof e.code === 'string' ? e.code : 'notBackup'}`)));
    }
  }

  function showRestore(playlists, mixes = [], [albumCount, artistCount] = [0, 0]) {
    const boxes = playlists.map((p) => {
      const box = h('input', { type: 'checkbox' });
      box.checked = true;
      return { p, box };
    });
    const mixBox = h('input', { type: 'checkbox', id: 'restore-mixes' });
    mixBox.checked = true;
    const go = h('button', { class: 'btn primary', type: 'button', onclick: () => restore() }, t('restoreBtn'));
    const upd = () => { go.disabled = !boxes.some((b) => b.box.checked) && !(mixes.length && mixBox.checked); };
    [...boxes.map((b) => b.box), mixBox].forEach((box) => box.addEventListener('change', upd));
    upd();
    setKids(restoreBox,
      h('ul', { class: 'restore-list' },
        boxes.map(({ p, box }) => h('li', {}, h('label', { class: 'check' }, box, h('span', {}, `${p.name} · ${t('songs', { n: fmt(p.tracks.length) })}`)))),
        mixes.length ? h('li', {}, h('label', { class: 'check' }, mixBox, h('span', {}, t('restoreMixes', { n: fmt(mixes.length) })))) : null),
      albumCount || artistCount ? h('p', { class: 'note', id: 'restore-library-note' }, t('restoreLibraryNote', { a: fmt(albumCount), b: fmt(artistCount) })) : null,
      go);
    restoreBox.hidden = false;

    function restore() {
      task(status, async () => {
        let n = 0;
        let mixCount = 0;
        let mixSkipped = 0;
        if (mixes.length && mixBox.checked) {
          let list = getMixes();
          for (const m of mixes) {
            if (list.some((x) => x.id === m.id)) { mixSkipped++; continue; }
            const r = upsertMix(list, m);
            if (r.ok) { list = r.list; mixCount++; }
          }
          setMixes(list);
          mixBox.checked = false;
          mixBox.disabled = true;
        }
        for (const { p, box } of boxes) {
          if (!box.checked) continue;
          const id = (await S.api.createPlaylist(`${p.name} (${t('restoredSuffix')})`, t('barajaDesc'))).id;
          await S.api.addItems(id, p.tracks.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
          n++;
          box.checked = false;
          box.disabled = true;
        }
        await loadPlaylists();
        status.clear();
        status.say(t('restoredDone', { n: fmt(n) }) + (mixCount || mixSkipped ? ` ${t('restoredMixes2', { n: fmt(mixCount) })}` : '') + (mixSkipped ? ` ${t('mixesSkipped', { n: fmt(mixSkipped) })}` : ''));
        restoreBox.hidden = true;
        fileIn.value = '';
      });
    }
  }

  return h('section', { class: 'panel', id: 'panel-backup', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('tabBackup')),
    h('p', { class: 'lead' }, t('backupLead')),
    h('h2', {}, t('source')), picker.el,
    h('label', { class: 'check' }, incAlbums, h('span', {}, t('incAlbums'))),
    h('label', { class: 'check' }, incArtists, h('span', {}, t('incArtists'))),
    exportBtn, out,
    h('h2', {}, t('restoreTitle')), h('p', { class: 'muted' }, t('restoreLead')), fileIn, restoreBox,
    status.el);
}

// ---------- Ajustes ----------

function copyBox(value, label = t('redirectUri'), id = null) {
  const input = h('input', { type: 'text', class: 'text mono', readonly: true, value, 'aria-label': label, id });
  const btn = h('button', { class: 'btn', type: 'button', id: id && `${id}-copy`, onclick: async () => {
    try { await navigator.clipboard.writeText(value); btn.textContent = t('copied'); } catch { input.select(); btn.textContent = t('selected'); }
    setTimeout(() => { btn.textContent = t('copy'); }, 1800);
  } }, t('copy'));
  return h('div', { class: 'copybox' }, input, btn);
}

function settingsPanel() {
  const status = createStatus();
  const idIn = h('input', { type: 'text', id: 'settings-client-id', class: 'text mono', value: auth.getClientId(), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('clientId') });
  const langSel = h('select', { id: 'lang-select', 'aria-label': t('language'), onchange: () => { setLang(langSel.value); mountApp(); } },
    LANGS.map(([code, label]) => { const o = h('option', { value: code }, label); if (code === getLang()) o.selected = true; return o; }));
  const themeSel = h('select', { id: 'theme-select', 'aria-label': t('themeTitle'), onchange: () => { setItem(KEYS.theme, themeSel.value); applyTheme(); } },
    THEMES.map((k) => { const o = h('option', { value: k }, t(`theme_${k}`)); if (k === currentTheme()) o.selected = true; return o; }));
  const coverToggle = h('input', { type: 'checkbox', id: 'cover-toggle', onchange: () => setItem(KEYS.cover, coverToggle.checked) });
  coverToggle.checked = coverEnabled();
  const shakeToggle = h('input', { type: 'checkbox', id: 'shake-toggle', onchange: async () => {
    setItem(KEYS.shake, shakeToggle.checked);
    if (shakeToggle.checked && motionNeedsPermission() && !SHAKE.granted) await requestMotion();
    syncShake();
  } });
  shakeToggle.checked = shakeEnabled();
  const purgeToggle = h('input', { type: 'checkbox', id: 'purge-toggle', onchange: () => setItem(KEYS.purge, purgeToggle.checked) });
  purgeToggle.checked = purgeEnabled();
  const undoInfo = h('p', { class: 'muted' });
  const undoBtn = h('button', { class: 'btn', type: 'button', onclick: () => task(status, async () => {
    if (await applyUndo(status)) status.say(t('undone'));
    syncUndo();
  }) }, t('undo'));
  function syncUndo() {
    const u = getItem(KEYS.undo);
    undoBtn.disabled = !u;
    undoInfo.textContent = u ? t('undoInfo', { name: u.name || u.playlistId, n: fmt(u.uris.length), date: new Date(u.date).toLocaleString(getLang()) }) : t('undoNone');
  }
  syncUndo();
  const panel = h('section', { class: 'panel', id: 'panel-settings', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('settings')),
    h('h2', {}, t('clientId')), idIn,
    h('button', { class: 'btn', type: 'button', onclick: () => { auth.setClientId(idIn.value); status.say(t('saved')); } }, t('save')),
    h('h2', {}, t('redirectUri')), copyBox(auth.redirectUri()),
    h('h2', {}, t('language')), langSel,
    h('h2', {}, t('themeTitle')), themeSel,
    h('h2', {}, t('coverTitle')),
    h('label', { class: 'check' }, coverToggle, h('span', {}, t('coverToggle'))),
    h('h2', {}, t('shakeTitle')),
    h('label', { class: 'check' }, shakeToggle, h('span', {}, t('shakeToggle'))),
    h('h2', {}, t('purgeSettingTitle')),
    h('label', { class: 'check' }, purgeToggle, h('span', {}, t('purgeToggle'))),
    h('p', { class: 'muted small' }, t('purgeRecover')),

    h('h2', {}, t('undoTitle')), undoInfo, undoBtn,
    h('h2', {}, t('account')), h('p', { class: 'muted' }, S.me?.display_name || S.me?.id || ''),
    h('button', { class: 'btn danger', type: 'button', id: 'logout', onclick: () => { auth.logout(); idbClear(); renderSetup(); } }, t('logout')),
    h('h2', {}, t('privacyTitle')), h('p', { class: 'muted' }, t('privacy')),
    h('h2', {}, t('aboutTitle')),
    h('p', { class: 'muted', id: 'about-notice' }, t('notAffiliated')),
    h('p', {}, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, t('repoLink'))),
    status.el);
  panel.refresh = () => { syncUndo(); purgeToggle.checked = purgeEnabled(); };
  return panel;
}

// ---------- Diagnóstico: peticiones, comprobaciones, prueba completa y registro de errores ----------

/** Una canción para la playlist de prueba: la más reciente de Tus me gusta o, si no hay, la primera de una playlist tuya. */
async function probeTrackUri() {
  const liked = await S.api.request('GET', '/me/tracks?limit=1');
  const fromLiked = normalizeEntries(liked?.items ?? []).tracks[0];
  if (fromLiked) return fromLiked.uri;
  const own = S.playlists.find((p) => !p.isLiked && p.readable && p.total);
  if (!own) return null;
  const page = await S.api.request('GET', `/playlists/${encodeURIComponent(own.id)}/items?limit=1&additional_types=track`);
  return normalizeEntries(page?.items ?? []).tracks[0]?.uri ?? null;
}

function diagPanel() {
  const status = createStatus();
  const counts = h('p', { class: 'diag-counts', id: 'req-counts', role: 'status' });
  const actions = h('ul', { class: 'diag-actions', id: 'req-actions' });
  const syncCounts = () => {
    const s = requestStats();
    counts.textContent = t('reqCounts', { session: fmt(s.session), today: fmt(s.today) });
    setKids(actions, s.actions.map((a) => h('li', {}, t('reqAction', { name: t(`act_${a.name}`) === `act_${a.name}` ? a.name : t(`act_${a.name}`), n: fmt(a.n) }))));
  };

  // «Comprobar conexión» (rápida): cuenta, playlists, permisos y borrado de verdad con una playlist vacía.
  const diagList = h('ul', { class: 'diag', id: 'diag-results' });
  async function diagnose() {
    const rows = [];
    const check = async (label, fn) => {
      try { rows.push({ label, ok: true, detail: await fn() }); } catch (e) { recordError(e); rows.push({ label, ok: false, detail: errorMessage(e) }); }
    };
    await check(t('diagAccount'), async () => { const me = await S.api.getMe(); return me.display_name || me.id; });
    await check(t('diagPlaylists'), async () => { await S.api.request('GET', '/me/playlists?limit=1'); return ''; });
    const missing = auth.missingScopes(getItem(KEYS.tokens));
    rows.push({ label: t('diagScopes'), ok: missing.length === 0, detail: missing.join(', ') });
    // Prueba real de borrado: crea una playlist vacía y la quita con DELETE /me/library. Si falla, se ve el error de Spotify.
    // También comprueba que Spotify devuelve la etiqueta en la descripción (sin ella no se reconocerían las de Shuffl)
    // y que la playlist ya no está en la biblioteca. Lleva la etiqueta: si no se pudo quitar, la quitará el próximo shuffle.
    await check(t('diagDelete'), async () => {
      const name = t('diagProbeName');
      const probe = await S.api.createPlaylist(name, withTag(t('diagProbeDesc'), await tagFor('diag'), name));
      try {
        const seen = await S.api.getPlaylistInfo(probe.id);
        if (!isAppPlaylist(seen, S.me.id)) throw new UserError(t('diagNoTag'), 'diagNoTag');
        await removePlaylists([probe.id]);
      } catch (e) {
        throw new UserError(`${errorMessage(e)} ${t('diagProbeLeft', { name })}`, 'diagProbeLeft', e);
      }
      return t('diagDeleteOk');
    });
    setKids(diagList, rows.map((r) => h('li', { class: r.ok ? 'ok' : 'bad' }, `${r.ok ? '✓' : '✗'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)));
  }
  const diagBtn = h('button', { class: 'btn', type: 'button', id: 'run-diag', onclick: () => task(status, diagnose, 'diag').then(syncCounts) }, t('diagRun'));

  // «Prueba completa»: todo lo que hace la app con tu cuenta, paso a paso, con una playlist de prueba que se borra al final.
  const playBox = h('input', { type: 'checkbox', id: 'full-test-play', checked: true });
  const fullList = h('ol', { class: 'diag', id: 'full-results' });
  let lastSteps = null;
  async function fullTest() {
    const steps = [];
    lastSteps = steps;
    const render = () => setKids(fullList, steps.map((r) => h('li', { class: r.ok === null ? 'skip' : r.ok ? 'ok' : 'bad' },
      `${r.ok === null ? '–' : r.ok ? '✓' : '✗'} ${t(`full_${r.key}`)}${r.text ? ` — ${r.text}` : ''}`)));
    /** `detail`: dato sin nombres para el informe; `text`: lo que se ve en pantalla. */
    const step = async (key, fn) => {
      status.say(t(`full_${key}`));
      try {
        const out = (await fn()) ?? {};
        steps.push({ key, ok: out.skip ? null : true, text: out.text ?? '', detail: out.detail ?? '' });
        render();
        return true;
      } catch (e) {
        recordError(e);
        const { kind } = errorInfo(e);
        steps.push({ key, ok: false, text: errorMessage(e), detail: kind === 'user' ? `user:${e.code}` : `${kind}${e.status ? ` ${e.status}` : ''}${e.reason ? ` ${e.reason}` : ''}` });
        render();
        return false;
      }
    };
    setKids(fullList);
    if (!await step('login', async () => { const me = await S.api.getMe(); return { text: me.display_name || me.id }; })) return;
    await step('read', async () => {
      const page = await S.api.request('GET', '/me/playlists?limit=1');
      return { text: t('fullPlaylistsN', { n: fmt(page?.total ?? 0) }), detail: `total ${page?.total ?? 0}` };
    });
    await step('scopes', async () => {
      const missing = auth.missingScopes(getItem(KEYS.tokens));
      if (missing.length) throw new UserError(t('fullScopesMissing', { list: missing.join(', ') }), 'scopes');
    });
    let uri = null;
    await step('track', async () => {
      uri = await probeTrackUri();
      if (!uri) throw new UserError(t('fullNoTrack'), 'noTrack');
    });
    const name = t('diagProbeName');
    let probeId = null;
    const created = await step('create', async () => {
      probeId = (await S.api.createPlaylist(name, withTag(t('diagProbeDesc'), await tagFor('diag'), name))).id;
      if (uri) await S.api.addItems(probeId, [uri]);
    });
    if (created && probeId) {
      await step('overwrite', async () => {
        if (!uri) return { skip: true };
        await S.api.replaceItems(probeId, [uri, uri]);
        const page = await S.api.request('GET', `/playlists/${encodeURIComponent(probeId)}/items?limit=1`);
        if (page?.total !== 2) throw new UserError(t('fullOverwriteBad'), 'overwriteBad');
      });
      await step('recognize', async () => {
        if (!isAppPlaylist(await S.api.getPlaylistInfo(probeId), S.me.id)) throw new UserError(t('diagNoTag'), 'diagNoTag');
      });
    }
    let device = null;
    let cancelled = false;
    const willPlay = () => playBox.checked && probeId && uri;
    await step('devices', async () => {
      const devices = await S.api.getDevices();
      const pick = pickDevice(devices);
      device = pick.device ?? (pick.choose && willPlay() ? await chooseDevice(pick.choose) : null);
      cancelled = !!pick.choose && willPlay() && !device;
      const n = devices.length;
      if (pick.problem === 'restricted') throw new UserError(t('playRestricted'), 'restricted');
      return { text: n ? t('fullDevices', { n: fmt(n), name: device?.name ?? '' }) : t('fullNoDevice'), detail: `${n} ${device?.type ?? '-'}${device?.is_active ? ' activo' : ''}` };
    });
    await step('play', async () => {
      if (!willPlay() || cancelled) return { skip: true, text: t('fullSkipped') };
      if (!device) return { skip: true, text: t('playNoDevice') };
      let outcome = await startAndVerify(probeId, device);
      if (PLAY_RETRY.has(outcome)) outcome = await startAndVerify(probeId, device);
      if (outcome !== 'ok' && outcome !== 'sent') throw new UserError(t(`fullPlay_${['premium', 'restricted', 'forbidden', 'shuffle'].includes(outcome) ? outcome : 'other'}`), `play:${outcome}`);
      return { text: t('playOk', { device: device.name }), detail: outcome };
    });
    if (probeId) {
      await step('delete', async () => {
        try {
          await removePlaylists([probeId]);
        } catch (e) {
          throw new UserError(`${errorMessage(e)} ${t('diagProbeLeft', { name })}`, 'diagProbeLeft', e);
        }
      });
    }
    status.say(steps.every((s) => s.ok !== false) ? t('fullAllOk') : t('fullSomeBad'));
  }
  const fullBtn = h('button', { class: 'btn primary', type: 'button', id: 'full-test', onclick: () => task(status, fullTest, 'fulltest').then(() => { syncCounts(); syncErrors(); }) }, t('fullRun'));

  // Registro de errores e informe para copiar
  const errList = h('ul', { class: 'diag errors', id: 'error-log' });
  const report = () => buildReport({
    version: APP_VERSION, lang: getLang(), standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    steps: lastSteps?.map((s) => ({ ok: s.ok !== false, key: s.key, detail: s.detail })) ?? null,
  });
  const copyMsg = h('p', { class: 'muted small', id: 'copy-msg', role: 'status' });
  const copyArea = h('div', { id: 'report-box' });
  async function copyReport() {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      copyMsg.textContent = t('reportCopied');
      setKids(copyArea);
    } catch {
      // Sin portapapeles (o sin permiso): el informe sale en un cuadro para seleccionarlo y copiarlo a mano.
      copyMsg.textContent = t('reportManual');
      const area = h('textarea', { class: 'text mono report', id: 'report-text', readonly: true, rows: '10' });
      area.value = text;
      setKids(copyArea, area);
      area.focus();
      area.select();
    }
  }
  function syncErrors() {
    const list = getErrors();
    setKids(errList, list.length ? list.slice(0, 10).map((e) => h('li', {},
      `${new Date(e.at).toLocaleString(getLang(), { dateStyle: 'short', timeStyle: 'short' })} · ${e.where || '—'} · ${e.kind}${e.status !== undefined ? ` ${e.status}` : ''}`))
      : h('li', { class: 'muted' }, t('noErrors')));
  }

  const panel = h('section', { class: 'panel', id: 'panel-diag', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('diagTitle2')),
    h('p', { class: 'lead' }, t('diagPanelLead')),
    h('h2', {}, t('reqTitle')), counts, actions, h('p', { class: 'muted small' }, t('reqNote')),
    h('h2', {}, t('fullTitle')), h('p', { class: 'muted' }, t('fullLead')),
    h('label', { class: 'check' }, playBox, h('span', {}, t('fullPlayOpt'))),
    fullBtn, fullList, status.el,
    h('h2', {}, t('diagRun')), h('p', { class: 'muted' }, t('diagLead')), diagBtn, diagList,
    h('h2', {}, t('errorsTitle')), errList,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'button', id: 'copy-report', onclick: () => copyReport() }, t('copyReport')),
      h('button', { class: 'btn', type: 'button', id: 'clear-errors', onclick: () => { clearErrors(); syncErrors(); } }, t('clearErrors'))),
    copyMsg, copyArea);
  panel.refresh = () => { syncCounts(); syncErrors(); };
  return panel;
}

// ---------- Tenerla siempre a mano ----------

function pinPanel() {
  const slot = h('div', { class: 'actions' });
  const panel = h('section', { class: 'panel', id: 'panel-pin', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('pinTitle')),
    h('p', { class: 'lead' }, t('pinLead')),
    h('h2', {}, t('pinHow')), h('p', {}, t('pinHowText')),
    h('h2', {}, t('pinWhy')), h('p', {}, t('pinWhyText')),
    h('h2', {}, t('pinHome')), h('p', {}, t('pinHomeText')),
    h('h2', { id: 'car-title' }, t('carTitle')), h('p', {}, t('carText')), h('p', {}, t('carSiri')),
    slot,
    h('button', { class: 'btn', type: 'button', id: 'pin-back', onclick: () => S.back() }, t('back')));
  panel.refresh = () => {
    const id = getItem(KEYS.lastTarget);
    setKids(slot, id ? h('a', { class: 'btn primary', href: spotifyUrl(id), target: '_blank', rel: 'noopener', id: 'pin-open' }, t('openInSpotify')) : null);
  };
  return panel;
}

// ---------- Elige por mí ----------

function roulettePanel() {
  const status = createStatus();
  const reel = h('div', { class: 'reel', id: 'reel', role: 'status', 'aria-live': 'polite' }, '?');
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'roulette-go', onclick: () => spin() }, t('rouletteSpin'));
  const candidates = () => S.playlists.filter((p) => !baseReason(p) && p.total !== 0);

  /** La elegida sale de pickIndex (uniforme) antes de animar; la ruleta solo lo enseña. */
  async function spin() {
    if (S.busy) return;
    const list = candidates();
    if (!list.length) { status.fail(new UserError(t('rouletteEmpty'), 'rouletteEmpty')); return; }
    status.clear();
    const chosen = pickIndex(list.length);
    go.disabled = true;
    reel.classList.remove('landed');
    if (!prefersReducedMotion()) {
      reel.classList.add('spinning');
      const seq = spinSequence(list.length, chosen);
      const delays = spinDelays(seq.length);
      for (let i = 0; i < seq.length; i++) {
        reel.textContent = list[seq[i]].name;
        await wait(delays[i]);
      }
      reel.classList.remove('spinning');
    }
    reel.textContent = list[chosen].name;
    reel.classList.add('landed');
    reel.dataset.chosen = list[chosen].id;
    await wait(prefersReducedMotion() ? 0 : 600);
    go.disabled = false;
    if (S.busy) { status.say(t('rouletteBusy')); return; }
    S.runMix({ library: false, ids: [list[chosen].id], filters: emptyFilters(), dedupe: true, mode: 'reuse' }, null, { modeOverride: 'reuse' });
  }

  return h('section', { class: 'panel', id: 'panel-roulette', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('rouletteTitle')),
    h('p', { class: 'lead' }, t('rouletteLead')),
    h('div', { class: 'reel-frame' }, reel),
    spotifyAttribution(),
    go, status.el);
}

// ---------- ¿Es aleatorio de verdad? ----------

const PROOF_SONGS = 10;
const PROOF_RUNS = 10000;

/**
 * Simula miles de barajas y enseña cuántas veces suena primero cada canción: con Shuffl todas igual (10 %),
 * con el error clásico de barajar unas mucho más que otras. Dos gráficos con la misma escala y una tabla.
 */
function proofPanel() {
  const charts = h('div', { class: 'proof-charts' });
  const summary = h('p', { class: 'proof-summary', id: 'proof-summary', role: 'status' });
  const tableBox = h('details', { class: 'more', id: 'proof-table' });
  const pct = (c) => `${((c / PROOF_RUNS) * 100).toLocaleString(getLang(), { maximumFractionDigits: 1 })} %`;

  function chart(id, title, note, counts, scale) {
    const expected = PROOF_RUNS / PROOF_SONGS;
    const bars = counts.map((c, i) => h('div', {
      class: 'bar', tabindex: '0', title: t('proofBarTip', { n: i + 1, p: pct(c) }), 'aria-label': t('proofBarTip', { n: i + 1, p: pct(c) }),
      style: `--h:${(c / scale) * 100}%;--i:${i}`,
    }, h('span', { class: 'bar-fill' })));
    return h('figure', { class: 'proof-chart', id },
      h('figcaption', {}, h('strong', {}, title), h('span', { class: 'muted small' }, note)),
      h('div', { class: 'bars', style: `--ref:${(expected / scale) * 100}%` }, bars, h('span', { class: 'ref', 'aria-hidden': 'true' }, t('proofFairLine'))),
      h('div', { class: 'bar-labels', 'aria-hidden': 'true' }, counts.map((_, i) => h('span', {}, String(i + 1)))));
  }

  function simulate() {
    const fair = firstSongHistogram(fairShuffle, PROOF_SONGS, PROOF_RUNS);
    const biased = firstSongHistogram(naiveShuffle, PROOF_SONGS, PROOF_RUNS);
    const scale = Math.max(...fair, ...biased) * 1.1;
    setKids(charts,
      chart('proof-fair', APP_NAME, t('proofFairNote'), fair, scale),
      chart('proof-biased', t('proofBiased'), t('proofBiasedNote'), biased, scale));
    const dev = (c) => `${(maxDeviation(c) * 100).toLocaleString(getLang(), { maximumFractionDigits: 1 })} %`;
    summary.textContent = t('proofSummary', { fair: dev(fair), biased: dev(biased) });
    setKids(tableBox, h('summary', {}, t('proofTable')),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('proofSong')), h('th', { scope: 'col' }, APP_NAME), h('th', { scope: 'col' }, t('proofBiased')))),
        h('tbody', {}, fair.map((c, i) => h('tr', {}, h('th', { scope: 'row' }, String(i + 1)), h('td', {}, pct(c)), h('td', {}, pct(biased[i])))))));
    if (!prefersReducedMotion()) {
      charts.classList.remove('grow');
      requestAnimationFrame(() => requestAnimationFrame(() => charts.classList.add('grow')));
    } else {
      charts.classList.add('grow');
    }
  }

  const panel = h('section', { class: 'panel', id: 'panel-proof', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('proofTitle')),
    h('p', { class: 'lead' }, t('proofLead', { n: fmt(PROOF_RUNS), songs: PROOF_SONGS })),
    charts, summary,
    h('button', { class: 'btn', type: 'button', id: 'proof-again', onclick: () => simulate() }, t('proofAgain')),
    tableBox,
    h('p', { class: 'muted small' }, t('proofExplain')));
  panel.refresh = () => { if (!charts.firstChild) simulate(); };
  return panel;
}

// ---------- Estructura de la app ----------

const mixOrigin = (mix) => ({ mixId: mix.id, mixName: mix.name });
const appBase = () => `${location.origin}${location.pathname}`;

/** Clave aleatoria de este navegador: los atajos creados aquí la llevan y se ejecutan sin preguntar. */
function linkKey() {
  const stored = getItem(KEYS.linkKey);
  if (typeof stored === 'string' && /^[A-Za-z0-9_-]{22}$/.test(stored)) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  setItem(KEYS.linkKey, key);
  return key;
}

/** Pasos para crear en la app Atajos de iOS un atajo que abre el enlace profundo de una mezcla. */
function showShortcutSheet(mix) {
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); sheet.remove(); };
  const link = buildDeepLink(appBase(), { mixId: mix.id, key: linkKey() });
  const phrase = `${APP_NAME} ${mix.name.toLowerCase()}`;
  const sheet = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet', id: 'shortcut-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('shortcutTitle', { name: mix.name }) },
      h('h2', {}, t('shortcutTitle', { name: mix.name })),
      h('p', {}, t('shortcutLead', { phrase })),
      copyBox(link, t('shortcutLink'), 'shortcut-link'),
      h('ol', { class: 'howto' },
        h('li', {}, t('shortcutStep1')),
        h('li', {}, t('shortcutStep2')),
        h('li', {}, t('shortcutStep3')),
        h('li', {}, t('shortcutStep4', { phrase })),
        h('li', {}, t('shortcutStep5', { phrase }))),
      h('p', { class: 'muted small' }, t('shortcutSafari')),
      h('button', { class: 'btn', type: 'button', id: 'shortcut-close', onclick: close }, t('close'))));
  document.addEventListener('keydown', onKey);
  document.body.append(sheet);
  sheet.querySelector('#shortcut-close').focus();
}

/** «Rock + Chill · filtros · sin repetidas» para las tarjetas de mezcla. */
function mixSummary(mix) {
  const parts = [mixLabel(mix)];
  if (hasFilters(mix.filters)) parts.push(t('withFilters'));
  return parts.join(' · ');
}

// ---------- Descubrir ----------

const RECENT_MAX = 3;
/** «Lo último» de Inicio: las últimas funciones usadas (solo el panel y su título, nada de Spotify). */
function rememberRecent(panel) {
  const list = (getItem(KEYS.recent, []) ?? []).filter((x) => typeof x === 'string' && PANEL_LABEL[x] && x !== panel);
  setItem(KEYS.recent, [panel, ...list].slice(0, RECENT_MAX));
}
const recentPanels = () => (Array.isArray(getItem(KEYS.recent)) ? getItem(KEYS.recent) : []).filter((x) => PANEL_LABEL[x]).slice(0, RECENT_MAX);

/** Tus me gusta para Olvidadas: si no han cambiado desde la última lectura, de la copia del dispositivo (una petición). */
async function likedTracks(status) {
  const liked = S.playlists.find((p) => p.isLiked);
  if (liked?.error) throw new UserError(t('likedUnavailable'), 'likedUnavailable');
  return (await readSource(liked ?? likedEntry(), (d, tot) => status.progress('reading', d, tot), { useCache: true })).tracks;
}

/** Peticiones como mucho para poner al día el índice de tus playlists en cada búsqueda de Descubrir. */
const INDEX_BUDGET = 8;

/**
 * Ids de las canciones de tus playlists (propias y colaborativas, sin las de Shuffl), para no proponerte lo que ya
 * tienes. Usa la copia guardada de cada playlist (vale mientras no cambie su snapshot_id); las que cambiaron se leen
 * con un tope de INDEX_BUDGET peticiones por búsqueda, y si no caben se usa su copia anterior (o se leen la próxima vez).
 * Tus me gusta no se lee entera: se pregunta a Spotify solo por las candidatas (`dropSaved`).
 */
async function playlistIndex(status) {
  await ensureFreshLibrary();
  const ids = new Set();
  const mine = S.raw.filter((p) => p?.id && (p.owner?.id === S.me.id || p.collaborative) && !isAppPlaylist(p, S.me.id));
  let spent = 0;
  for (const [i, p] of mine.entries()) {
    const hit = await cacheRead(`pl:${p.id}`, LONG_TTL_MS);
    let tracks = hit?.snap && hit.snap === p.snapshot_id ? hit.tracks : null;
    const pages = Math.max(1, Math.ceil((p.items?.total ?? p.tracks?.total ?? 0) / 50));
    if (!tracks && spent + pages <= INDEX_BUDGET) {
      status.progress('readingLibrary', i, mine.length);
      tracks = (await readSource({ id: p.id }, null, { useCache: true })).tracks;
      spent += pages;
    }
    for (const tr of tracks ?? hit?.tracks ?? []) ids.add(tr.id);
  }
  return ids;
}

const genDescription = (key, params) => generatedDescription(t(key, params), []);

/** Artistas simplificados (id, nombre y géneros si Spotify los da) para guardar en la caché. */
const slimArtists = (list) => list.filter((a) => a?.id).map((a) => ({ id: a.id, name: a.name ?? '', genres: Array.isArray(a.genres) ? a.genres.slice(0, 5) : [] }));
const topArtistLists = async () => [
  await cached('topArtists:short_term', async () => slimArtists(await S.api.getTopArtists('short_term'))),
  await cached('topArtists:medium_term', async () => slimArtists(await S.api.getTopArtists('medium_term'))),
];
/** Lanzamientos de un artista (los 10 últimos entre álbumes y singles, en una petición). 24 h en el dispositivo. */
const artistReleases = (id) => cached(`releases:${id}`, async () => (await S.api.getArtistAlbums(id)).map(albumInfo));

const MAX_GENRE_PAGES = 3;
/** Álbumes de lo que escuchas últimamente con los que empieza Descubre. */
const LISTENING_ALBUMS = 8;

/**
 * Novedades y Descubre: cuántas canciones (o cuánto tiempo), de quién («tus artistas», «como mi playlist…» o un
 * género) y sin lo que ya tienes en tus playlists o en Tus me gusta. «Buscar más» añade otra tanda a la misma playlist
 * y sigue con los artistas donde se quedó (lo ya leído está en la caché del dispositivo).
 * Cada búsqueda gasta como mucho READ_BUDGET peticiones de lectura; si Spotify agota la cuota a mitad, se guarda lo
 * conseguido si llega a MIN_TRACKS_ON_QUOTA canciones.
 */
function discoverGenPanel(kind) {
  const isNew = kind === 'new';
  const status = createStatus({ loader: true });
  const result = h('div', { class: 'result', hidden: true });
  const empty = h('div', { class: 'empty', id: `${kind}-empty`, hidden: true, role: 'status' });

  const byTime = h('input', { type: 'checkbox', id: `${kind}-bytime`, onchange: () => sync() });
  const countSel = segmented(`${kind}-count`, t('amountLabel'), DISCOVER_COUNTS.map((n) => [String(n), String(n)]), () => sync());
  countSel.set(String(DEFAULT_DISCOVER_COUNT));
  const minSel = segmented(`${kind}-minutes`, t('timeLabel'), DISCOVER_MINUTES.map((m) => [String(m), t('minutesShort', { n: m })]), () => sync());
  minSel.set('60');
  const amountBox = h('div', {}, h('p', { class: 'field-label' }, t('amountLabel')), countSel.el);
  const timeBox = h('div', { hidden: true }, h('p', { class: 'field-label' }, t('timeLabel')), minSel.el);
  const perSearch = segmented(`${kind}-artists`, t('artistsPerSearch'), ARTISTS_PER_SEARCH.map((n) => [String(n), String(n)]),
    (v) => setItem(KEYS.artistsPerSearch, Number(v)));
  perSearch.set(String(sanitizeArtistsPerSearch(getItem(KEYS.artistsPerSearch))));

  const styleSel = segmented(`${kind}-style`, t('styleLabel'), [['mine', t('style_mine')], ['playlist', t('style_playlist')], ['genre', t('style_genre')]], () => sync());
  const genreOption = styleSel.el.querySelector(`label[for="${kind}-style-genre"]`);
  const seedSel = h('select', { id: `${kind}-seed`, 'aria-label': t('seedLabel'), onchange: () => sync() });
  const seedBox = h('label', { class: 'field-wide', hidden: true }, t('seedLabel'), seedSel);
  let genres = [];
  const genreSel = h('select', { id: `${kind}-genre`, 'aria-label': t('genreLabel'), onchange: () => sync() });
  const genreBox = h('label', { class: 'field-wide', hidden: true }, t('genreLabel'), genreSel);
  const days = isNew ? segmented('new-days', t('newDaysLabel'), RELEASE_DAYS.map((d) => [String(d), t('lastDays', { n: d })]), (v) => setItem(KEYS.discoverDays, Number(v))) : null;
  days?.set(String(RELEASE_DAYS.includes(getItem(KEYS.discoverDays)) ? getItem(KEYS.discoverDays) : 30));

  const srcLine = h('p', { class: 'source-line', id: `${kind}-source` });
  const go = h('button', { class: 'btn primary big', type: 'button', id: `${kind}-go`, onclick: () => run() }, t(isNew ? 'newBtn' : 'exploreBtn'));

  const style = () => styleSel.value;
  const amount = () => (byTime.checked ? { minutes: Number(minSel.value) } : { count: Number(countSel.value) });
  const seed = () => S.playlists.find((p) => p.id === seedSel.value);
  function sync() {
    amountBox.hidden = byTime.checked;
    timeBox.hidden = !byTime.checked;
    seedBox.hidden = style() !== 'playlist';
    genreBox.hidden = style() !== 'genre';
    const why = style() === 'playlist' ? t('srcPlaylist', { name: seed()?.name ?? '…' })
      : style() === 'genre' ? t('srcGenre', { genre: genreSel.value || '…' })
        : t(isNew ? 'srcMineNew' : 'srcMineExplore');
    srcLine.textContent = `${why} ${t('srcNotOwned')}`;
    go.disabled = (style() === 'playlist' && !seed()) || (style() === 'genre' && !genreSel.value);
  }

  const form = h('div', {},
    h('p', { class: 'lead' }, t(isNew ? 'newLead' : 'exploreLead')),
    styleSel.el, seedBox, genreBox,
    go, srcLine, empty,
    h('details', { class: 'more', id: `${kind}-more` }, h('summary', {}, t('moreOptions')),
      h('label', { class: 'check' }, byTime, h('span', {}, t('byTimeToggle'))), amountBox, timeBox,
      isNew ? h('p', { class: 'field-label' }, t('newDaysLabel')) : null, days?.el,
      h('p', { class: 'field-label' }, t('artistsPerSearch')), perSearch.el,
      h('p', { class: 'muted small' }, t('quotaNote'))));

  /** Se rellenan al abrir la pantalla: tus playlists para «Como mi playlist…» y los géneros de tus artistas. */
  async function refresh() {
    const current = seedSel.value;
    setKids(seedSel, h('option', { value: '' }, t('seedPick')),
      S.playlists.filter((p) => !p.isLiked && p.readable && p.total).map((p) => h('option', { value: p.id }, p.name)));
    seedSel.value = current && seed() ? current : '';
    if (!genres.length) {
      try {
        genres = topGenres((await topArtistLists()).flat());
      } catch (e) {
        console.warn('Géneros no leídos:', e?.status ?? e?.message);
      }
      // Spotify marca `genres` como obsoleto y en muchas cuentas llega vacío: sin géneros no se ofrece la opción.
      genreOption.hidden = !genres.length;
      setKids(genreSel, h('option', { value: '' }, t('genrePick')), genres.map((g) => h('option', { value: g }, g)));
      if (!genres.length && style() === 'genre') styleSel.set('mine');
    }
    sync();
  }

  // Estado de la tanda en curso: artistas por recorrer, canciones por proponer y en qué playlist se escribe.
  let st = null;
  const overBudget = () => actionSpent() >= READ_BUDGET;

  async function artistsFor(s) {
    if (s === 'playlist') {
      const { tracks } = await readSources([seed()], status, { useCache: true });
      return artistsFromTracks(tracks).slice(0, MAX_DISCOVER_ARTISTS);
    }
    const tops = await topArtistLists();
    if (s === 'genre') {
      const g = genreSel.value;
      const out = tops.flat().filter((a) => a.genres?.includes(g));
      for (let page = 0; page < MAX_GENRE_PAGES; page++) {
        status.phase('searchingGenre');
        const found = await cached(`genre:${g}:${page}`, async () => slimArtists(await S.api.searchArtistsByGenre(g, page * 10)));
        out.push(...found);
        if (found.length < 10) break;
      }
      return pickArtists([out], MAX_DISCOVER_ARTISTS);
    }
    status.phase('readingArtists');
    // Las dos primeras páginas de seguidos (100 artistas) bastan: nunca se recorren más.
    const followed = await cached('followed', async () => slimArtists(await S.api.getFollowedArtists(2)));
    return pickArtists([...tops, followed], MAX_DISCOVER_ARTISTS);
  }

  /** Canciones nuevas de un artista: lanzamientos recientes (Novedades) o sus dos últimos álbumes (Descubre). */
  async function artistTracks(a) {
    const rel = await artistReleases(a.id);
    const albums = isNew ? recentAlbums(rel, st.days) : rel.filter((al) => al.album_type === 'album').slice(0, 2);
    const out = [];
    for (const al of albums) {
      if (overBudget()) break;
      out.push(...await albumTracks(al));
    }
    return out;
  }

  /** Añade al pool (barajado) canciones nuevas hasta tener `need`, recorrer los artistas de esta búsqueda o gastar el tope. */
  async function fill(need) {
    const stop = Math.min(st.artists.length, st.next + st.perSearch);
    while (st.pool.length < need && st.next < stop && !overBudget()) {
      status.progress('discoverReading', st.next, st.artists.length);
      const a = st.artists[st.next++];
      const fresh = notInLibrary(await artistTracks(a), st.libIds).filter((x) => !st.seen.has(x.uri));
      fresh.forEach((x) => st.seen.add(x.uri));
      st.pool.push(...shuffle(fresh));
    }
  }

  /** Quita del pool las que están en Tus me gusta, preguntando solo por las primeras `n` (lotes de 40, una petición cada uno). */
  async function dropSaved(n) {
    const toCheck = st.pool.slice(0, n).filter((x) => !st.checked.has(x.uri));
    if (!toCheck.length) return;
    status.phase('checkingLiked');
    const saved = await S.api.libraryContains(toCheck.map((x) => x.uri));
    toCheck.forEach((x) => st.checked.add(x.uri));
    const drop = new Set(toCheck.filter((_, i) => saved[i]).map((x) => x.uri));
    if (drop.size) st.pool = st.pool.filter((x) => !drop.has(x.uri));
  }

  /**
   * Busca hasta tener lo pedido. Si la cuota se agota a mitad, no reintenta: devuelve lo conseguido y lo marca.
   * Devuelve { taken, quota }.
   */
  async function gather() {
    const want = need(st.amount);
    let quota = false;
    try {
      await fill(want + 10);
      await dropSaved(want + 10);
    } catch (e) {
      if (!isQuota(e)) throw e;
      quota = true;
    }
    const { taken, rest } = takeAmount(st.pool, st.amount);
    st.pool = rest;
    return { taken, quota };
  }

  const need = (a) => (a.minutes ? Math.ceil(a.minutes / 3) + 5 : a.count);
  const name = () => generatedName({ mixName: t(isNew ? 'newName' : 'exploreName') }, nameLabels());

  function show(notes) {
    form.hidden = true;
    renderResult(result, status, {
      name: st.name, notes, tracks: st.tracks, playlistId: st.playlistId,
      headExtra: h('button', { class: 'btn find-more', type: 'button', id: `${kind}-more-songs`, onclick: () => more() }, t('findMore')),
      editable: true,
      onTracks: (list) => { st.tracks = list; },
      onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
    });
  }

  function showEmpty(title, text) {
    status.clear();
    setKids(empty, emptyArt(), h('p', { class: 'empty-title' }, title), h('p', { class: 'muted' }, text));
    empty.hidden = false;
  }

  function run() {
    task(status, async () => {
      empty.hidden = true;
      status.phase('readingLibrary');
      const s = style();
      st = {
        pool: [], next: 0, seen: new Set(), checked: new Set(), artists: [], tracks: [], days: days ? Number(days.value) : 0,
        name: name(), amount: amount(), perSearch: sanitizeArtistsPerSearch(Number(perSearch.value)),
      };
      let quota = false;
      try {
        st.libIds = await playlistIndex(status);
        st.artists = await artistsFor(s);
        if (!isNew && s === 'mine') {
          // Descubre empieza por los álbumes que escuchas últimamente.
          status.phase('readingListening');
          const recent = normalizeEntries(await S.api.getRecentlyPlayed()).tracks;
          const top = normalizeEntries((await S.api.getTopTracks('short_term')).map((track) => ({ track }))).tracks;
          const listened = [...recent, ...top];
          const byId = new Map(listened.map((tr) => [tr.albumId, tr]));
          const tracks = [];
          for (const id of albumsFromListening(listened, LISTENING_ALBUMS)) {
            if (overBudget()) break;
            const tr = byId.get(id);
            tracks.push(...await albumTracks({ id, name: tr?.album ?? '', images: tr?.thumb ? [{ url: tr.thumb }] : [] }));
          }
          const fresh = notInLibrary(withoutUris(tracks, listened.map((x) => x.uri)), st.libIds);
          fresh.forEach((x) => st.seen.add(x.uri));
          st.pool.push(...shuffle(fresh));
        }
      } catch (e) {
        if (!isQuota(e)) throw e;
        quota = true;
        st.libIds ??= new Set();
      }
      if (!quota && !st.artists.length && !st.pool.length) {
        const key = s === 'playlist' ? 'seedNoArtists' : s === 'genre' ? 'genreNoArtists' : 'newNoArtists';
        showEmpty(t('noArtistsTitle'), t(key));
        return;
      }
      const got = quota ? { taken: takeAmount(st.pool, st.amount).taken, quota } : await gather();
      const { taken } = got;
      if (got.quota && taken.length < MIN_TRACKS_ON_QUOTA) throw new ApiError(429, 'QUOTA_EXCEEDED', { error: { reason: 'QUOTA_EXCEEDED' } });
      if (!taken.length) {
        showEmpty(isNew ? t('newEmptyTitle', { n: st.days }) : t('exploreNoneTitle'), t(isNew ? 'newEmpty' : 'exploreNone'));
        return;
      }
      status.phase('shuffling');
      const description = genDescription(isNew ? 'newDesc' : 'exploreDesc', { n: st.days });
      await commitApp({ key: kind, name: st.name, description, uris: taken.map((x) => x.uri) }, status, async (w) => {
        st.playlistId = w.id;
        st.tracks = taken;
        const notes = [...w.notes, ...await uploadCover(w.id, t(isNew ? 'newName' : 'exploreName'))];
        if (got.quota) notes.push(t('quotaPartial', { n: fmt(taken.length) }));
        else if (!st.amount.minutes && taken.length < st.amount.count) notes.push(t('fewerFound', { n: fmt(taken.length) }));
        rememberRecent(kind);
        status.clear();
        show(notes);
      });
    }, kind);
  }

  /** «Buscar más»: otra tanda a la misma playlist (no se crea otra, así que no hay nada que borrar). */
  function more() {
    task(status, async () => {
      const { taken, quota } = await gather();
      if (!taken.length) {
        if (quota) throw new ApiError(429, 'QUOTA_EXCEEDED', { error: { reason: 'QUOTA_EXCEEDED' } });
        status.say(t(st.next >= st.artists.length ? 'noMoreFound' : 'noMoreYet'));
        return;
      }
      await result.flushPending?.();
      status.phase('saving');
      await withWriteLock(async () => {
        await assertStillAppPlaylist(st.playlistId);
        await S.api.addItems(st.playlistId, taken.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
      });
      st.tracks = [...st.tracks, ...taken];
      status.clear();
      show([t(quota ? 'quotaPartial' : 'addedMore', { n: fmt(taken.length) })]);
    }, `${kind}-more`);
  }

  const panel = h('section', { class: 'panel', id: `panel-${kind}`, hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t(isNew ? 'newTitle' : 'exploreTitle')), status.el, form, result);
  panel.refresh = () => { refresh(); };
  sync();
  return panel;
}

/** Olvidadas: Tus me gusta de hace años; como mucho 100, elegidas al azar entre todas las olvidadas (crear una de miles gastaría mucha cuota). */
const FORGOTTEN_MAX = 100;

function forgottenPanel() {
  const status = createStatus({ loader: true });
  const result = h('div', { class: 'result', hidden: true });
  const empty = h('div', { class: 'empty', id: 'forgotten-empty', hidden: true, role: 'status' });
  const years = segmented('forgotten-years', t('forgottenYearsLabel'), FORGOTTEN_YEARS.map((n) => [String(n), t('moreThanYears', { n: String(n) })]));
  years.set('2');
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'forgotten-go', onclick: () => run() }, t('forgottenBtn'));
  const form = h('div', {}, h('p', { class: 'lead' }, t('forgottenLead')), go, empty,
    h('details', { class: 'more', id: 'forgotten-more' }, h('summary', {}, t('moreOptions')), h('p', { class: 'field-label' }, t('forgottenYearsLabel')), years.el));
  function run() {
    task(status, async () => {
      empty.hidden = true;
      const n = Number(years.value);
      status.phase('reading');
      const list = forgottenTracks(await likedTracks(status), n);
      if (!list.length) {
        status.clear();
        setKids(empty, emptyArt(), h('p', { class: 'empty-title' }, t('forgottenEmptyTitle')), h('p', { class: 'muted' }, t('forgottenEmpty', { n })));
        empty.hidden = false;
        return;
      }
      const tracks = shuffle(list).slice(0, FORGOTTEN_MAX);
      const name = generatedName({ mixName: t('forgottenName') }, nameLabels());
      await commitApp({ key: 'forgotten', name, description: genDescription('forgottenDesc', { n }), uris: tracks.map((x) => x.uri) }, status, async (w) => {
        const notes = [...w.notes, ...await uploadCover(w.id, t('forgottenName'))];
        if (list.length > tracks.length) notes.push(t('forgottenSample', { n: fmt(tracks.length), m: fmt(list.length) }));
        rememberRecent('forgotten');
        status.clear();
        form.hidden = true;
        const removed = new Set();
        renderResult(result, status, {
          name, notes, tracks, playlistId: w.id,
          headExtra: h('button', { class: 'btn reshuffle', type: 'button', id: 'forgotten-again', onclick: () => again() }, icon(...ICONS.shuffle), h('span', {}, t('reshuffle'))),
          editable: true,
          onTracks: (_left, tr) => { removed.add(tr.uri); },
          reshuffle: () => again(),
          onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
        });
        /** Otras 100 al azar entre todas las olvidadas (nunca las que quitaste), en la misma playlist. */
        function again() {
          if (S.busy) return;
          result.cancelPending?.();
          task(status, async () => {
            const order = shuffle(list.filter((x) => !removed.has(x.uri))).slice(0, FORGOTTEN_MAX);
            await withWriteLock(async () => {
              await assertStillAppPlaylist(w.id);
              await S.api.replaceItems(w.id, order.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
            });
            status.clear();
            renderResult(result, status, { ...result.lastOptions, tracks: order, notes: [] });
          }, 'reshuffle');
        }
      });
    });
  }
  return h('section', { class: 'panel', id: 'panel-forgotten', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('forgottenTitle')), status.el, form, result);
}


// ---------- Tu resumen ----------

const SUMMARY_RANGES = [['short_term', 'range_short'], ['medium_term', 'range_medium'], ['long_term', 'range_long']];

function summaryPanel() {
  const status = createStatus();
  const range = segmented('summary-range', t('summaryRange'), SUMMARY_RANGES.map(([k, label]) => [k, t(label)]));
  const out = h('div', { id: 'summary-out', hidden: true });
  const empty = h('div', { class: 'empty', id: 'summary-empty', hidden: true, role: 'status' });
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'summary-go', onclick: () => run() }, t('summaryBtn'));
  let topTracks = [];
  let previewUrl = null;


  function run() {
    task(status, async () => {
      empty.hidden = true;
      out.hidden = true;
      const r = range.value;
      status.say(t('summaryReading'));
      const artists = (await S.api.getTopArtists(r, 5)).slice(0, 5);
      const rawTop = await S.api.getTopTracks(r);
      topTracks = normalizeEntries(rawTop.map((track) => ({ track }))).tracks;
      if (!artists.length && !topTracks.length) {
        status.clear();
        setKids(empty, emptyArt(), h('p', { class: 'empty-title' }, t('summaryEmptyTitle')), h('p', { class: 'muted' }, t('summaryEmpty')));
        empty.hidden = false;
        return;
      }
      const data = {
        title: t('summaryCardTitle'), range: t(SUMMARY_RANGES.find(([k]) => k === r)[1]),
        artistsLabel: t('summaryArtists'), tracksLabel: t('summaryTracks'),
        artists: artists.map((a) => ({ name: a.name ?? '', image: pickImage(a.images) })),
        tracks: rawTop.filter((x) => x?.uri).slice(0, 5).map((x) => ({ name: x.name ?? '', sub: (x.artists ?? []).map((a) => a.name).join(', '), image: pickImage(x.album?.images) })),
        footer: `${APP_NAME} · ${new Date().toLocaleDateString(getLang(), { dateStyle: 'medium' })}`,
      };
      status.say(t('summaryDrawing'));
      const [story, square] = await Promise.all([renderSummary(data, 'story'), renderSummary(data, 'square')])
        .catch((e) => { throw e?.message === 'spotifyLogo' ? new UserError(t('summaryNoLogo'), 'summaryNoLogo') : e; });
      status.clear();
      const stamp = new Date().toISOString().slice(0, 10);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(story.blob);
      const preview = h('img', { class: 'summary-preview', id: 'summary-preview', src: previewUrl, alt: t('summaryAlt', { range: data.range }), width: '270', height: '480' });
      setKids(out,
        story.missingImages ? h('p', { class: 'note' }, t('summaryNoImages')) : null,
        preview,
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', id: 'summary-share-story', onclick: () => saveFile(story.blob, `shuffl-resumen-${stamp}.png`, status) }, t('summaryShareStory')),
          h('button', { class: 'btn', type: 'button', id: 'summary-share-square', onclick: () => saveFile(square.blob, `shuffl-resumen-cuadrado-${stamp}.png`, status) }, t('summaryShareSquare'))),
        h('h2', {}, t('summaryArtists')), h('ol', { class: 'tracks summary-list', id: 'summary-artists' }, artists.map((a, i) => trackRow({ name: a.name ?? '', sub: '', thumb: pickThumb(a.images) }, i))),
        h('h2', {}, t('summaryTracks')), h('ol', { class: 'tracks summary-list', id: 'summary-tracks' }, topTracks.slice(0, 5).map((tr, i) => trackRow(tr, i))),
        spotifyAttribution(),
        topTracks.length ? h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', id: 'summary-playlist', onclick: () => makeTopPlaylist() }, t('summaryMakePlaylist'))) : null,
        result);
      out.hidden = false;
      rememberRecent('summary');
    });
  }

  const result = h('div', { class: 'result', hidden: true });
  function makeTopPlaylist() {
    task(status, async () => {
      const order = shuffle(uniqueByUri(topTracks));
      const name = generatedName({ mixName: t('topName') }, nameLabels());
      const description = genDescription('topDesc', { range: t(SUMMARY_RANGES.find(([k]) => k === range.value)[1]) });
      await commitApp({ key: 'top', name, description, uris: order.map((x) => x.uri) }, status, async (w) => {
        const notes = [...w.notes, ...await uploadCover(w.id, t('topName'))];
        status.clear();
        renderResult(result, status, {
          name, notes, tracks: order, playlistId: w.id, editable: true,
          onBack: () => { result.hidden = true; },
        });
      });
    });
  }

  return h('section', { class: 'panel', id: 'panel-summary', hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, t('summaryTitle')), h('p', { class: 'lead' }, t('summaryLead')),
    range.el, go, empty, out, status.el);
}

const pickImage = (images) => {
  const list = Array.isArray(images) ? images.filter((i) => typeof i?.url === 'string' && i.url.startsWith('https://')) : [];
  return (list.find((i) => (i.width ?? 0) >= 160 && (i.width ?? 0) <= 640) ?? list[0])?.url ?? '';
};

// ---------- Pestañas: Inicio · Shuffle · Descubrir · Más ----------

const TABS = [['home', 'tabHome'], ['shuffle', 'tabShuffle'], ['discover', 'tabDiscover'], ['more', 'tabMore']];
const TAB_ORDER = TABS.map(([key]) => key);
const TAB_LABEL = Object.fromEntries(TABS);
/** De qué pestaña cuelga cada pantalla (para marcarla y para «‹ Volver»). */
const PARENT = {
  roulette: 'shuffle',
  new: 'discover', explore: 'discover', forgotten: 'discover', summary: 'discover',
  sort: 'more', dups: 'more', backup: 'more', snap: 'more', orphans: 'more', split: 'more', proof: 'more', pin: 'more', settings: 'more', diag: 'more',
};
const PANEL_LABEL = {
  new: 'newTitle', explore: 'exploreTitle', forgotten: 'forgottenTitle', summary: 'summaryTitle',
  sort: 'tabSort', dups: 'tabDups', backup: 'tabBackup', snap: 'snapTitle', orphans: 'orphansTitle', split: 'splitTitle',
  roulette: 'rouletteTitle', proof: 'proofTitle', diag: 'diagTitle2',
};
const PANEL_ICON = {
  new: 'spark', explore: 'compass', forgotten: 'clock', summary: 'trophy',
  sort: 'sort', dups: 'dups', backup: 'backup', snap: 'snap', orphans: 'orphans', split: 'split',
  roulette: 'roulette', proof: 'proof', pin: 'pin', settings: 'settings', diag: 'diag',
};
const tabOf = (key) => PARENT[key] ?? key;

const navCard = (key, title, sub, extra = '') => h('button', { class: `card ${extra}`.trim(), type: 'button', id: `card-${key}`, onclick: () => S.show(key) },
  h('span', { class: 'card-icon' }, icon(...ICONS[PANEL_ICON[key] ?? key])),
  h('span', {}, h('span', { class: 'card-title' }, title), sub ? h('span', { class: 'card-sub' }, sub) : null));

function discoverPanel() {
  return h('section', { class: 'panel', id: 'panel-discover', hidden: true },
    h('h2', { class: 'tool-title' }, t('tabDiscover')),
    h('p', { class: 'lead' }, t('discoverLead')),
    h('h2', {}, t('discoverNew')),
    h('div', { class: 'cards' },
      navCard('new', t('newTitle'), t('cardNewSub')),
      navCard('explore', t('exploreTitle'), t('cardExploreSub'))),
    h('h2', {}, t('discoverYours')),
    h('div', { class: 'cards' },
      navCard('forgotten', t('forgottenTitle'), t('cardForgottenSub')),
      navCard('summary', t('summaryTitle'), t('cardSummarySub'))),
    h('p', { class: 'muted small' }, t('discoverNote')));
}

function morePanel() {
  return h('section', { class: 'panel', id: 'panel-more', hidden: true },
    h('h2', { class: 'tool-title' }, t('tabMore')),
    h('h2', {}, t('moreTools')),
    h('div', { class: 'cards' },
      navCard('sort', t('tabSort'), t('cardSortSub')),
      navCard('dups', t('tabDups'), t('cardDupsSub')),
      navCard('backup', t('tabBackup'), t('cardBackupSub')),
      navCard('snap', t('snapTitle'), t('cardSnapSub')),
      navCard('orphans', t('orphansTitle'), t('cardOrphansSub')),
      navCard('split', t('splitTitle'), t('cardSplitSub'))),
    h('h2', {}, APP_NAME),
    h('div', { class: 'cards' },
      navCard('pin', t('pinTitle'), t('cardPinSub')),
      navCard('proof', t('proofTitle'), t('cardProofSub')),
      navCard('diag', t('diagTitle2'), t('cardDiagSub')),
      navCard('settings', t('settings'), t('cardSettingsSub'))));
}

/** «hoy, 18:30», «ayer, 09:10» o «12 nov, 18:30». */
function whenLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' });
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff === 0) return t('whenToday', { time });
  if (diff === 1) return t('whenYesterday', { time });
  return `${d.toLocaleDateString(getLang(), { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Carátula del último origen: la de su primera playlist (♥ para Tus me gusta). Siempre entera, sin nada encima. */
function lastCover(mix) {
  const first = mix.library ? null : S.playlists.find((p) => p.id === mix.ids[0]);
  if (first?.isLiked) return h('span', { class: 'again-cover liked', 'aria-hidden': 'true' }, '♥');
  if (first?.image?.startsWith('https://')) return h('img', { class: 'again-cover', src: first.image, alt: '', width: '72', height: '72' });
  return h('span', { class: 'again-cover', 'aria-hidden': 'true' }, icon(...ICONS.shuffle));
}

function homePanel() {
  const slot = h('div', { class: 'home' });
  const panel = h('section', { class: 'panel', id: 'panel-home', hidden: true }, slot);
  const mixRow = (mix) => h('div', { class: 'mix-row' },
    h('button', { class: 'card', type: 'button', 'data-mix': mix.id, onclick: () => S.runMix(mix, mixOrigin(mix)) },
      h('span', { class: 'card-icon' }, icon(...ICONS[mix.kind === 'time' ? 'clock' : 'shuffle'])),
      h('span', {}, h('span', { class: 'card-title' }, mix.name), h('span', { class: 'card-sub' }, mixSummary(mix)))),
    h('button', { class: 'icon-btn', type: 'button', 'data-shortcut': mix.id, 'aria-label': t('shortcutBtn', { name: mix.name }), onclick: () => showShortcutSheet(mix) }, icon(...ICONS.mic)),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('editMix', { name: mix.name }), onclick: () => S.editMix(mix) }, icon(...ICONS.edit)),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('deleteMix', { name: mix.name }), onclick: () => {
      if (!confirm(t('confirmDeleteMix', { name: mix.name }))) return;
      setMixes(removeMix(getMixes(), mix.id));
      panel.refresh();
    } }, icon(...ICONS.trash)));
  panel.refresh = () => {
    const raw = getItem(KEYS.lastMix);
    const mix = raw && sanitizeMix({ ...raw, id: 'last', name: 'last' });
    const mixes = getMixes();
    const saved = raw?.mixId && mixes.find((m) => m.id === raw.mixId);
    const origin = saved ? mixOrigin(saved) : null;
    /** Agitar: siempre pide confirmación, porque crea una playlist nueva y quita la anterior de Shuffl. */
    S.shakeShuffle = mix ? () => {
      if (!confirm(t('shakeConfirm', { name: saved?.name ?? mixLabel(mix) }))) return;
      navigator.vibrate?.(40);
      S.runMix(mix, origin, { modeOverride: 'reuse' });
    } : null;
    const touch = matchMedia('(pointer: coarse)').matches && typeof DeviceMotionEvent !== 'undefined';
    const shakeHint = !mix || !touch || !shakeEnabled() ? null
      : motionNeedsPermission() && !SHAKE.granted
        ? h('button', { class: 'btn shortcut', type: 'button', id: 'shake-enable', onclick: async () => { if (await requestMotion()) panel.refresh(); } }, t('shakeEnable'))
        : h('p', { class: 'muted small', id: 'shake-hint' }, t('shakeHint'));
    const recent = recentPanels();
    const when = raw?.at ? whenLabel(raw.at) : '';
    const top = mix
      ? h('article', { class: 'again', id: 'again-card' },
        h('div', { class: 'again-head' }, lastCover(mix),
          h('div', { class: 'again-text' },
            h('p', { class: 'again-kicker' }, t('againKicker')),
            h('h2', { class: 'again-name', id: 'again-name' }, saved?.name ?? mixLabel(mix)),
            when ? h('p', { class: 'again-when' }, t('againWhen', { when })) : null)),
        h('div', { class: 'again-actions' },
          h('button', { class: 'btn primary again-go', type: 'button', id: 'card-last-mix', onclick: () => S.runMix(mix, origin) }, icon(...ICONS.shuffle), h('span', {}, t('againBtn'))),
          h('button', { class: 'btn', type: 'button', id: 'hero-other', onclick: () => S.show('shuffle') }, t('heroOther'))))
      : h('article', { class: 'again welcome', id: 'welcome-card' },
        h('h2', { class: 'again-name' }, t('welcomeTitle')),
        h('p', { class: 'muted' }, t('welcomeText')),
        h('button', { class: 'btn primary again-go', type: 'button', id: 'hero-start', onclick: () => S.show('shuffle') }, t('startBtn')));
    setKids(slot,
      top,
      shakeHint,
      recent.length ? h('h2', {}, t('recentTitle')) : null,
      recent.length ? h('div', { class: 'chips' }, recent.map((key) => h('button', { class: 'chip', type: 'button', 'data-recent': key, onclick: () => S.show(key) },
        icon(...ICONS[PANEL_ICON[key]]), h('span', {}, t(PANEL_LABEL[key]))))) : null,
      h('h2', {}, t('savedMixes')),
      mixes.length ? mixes.map(mixRow) : h('p', { class: 'muted', id: 'mixes-empty' }, t('mixesEmpty')));
  };
  return panel;
}

const mixLabel = (mix) => {
  const src = mixSources(mix, t('libraryName'));
  if (mix.kind !== 'time') return src;
  const p = presetByKey(mix.preset);
  return `${p ? `${p.emoji} ${t(`preset_${p.key}`)} ` : ''}${t('minutesShort', { n: mix.minutes })} · ${src}`;
};

function mountApp() {
  S.pickers = [];
  BACK_BARS.clear();
  const panels = {
    home: homePanel(), shuffle: shufflePanel(), discover: discoverPanel(), more: morePanel(),
    new: discoverGenPanel('new'), explore: discoverGenPanel('explore'), forgotten: forgottenPanel(), summary: summaryPanel(),
    sort: sortPanel(), dups: dupsPanel(), backup: backupPanel(),
    snap: snapPanel(), orphans: orphansPanel(), split: splitPanel(), pin: pinPanel(), settings: settingsPanel(),
    roulette: roulettePanel(), proof: proofPanel(), diag: diagPanel(),
  };
  const tabBtns = {};
  let prev = null;
  S.backTarget = () => (prev && prev !== S.tab ? prev : tabOf(S.tab));
  S.back = () => show(S.backTarget());
  /**
   * Cambio de pantalla inmediato: sin View Transitions (en iOS, y más en la app instalada, hacían que la pantalla
   * «vibrara» casi un segundo) ni desplazamientos; solo un fundido de 120 ms. Cada pantalla recuerda su scroll.
   */
  const show = (key) => {
    const changed = S.tab !== key;
    if (changed) {
      S.scroll[S.tab] = window.scrollY;
      // «Volver» lleva a la pantalla anterior si es de la misma pestaña (Inicio → Ordenar → Volver vuelve a Inicio).
      prev = PARENT[key] ? S.tab : null;
    }
    S.tab = key;
    for (const [k, p] of Object.entries(panels)) {
      const on = k === key;
      if (p.hidden === on) p.hidden = !on;
    }
    for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-current', k === tabOf(key) ? 'page' : 'false');
    for (const b of BACK_BARS) b.sync();
    panels[key].refresh?.();
    if (changed) {
      window.scrollTo(0, S.scroll[key] ?? 0);
      if (!prefersReducedMotion()) {
        panels[key].classList.remove('fade');
        void panels[key].offsetWidth;
        panels[key].classList.add('fade');
      }
    }
  };
  S.show = show;
  const nav = h('nav', { class: 'tabs', 'aria-label': t('sections') }, TABS.map(([label_key, label]) => {
    const b = h('button', { type: 'button', id: `tab-${label_key}`, onclick: () => show(label_key) }, icon(...ICONS[label_key]), h('span', {}, t(label)));
    tabBtns[label_key] = b;
    return b;
  }));
  setKids(root,
    h('header', { class: 'top' }, h('h1', {}, h('img', { src: 'icons/icon.svg', alt: '', width: '28', height: '28' }), APP_NAME)),
    h('main', {}, Object.values(panels)),
    nav);
  S.tab = S.tab in panels ? S.tab : 'home';
  const first = S.tab;
  S.tab = null;
  show(first);
  // Aviso de un solo uso, solo en Inicio: al pulsar «Entendido» no vuelve a salir.
  showNotice('logo-notice', t('logoNotice'), KEYS.logoNotice);
  syncShake();
  // Chrome también expone requestPermission y lo concede sin preguntar; iOS lo rechaza sin un toque y entonces sale el botón.
  if (shakeEnabled() && motionNeedsPermission() && !SHAKE.granted && !SHAKE.tried) {
    SHAKE.tried = true;
    requestMotion().then((ok) => { if (ok && S.tab === 'home') panels.home.refresh(); });
  }
  S.playlists = S.playlists.length ? S.playlists : [likedEntry()];
  S.pickers.forEach((p) => p.update());
}


// ---------- Pantalla inicial ----------

function renderSetup(problem) {
  S.playlists = [];
  S.loaded = false;
  const idIn = h('input', { type: 'text', id: 'client-id', class: 'text mono', value: auth.getClientId(), placeholder: t('clientIdPlaceholder'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('clientId') });
  const err = h('p', { class: 'error', role: 'alert', hidden: !problem }, problem ? errorMessage(problem) : '');
  const connect = h('button', { class: 'btn primary big', type: 'button', id: 'connect', onclick: async () => {
    const id = idIn.value.trim();
    if (!/^[a-f0-9]{32}$/i.test(id)) { err.textContent = t('badClientId'); err.hidden = false; return; }
    auth.setClientId(id);
    try { await auth.startLogin(); } catch (e) { err.textContent = errorMessage(e); err.hidden = false; }
  } }, t('connect'));
  const langSel = h('select', { 'aria-label': t('language'), onchange: () => { setLang(langSel.value); renderSetup(problem); } },
    LANGS.map(([code, label]) => { const o = h('option', { value: code }, label); if (code === getLang()) o.selected = true; return o; }));
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
  const actions = {
    step1: h('a', { class: 'btn', href: 'https://developer.spotify.com/dashboard', target: '_blank', rel: 'noopener', id: 'open-dashboard' }, t('openDashboard')),
    step3: copyBox(auth.redirectUri()),
    step4: idIn,
  };
  const stepItem = (s, i) => {
    const li = h('li', { class: 'step' });
    const box = h('input', { type: 'checkbox', 'aria-label': t('stepDone', { n: i + 1 }), onchange: () => li.classList.toggle('done', box.checked) });
    li.append(h('label', { class: 'check step-head' }, box, h('span', {}, t(s))));
    if (actions[s]) li.append(actions[s]);
    return li;
  };
  setKids(root,h('main', { class: 'setup' },
    h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '', width: '72', height: '72' }), h('h1', {}, APP_NAME)),
    h('p', { class: 'lead' }, t('welcome')),
    h('h2', {}, t('guideTitle')),
    h('ol', { class: 'steps' }, steps.map(stepItem)),
    h('p', { class: 'muted' }, t('premiumNote')),
    err, connect,
    h('details', { class: 'more', id: 'setup-diagnosis' }, h('summary', {}, t('diagTitle')),
      h('ul', { class: 'diag' }, ['diagRedirect', 'diagUserMgmt', 'diagPremium', 'diagQuota', 'diagClientId'].map((k) => h('li', {}, t(k))))),
    h('p', { class: 'muted small' }, t('notAffiliated')),
    langSel));
}

function renderReconnect() {
  S.playlists = [];
  const err = h('p', { class: 'error', role: 'alert', hidden: true });
  setKids(root, h('main', { class: 'setup' },
    h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '', width: '72', height: '72' }), h('h1', {}, APP_NAME)),
    h('p', { class: 'lead', id: 'reconnect-msg' }, t('reconnectMsg')),
    err,
    h('button', { class: 'btn primary big', type: 'button', id: 'reconnect', onclick: async () => {
      try { await auth.startLogin(); } catch (e) { err.textContent = errorMessage(e); err.hidden = false; }
    } }, t('connect'))));
}

// ---------- Tema y gestos ----------

const THEMES = ['dark', 'light', 'auto'];
const currentTheme = () => (THEMES.includes(getItem(KEYS.theme)) ? getItem(KEYS.theme) : 'dark');
const applyTheme = () => { document.documentElement.dataset.theme = currentTheme(); };

function ptrIndicator() {
  let ind = document.getElementById('ptr');
  if (!ind) {
    ind = h('div', { id: 'ptr', class: 'ptr', role: 'status' });
    document.body.append(ind);
  }
  return ind;
}

/** Aviso breve arriba al tirar hacia abajo. */
function pullHint(text) {
  const ind = ptrIndicator();
  ind.textContent = text;
  ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), 1200);
}

/** Vuelve a pedir permiso a Spotify (sesión caducada o falta un permiso). */
async function reconnect() {
  try {
    await auth.startLogin();
  } catch (e) {
    recordError(e);
    showToast(errorMessage(e));
  }
}

let toastTimer = null;
/** Mensaje flotante abajo, para errores que no son de ninguna pantalla. Con «Diagnóstico» para copiar el informe. */
function showToast(text) {
  document.getElementById('toast')?.remove();
  const box = h('div', { class: 'toast', id: 'toast', role: 'alert' },
    h('p', {}, text),
    S.show ? h('button', { class: 'btn', type: 'button', onclick: () => { box.remove(); S.show('diag'); } }, t('diagTitle2')) : null,
    h('button', { class: 'btn', type: 'button', 'aria-label': t('close'), onclick: () => box.remove() }, '×'));
  document.body.append(box);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.remove(), 8000);
}

let lastCrash = 0;
/**
 * Red de seguridad: un error que no ha recogido ninguna pantalla se registra y se explica en un aviso, nunca una
 * pantalla en blanco ni un botón que se queda sin hacer nada. Como mucho un aviso cada 3 s.
 */
function onCrash(err) {
  if (!err || err?.name === 'AbortError') return;
  recordError(err);
  console.error(err);
  if (Date.now() - lastCrash < 3000) return;
  lastCrash = Date.now();
  showToast(errorMessage(err));
}
window.addEventListener('error', (e) => { if (e.error) onCrash(e.error); });
window.addEventListener('unhandledrejection', (e) => onCrash(e.reason));

async function refreshPlaylists() {
  if (S.busy || !S.api) return;
  const ind = ptrIndicator();
  ind.textContent = t('refreshing');
  ind.classList.add('show');
  S.busy = true;
  try {
    await loadPlaylists();
    await probeLiked();
    ind.textContent = t('refreshed');
  } catch (e) {
    console.error(e);
    ind.textContent = errorMessage(e);
  } finally {
    S.busy = false;
    setTimeout(() => ind.classList.remove('show'), 1200);
  }
}

/** Deslizar a los lados cambia de pestaña; tirar hacia abajo desde arriba refresca las playlists. */
function bindGestures() {
  let start = null;
  document.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    start = { x: p.clientX, y: p.clientY, ignore: !!e.target.closest?.('.picker, input, select, textarea, .sheet-backdrop, .removable') };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const s = start;
    start = null;
    if (!s || s.ignore || !S.api || document.querySelector('.sheet-backdrop')) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Math.abs(dx) > Math.abs(dy) * 2) {
      const next = TAB_ORDER[TAB_ORDER.indexOf(S.tab) + (dx < 0 ? 1 : -1)];
      if (TAB_ORDER.includes(S.tab) && next) S.show(next, dx < 0 ? 1 : -1);
    } else if (dy > 90 && Math.abs(dx) < 40 && window.scrollY <= 0) {
      // En un resultado que se puede rebarajar, tirar hacia abajo rebaraja; en el resto, refresca tus playlists.
      const result = document.querySelector(`#panel-${S.tab} .result:not([hidden])`);
      if (result?.pullAction && !S.busy) { pullHint(t('pullReshuffle')); result.pullAction(); } else refreshPlaylists();
    }
  }, { passive: true });
}

// ---------- Arranque ----------

async function boot() {
  setLang();
  applyTheme();
  OBSOLETE_KEYS.forEach(removeItem);
  bindGestures();
  // El enlace profundo se quita de la barra en cuanto se lee: recargar nunca vuelve a barajar ni a reproducir.
  const link = parseDeepLink(location.search);
  if (LINK_PARAMS.some((p) => new URLSearchParams(location.search).has(p))) history.replaceState(null, '', withoutDeepLink(location.href));
  let problem = null;
  try {
    await auth.handleCallback();
  } catch (e) {
    problem = e;
  }
  if (!auth.getClientId() || !auth.isLoggedIn()) return renderSetup(problem);
  if (auth.needsReconnect()) return renderReconnect();
  S.api = new SpotifyApi({ auth, onRequest: countRequest });
  try {
    S.me = await S.api.getMe();
    idbPrune(LONG_TTL_MS);
    mountApp();
    await loadPlaylists();
    await probeLiked();
    if (link) await S.openDeepLink(link);
  } catch (e) {
    console.error(e);
    if (e instanceof auth.AuthError) return renderSetup(e);
    recordError(e);
    const info = errorInfo(e);
    setKids(root, h('main', { class: 'setup', id: 'boot-error' }, h('p', { class: 'error', role: 'alert' }, info.text),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, t('retry')),
      info.reconnect ? h('button', { class: 'btn', type: 'button', onclick: () => reconnect() }, t('reconnectBtn')) : null));
  }
}

function showUpdateBanner(apply) {
  if (document.getElementById('update-banner')) return;
  document.body.append(h('div', { id: 'update-banner', class: 'update-banner', role: 'status' },
    h('span', {}, t('updateAvailable')),
    h('button', { class: 'btn primary', type: 'button', id: 'update-apply', onclick: (e) => {
      if (S.busy) { e.currentTarget.textContent = t('updateBusy'); return; }
      apply();
    } }, t('update'))));
}

registerUpdates({ onUpdate: showUpdateBanner }).catch((e) => console.warn('Service worker no registrado', e.message));
boot();
