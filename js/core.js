// Lógica pura de Baraja: sin DOM ni red, para poder probarla con node --test.

export const MAX_PLAYLIST = 10000;
export const MAX_BACKUP_PLAYLISTS = 200;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const LIKED_ID = '__liked__';

const defaultRandomValues = (arr) => globalThis.crypto.getRandomValues(arr);

/** Entero uniforme en [0, max) por muestreo por rechazo (sin sesgo de módulo). */
export function randomInt(max, getRandomValues = defaultRandomValues) {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) {
    throw new RangeError('max debe ser un entero entre 1 y 2^32');
  }
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** Fisher-Yates uniforme. Devuelve una copia; no modifica la entrada. */
export function shuffle(items, rand = randomInt) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function chunk(items, size) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('size debe ser un entero >= 1');
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function uniqueByUri(tracks) {
  const seen = new Set();
  const out = [];
  for (const t of tracks) {
    if (seen.has(t.uri)) continue;
    seen.add(t.uri);
    out.push(t);
  }
  return out;
}

/** Corta a MAX_PLAYLIST después de barajar. */
export function capPlaylist(tracks) {
  return { tracks: tracks.slice(0, MAX_PLAYLIST), truncated: Math.max(0, tracks.length - MAX_PLAYLIST) };
}

// ---------- Normalización de lo que devuelve la API ----------

export function normalizeEntry(entry) {
  const it = entry?.item ?? entry?.track;
  if (!it) return { reason: 'empty' };
  if (entry.is_local || it.is_local || String(it.uri ?? '').startsWith('spotify:local:')) {
    return { reason: 'local' };
  }
  if (!it.uri) return { reason: 'empty' };
  const isEpisode = it.type === 'episode' || it.uri.startsWith('spotify:episode:');
  const album = isEpisode ? it.show : it.album;
  const images = album?.images ?? it.images ?? [];
  return {
    track: {
      uri: it.uri,
      id: it.id ?? it.uri.split(':').pop(),
      type: isEpisode ? 'episode' : 'track',
      name: it.name ?? '',
      artists: isEpisode ? [it.show?.publisher].filter(Boolean) : (it.artists ?? []).map((a) => a.name).filter(Boolean),
      album: album?.name ?? '',
      albumId: album?.id ?? '',
      releaseDate: (isEpisode ? it.release_date : it.album?.release_date) ?? '',
      releaseDatePrecision: (isEpisode ? it.release_date_precision : it.album?.release_date_precision) ?? '',
      durationMs: it.duration_ms ?? 0,
      isrc: it.external_ids?.isrc ?? '',
      addedAt: entry.added_at ?? '',
      discNumber: it.disc_number ?? 1,
      trackNumber: it.track_number ?? 0,
      isLocal: false,
      image: images.length ? images[images.length - 1].url : '',
    },
  };
}

export function normalizeEntries(entries) {
  const tracks = [];
  const skipped = { local: 0, empty: 0 };
  for (const e of entries) {
    const r = normalizeEntry(e);
    if (r.track) tracks.push(r.track);
    else skipped[r.reason]++;
  }
  return { tracks, skipped };
}

export function normalizePlaylist(p, meId) {
  const owned = p.owner?.id === meId;
  const images = p.images ?? [];
  return {
    id: p.id,
    name: p.name ?? '',
    total: p.items?.total ?? p.tracks?.total ?? null,
    image: images.length ? images[images.length - 1].url : '',
    owner: p.owner?.display_name ?? p.owner?.id ?? '',
    owned,
    collaborative: !!p.collaborative,
    readable: owned || !!p.collaborative,
    isLiked: false,
  };
}

// ---------- Fechas de lanzamiento ----------

/** Devuelve { year, month, day, precision, key } o null. Los huecos cuentan como 1 para ordenar. */
export function parseReleaseDate(str, precision) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(str ?? '').trim());
  if (!m) return null;
  const year = +m[1];
  const month = m[2] ? +m[2] : 0;
  const day = m[3] ? +m[3] : 0;
  if (month > 12 || day > 31) return null;
  const inferred = day ? 'day' : month ? 'month' : 'year';
  return {
    year,
    month,
    day,
    precision: precision || inferred,
    key: year * 10000 + (month || 1) * 100 + (day || 1),
  };
}

const releaseKey = (t) => parseReleaseDate(t.releaseDate, t.releaseDatePrecision)?.key ?? null;

// ---------- Ordenación ----------

export const SORT_KEYS = [
  'release-desc', 'release-asc', 'artist', 'album', 'title',
  'duration-asc', 'duration-desc', 'added-desc', 'added-asc', 'reverse', 'current',
];

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const cmpNum = (a, b) => a - b;
const cmpMissingLast = (a, b, cmp) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return cmp(a, b);
};
const cmpAlbumOrder = (a, b) =>
  cmpMissingLast(releaseKey(a), releaseKey(b), cmpNum) ||
  collator.compare(a.album, b.album) ||
  collator.compare(a.albumId, b.albumId) ||
  cmpNum(a.discNumber, b.discNumber) ||
  cmpNum(a.trackNumber, b.trackNumber);

/** Ordenación estable (el índice original desempata). Devuelve una copia. */
export function sortTracks(tracks, key) {
  if (!SORT_KEYS.includes(key)) throw new RangeError(`Orden desconocido: ${key}`);
  if (key === 'current') return tracks.slice();
  if (key === 'reverse') return tracks.slice().reverse();
  const cmps = {
    'release-asc': cmpAlbumOrder,
    'release-desc': (a, b) =>
      cmpMissingLast(releaseKey(a), releaseKey(b), (x, y) => y - x) ||
      collator.compare(a.album, b.album) ||
      collator.compare(a.albumId, b.albumId) ||
      cmpNum(a.discNumber, b.discNumber) ||
      cmpNum(a.trackNumber, b.trackNumber),
    artist: (a, b) => collator.compare(a.artists[0] ?? '', b.artists[0] ?? '') || cmpAlbumOrder(a, b),
    album: cmpAlbumOrder,
    title: (a, b) => collator.compare(a.name, b.name) || collator.compare(a.artists[0] ?? '', b.artists[0] ?? ''),
    'duration-asc': (a, b) => cmpNum(a.durationMs, b.durationMs),
    'duration-desc': (a, b) => cmpNum(b.durationMs, a.durationMs),
    'added-asc': (a, b) => cmpMissingLast(a.addedAt || null, b.addedAt || null, (x, y) => (x < y ? -1 : x > y ? 1 : 0)),
    'added-desc': (a, b) => cmpMissingLast(a.addedAt || null, b.addedAt || null, (x, y) => (x < y ? 1 : x > y ? -1 : 0)),
  };
  const cmp = cmps[key];
  return tracks
    .map((t, i) => [t, i])
    .sort((x, y) => cmp(x[0], y[0]) || x[1] - y[1])
    .map(([t]) => t);
}

/** Filtra por fecha en que se añadió (YYYY-MM-DD, ambos extremos incluidos y opcionales). */
export function filterByAdded(tracks, from, to) {
  if (!from && !to) return tracks.slice();
  return tracks.filter((t) => {
    const d = t.addedAt?.slice(0, 10);
    if (!d) return false;
    return (!from || d >= from) && (!to || d <= to);
  });
}

// ---------- Duplicados ----------

const KEEP_RE = /\b(live|en vivo|acoustic|ac[uú]stic[oa]|unplugged)\b/i;
const NOISE_RE = /\b(remaster(?:ed)?|radio edit|single version|album version|mono|stereo)\b/i;

export function normalizeTitle(name) {
  let s = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const dropIf = (seg) => (NOISE_RE.test(seg) && !KEEP_RE.test(seg) ? '' : null);
  s = s.replace(/\s*[([]([^)\]]*)[)\]]/g, (m, inner) => {
    if (/^\s*(feat|ft|featuring|with)\b/i.test(inner)) return '';
    return dropIf(inner) ?? m;
  });
  s = s.replace(/\s+[-–]\s+(.*)$/, (m, rest) => {
    if (/^\s*(feat|ft|featuring|with)\b/i.test(rest)) return '';
    return dropIf(rest) ?? m;
  });
  s = s.replace(/\s+(feat|ft|featuring)\.?\s+.*$/i, '');
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function normalizeArtist(name) {
  return String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function duplicateKey(t, mode) {
  if (mode === 'exact' || t.type === 'episode') return `u:${t.uri}`;
  if (t.isrc) return `i:${t.isrc.toUpperCase()}`;
  return `n:${normalizeTitle(t.name)}|${normalizeArtist(t.artists[0])}`;
}

/**
 * Agrupa repetidos. Cada grupo conserva la primera aparición (`keep`) y lista las demás (`dupes`),
 * con su posición (1-based) en la playlist original.
 */
export function findDuplicates(tracks, mode = 'exact') {
  const groups = new Map();
  tracks.forEach((track, index) => {
    const key = duplicateKey(track, mode);
    if (!groups.has(key)) groups.set(key, { key, keep: { track, index }, dupes: [] });
    else groups.get(key).dupes.push({ track, index });
  });
  return [...groups.values()].filter((g) => g.dupes.length > 0);
}

/** Quita de `tracks` las posiciones (índices 0-based) indicadas. */
export function removeIndexes(tracks, indexes) {
  const drop = new Set(indexes);
  return tracks.filter((_, i) => !drop.has(i));
}

// ---------- Copia de seguridad ----------

const slim = (t) => ({
  uri: t.uri, name: t.name, artists: t.artists, album: t.album,
  releaseDate: t.releaseDate, durationMs: t.durationMs, isrc: t.isrc, addedAt: t.addedAt,
});

export function buildBackup(playlists, now = new Date()) {
  return {
    app: 'baraja',
    version: 1,
    exportedAt: now.toISOString(),
    playlists: playlists.map((p) => ({ id: p.id, name: p.name, isLiked: !!p.isLiked, tracks: p.tracks.map(slim) })),
  };
}

const csvCell = (v) => {
  let s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(playlists) {
  const head = ['playlist', 'uri', 'name', 'artists', 'album', 'releaseDate', 'durationMs', 'isrc', 'addedAt'];
  const rows = [head.join(',')];
  for (const p of playlists) {
    for (const t of p.tracks) {
      rows.push([p.name, t.uri, t.name, t.artists, t.album, t.releaseDate, t.durationMs, t.isrc, t.addedAt].map(csvCell).join(','));
    }
  }
  return rows.join('\r\n') + '\r\n';
}

/** Valida un JSON de copia. Devuelve las playlists limpias o lanza Error con `code`. */
export function validateBackup(obj) {
  const fail = (code) => Object.assign(new Error(code), { code });
  if (!obj || typeof obj !== 'object' || obj.app !== 'baraja') throw fail('notBackup');
  if (obj.version !== 1) throw fail('badVersion');
  if (!Array.isArray(obj.playlists)) throw fail('notBackup');
  if (obj.playlists.length > MAX_BACKUP_PLAYLISTS) throw fail('tooBig');
  return obj.playlists.map((p, i) => {
    if (!p || typeof p.name !== 'string' || !Array.isArray(p.tracks)) throw fail('notBackup');
    const tracks = p.tracks.slice(0, MAX_PLAYLIST).map((t) => {
      if (!t || typeof t.uri !== 'string' || !/^spotify:(track|episode):[A-Za-z0-9]{22}$/.test(t.uri)) throw fail('badTrack');
      return {
        uri: t.uri,
        name: String(t.name ?? ''),
        artists: Array.isArray(t.artists) ? t.artists.map(String) : [],
        album: String(t.album ?? ''),
        releaseDate: String(t.releaseDate ?? ''),
        durationMs: Number(t.durationMs) || 0,
        isrc: String(t.isrc ?? ''),
        addedAt: String(t.addedAt ?? ''),
      };
    });
    return { id: String(p.id ?? i), name: p.name.slice(0, 100) || `Playlist ${i + 1}`, isLiked: !!p.isLiked, tracks };
  });
}
