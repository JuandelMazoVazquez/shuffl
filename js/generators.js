// Lógica pura de las playlists de la v1.3 (a medida de tiempo, Olvidadas y Descubrir): sin DOM ni red.
import { shuffle, randomInt, uniqueByUri } from './core.js';

export const MINUTE = 60000;
export const TIME_MARGIN_MS = 2 * MINUTE;
export const MIN_MINUTES = 5;
/** Las mezclas guardadas de antes podían llegar a 600 min; el deslizador va de 5 a 180. */
export const MAX_MINUTES = 600;
export const SLIDER_MAX = 180;

/** Accesos rápidos del shuffle por tiempo (v1.3.2). La clave da el texto («Gym») y el nombre de la playlist. */
export const TIME_PRESETS = [
  { key: 'commute', emoji: '🚗', minutes: 20 },
  { key: 'gym', emoji: '🏋️', minutes: 45 },
  { key: 'run', emoji: '🏃', minutes: 30 },
  { key: 'trip', emoji: '✈️', minutes: 90 },
  { key: 'sleep', emoji: '😴', minutes: 30 },
];
export const presetByKey = (key) => TIME_PRESETS.find((p) => p.key === key) ?? null;

/** Minutos válidos (enteros de 5 a 600) o null. */
export function sanitizeMinutes(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= MIN_MINUTES && n <= MAX_MINUTES ? n : null;
}

/**
 * Ordena al azar de forma uniforme y toma canciones en ese orden mientras quepan en `minutes` ± 2 min.
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
/**
 * Artistas que se leen de cada vez (ajustable en «Más opciones»); «Buscar más» sigue con los siguientes, hasta
 * MAX_DISCOVER_ARTISTS. Cada búsqueda, además, no pasa de READ_BUDGET peticiones de lectura (v1.3.2: cuota).
 */
export const ARTISTS_PER_SEARCH = [8, 15, 25];
export const DEFAULT_ARTISTS_PER_SEARCH = 15;
export const MAX_DISCOVER_ARTISTS = 100;
export const READ_BUDGET = 30;
/** Si la cuota se acaba a medias, con al menos estas canciones se crea la playlist igualmente. */
export const MIN_TRACKS_ON_QUOTA = 10;
export const sanitizeArtistsPerSearch = (v) => (ARTISTS_PER_SEARCH.includes(v) ? v : DEFAULT_ARTISTS_PER_SEARCH);

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

// ---------- Variedad: máximo por artista y por turnos (v1.5.0) ----------

/** Canciones como mucho de un mismo artista en una playlist de Descubre o Novedades (ajustable en «Más opciones»). */
export const PER_ARTIST = [1, 2, 3, 5];
export const DEFAULT_PER_ARTIST = 3;
export const sanitizePerArtist = (v) => (PER_ARTIST.includes(v) ? v : DEFAULT_PER_ARTIST);
/** El artista principal (el primero que firma la canción); sin id, su nombre. */
export const mainArtist = (tr) => tr?.artistIds?.[0] || tr?.artists?.[0] || '';

/**
 * Ordena `pool` por turnos entre artistas (una canción de cada uno, luego la segunda…) sin pasar de `max` por artista,
 * contando las que ya lleva la playlist (`used`, artista → canciones). Dentro de cada artista se respeta el orden del
 * pool (ya barajado); los artistas siguen el orden en que aparecen. Devuelve { ordered, overflow }: `overflow` son las
 * que sobran por el máximo.
 */
export function spreadByArtist(pool, max, used = new Map()) {
  const groups = new Map();
  for (const tr of pool) {
    const key = mainArtist(tr);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tr);
  }
  const ordered = [];
  const overflow = [];
  const queues = [...groups.entries()].map(([key, list]) => {
    const room = Math.max(0, max - (used.get(key) ?? 0));
    overflow.push(...list.slice(room));
    return list.slice(0, room);
  });
  for (let round = 0; queues.some((q) => round < q.length); round++) {
    for (const q of queues) if (round < q.length) ordered.push(q[round]);
  }
  return { ordered, overflow };
}

/** Suma a `used` (artista → canciones) las canciones de `tracks`. */
export function countArtists(tracks, used = new Map()) {
  for (const tr of tracks) used.set(mainArtist(tr), (used.get(mainArtist(tr)) ?? 0) + 1);
  return used;
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

// ---------- Caché en el dispositivo (IndexedDB, js/idb.js) ----------

/** Artistas, lanzamientos y búsquedas valen 24 h; las canciones de playlists y álbumes, 30 días (ver app.js). */
export const CACHE_TTL_MS = 24 * 3600 * 1000;
