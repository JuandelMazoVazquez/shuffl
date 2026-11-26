import {
  LIKED_ID, shuffle, uniqueByUri, capPlaylist, normalizeEntries, normalizePlaylist, sortTracks, SORT_KEYS,
  filterByAdded, findDuplicates, removeIndexes, buildBackup, toCsv, validateBackup, MAX_BACKUP_BYTES, MAX_BACKUP_PLAYLISTS,
  EXPLICIT_MODES, emptyFilters, hasFilters, filterTracks, sanitizeFilters, organizePlaylists, parsePlaylistRef,
  SPLIT_MODES, MAX_SPLIT_PARTS, splitTracks, MULTI_KEYS, sortTracksBy, normalizeAlbum, normalizeFollowedArtist, toLibraryCsv,
} from './core.js';
import { sanitizeMix, sanitizeMixes, upsertMix, removeMix, newMixId, mixSources } from './mixes.js';
import {
  sourceKey, generatedName, datedName, generatedDescription, sameDescription, sanitizeTargets, setTarget,
  isGeneratedPlaylist, tagFor, withTag, readTag, findCandidates, pickKeep, duplicateGroups,
  findLegacyBaraja, groupKeyOf,
} from './targets.js';
import { SpotifyApi, ApiError } from './api.js';
import * as auth from './auth.js';
import { KEYS, getItem, setItem, removeItem } from './storage.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { REPO_URL, APP_NAME } from './config.js';
import { registerUpdates } from './update.js';
import { makeCover } from './cover.js';
import { parseDeepLink, buildDeepLink, withoutDeepLink, LINK_PARAMS } from './links.js';
import {
  createShakeDetector, pickIndex, spinSequence, spinDelays, naiveShuffle, fairShuffle, firstSongHistogram, maxDeviation,
} from './random.js';
import { imageDominantColor, rgbCss } from './color.js';
import {
  MINUTE, TIME_PRESETS, MIN_MINUTES, MAX_MINUTES, sanitizeMinutes, fitDuration, groupAlbums, shuffleAlbums,
  onThisDayGroups, topArtist, forgottenTracks, FORGOTTEN_YEARS, pickArtists, recentAlbums, RELEASE_DAYS, albumsFromListening,
  withoutUris, pruneCache, cacheGet, cacheSet,
} from './generators.js';
import { SHUFFLE_KINDS } from './mixes.js';
import { renderSummary } from './summary.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const root = document.getElementById('app');
const S = { api: null, me: null, playlists: [], raw: [], sourceCache: new Map(), loaded: false, busy: false, tab: 'home', pickers: [], cleanDeclined: new Set() };
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
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
};

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

class UserError extends Error {}

function errorMessage(e) {
  if (e instanceof UserError) return e.message;
  if (e instanceof auth.AuthError) return t(e.code === 'invalid_grant' ? 'errSession' : `authErr_${e.code}`);
  if (e instanceof ApiError) {
    if (e.status === 0) return t('errIncomplete');
    if (e.reason === 'QUOTA_EXCEEDED') return t('errQuota');
    if (e.reason === 'PREMIUM_REQUIRED') return t('errPremiumPlayer');
    if (e.status === 403) return t('err403');
    if (e.status === 404) return t('err404');
    if (e.status === 429) return t('errRate');
    return `${t('errGeneric')} (${e.status}${e.message ? `: ${e.message}` : ''})`;
  }
  if (e instanceof TypeError) return t('errNetwork');
  return e?.message || t('errGeneric');
}

// ---------- Estado de tarea (progreso y errores) ----------

/** Con `loader` muestra los naipes mezclándose; su barra sigue el progreso real. */
function createStatus({ loader = false } = {}) {
  const bar = h('progress', { hidden: true, max: '1', value: '0' });
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' });
  const err = h('p', { class: 'error', role: 'alert', hidden: true });
  const cards = loader
    ? h('div', { class: 'loader', 'aria-hidden': 'true' }, h('div', { class: 'deck' }, h('div', { class: 'lcard' }), h('div', { class: 'lcard' }), h('div', { class: 'lcard' })), h('div', { class: 'loader-bar' }))
    : null;
  const showCards = (on) => cards?.classList.toggle('on', on);
  return {
    el: h('div', { class: 'status' }, cards, live, bar, err),
    say(msg) { live.textContent = msg; err.hidden = true; showCards(false); },
    progress(key, done, total) {
      live.textContent = t(key, { done: fmt(done), total: fmt(total) });
      bar.hidden = false;
      bar.max = Math.max(total, 1);
      bar.value = done;
      if (cards) { showCards(true); cards.style.setProperty('--p', String(Math.min(1, done / Math.max(total, 1)))); }
    },
    stop() { bar.hidden = true; showCards(false); },
    clear() { live.textContent = ''; bar.hidden = true; err.hidden = true; showCards(false); },
    fail(e) {
      console.error(e);
      live.textContent = '';
      bar.hidden = true;
      showCards(false);
      err.textContent = errorMessage(e);
      err.hidden = false;
    },
  };
}

async function task(status, fn) {
  if (S.busy) return;
  S.busy = true;
  document.body.classList.add('busy');
  status.clear();
  try {
    await fn();
  } catch (e) {
    status.fail(e);
  } finally {
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
  S.playlists = organizePlaylists([likedEntry(S.playlists.find((p) => p.isLiked)), ...raw.map((p) => normalizePlaylist(p, S.me.id))]);
  S.loaded = true;
  S.sourceCache.clear();
  S.pickers.forEach((p) => p.update());
}

const getMixes = () => sanitizeMixes(getItem(KEYS.mixes, []));
const setMixes = (list) => setItem(KEYS.mixes, list);
const getTargets = () => sanitizeTargets(getItem(KEYS.targets, {}));
/** Playlists que crea la app: no cuentan como origen de «toda mi biblioteca» ni de «Me gusta sin playlist». */
const isGenerated = (pl) => isGeneratedPlaylist(pl, getTargets(), getItem(KEYS.barajaId));
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
async function setTint(pl) {
  const token = ++tintToken;
  const root = document.documentElement;
  const url = pl && !pl.isLiked && pl.image.startsWith('https://') ? pl.image : null;
  const color = url ? await imageDominantColor(url) : null;
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

async function readSource(pl, onProgress) {
  const entries = pl.isLiked ? await S.api.getLikedTracks(onProgress) : await S.api.getPlaylistItems(pl.id, onProgress);
  return normalizeEntries(entries);
}

async function readSources(list, status) {
  const grand = list.reduce((n, p) => n + (p.total ?? 0), 0);
  const tracks = [];
  const skipped = { local: 0, empty: 0 };
  let base = 0;
  for (const pl of list) {
    const r = await readSource(pl, (d, tot) => status.progress('reading', base + d, Math.max(grand, base + tot)));
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
  if (prev?.pending) throw new UserError(t('errPending', { name: prev.name || prev.playlistId }));
  const entry = { playlistId, name, uris, pending: true, date: new Date().toISOString() };
  if (setItem(KEYS.undo, entry, { strict: true })) return;
  // La caché de Descubrir puede haber llenado el almacenamiento: Deshacer va antes.
  dropMetaCache();
  if (!setItem(KEYS.undo, entry, { strict: true })) throw new UserError(t('errUndoStorage'));
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
  if (!setItem(KEYS.undo, { ...u, pending: true }, { strict: true })) throw new UserError(t('errUndoStorage'));
}

async function overwritePlaylist(id, uris, status) {
  markUndoPending(id);
  await S.api.replaceItems(id, uris, (d, tot) => status.progress('saving', d, tot));
  finishUndo(id, uris.length);
}

/** Comprueba el total y la primera página (si se pasa `expected`) antes de escribir con datos leídos antes. */
async function assertUnchanged(playlistId, expectedTotal, expected) {
  const page = await S.api.request('GET', `/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track,episode`);
  if (page.total !== expectedTotal) throw new UserError(t('errChanged'));
  if (!expected) return;
  if (!Array.isArray(page.items)) throw new ApiError(0, 'incomplete');
  const head = normalizeEntries(page.items).tracks;
  if (head.some((x, i) => x.uri !== expected[i]?.uri)) throw new UserError(t('errChanged'));
}

function confirmOverwrite(name, skipped) {
  const lost = skipped ? ` ${t('confirmLost', { n: fmt(skipped) })}` : '';
  return confirm(t('confirmOverwrite', { name }) + lost);
}

async function applyUndo(status, expectedId) {
  const u = getItem(KEYS.undo);
  if (!u) return false;
  if (expectedId && u.playlistId !== expectedId) throw new UserError(t('errUndoOther'));
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

// ---------- Playlists «· Shuffle»: una por origen en cualquier dispositivo (v1.3) ----------

const autoClean = () => getItem(KEYS.autoClean) === true;

/** Ms de la última escritura de cada playlist (solo hace falta si hay más de una candidata). */
async function lastWrites(list) {
  const map = new Map();
  if (list.length < 2) return map;
  for (const p of list) map.set(p.id, await S.api.lastWriteTime(p.id));
  return map;
}

/** Playlists que nunca se quitan: los orígenes de las mezclas guardadas y de la última mezcla (atajos, agitar). */
function sourceIds() {
  const last = getItem(KEYS.lastMix);
  return [...getMixes().flatMap((m) => m.ids), ...(Array.isArray(last?.ids) ? last.ids : [])];
}

/**
 * Escribe `uris` en la «· Shuffle» de `key`: la busca por su etiqueta en tus playlists (o, sin etiqueta, la de la v1.2
 * que este dispositivo ya usaba o la única con ese nombre y descripción), reutiliza la más reciente y le pone nombre,
 * descripción y etiqueta; si no hay, la crea. `protect`: los orígenes de esta baraja, que nunca se sobrescriben ni se
 * quitan. Devuelve { id, notes }.
 */
async function writeGenerated({ key, name, description, uris, protect = [] }, status) {
  const tag = await tagFor(key);
  const full = withTag(description, tag);
  const result = await withWriteLock(async () => {
    const raw = await S.api.getMyPlaylists();
    const cands = findCandidates(raw, { meId: S.me.id, tag, name, legacyDescription: description, preferredId: getTargets()[key] })
      .filter((p) => !protect.includes(p.id));
    const keep = pickKeep(cands, await lastWrites(cands), getTargets()[key]);
    const notes = [];
    let id;
    if (keep) {
      id = keep.id;
      if (!getItem(KEYS.undo)) {
        const current = normalizeEntries(await S.api.getPlaylistItems(id)).tracks;
        saveUndo(id, keep.name, current.map((x) => x.uri), { soft: true });
      }
      if (keep.name !== name || !sameDescription(keep.description, full)) {
        try {
          await S.api.updatePlaylistDetails(id, { name, description: full });
        } catch (e) {
          console.warn('Nombre no actualizado:', e?.status ?? e?.message);
          notes.push(t('renameFailed'));
        }
      }
    } else {
      id = (await S.api.createPlaylist(name, full)).id;
    }
    setItem(KEYS.targets, setTarget(getTargets(), key, id));
    await overwritePlaylist(id, uris, status);
    const tagged = cands.filter((p) => p.id !== id && readTag(p.description) === tag);
    return { id, notes, group: tagged.length ? { key: `tag:${tag}`, name, keepId: id, legacy: false, count: tagged.length + 1 } : null };
  });
  if (result.group) result.notes.push(...await offerCleanup([result.group], { protect }));
  return { id: result.id, notes: result.notes };
}

/** Hoja de confirmación de la limpieza, con una casilla por grupo. Devuelve { ok, always, keys, legacy }. */
function confirmCleanup(groups, legacy) {
  return new Promise((resolve) => {
    const always = h('input', { type: 'checkbox', id: 'clean-always' });
    always.checked = autoClean();
    // Las de la v1.2 sin etiqueta pueden venir de orígenes distintos con el mismo nombre: sin marcar por defecto.
    const boxes = groups.map((g) => {
      const box = h('input', { type: 'checkbox', 'data-group': g.key });
      box.checked = !g.legacy;
      return { g, box };
    });
    const legacyBox = legacy ? h('input', { type: 'checkbox', id: 'clean-legacy' }) : null;
    if (legacyBox) legacyBox.checked = true;
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const close = (ok) => {
      document.removeEventListener('keydown', onKey);
      sheet.remove();
      resolve({ ok, always: always.checked, keys: boxes.filter((b) => b.box.checked).map((b) => b.g.key), legacy: !!legacyBox?.checked });
    };
    const single = groups.length === 1 && !legacy && !groups[0].legacy;
    const title = single ? t('cleanTitleOne', { n: fmt(groups[0].count), name: groups[0].name }) : t('cleanTitleMany');
    const sheet = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) close(false); } },
      h('div', { class: 'sheet', id: 'clean-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', { class: 'sheet-title' }, title),
        single ? null : h('div', { class: 'clean-list' },
          boxes.map(({ g, box }) => h('label', { class: 'check' }, box,
            h('span', {}, t(g.legacy ? 'cleanGroupLegacy' : 'cleanGroup', { name: g.name, n: fmt(g.count) })))),
          legacyBox ? h('label', { class: 'check' }, legacyBox, h('span', {}, t('cleanLegacy', { name: legacy.name }))) : null),
        h('p', {}, t('cleanWhat')),
        h('p', { class: 'muted small' }, t('cleanRecover')),
        groups.length ? h('label', { class: 'check' }, always, h('span', {}, t('cleanAlways'))) : null,
        h('button', { class: 'btn primary', type: 'button', id: 'clean-ok', onclick: () => close(true) }, t('cleanOk')),
        h('button', { class: 'btn', type: 'button', id: 'clean-no', onclick: () => close(false) }, t('notNow'))));
    document.addEventListener('keydown', onKey);
    document.body.append(sheet);
    sheet.querySelector('#clean-ok').focus();
  });
}

/**
 * Quita (deja de seguir) las copias repetidas de cada grupo y, si se pasa, la antigua «🔀 Baraja».
 * `groups`: [{ key, name, keepId, legacy, count }]. Pregunta salvo en automático; los grupos sin etiqueta (v1.2)
 * y la antigua «🔀 Baraja» siempre se preguntan. Antes de quitar, con el candado de escritura y la biblioteca recién
 * leída, se vuelve a calcular cada grupo: si la que se conserva ya no es la misma (otra pestaña o dispositivo escribió
 * en otra, o la renombraste), ese grupo se salta. Nunca se quita un origen. Si falla, no se pierde nada. Devuelve avisos.
 */
async function offerCleanup(groups, { protect = [], legacy = null, ask = !autoClean() } = {}) {
  let pending = groups.filter((g) => !S.cleanDeclined.has(g.key));
  let legacyLeft = legacy && !getItem(KEYS.migrationNotice) ? legacy : null;
  if (!pending.length && !legacyLeft) return [];
  if (ask || legacyLeft || pending.some((g) => g.legacy)) {
    const answer = await confirmCleanup(pending, legacyLeft);
    if (!answer.ok) {
      pending.forEach((g) => S.cleanDeclined.add(g.key));
      // Quien quiere conservar la antigua «🔀 Baraja» no vuelve a ver la pregunta.
      if (legacyLeft) setItem(KEYS.migrationNotice, true);
      return [];
    }
    if (pending.length) setItem(KEYS.autoClean, answer.always);
    pending.filter((g) => !answer.keys.includes(g.key)).forEach((g) => S.cleanDeclined.add(g.key));
    pending = pending.filter((g) => answer.keys.includes(g.key));
    if (legacyLeft && !answer.legacy) { setItem(KEYS.migrationNotice, true); legacyLeft = null; }
  }
  const keepSafe = new Set([...protect, ...sourceIds()]);
  try {
    const removed = await withWriteLock(async () => {
      const fresh = (await S.api.getMyPlaylists()).filter(Boolean);
      const ids = [];
      for (const g of pending) {
        const members = fresh.filter((p) => groupKeyOf(p, S.me.id) === g.key);
        if (members.length < 2 || !members.some((p) => p.id === g.keepId)) continue;
        const keep = pickKeep(members, await lastWrites(members), g.keepId);
        if (keep.id !== g.keepId) continue;
        ids.push(...members.filter((p) => p.id !== keep.id && !keepSafe.has(p.id)).map((p) => p.id));
      }
      const old = legacyLeft && findLegacyBaraja(fresh, S.me.id);
      if (old && old.id === legacyLeft.id && !keepSafe.has(old.id)) ids.push(old.id);
      const unique = [...new Set(ids)];
      if (unique.length) await S.api.unfollowPlaylists(unique);
      // Solo tras quitarla de verdad: si el borrado falla, la antigua «🔀 Baraja» se vuelve a ofrecer.
      if (legacyLeft) setItem(KEYS.migrationNotice, true);
      return unique.length;
    });
    document.getElementById('clean-notice')?.remove();
    if (!removed) return [];
    await loadPlaylists();
    return [t('cleanRemoved', { n: fmt(removed) })];
  } catch (e) {
    console.warn('Copias no quitadas:', e?.status ?? e?.message);
    return [t('cleanFailed', { reason: errorMessage(e) })];
  }
}

/** Al arrancar: copias repetidas en toda la biblioteca y la antigua «🔀 Baraja». Aviso en Inicio, o limpieza si está en automático. */
async function checkLibraryDuplicates() {
  const groups = [];
  for (const g of duplicateGroups(S.raw, S.me.id)) {
    const keep = pickKeep(g.playlists, await lastWrites(g.playlists), Object.values(getTargets()).find((id) => g.playlists.some((p) => p.id === id)));
    groups.push({ key: g.key, name: g.name, legacy: g.legacy, keepId: keep.id, count: g.playlists.length });
  }
  const legacy = getItem(KEYS.migrationNotice) ? null : findLegacyBaraja(S.raw, S.me.id);
  if (!groups.length && !legacy) return;
  // En automático solo se limpian sin preguntar las copias con etiqueta.
  const autoGroups = autoClean() ? groups.filter((g) => !g.legacy) : [];
  // El resultado de la limpieza automática va en su propio aviso para que no lo tape el de lo que queda por revisar.
  if (autoGroups.length) {
    const notes = await offerCleanup(autoGroups, { ask: false });
    if (notes.length) showNotice('clean-done', notes.join(' '));
  }
  const left = groups.filter((g) => !autoGroups.includes(g));
  if (!left.length && !legacy) return;
  const legacyOnly = legacy && !left.length;
  showNotice('clean-notice', legacyOnly ? t('legacyFound', { name: legacy.name }) : t('dupsInLibrary', { n: fmt(left.length) }), {
    label: t('review'),
    run: async () => {
      const notes = await offerCleanup(left, { legacy, ask: true });
      if (notes.length) showNotice('clean-notice', notes.join(' '));
    },
    // «Entendido» sobre la antigua «🔀 Baraja» es definitivo; sobre copias repetidas, solo por esta vez.
    dismiss: legacyOnly ? () => setItem(KEYS.migrationNotice, true) : null,
  });
}

/** Aviso en lo alto de Inicio con un botón opcional («Revisar») y «Entendido». */
function showNotice(id, text, action = null) {
  document.getElementById(id)?.remove();
  const home = document.getElementById('panel-home');
  if (!home) return;
  const box = h('div', { class: 'notice', id, role: 'note' },
    h('p', {}, text),
    h('div', { class: 'notice-actions' },
      action ? h('button', { class: 'btn primary', type: 'button', onclick: () => { box.remove(); action.run(); } }, action.label) : null,
      h('button', { class: 'btn', type: 'button', onclick: () => { box.remove(); action?.dismiss?.(); } }, t('gotIt'))));
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

function showNoDevice(info) {
  setKids(info,
    h('p', {}, t('noDevice')),
    h('a', { class: 'btn', href: 'https://open.spotify.com/', target: '_blank', rel: 'noopener' }, t('listenOnSpotify')),
    h('p', { class: 'muted small' }, t('shuffleReminder')));
}

async function playNow(playlistId, info, status) {
  setKids(info);
  let devices = null;
  await task(status, async () => { devices = await S.api.getDevices(); });
  if (!devices) return;
  if (!devices.length) return showNoDevice(info);
  const target = devices.find((d) => d.is_active) ?? await chooseDevice(devices);
  if (!target) return;
  await task(status, async () => {
    try {
      await S.api.playPlaylist(playlistId, target.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return showNoDevice(info);
      throw e;
    }
    setKids(info, h('p', {}, t('playingOn', { device: target.name })), h('p', { class: 'muted small' }, t('shuffleOffNote')));
  });
}

// ---------- Resultado compartido ----------

function renderResult(container, status, o) {
  const undoBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => task(status, async () => {
    if (await applyUndo(status, o.playlistId)) { status.say(t('undone')); undoBtn.hidden = true; }
  }) }, t('undo'));
  const sync = () => { const u = getItem(KEYS.undo); undoBtn.hidden = !(u && u.playlistId === o.playlistId); };
  sync();
  const info = h('div', { class: 'play-info', role: 'status' });
  const title = h('h2', { class: 'result-title' }, o.titleFn ? o.titleFn(prefersReducedMotion() ? o.count : 0) : o.title);
  const savedName = S.raw.find((p) => p.id === o.playlistId)?.name;
  setKids(container,
    title,
    savedName && !o.titleNamesPlaylist ? h('p', { class: 'result-sub', id: 'result-playlist' }, t('savedIn', { name: savedName })) : null,
    ...o.notes.map((n) => h('p', { class: 'note' }, n)),
    h('ol', { class: 'preview', 'aria-label': t('preview') }, o.tracks.slice(0, 20).map((tr, i) => h('li', { style: `--i:${i}` }, h('strong', {}, tr.name), ' ', h('span', { class: 'muted' }, artistsOf(tr))))),
    spotifyAttribution(spotifyUrl(o.playlistId)),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'button', id: 'play-now', onclick: () => playNow(o.playlistId, info, status) }, t('playNow')),
      info,
      h('a', { class: 'btn', href: spotifyUrl(o.playlistId), target: '_blank', rel: 'noopener' }, t('openInSpotify')),
      h('button', { class: 'btn', type: 'button', id: 'share-link', onclick: () => shareLink(o.playlistId, info) }, t('share')),
      ...(o.extra ?? []),
      undoBtn,
      h('button', { class: 'btn', type: 'button', onclick: o.onBack }, t('back'))),
  );
  container.playNow = () => playNow(o.playlistId, info, status);
  container.hidden = false;
  window.scrollTo(0, 0);
  celebrate(container);
  if (o.titleFn && !prefersReducedMotion()) animateCount(title, o.titleFn, o.count);
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
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw new UserError(t('errOtherTab'));
    throw e;
  }
}
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Celebración discreta al terminar: unos naipes lima que caen y se desvanecen (nada con movimiento reducido). */
function celebrate(container) {
  if (prefersReducedMotion()) return;
  const burst = h('div', { class: 'confetti', 'aria-hidden': 'true' },
    Array.from({ length: 14 }, (_, i) => h('span', { style: `--x:${(i * 37) % 100}%;--r:${(i * 53) % 90 - 45}deg;--d:${(i % 5) * 60}ms` })));
  container.prepend(burst);
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

/** Cuenta de 0 a `target` en ~0,7 s; siempre termina en el texto final. */
function animateCount(el, textFor, target, ms = 700) {
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = textFor(Math.round(target * (1 - (1 - k) ** 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
    else el.textContent = textFor(target);
  };
  requestAnimationFrame(step);
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

// ---------- Caché de metadatos de Spotify (24 h, en el dispositivo) ----------

/** { cache, size }: la caché en memoria y sus caracteres en JSON (para no serializarla entera en cada entrada). */
let metaCache = null;
let persistTimer = null;
const loadCache = () => (metaCache ??= { cache: pruneCache(getItem(KEYS.metaCache, {})) }).cache;
function dropMetaCache() {
  metaCache = null;
  clearTimeout(persistTimer);
  removeItem(KEYS.metaCache);
}
/**
 * Lee de la caché o pide a Spotify y guarda. Las claves llevan el id de la cuenta: otra cuenta en el mismo navegador
 * no ve ni usa los datos de la anterior. Se escribe en localStorage una vez por ráfaga (Novedades hace decenas de
 * lecturas seguidas); si el almacenamiento está lleno, se sigue con la caché en memoria.
 */
async function cached(rawKey, fetcher) {
  const key = `${S.me.id}:${rawKey}`;
  const hit = cacheGet(loadCache(), key);
  if (hit !== undefined) return hit;
  const data = await fetcher();
  loadCache();
  metaCache = cacheSet(metaCache, key, data);
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { if (metaCache) setItem(KEYS.metaCache, metaCache.cache); }, 800);
  return data;
}

const albumInfo = (a) => ({ id: a.id, name: a.name ?? '', release_date: a.release_date ?? '', release_date_precision: a.release_date_precision ?? '', images: (a.images ?? []).slice(-1) });

/** Canciones completas de un álbum (las devuelve sin datos del álbum: se los añadimos). */
async function albumTracks(album) {
  const items = await cached(`album:${album.id}`, async () => (await S.api.getAlbumTracks(album.id))
    .map((tr) => ({ id: tr.id, uri: tr.uri, name: tr.name, type: 'track', artists: (tr.artists ?? []).map((x) => ({ name: x.name })), duration_ms: tr.duration_ms, explicit: tr.explicit, disc_number: tr.disc_number, track_number: tr.track_number, is_local: tr.is_local })));
  return normalizeEntries(items.map((tr) => ({ track: { ...tr, album: albumInfo(album) } }))).tracks;
}

const MAX_ALBUMS = 50;

/** Completa los álbumes de una playlist con todas sus canciones. Si hay más de 50, se eligen 50 al azar (uniforme). */
async function completeAlbums(groups, status) {
  const chosen = shuffle(groups).slice(0, MAX_ALBUMS);
  const out = [];
  for (const [i, g] of chosen.entries()) {
    status.progress('readingAlbums', i, chosen.length);
    const full = await albumTracks({ id: g.id, name: g.name });
    out.push({ ...g, tracks: full.length ? full : g.tracks });
  }
  return groupAlbums(out.flatMap((a) => a.tracks));
}

/** Canciones de tus álbumes guardados (los de más de 50 canciones se completan aparte). */
async function readSavedAlbumTracks(status) {
  status.say(t('backupReadingAlbums'));
  const saved = await S.api.getSavedAlbums((d, tot) => status.progress('readingAlbums', d, tot));
  const tracks = [];
  const skipped = { local: 0, empty: 0 };
  for (const { album } of saved) {
    if (!album?.id) continue;
    const page = album.tracks;
    if (Array.isArray(page?.items) && page.items.length >= (page.total ?? 0)) {
      const r = normalizeEntries(page.items.map((tr) => ({ track: { ...tr, album: albumInfo(album) } })));
      tracks.push(...r.tracks);
      skipped.local += r.skipped.local;
      skipped.empty += r.skipped.empty;
    } else {
      tracks.push(...await albumTracks(album));
    }
  }
  return { tracks, skipped };
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
    mkRadio('reuse', t('destReuse'), t('destReuseHint')), mkRadio('new', t('destNew'), t('destNewHint')), mkRadio('self', t('destSelf'), t('destSelfHint')));
  radios.reuse.checked = true;
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'shuffle-go', disabled: true, onclick: () => run() }, t('shuffleBtn'));

  // Tipo: canciones (lo de siempre), a medida de tiempo o por álbumes
  const kindHint = h('p', { class: 'muted small', id: 'kind-hint' });
  const kindSel = segmented('sh-kind', t('kindLabel'), SHUFFLE_KINDS.map((k) => [k, t(`kind_${k}`)]), () => syncKind());
  const minutesSel = segmented('sh-minutes', t('timeLabel'), [...TIME_PRESETS.map((m) => [String(m), t('minutesShort', { n: m })]), ['custom', t('timeCustom')]], () => syncKind());
  minutesSel.set('30');
  const customMin = h('input', { type: 'number', class: 'text', id: 'sh-custom-min', inputmode: 'numeric', min: String(MIN_MINUTES), max: String(MAX_MINUTES), value: '35', 'aria-label': t('timeCustomLabel') });
  const customLabel = h('label', { class: 'field-wide', hidden: true }, t('timeCustomLabel'), customMin);
  const timeBox = h('div', { id: 'time-box', hidden: true }, minutesSel.el, customLabel);
  const savedAlbums = h('input', { type: 'checkbox', id: 'sh-saved-albums', onchange: () => syncKind() });
  const albumsBox = h('div', { id: 'albums-box', hidden: true }, h('label', { class: 'check' }, savedAlbums, h('span', {}, t('useSavedAlbums'))));
  const readMinutes = () => sanitizeMinutes(minutesSel.value === 'custom' ? customMin.value : minutesSel.value);
  const usingSavedAlbums = () => kindSel.value === 'albums' && savedAlbums.checked;
  function syncKind() {
    const k = kindSel.value;
    timeBox.hidden = k !== 'time';
    customLabel.hidden = minutesSel.value !== 'custom';
    albumsBox.hidden = k !== 'albums';
    sourceBox.hidden = usingSavedAlbums();
    kindHint.textContent = t(`kindHint_${k}`);
    syncSelection(picker.getSelected());
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
  const libraryIds = () => S.playlists.filter((p) => !baseReason(p) && (p.isLiked || !isGenerated(p))).map((p) => p.id);
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
        if (!S.sourceCache.has(key)) S.sourceCache.set(key, readSource(pl).then((r) => r.tracks));
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
    const selfOk = kindSel.value === 'songs' && !libraryMode && sel.length === 1 && sel[0].owned && !sel[0].isLiked && !hasFilters(readFilters());
    radios.self.disabled = !selfOk;
    if (!selfOk && radios.self.checked) radios.reuse.checked = true;
  }
  function syncSelection(sel) {
    const ready = sel.length > 0 || usingSavedAlbums();
    go.disabled = !ready;
    saveMixBtn.disabled = !ready;
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
    const sel = usingSavedAlbums() ? [] : picker.getSelected();
    return {
      library: libraryMode && !usingSavedAlbums(), ids: sel.map((p) => p.id), names: sel.map((p) => p.name), filters: readFilters(), dedupe: dedupe.checked, mode: dest(),
      kind: kindSel.value, minutes: readMinutes() ?? undefined, savedAlbums: usingSavedAlbums(),
    };
  };
  async function saveMix() {
    const cfg = currentConfig();
    const existing = getMixes().find((m) => m.id === editingId);
    const name = await askName({ title: t('mixName'), value: existing?.name ?? (cfg.savedAlbums ? t('yourAlbums') : libraryMode ? t('libraryName') : cfg.names.join(' + ')).slice(0, 60) });
    if (!name) return;
    const mix = sanitizeMix({ ...cfg, id: editingId ?? newMixId(), name });
    const { list, ok } = upsertMix(getMixes(), mix);
    if (!ok) { status.fail(new UserError(t('errMixLimit'))); return; }
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
    kindSel.el, kindHint, timeBox, albumsBox,
    sourceBox, go, moreBox);
  const rouletteCard = h('button', { class: 'card compact', type: 'button', id: 'card-roulette', onclick: () => S.show('roulette') },
    h('span', { class: 'card-icon' }, icon(...ICONS.roulette)),
    h('span', {}, h('span', { class: 'card-title' }, t('rouletteTitle')), h('span', { class: 'card-sub' }, t('cardRouletteSub'))));
  syncKind();

  let last = null;

  /** Carga una mezcla en el formulario. Devuelve si todas sus playlists siguen disponibles. */
  function applyMix(mix) {
    S.show('shuffle');
    result.hidden = true;
    form.hidden = false;
    kindSel.set(mix.kind ?? 'songs');
    if (mix.minutes) {
      const preset = TIME_PRESETS.includes(mix.minutes);
      minutesSel.set(preset ? String(mix.minutes) : 'custom');
      if (!preset) customMin.value = String(mix.minutes);
    }
    savedAlbums.checked = !!mix.savedAlbums;
    syncKind();
    if (mix.savedAlbums) {
      syncSelection(picker.getSelected());
      if (radios[mix.mode] && !radios[mix.mode].disabled) radios[mix.mode].checked = true;
      return true;
    }
    const ids = mix.library ? libraryIds() : mix.ids;
    programmatic = true;
    const n = picker.setSelected(ids);
    programmatic = false;
    libraryMode = !!mix.library;
    setFilters(mix.filters ?? emptyFilters());
    if (hasFilters(mix.filters)) { filtersBox.open = true; moreBox.open = true; }
    dedupe.checked = mix.dedupe !== false;
    syncSelection(picker.getSelected());
    if (radios[mix.mode] && !radios[mix.mode].disabled) radios[mix.mode].checked = true;
    return mix.library ? n > 0 : n === ids.length;
  }
  /** `origin.mixId`/`origin.mixName`: la mezcla guardada de la que viene, para que tenga su propia playlist generada. */
  S.runMix = (mix, origin = null, opts = {}) => {
    if (applyMix(mix)) return run(origin, opts);
    status.fail(new UserError(t('mixMissing')));
    return Promise.resolve(null);
  };

  /**
   * Enlace profundo (Siri, Atajos): solo con sesión válida (lo garantiza boot) y si la mezcla o la playlist
   * existen en este dispositivo. Siempre escribe en la playlist generada «· Shuffle», nunca en el origen.
   * Sin la clave de este dispositivo (un enlace de otra web, o el atajo abierto en otro navegador) pide confirmación.
   */
  S.openDeepLink = async (link) => {
    S.show('shuffle');
    const trusted = !!link.key && link.key === getItem(KEYS.linkKey);
    let mix;
    let origin = null;
    if (link.kind === 'mix') {
      const saved = getMixes().find((m) => m.id === link.id);
      if (!saved) { status.fail(new UserError(t('deepLinkMixMissing'))); return; }
      mix = saved;
      origin = mixOrigin(saved);
    } else {
      const pl = S.playlists.find((p) => p.id === link.id && !baseReason(p));
      if (!pl) { status.fail(new UserError(t('deepLinkSourceMissing'))); return; }
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
    if (!applyMix(mix)) status.fail(new UserError(t('mixMissing')));
    setEditing(mix);
  };

  const dest = () => Object.values(radios).find((r) => r.checked).value;

  /** Nombre y clave de la «· Shuffle» según el tipo: «Rock · Shuffle», «35 min · Shuffle» o «Rock · Álbumes · Shuffle». */
  function targetFor(kind, { sel, origin, minutes, saved }) {
    const label = saved ? t('yourAlbums') : coverTitle(sel, origin);
    const baseKey = sourceKey({ mixId: origin.mixId, library: origin.library, ids: sel.map((p) => p.id) });
    if (kind === 'time') {
      const title = origin.mixName || t('minutesShort', { n: minutes });
      return { key: origin.mixId ? baseKey : `time:${minutes}`, name: generatedName({ mixName: title }, nameLabels()), title };
    }
    if (kind === 'albums') {
      const title = origin.mixName || `${label} · ${t('albumsWord')}`;
      return { key: origin.mixId ? baseKey : saved ? 'albums:saved' : baseKey && `albums:${baseKey}`, name: generatedName({ mixName: title }, nameLabels()), title };
    }
    return { key: baseKey, name: generatedName({ mixName: origin.mixName, library: origin.library, sources: sel }, nameLabels()), title: coverTitle(sel, origin) };
  }

  /**
   * Escribe en el destino. «reuse»: la «· Shuffle» de ese origen (ver writeGenerated); «new»: una nueva con fecha;
   * «self»: la propia playlist (con Deshacer). Devuelve { id, notes }.
   */
  async function writeTarget(mode, { sel, originalTracks, target, uris, saved }) {
    if (mode === 'self') {
      return withWriteLock(async () => {
        saveUndo(sel[0].id, sel[0].name, originalTracks.map((x) => x.uri));
        await overwritePlaylist(sel[0].id, uris, status);
        return { id: sel[0].id, notes: [] };
      });
    }
    const description = generatedDescription(t('shuffleDescFrom'),
      saved ? [t('yourAlbums')] : target.library ? [t('allMyMusic')] : sel.map((p) => (p.isLiked ? t('liked') : p.name)));
    if (mode === 'new' || !target.key) {
      const id = (await S.api.createPlaylist(datedName(target.name, nowLabel()), description)).id;
      await S.api.replaceItems(id, uris, (d, tot) => status.progress('saving', d, tot));
      return { id, notes: [] };
    }
    return writeGenerated({ key: target.key, name: target.name, description, uris, protect: sel.map((p) => p.id) }, status);
  }

  /** Texto grande de la portada: el origen sin el sufijo. */
  const coverTitle = (sel, origin) => origin?.mixName || (origin?.library ? t('allMyMusic')
    : sel.length === 1 ? (sel[0].isLiked ? t('liked') : sel[0].name) : 'Mix');

  /** Orden final según el tipo. Canciones: Fisher-Yates; tiempo: barajar y llenar; álbumes: orden de álbumes uniforme. */
  function arrange(kind, base, { minutes, albums }) {
    if (kind === 'time') {
      const fit = fitDuration(base, minutes);
      if (!fit.tracks.length) throw new UserError(t('errTimeEmpty'));
      return { order: fit.tracks, truncated: 0, notes: fit.reached ? [] : [t('timeShort', { got: fmt(Math.round(fit.totalMs / MINUTE)), m: fmt(minutes) })] };
    }
    if (kind === 'albums') {
      const { tracks, albums: order } = shuffleAlbums(albums);
      const capped = capPlaylist(tracks);
      return { order: capped.tracks, truncated: capped.truncated, notes: [t('albumsCount', { n: fmt(order.length) })] };
    }
    const capped = capPlaylist(shuffle(base));
    return { order: capped.tracks, truncated: capped.truncated, notes: [] };
  }

  function showResult(info) {
    form.hidden = true;
    last = info;
    const notes = [...skipNotes(info.skipped), ...(info.kindNotes ?? []), ...(info.coverNotes ?? [])];
    if (info.dedupRemoved) notes.push(t('dedupRemoved', { n: fmt(info.dedupRemoved) }));
    if (info.filteredOut) notes.push(t('filteredOut', { n: fmt(info.filteredOut) }));
    if (info.truncated) notes.push(t('truncated', { n: fmt(info.truncated) }));
    renderResult(result, status, {
      titleFn: (n) => t('shuffledDone', { n: fmt(n) }), count: info.order.length,
      notes, tracks: info.order, playlistId: info.playlistId,
      extra: [
        h('button', { class: 'btn', type: 'button', id: 'reshuffle', onclick: () => reshuffle() }, t('reshuffle')),
        h('button', { class: 'btn', type: 'button', id: 'open-pin-result', onclick: () => S.show('pin') }, t('pinTitle')),
      ],
      onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
    });
  }

  /** Devuelve una promesa con el id de la playlist escrita (o null si no se barajó). */
  function run(fromMix = null, { modeOverride } = {}) {
    let written = null;
    return task(status, async () => {
      // Todo el formulario se lee antes de esperar a la red: si otra pantalla lo cambia a mitad, esta baraja no se ve afectada.
      const kind = kindSel.value;
      const saved = usingSavedAlbums();
      const sel = saved ? [] : picker.getSelected();
      const minutes = readMinutes();
      const origin = { mixId: fromMix?.mixId, mixName: fromMix?.mixName, library: libraryMode && !saved };
      const mode = kind !== 'songs' && (modeOverride ?? dest()) === 'self' ? 'reuse' : modeOverride ?? dest();
      const filters = readFilters();
      const doDedupe = dedupe.checked || kind === 'albums';
      const config = { ...currentConfig(), mode, mixId: origin.mixId };
      if (kind === 'time' && !minutes) throw new UserError(t('errMinutes', { min: MIN_MINUTES, max: MAX_MINUTES }));
      const { tracks, skipped } = saved ? await readSavedAlbumTracks(status) : await readSources(sel, status);
      if (mode === 'self' && !confirmOverwrite(sel[0].name, skippedCount(skipped))) { status.clear(); return; }
      const unique = doDedupe ? uniqueByUri(tracks) : tracks;
      const base = saved ? unique : filterTracks(unique, filters);
      if (!base.length) throw new UserError(hasFilters(filters) && !saved ? t('errFiltersEmpty') : t('errEmpty'));
      const albums = kind === 'albums' ? (saved ? groupAlbums(base) : await completeAlbums(groupAlbums(base), status)) : null;
      const { order, truncated, notes: kindNotes } = arrange(kind, base, { minutes, albums });
      const target = { ...targetFor(kind, { sel, origin, minutes, saved }), library: origin.library };
      const written_ = await writeTarget(mode, { sel, originalTracks: tracks, target, uris: order.map((x) => x.uri), saved });
      const coverNotes = [...written_.notes, ...(mode === 'self' ? [] : await uploadCover(written_.id, target.title))];
      setItem(KEYS.lastMix, config);
      if (mode !== 'self') setItem(KEYS.lastTarget, written_.id);
      written = written_.id;
      await loadPlaylists();
      status.clear();
      showResult({
        base, order, skipped, truncated, dedupRemoved: tracks.length - unique.length, filteredOut: unique.length - base.length,
        playlistId: written_.id, mode, coverNotes, kindNotes, title: target.title, kind, minutes, albums,
      });
    }).then(() => written);
  }
  S.shuffleWith = run;

  function reshuffle() {
    task(status, async () => {
      const { order, truncated, notes: kindNotes } = arrange(last.kind, last.base, last);
      await withWriteLock(async () => {
        await assertUnchanged(last.playlistId, last.order.length, last.order);
        saveUndo(last.playlistId, '', last.order.map((x) => x.uri), { soft: true });
        await overwritePlaylist(last.playlistId, order.map((x) => x.uri), status);
      });
      const coverNotes = last.mode === 'self' ? [] : await uploadCover(last.playlistId, last.title);
      status.clear();
      showResult({ ...last, order, truncated, kindNotes, coverNotes });
    });
  }

  return h('section', { class: 'panel', id: 'panel-shuffle' }, form, result, status.el, rouletteCard);
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
      if (new Set(keys).size !== keys.length) throw new UserError(t('sortDup'));
      const filtered = filterByAdded(tracks, from.value, to.value);
      const sorted = keys.length === 1 ? sortTracks(filtered, keys[0]) : sortTracksBy(filtered, keys);
      if (!sorted.length) throw new UserError(t('errEmpty'));
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
      if (!tracks.length) throw new UserError(t('errEmpty'));
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
      h('p', { class: 'dup-head' }, h('strong', {}, g.keep.track.name), ' ', h('span', { class: 'muted' }, artistsOf(g.keep.track))),
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
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const radios = SNAPS.map(([key, label]) => ({ key, input: h('input', { type: 'radio', name: 'snap-kind', value: key, id: `snap-${key}` }), label }));
  radios[0].input.checked = true;
  const shuffleBox = h('input', { type: 'checkbox', id: 'snap-shuffle' });
  const form = h('div', {},
    h('div', { class: 'choices' }, radios.map(({ input, label }) => h('label', { class: 'choice' }, input, h('span', {}, h('strong', {}, t(label)))))),
    h('label', { class: 'check' }, shuffleBox, h('span', {}, t('snapShuffle'))),
    h('button', { class: 'btn primary big', type: 'button', id: 'snap-go', onclick: () => run() }, t('snapBtn')));

  function run() {
    task(status, async () => {
      const [kind, labelKey, range] = SNAPS.find(([k]) => radios.find((r) => r.key === k).input.checked);
      const entries = range ? (await S.api.getTopTracks(range)).map((track) => ({ track })) : await S.api.getRecentlyPlayed();
      const tracks = uniqueByUri(normalizeEntries(entries).tracks);
      if (!tracks.length) throw new UserError(t('errEmpty'));
      const order = shuffleBox.checked ? shuffle(tracks) : tracks;
      const uris = order.map((x) => x.uri);
      const name = t(labelKey);
      const snaps = getItem(KEYS.snaps, {});
      const existing = snaps[kind] ? (await S.api.getMyPlaylists()).find((p) => p?.id === snaps[kind] && p.owner?.id === S.me.id) : null;
      let id;
      if (existing) {
        id = existing.id;
        await withWriteLock(async () => {
          const current = normalizeEntries(await S.api.getPlaylistItems(id)).tracks;
          saveUndo(id, existing.name, current.map((x) => x.uri), { soft: true });
          await overwritePlaylist(id, uris, status);
        });
      } else {
        id = (await S.api.createPlaylist(name, t('snapDesc'))).id;
        setItem(KEYS.snaps, { ...snaps, [kind]: id });
        await S.api.addItems(id, uris, (d, tot) => status.progress('saving', d, tot));
      }
      await loadPlaylists();
      status.clear();
      form.hidden = true;
      renderResult(result, status, {
        title: t('snapDone', { name, n: fmt(order.length) }), notes: [], tracks: order, playlistId: id,
        onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
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
      const liked = S.playlists.find((p) => p.isLiked);
      const mine = S.playlists.filter((p) => !p.isLiked && p.readable && !isGenerated(p));
      const likedRead = await readSource(liked, (d, tot) => status.progress('reading', d, tot));
      const inPlaylists = new Set();
      let done = 0;
      for (const pl of mine) {
        status.say(t('orphansReading', { i: fmt(++done), n: fmt(mine.length) }));
        for (const tr of (await readSource(pl)).tracks) inPlaylists.add(tr.uri);
      }
      orphans = uniqueByUri(likedRead.tracks.filter((tr) => !inPlaylists.has(tr.uri)));
      status.clear();
      if (!orphans.length) { setKids(found, h('p', { class: 'note', id: 'orphans-none' }, t('orphansNone'))); found.hidden = false; return; }
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
        if (e.code === 'tooMany') throw new UserError(t('splitTooMany', { n: fmt(e.count), max: fmt(MAX_SPLIT_PARTS) }));
        throw e;
      }
      if (groups.length < 2) throw new UserError(t('splitOneGroup'));
      status.clear();
      const rows = groups.map((g) => ({ g, input: h('input', { type: 'text', class: 'text', maxlength: '100', value: nameOf(pl.name, mode, g), 'aria-label': t('newName') }), done: false }));
      const createBtn = h('button', { class: 'btn primary big', type: 'button', id: 'split-create', onclick: () => create() }, t('splitCreate', { n: fmt(groups.length) }));
      setKids(preview,
        h('h2', { class: 'result-title', id: 'split-summary' }, t('splitSummary', { n: fmt(groups.length), m: fmt(tracks.length) })),
        skippedCount(skipped) ? h('p', { class: 'note' }, t('skipped', { n: fmt(skippedCount(skipped)) })) : null,
        h('ul', { class: 'restore-list' }, rows.map(({ g, input }) => h('li', {}, input, h('span', { class: 'muted small' }, t('songs', { n: fmt(g.tracks.length) }))))),
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
      if (sel.length > MAX_BACKUP_PLAYLISTS) throw new UserError(t('errBackupLimit'));
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
      if (jsonBlob.size > MAX_BACKUP_BYTES) throw new UserError(t('errBackupLimit'));
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
      if (file.size > MAX_BACKUP_BYTES) throw new UserError(t('errBackupSize'));
      const parsed = JSON.parse(await file.text());
      showRestore(validateBackup(parsed), sanitizeMixes(parsed.mixes), [parsed.albums, parsed.artists].map((x) => (Array.isArray(x) ? x.length : 0)));
    } catch (e) {
      status.fail(e instanceof UserError ? e : e instanceof SyntaxError ? new UserError(t('restoreBad_notBackup')) : new UserError(t(`restoreBad_${typeof e.code === 'string' ? e.code : 'notBackup'}`)));
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
  const cleanToggle = h('input', { type: 'checkbox', id: 'clean-toggle', onchange: () => setItem(KEYS.autoClean, cleanToggle.checked) });
  cleanToggle.checked = autoClean();
  const diagList = h('ul', { class: 'diag', id: 'diag-results' });
  async function diagnose() {
    const rows = [];
    const check = async (label, fn) => {
      try { rows.push({ label, ok: true, detail: await fn() }); } catch (e) { rows.push({ label, ok: false, detail: errorMessage(e) }); }
    };
    await check(t('diagAccount'), async () => { const me = await S.api.getMe(); return me.display_name || me.id; });
    await check(t('diagPlaylists'), async () => { await S.api.request('GET', '/me/playlists?limit=1'); return ''; });
    const missing = auth.missingScopes(getItem(KEYS.tokens));
    rows.push({ label: t('diagScopes'), ok: missing.length === 0, detail: missing.join(', ') });
    setKids(diagList, rows.map((r) => h('li', { class: r.ok ? 'ok' : 'bad' }, `${r.ok ? '✓' : '✗'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)));
  }
  const diagBtn = h('button', { class: 'btn', type: 'button', id: 'run-diag', onclick: () => task(status, diagnose) }, t('diagRun'));
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
    h('h2', {}, t('diagRun')), h('p', { class: 'muted' }, t('diagLead')), diagBtn, diagList,
    h('h2', {}, t('themeTitle')), themeSel,
    h('h2', {}, t('coverTitle')),
    h('label', { class: 'check' }, coverToggle, h('span', {}, t('coverToggle'))),
    h('h2', {}, t('shakeTitle')),
    h('label', { class: 'check' }, shakeToggle, h('span', {}, t('shakeToggle'))),
    h('h2', {}, t('cleanSettingTitle')),
    h('label', { class: 'check' }, cleanToggle, h('span', {}, t('cleanAlways'))),
    h('p', { class: 'muted small' }, t('cleanRecover')),

    h('h2', {}, t('undoTitle')), undoInfo, undoBtn,
    h('h2', {}, t('account')), h('p', { class: 'muted' }, S.me?.display_name || S.me?.id || ''),
    h('button', { class: 'btn danger', type: 'button', id: 'logout', onclick: () => { auth.logout(); renderSetup(); } }, t('logout')),
    h('h2', {}, t('privacyTitle')), h('p', { class: 'muted' }, t('privacy')),
    h('h2', {}, t('aboutTitle')),
    h('p', { class: 'muted', id: 'about-notice' }, t('notAffiliated')),
    h('p', {}, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, t('repoLink'))),
    status.el);
  panel.refresh = () => { syncUndo(); cleanToggle.checked = autoClean(); };
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
    const id = getItem(KEYS.lastTarget) ?? getItem(KEYS.barajaId);
    setKids(slot, id ? h('a', { class: 'btn primary', href: spotifyUrl(id), target: '_blank', rel: 'noopener', id: 'pin-open' }, t('openInSpotify')) : null);
  };
  return panel;
}

// ---------- Elige por mí ----------

function roulettePanel() {
  const status = createStatus();
  const reel = h('div', { class: 'reel', id: 'reel', role: 'status', 'aria-live': 'polite' }, '?');
  const go = h('button', { class: 'btn primary big', type: 'button', id: 'roulette-go', onclick: () => spin() }, t('rouletteSpin'));
  const candidates = () => S.playlists.filter((p) => !baseReason(p) && (p.isLiked || !isGenerated(p)) && p.total !== 0);

  /** La elegida sale de pickIndex (uniforme) antes de animar; la ruleta solo lo enseña. */
  async function spin() {
    if (S.busy) return;
    const list = candidates();
    if (!list.length) { status.fail(new UserError(t('rouletteEmpty'))); return; }
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

/** Aviso único de logo nuevo (en iPhone el icono de la pantalla de inicio no se actualiza solo). */
function logoNotice() {
  if (getItem(KEYS.logoNotice)) return null;
  const box = h('div', { class: 'notice', id: 'logo-notice', role: 'note' },
    h('p', {}, t('logoNotice')),
    h('button', { class: 'btn', type: 'button', onclick: () => { setItem(KEYS.logoNotice, true); box.remove(); } }, t('gotIt')));
  return box;
}


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

// ---------- Descubrir y recuerdos: cada función crea su propia «· Shuffle» ----------

const RECENT_MAX = 3;
/** «Lo último» de Inicio: las últimas funciones usadas (solo el panel y su título, nada de Spotify). */
function rememberRecent(panel) {
  const list = (getItem(KEYS.recent, []) ?? []).filter((x) => typeof x === 'string' && PANEL_LABEL[x] && x !== panel);
  setItem(KEYS.recent, [panel, ...list].slice(0, RECENT_MAX));
}
const recentPanels = () => (Array.isArray(getItem(KEYS.recent)) ? getItem(KEYS.recent) : []).filter((x) => PANEL_LABEL[x]).slice(0, RECENT_MAX);

/** Lectura de Tus me gusta compartida por Tal día como hoy y Olvidadas (una vez por sesión). */
async function likedTracks(status) {
  const liked = S.playlists.find((p) => p.isLiked);
  if (liked?.error) throw new UserError(t('likedUnavailable'));
  if (S.likedRead && S.likedRead.total === liked?.total) return S.likedRead.tracks;
  const r = await readSource(liked ?? likedEntry(), (d, tot) => status.progress('reading', d, tot));
  S.likedRead = { total: liked?.total, tracks: r.tracks };
  return r.tracks;
}

/** Quita lo que ya tienes guardado (GET /me/library/contains, de 40 en 40). */
async function notSaved(tracks, status) {
  const uris = tracks.map((x) => x.uri);
  status.say(t('checkingLibrary'));
  const saved = await S.api.libraryContains(uris);
  return tracks.filter((_, i) => !saved[i]);
}

/**
 * Pantalla de una función que crea su «· Shuffle»: título, una frase, opciones (las avanzadas plegadas en «Más opciones»),
 * botón principal, estado vacío que dice qué hacer y resultado con Reproducir ahora.
 * `build(status)` devuelve { key, name, description, coverTitle, tracks, notes?, extra? } o { empty: { title, text } }.
 */
function genPanel({ id, title, lead, options = [], advanced = [], button, build }) {
  const status = createStatus({ loader: true });
  const result = h('div', { class: 'result', hidden: true });
  const empty = h('div', { class: 'empty', id: `${id}-empty`, hidden: true, role: 'status' });
  const go = h('button', { class: 'btn primary big', type: 'button', id: `${id}-go`, onclick: () => run() }, button);
  const form = h('div', {}, ...options,
    advanced.length ? h('details', { class: 'more', id: `${id}-more` }, h('summary', {}, t('moreOptions')), ...advanced) : null,
    go, empty);
  const back = () => { result.hidden = true; form.hidden = false; status.clear(); };

  function run() {
    return task(status, async () => {
      empty.hidden = true;
      const out = await build(status);
      if (out.empty) {
        status.clear();
        setKids(empty, h('p', { class: 'empty-title' }, out.empty.title), h('p', { class: 'muted' }, out.empty.text));
        empty.hidden = false;
        return;
      }
      const { tracks, truncated } = capPlaylist(out.tracks);
      const written = await writeGenerated({ key: out.key, name: out.name, description: out.description, uris: tracks.map((x) => x.uri) }, status);
      const notes = [...(out.notes ?? []), ...written.notes, ...await uploadCover(written.id, out.coverTitle)];
      if (truncated) notes.push(t('truncated', { n: fmt(truncated) }));
      rememberRecent(id);
      await loadPlaylists();
      status.clear();
      form.hidden = true;
      renderResult(result, status, {
        titleFn: (n) => t('genDone', { name: out.name, n: fmt(n) }), titleNamesPlaylist: true, count: tracks.length, notes, tracks, playlistId: written.id,
        extra: [h('button', { class: 'btn', type: 'button', id: `${id}-again`, onclick: () => { back(); run(); } }, t('reshuffle')), ...(out.extra ?? [])],
        onBack: back,
      });
    });
  }
  const panel = h('section', { class: 'panel', id: `panel-${id}`, hidden: true },
    backBar(), h('h2', { class: 'tool-title' }, title), h('p', { class: 'lead' }, lead), form, result, status.el);
  panel.run = run;
  return panel;
}

const genDescription = (key, params) => generatedDescription(t(key, params), []);

function newReleasesPanel() {
  const stored = RELEASE_DAYS.includes(getItem(KEYS.discoverDays)) ? getItem(KEYS.discoverDays) : 30;
  const days = segmented('new-days', t('newDaysLabel'), RELEASE_DAYS.map((d) => [String(d), t('lastDays', { n: d })]), (v) => setItem(KEYS.discoverDays, Number(v)));
  days.set(String(stored));
  return genPanel({
    id: 'new', title: t('newTitle'), lead: t('newLead'), button: t('newBtn'),
    advanced: [h('p', { class: 'field-label' }, t('newDaysLabel')), days.el, h('p', { class: 'muted small' }, t('quotaNote'))],
    async build(status) {
      const n = Number(days.value);
      status.say(t('discoverArtists'));
      const slim = (list) => list.map((a) => ({ id: a.id, name: a.name }));
      const short = await cached('topArtists:short_term', async () => slim(await S.api.getTopArtists('short_term')));
      const medium = await cached('topArtists:medium_term', async () => slim(await S.api.getTopArtists('medium_term')));
      const followed = await cached('followed', async () => slim(await S.api.getFollowedArtists()));
      const artists = pickArtists([short, medium, followed]);
      if (!artists.length) return { empty: { title: t('newNoArtistsTitle'), text: t('newNoArtists') } };
      const albums = [];
      for (const [i, a] of artists.entries()) {
        status.progress('discoverReading', i, artists.length);
        albums.push(...await cached(`artistAlbums:${a.id}`, async () => [
          ...await S.api.getArtistAlbums(a.id, 'album'), ...await S.api.getArtistAlbums(a.id, 'single'),
        ].map(albumInfo)));
      }
      const fresh = recentAlbums(albums, n);
      const tracks = [];
      for (const [i, al] of fresh.entries()) {
        status.progress('readingAlbums', i, fresh.length);
        tracks.push(...await albumTracks(al));
      }
      const pool = await notSaved(withoutUris(tracks, []), status);
      if (!pool.length) return { empty: { title: t('newEmptyTitle', { n }), text: t('newEmpty') } };
      return {
        key: 'new', name: generatedName({ mixName: t('newName') }, nameLabels()), coverTitle: t('newName'),
        description: genDescription('newDesc', { n }), tracks: shuffle(pool),
        notes: [t('newSummary', { a: fmt(fresh.length), p: fmt(artists.length) })],
      };
    },
  });
}

function explorePanel() {
  return genPanel({
    id: 'explore', title: t('exploreTitle'), lead: t('exploreLead'), button: t('exploreBtn'),
    advanced: [h('p', { class: 'muted small' }, t('quotaNote'))],
    async build(status) {
      status.say(t('exploreReading'));
      const recent = normalizeEntries(await S.api.getRecentlyPlayed()).tracks;
      const top = normalizeEntries((await S.api.getTopTracks('short_term')).map((track) => ({ track }))).tracks;
      const listened = [...recent, ...top];
      const ids = albumsFromListening(listened);
      if (!ids.length) return { empty: { title: t('exploreEmptyTitle'), text: t('exploreEmpty') } };
      const byId = new Map(listened.map((tr) => [tr.albumId, tr]));
      const tracks = [];
      for (const [i, id] of ids.entries()) {
        status.progress('readingAlbums', i, ids.length);
        tracks.push(...await albumTracks({ id, name: byId.get(id)?.album ?? '' }));
      }
      const pool = await notSaved(withoutUris(tracks, listened.map((x) => x.uri)), status);
      if (!pool.length) return { empty: { title: t('exploreNoneTitle'), text: t('exploreNone') } };
      return {
        key: 'explore', name: generatedName({ mixName: t('exploreName') }, nameLabels()), coverTitle: t('exploreName'),
        description: genDescription('exploreDesc'), tracks: shuffle(pool),
        notes: [t('exploreSummary', { a: fmt(ids.length) })],
      };
    },
  });
}

const monthName = (year, month) => new Date(year, month, 1).toLocaleString(getLang(), { month: 'long' });

function onThisDayPanel() {
  let year = null;
  const yearsBox = h('div', { class: 'actions', id: 'ago-years' });
  const panel = genPanel({
    id: 'ago', title: t('agoTitle'), lead: t('agoLead'), button: t('agoBtn'),
    async build(status) {
      const groups = onThisDayGroups(await likedTracks(status));
      if (!groups.length) return { empty: { title: t('agoEmptyTitle', { month: monthName(2000, new Date().getMonth()) }), text: t('agoEmpty') } };
      const g = groups.find((x) => x.year === year) ?? groups[0];
      year = null;
      const artist = topArtist(g.tracks);
      const label = t('yearsAgo', { n: String(g.yearsAgo) });
      const others = groups.filter((x) => x !== g).map((x) => h('button', { class: 'btn', type: 'button', 'data-year': String(x.year), onclick: () => { year = x.year; panel.querySelector('.result').hidden = true; panel.run(); } }, String(x.year)));
      return {
        key: `ago:${g.yearsAgo}`, name: generatedName({ mixName: label }, nameLabels()), coverTitle: label,
        description: genDescription('agoDesc', { month: monthName(g.year, new Date().getMonth()), year: g.year }), tracks: shuffle(g.tracks),
        notes: [artist ? t('nostalgia', { month: monthName(g.year, new Date().getMonth()), year: g.year, artist }) : t('nostalgiaPlain', { month: monthName(g.year, new Date().getMonth()), year: g.year })],
        extra: others.length ? [h('p', { class: 'muted small' }, t('agoOtherYears')), ...others] : [],
      };
    },
  });
  return panel;
}

function forgottenPanel() {
  const years = segmented('forgotten-years', t('forgottenYearsLabel'), FORGOTTEN_YEARS.map((n) => [String(n), t('moreThanYears', { n: String(n) })]));
  years.set('2');
  return genPanel({
    id: 'forgotten', title: t('forgottenTitle'), lead: t('forgottenLead'), button: t('forgottenBtn'),
    advanced: [h('p', { class: 'field-label' }, t('forgottenYearsLabel')), years.el],
    async build(status) {
      const n = Number(years.value);
      const list = forgottenTracks(await likedTracks(status), n);
      if (!list.length) return { empty: { title: t('forgottenEmptyTitle'), text: t('forgottenEmpty', { n }) } };
      return {
        key: 'forgotten', name: generatedName({ mixName: t('forgottenName') }, nameLabels()), coverTitle: t('forgottenName'),
        description: genDescription('forgottenDesc', { n }), tracks: shuffle(list),
      };
    },
  });
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

  const itemRow = (img, title, sub) => h('li', { class: 'row' },
    img ? h('img', { class: 'cover', src: img, alt: '', loading: 'lazy' }) : h('span', { class: 'cover', 'aria-hidden': 'true' }, '♪'),
    h('span', { class: 'row-text' }, h('span', { class: 'row-name' }, title), sub ? h('span', { class: 'row-meta' }, sub) : null));

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
        setKids(empty, h('p', { class: 'empty-title' }, t('summaryEmptyTitle')), h('p', { class: 'muted' }, t('summaryEmpty')));
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
        .catch((e) => { throw e?.message === 'spotifyLogo' ? new UserError(t('summaryNoLogo')) : e; });
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
        h('h2', {}, t('summaryArtists')), h('ol', { class: 'summary-list' }, data.artists.map((a) => itemRow(a.image, a.name))),
        h('h2', {}, t('summaryTracks')), h('ol', { class: 'summary-list' }, data.tracks.map((tr) => itemRow(tr.image, tr.name, tr.sub))),
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
      const written = await writeGenerated({ key: 'top', name, description: genDescription('topDesc', { range: t(SUMMARY_RANGES.find(([k]) => k === range.value)[1]) }), uris: order.map((x) => x.uri) }, status);
      const notes = [...written.notes, ...await uploadCover(written.id, t('topName'))];
      await loadPlaylists();
      status.clear();
      renderResult(result, status, {
        titleFn: (n) => t('genDone', { name, n: fmt(n) }), titleNamesPlaylist: true, count: order.length, notes, tracks: order, playlistId: written.id,
        onBack: () => { result.hidden = true; },
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
  new: 'discover', explore: 'discover', ago: 'discover', forgotten: 'discover', summary: 'discover',
  sort: 'more', dups: 'more', backup: 'more', snap: 'more', orphans: 'more', split: 'more', proof: 'more', pin: 'more', settings: 'more',
};
const PANEL_LABEL = {
  new: 'newTitle', explore: 'exploreTitle', ago: 'agoTitle', forgotten: 'forgottenTitle', summary: 'summaryTitle',
  sort: 'tabSort', dups: 'tabDups', backup: 'tabBackup', snap: 'snapTitle', orphans: 'orphansTitle', split: 'splitTitle',
  roulette: 'rouletteTitle', proof: 'proofTitle',
};
const PANEL_ICON = {
  new: 'spark', explore: 'compass', ago: 'calendar', forgotten: 'clock', summary: 'trophy',
  sort: 'sort', dups: 'dups', backup: 'backup', snap: 'snap', orphans: 'orphans', split: 'split',
  roulette: 'roulette', proof: 'proof', pin: 'pin', settings: 'settings',
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
      navCard('ago', t('agoTitle'), t('cardAgoSub')),
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
      navCard('settings', t('settings'), t('cardSettingsSub'))));
}

function homePanel() {
  const slot = h('div', { class: 'home' });
  const panel = h('section', { class: 'panel', id: 'panel-home', hidden: true }, slot);
  const mixRow = (mix) => h('div', { class: 'mix-row' },
    h('button', { class: 'card', type: 'button', 'data-mix': mix.id, onclick: () => S.runMix(mix, mixOrigin(mix)) },
      h('span', { class: 'card-icon' }, icon(...ICONS[mix.kind === 'time' ? 'clock' : mix.kind === 'albums' ? 'album' : 'shuffle'])),
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
    /** Agitar: siempre pide confirmación, porque va a sobrescribir la playlist «· Shuffle» de esa mezcla. */
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
    setKids(slot,
      h('button', { class: 'hero-shuffle', type: 'button', id: mix ? 'card-last-mix' : 'hero-start', onclick: () => (mix ? S.runMix(mix, origin) : S.show('shuffle')) },
        h('span', { class: 'hero-icon' }, icon(...ICONS.shuffle)),
        h('span', { class: 'hero-word' }, t('heroShuffle')),
        h('span', { class: 'hero-sub' }, mix ? t('heroAgain', { name: saved?.name ?? mixLabel(mix) }) : t('heroFirst'))),
      mix ? h('button', { class: 'link-btn', type: 'button', id: 'hero-other', onclick: () => S.show('shuffle') }, t('heroOther')) : null,
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
  const src = mixSources(mix, t('libraryName'), t('yourAlbums'));
  return mix.kind === 'time' ? `${t('minutesShort', { n: mix.minutes })} · ${src}` : mix.kind === 'albums' ? `${t('albumsWord')} · ${src}` : src;
};

function mountApp() {
  S.pickers = [];
  BACK_BARS.clear();
  const panels = {
    home: homePanel(), shuffle: shufflePanel(), discover: discoverPanel(), more: morePanel(),
    new: newReleasesPanel(), explore: explorePanel(), ago: onThisDayPanel(), forgotten: forgottenPanel(), summary: summaryPanel(),
    sort: sortPanel(), dups: dupsPanel(), backup: backupPanel(),
    snap: snapPanel(), orphans: orphansPanel(), split: splitPanel(), pin: pinPanel(), settings: settingsPanel(),
    roulette: roulettePanel(), proof: proofPanel(),
  };
  const tabBtns = {};
  let prev = null;
  S.backTarget = () => (prev && prev !== S.tab ? prev : tabOf(S.tab));
  S.back = () => show(S.backTarget(), -1);
  const show = (key, dir) => {
    const from = TAB_ORDER.indexOf(tabOf(S.tab));
    const to = TAB_ORDER.indexOf(tabOf(key));
    const dx = dir ?? (from >= 0 && to >= 0 && from !== to ? Math.sign(to - from) : PARENT[key] && !PARENT[S.tab] ? 1 : 0);
    const changed = S.tab !== key;
    // «Volver» lleva a la pantalla anterior si es de la misma pestaña (Inicio → Ordenar → Volver vuelve a Inicio).
    if (changed) prev = PARENT[key] ? S.tab : null;
    S.tab = key;
    const swap = () => {
      for (const [k, p] of Object.entries(panels)) {
        p.hidden = k !== key;
        if (k === key) p.style.setProperty('--dx', `${dx * 28}px`);
      }
      for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-current', k === tabOf(key) ? 'page' : 'false');
      for (const b of BACK_BARS) b.sync();
      for (const p of Object.values(panels)) if (!p.hidden) p.refresh?.();
      panels.home.refresh();
      window.scrollTo(0, 0);
    };
    // Transición fluida entre pantallas donde el navegador la admite (View Transitions API).
    if (changed && document.startViewTransition && !prefersReducedMotion()) {
      root.classList.add('vt');
      document.startViewTransition(swap).finished.finally(() => root.classList.remove('vt'));
    } else {
      swap();
    }
  };
  S.show = show;
  const nav = h('nav', { class: 'tabs', 'aria-label': t('sections') }, TABS.map(([key, label]) => {
    const b = h('button', { type: 'button', id: `tab-${key}`, onclick: () => show(key) }, icon(...ICONS[key]), h('span', {}, t(label)));
    tabBtns[key] = b;
    return b;
  }));
  setKids(root,
    h('header', { class: 'top' }, h('h1', {}, h('img', { src: 'icons/icon.svg', alt: '', width: '28', height: '28' }), APP_NAME)),
    h('main', {}, logoNotice(), Object.values(panels)),
    nav);
  show(S.tab);
  syncShake();
  // Chrome también expone requestPermission y lo concede sin preguntar; iOS lo rechaza sin un toque y entonces sale el botón.
  if (shakeEnabled() && motionNeedsPermission() && !SHAKE.granted && !SHAKE.tried) {
    SHAKE.tried = true;
    requestMotion().then((ok) => { if (ok) panels.home.refresh(); });
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

async function refreshPlaylists() {
  if (S.busy || !S.api) return;
  let ind = document.getElementById('ptr');
  if (!ind) {
    ind = h('div', { id: 'ptr', class: 'ptr', role: 'status' });
    document.body.append(ind);
  }
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
    start = { x: p.clientX, y: p.clientY, ignore: !!e.target.closest?.('.picker, input, select, textarea, .sheet-backdrop') };
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
      refreshPlaylists();
    }
  }, { passive: true });
}

// ---------- Arranque ----------

async function boot() {
  setLang();
  applyTheme();
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
  S.api = new SpotifyApi({ auth });
  try {
    S.me = await S.api.getMe();
    mountApp();
    await loadPlaylists();
    await probeLiked();
    if (link) await S.openDeepLink(link);
    checkLibraryDuplicates().catch((e) => console.warn('Revisión de copias no hecha:', e?.status ?? e?.message));
  } catch (e) {
    console.error(e);
    if (e instanceof auth.AuthError) return renderSetup(e);
    setKids(root,h('main', { class: 'setup' }, h('p', { class: 'error', role: 'alert' }, errorMessage(e)),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, t('retry'))));
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
