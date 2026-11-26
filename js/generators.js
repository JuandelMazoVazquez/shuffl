// Lógica pura de las playlists nuevas de la v1.3 (a medida de tiempo, recuerdos, álbumes y descubrir): sin DOM ni red.
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

// ---------- Tal día como hoy y Olvidadas ----------

const addedDate = (tr) => {
  const d = new Date(tr.addedAt);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Canciones de Tus me gusta guardadas en el mismo mes que `now` de años anteriores, agrupadas por año
 * (del más reciente al más antiguo). Se usa la hora local, como el calendario de quien la usa.
 */
export function onThisDayGroups(tracks, now = new Date()) {
  const byYear = new Map();
  for (const tr of tracks) {
    const d = addedDate(tr);
    if (!d || d.getMonth() !== now.getMonth() || d.getFullYear() >= now.getFullYear()) continue;
    const y = d.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(tr);
  }
  return [...byYear.entries()].sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({ year, yearsAgo: now.getFullYear() - year, tracks: uniqueByUri(list) }));
}

/** El artista que más se repite en un grupo (empate: el que aparece antes). Null si no hay. */
export function topArtist(tracks) {
  const count = new Map();
  for (const tr of tracks) {
    const a = tr.artists?.[0];
    if (a) count.set(a, (count.get(a) ?? 0) + 1);
  }
  let best = null;
  for (const [a, n] of count) if (!best || n > best.n) best = { name: a, n };
  return best?.name ?? null;
}

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

// ---------- Barajar por álbumes ----------

const byTrackOrder = (a, b) => (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber);

/**
 * Agrupa canciones por álbum. Devuelve [{ id, name, tracks }] en el orden en que aparece cada álbum,
 * con las canciones en su orden original de disco y pista y sin repetidas.
 */
export function groupAlbums(tracks) {
  const map = new Map();
  for (const tr of tracks) {
    if (tr.type !== 'track' || !tr.albumId) continue;
    if (!map.has(tr.albumId)) map.set(tr.albumId, { id: tr.albumId, name: tr.album, tracks: [] });
    map.get(tr.albumId).tracks.push(tr);
  }
  return [...map.values()].map((a) => ({ ...a, tracks: uniqueByUri(a.tracks).sort(byTrackOrder) }));
}

/** Orden uniforme de los álbumes; dentro de cada uno, el orden original. Devuelve la lista plana y el orden. */
export function shuffleAlbums(albums, rand = randomInt) {
  const order = shuffle(albums.filter((a) => a.tracks.length), rand);
  return { albums: order, tracks: order.flatMap((a) => a.tracks) };
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

/** Añade una entrada; si se pasa de entradas o de tamaño, quita primero las más antiguas. */
export function cacheSet(cache, key, data, now = Date.now(), maxChars = MAX_CACHE_CHARS) {
  let next = { ...cache, [key]: { t: now, d: data } };
  if (Object.keys(next).length > MAX_CACHE_ENTRIES) next = pruneCache(next, now);
  let size = JSON.stringify(next).length;
  if (size <= maxChars) return next;
  const entries = Object.entries(next).sort((a, b) => a[1].t - b[1].t);
  while (entries.length && size > maxChars) {
    const [k, v] = entries.shift();
    size -= JSON.stringify(k).length + JSON.stringify(v).length + 2;
  }
  return Object.fromEntries(entries);
}
