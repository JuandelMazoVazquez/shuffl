// Lógica pura de las playlists de la v1.3 (a medida de tiempo, Olvidadas y Descubrir): sin DOM ni red.
import { shuffle, randomInt, uniqueByUri } from './core.js';

export const MINUTE = 60000;
export const TIME_PRESETS = [15, 30, 45, 60];
export const TIME_MARGIN_MS = 2 * MINUTE;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 600;

/** Minutos válidos (enteros de 5 a 600) o null. */
export function sanitizeMinutes(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= MIN_MINUTES && n <= MAX_MINUTES ? n : null;
}

/**
 * Baraja de forma uniforme y toma canciones en ese orden mientras quepan en `minutes` ± 2 min.
 * Si una no cabe se salta y se sigue buscando entre las restantes otra que encaje.
 * Devuelve las elegidas (en el orden barajado) y su duración total.
 */
export function fitDuration(tracks, minutes, rand = randomInt) {
  const target = minutes * MINUTE;
  const max = target + TIME_MARGIN_MS;
  const min = target - TIME_MARGIN_MS;
  const out = [];
  let total = 0;
  for (const tr of shuffle(tracks.filter((x) => x.durationMs > 0), rand)) {
    if (total >= min) break;
    if (total + tr.durationMs <= max) {
      out.push(tr);
      total += tr.durationMs;
    }
  }
  return { tracks: out, totalMs: total, reached: total >= min };
}

// ---------- Olvidadas ----------

const addedDate = (tr) => {
  const d = new Date(tr.addedAt);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const FORGOTTEN_YEARS = [1, 2, 3, 5];

/** Canciones guardadas hace más de `years` años (sin fecha válida no cuentan). */
export function forgottenTracks(tracks, years, now = new Date()) {
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() - years);
  return uniqueByUri(tracks.filter((tr) => {
    const d = addedDate(tr);
    return d && d < limit;
  }));
}

// ---------- Descubrir ----------

export const MAX_ARTISTS = 25;
export const RELEASE_DAYS = [7, 30, 90];

/** Artistas para Novedades: alterna los tops (4 semanas, 6 meses) y los seguidos, sin repetir, hasta `max`. */
export function pickArtists(lists, max = MAX_ARTISTS) {
  const seen = new Set();
  const out = [];
  const queues = lists.map((l) => (Array.isArray(l) ? l.filter((a) => a && typeof a.id === 'string') : []));
  for (let i = 0; out.length < max && queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      const a = q[i];
      if (!a || seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Fecha de lanzamiento como Date (UTC) si la precisión es de día. Con precisión de mes o año
 * no se puede saber si cae en los últimos días, así que no cuenta como novedad.
 */
function releaseDay(album) {
  if (album?.release_date_precision !== 'day' || !/^\d{4}-\d{2}-\d{2}$/.test(album.release_date ?? '')) return null;
  const d = new Date(`${album.release_date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Álbumes y singles publicados en los últimos `days` días (incluido hoy), sin repetir. */
export function recentAlbums(albums, days, now = new Date()) {
  const from = now.getTime() - days * 86400000;
  const seen = new Set();
  return albums.filter((a) => {
    const d = releaseDay(a);
    if (!d || d.getTime() < from || d.getTime() > now.getTime() || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

/** Álbumes de las escuchas recientes y del top de 4 semanas, sin repetir y como mucho `max`. */
export function albumsFromListening(tracks, max = MAX_ARTISTS) {
  const seen = new Set();
  const out = [];
  for (const tr of tracks) {
    if (!tr?.albumId || seen.has(tr.albumId)) continue;
    seen.add(tr.albumId);
    out.push(tr.albumId);
    if (out.length >= max) break;
  }
  return out;
}

/** Quita las canciones de `exclude` (URIs) y las repetidas. */
export function withoutUris(tracks, exclude) {
  const set = exclude instanceof Set ? exclude : new Set(exclude);
  return uniqueByUri(tracks.filter((tr) => !set.has(tr.uri)));
}

// ---------- Descubrir: cuántas, de quién y sin lo que ya tienes (v1.3.1) ----------

export const DISCOVER_COUNTS = [15, 30, 50, 100];
export const DISCOVER_MINUTES = [30, 45, 60, 90];
export const DEFAULT_DISCOVER_COUNT = 30;
/** Artistas que se leen de cada vez; «Buscar más» lee el siguiente lote, hasta MAX_DISCOVER_ARTISTS. */
export const ARTIST_BATCH = 25;
export const MAX_DISCOVER_ARTISTS = 100;

/**
 * Toma de `pool` (ya barajado) lo que se pide: `count` canciones o, con `minutes`, las que llenan esa duración
 * (±2 min, la misma lógica que el shuffle por tiempo, en el orden del pool). Devuelve { taken, rest }.
 */
export function takeAmount(pool, { count = DEFAULT_DISCOVER_COUNT, minutes = null } = {}) {
  if (!minutes) return { taken: pool.slice(0, count), rest: pool.slice(count) };
  const max = minutes * MINUTE + TIME_MARGIN_MS;
  const min = minutes * MINUTE - TIME_MARGIN_MS;
  const taken = [];
  const rest = [];
  let total = 0;
  for (const tr of pool) {
    if (total < min && tr.durationMs > 0 && total + tr.durationMs <= max) {
      taken.push(tr);
      total += tr.durationMs;
    } else {
      rest.push(tr);
    }
  }
  return { taken, rest };
}

/** Los géneros más frecuentes de una lista de artistas (sin vacíos), del más al menos repetido. */
export function topGenres(artists, max = 8) {
  const count = new Map();
  for (const a of artists ?? []) {
    for (const g of Array.isArray(a?.genres) ? a.genres : []) {
      if (typeof g === 'string' && g.trim()) count.set(g.trim(), (count.get(g.trim()) ?? 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([g]) => g);
}

/** Artistas de unas canciones, del más al menos repetido: [{ id, name }]. Para «Como mi playlist…». */
export function artistsFromTracks(tracks) {
  const map = new Map();
  for (const tr of tracks) {
    (tr.artistIds ?? []).forEach((id, i) => {
      if (typeof id !== 'string' || !id) return;
      const cur = map.get(id) ?? { id, name: tr.artists?.[i] ?? '', n: 0 };
      cur.n++;
      map.set(id, cur);
    });
  }
  return [...map.values()].sort((a, b) => b.n - a.n).map(({ id, name }) => ({ id, name }));
}

/** Sin las canciones que ya tienes (ids de tus playlists y de Tus me gusta) ni las repetidas. */
export function notInLibrary(tracks, libraryIds) {
  return uniqueByUri(tracks.filter((tr) => !libraryIds.has(tr.id)));
}

// ---------- Caché de metadatos (24 h) ----------

export const CACHE_TTL_MS = 24 * 3600 * 1000;
export const MAX_CACHE_ENTRIES = 400;

/** Valida y limpia la caché guardada: quita lo caducado y lo que no tiene formato. */
export function pruneCache(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const ok = Object.entries(raw).filter(([k, v]) => typeof k === 'string' && k.length <= 120 && v && typeof v.t === 'number' && now - v.t < CACHE_TTL_MS && now >= v.t);
  return Object.fromEntries(ok.sort((a, b) => a[1].t - b[1].t).slice(-MAX_CACHE_ENTRIES));
}

export const cacheGet = (cache, key, now = Date.now()) => {
  const v = cache[key];
  return v && now - v.t < CACHE_TTL_MS && now >= v.t ? v.d : undefined;
};

/** Tope en caracteres del JSON guardado: deja sitio en localStorage (unos 5 MB) para Deshacer y lo demás. */
export const MAX_CACHE_CHARS = 1_500_000;

/** Caracteres de `"k":v` en el JSON del objeto (la coma de separación se cuenta aparte). */
const entrySize = (k, v) => JSON.stringify(k).length + JSON.stringify(v).length + 1;

/**
 * Añade una entrada a `{ cache, size }` (size: caracteres del JSON). Solo serializa la entrada nueva, salvo cuando
 * hay que recortar: si se pasa de entradas o de tamaño, quita primero las más antiguas. Devuelve `{ cache, size }`.
 */
export function cacheSet({ cache, size = JSON.stringify(cache).length }, key, data, now = Date.now(), maxChars = MAX_CACHE_CHARS) {
  const entry = { t: now, d: data };
  const old = cache[key];
  let next = { ...cache, [key]: entry };
  const comma = !old && Object.keys(cache).length ? 1 : 0;
  let total = size + entrySize(key, entry) + comma - (old ? entrySize(key, old) : 0);
  if (Object.keys(next).length > MAX_CACHE_ENTRIES) {
    next = pruneCache(next, now);
    total = JSON.stringify(next).length;
  }
  if (total <= maxChars) return { cache: next, size: total };
  const entries = Object.entries(next).sort((a, b) => a[1].t - b[1].t);
  while (entries.length && total > maxChars) {
    const [k, v] = entries.shift();
    total -= entrySize(k, v) + (entries.length ? 1 : 0);
  }
  const cache2 = Object.fromEntries(entries);
  return { cache: cache2, size: JSON.stringify(cache2).length };
}
