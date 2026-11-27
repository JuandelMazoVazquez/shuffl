// Playlists que crea Shuffl: nombre, descripción con etiqueta y cómo reconocerlas para borrarlas (v1.3.1).
// En tu cuenta hay como mucho una playlist de Shuffl de cada categoría (v1.5.0): antes de crear la nueva se quitan las
// anteriores de su misma categoría.

/** v1.4.1: las playlists nuevas terminan en «· Shuffl»; hasta la v1.4.0 terminaban en «· Shuffle». */
export const SHUFFLE_SUFFIX = ' · Shuffl';
const LEGACY_SUFFIX = ' · Shuffle';
export const MAX_NAME = 100;
export const MAX_DESCRIPTION = 300;
const SOURCE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const LEGACY_PLAYLIST = '🔀 Baraja';
export const SNAPSHOT_PREFIX = '📸 ';

const cut = (s, max) => {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
};

/**
 * Clave del origen (para la etiqueta): una mezcla guardada tiene la suya; si no, toda la biblioteca o el conjunto de
 * playlists (sin importar el orden en que se eligieron). Devuelve null si no hay origen válido.
 */
export function sourceKey({ mixId, library, ids = [] }) {
  if (typeof mixId === 'string' && SOURCE_ID.test(mixId)) return `mix:${mixId}`;
  if (library) return 'library';
  const clean = [...new Set(ids.filter((id) => typeof id === 'string' && SOURCE_ID.test(id)))].sort();
  return clean.length ? `pl:${clean.join(',')}` : null;
}

/**
 * «Reggaeton · Shuffl», «Tus me gusta · Shuffl», «Mix · Shuffl», «Coche · Shuffl» o «Toda mi música · Shuffl».
 * `labels` trae los textos traducidos de Me gusta y de la biblioteca.
 */
export function generatedName({ mixName, library, sources = [] }, labels) {
  const base = (typeof mixName === 'string' && mixName.trim())
    || (library ? labels.library
      : sources.length === 1 ? (sources[0].isLiked ? labels.liked : sources[0].name)
        : 'Mix');
  return cut(String(base).trim() || 'Mix', MAX_NAME - SHUFFLE_SUFFIX.length) + SHUFFLE_SUFFIX;
}

/**
 * Shuffle por tiempo (v1.3.2): con un acceso rápido, «Gym 45 min · Shuffl»; personalizado, «Rock · 45 min · Shuffl».
 * Si el origen es muy largo se recorta él, nunca los minutos.
 */
export function timeName({ minutes, presetLabel = '', base = 'Mix' }) {
  const mins = `${minutes} min`;
  if (presetLabel) return `${cut(presetLabel, MAX_NAME - SHUFFLE_SUFFIX.length - mins.length - 1)} ${mins}${SHUFFLE_SUFFIX}`;
  const tail = ` · ${mins}`;
  return `${cut(String(base).trim() || 'Mix', MAX_NAME - SHUFFLE_SUFFIX.length - tail.length)}${tail}${SHUFFLE_SUFFIX}`;
}

/** Nombre de una instantánea: «📸 Top 4 semanas». */
export const snapshotName = (label) => cut(`${SNAPSHOT_PREFIX}${label}`, MAX_NAME);

/** `intro` termina en «: »; la lista de orígenes se recorta para no pasar de 300 caracteres. */
export function generatedDescription(intro, names) {
  return cut(`${intro}${names.filter(Boolean).join(', ')}`, MAX_DESCRIPTION);
}

const decodeEntities = (s) => String(s ?? '')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');

// ---------- Etiqueta ----------
// Cada playlist de Shuffl lleva al final de la descripción « · shuffl:src=<hash>». El hash resume el origen y no revela
// ids ni nombres; sirve para reconocerla desde cualquier dispositivo.

export const TAG_PREFIX = 'shuffl:src=';
const TAG_LEN = 10;
const TAG_SEP = ' · ';
/** «shuffl:src=<10 hex del origen>.<6 hex del nombre>» (v1.3.1); las de la v1.3 no llevan la parte del nombre. */
const TAG_RE = /(?:^| · )shuffl:src=([a-f0-9]{10})(?:\.([a-f0-9]{6}))?\s*$/;

/** Resumen corto (FNV-1a, 6 hex) del nombre con el que Shuffl creó la playlist: si cambia, la renombraste. */
export function nameHash(name) {
  let h = 0x811c9dc5;
  for (const ch of String(name ?? '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').slice(0, 6);
}

/** Primeros 10 caracteres hex del SHA-256 de la clave de origen. */
export async function tagFor(key) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`shuffl:${key}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, TAG_LEN);
}

/**
 * Descripción con la etiqueta al final (categoría, origen y, si se pasa, nombre); el texto se recorta para que quepa
 * siempre. La categoría (v1.5.0) va antes del origen para que las versiones anteriores sigan leyendo la etiqueta.
 */
export function withTag(description, tag, name = null, category = null) {
  const cat = CATEGORIES.includes(category) ? `${TAG_SEP}${CAT_PREFIX}${category}` : '';
  const suffix = `${cat}${TAG_SEP}${TAG_PREFIX}${tag}${name == null ? '' : `.${nameHash(decodeEntities(name))}`}`;
  return cut(String(description ?? ''), MAX_DESCRIPTION - suffix.length) + suffix;
}

// ---------- Categorías (v1.5.0) ----------
// Al crear una playlist de Shuffl solo se quitan las anteriores de la MISMA categoría: un shuffle y un Descubre
// conviven. `diag` es la playlist de prueba del diagnóstico: si se quedó por un fallo, la quita cualquier categoría.

export const CATEGORIES = Object.freeze(['shuffle', 'explore', 'new', 'forgotten', 'snap', 'diag']);
const CAT_PREFIX = 'shuffl:cat=';
const CAT_RE = /(?:^| · )shuffl:cat=([a-z]{1,16}) · shuffl:src=[a-f0-9]{10}(?:\.[a-f0-9]{6})?\s*$/;

/** La categoría escrita en la etiqueta, o null si no la lleva (anteriores a la v1.5.0) o no es una conocida. */
export function readCategory(description) {
  const cat = CAT_RE.exec(decodeEntities(description))?.[1] ?? null;
  return CATEGORIES.includes(cat) ? cat : (cat ? 'unknown' : null);
}

/**
 * Claves de origen fijas de las versiones anteriores (v1.3.0 a v1.4.2) y su categoría: así se clasifican por su
 * etiqueta las playlists sin categoría, sin fiarse del nombre (una playlist tuya llamada «Descubre» barajada se llama
 * «Descubre · Shuffl» y es un shuffle). Las demás claves (pl:, mix:, library, time:, albums:) son shuffles.
 */
const LEGACY_KEYS = [
  ['new', 'new'], ['explore', 'explore'], ['forgotten', 'forgotten'], ['top', 'snap'], ['diag', 'diag'],
  ...['top_short', 'top_medium', 'top_long', 'recent'].map((k) => [`snap:${k}`, 'snap']),
  // v1.3.0: «Un día como hoy» (hace N años) era un recuerdo, como Olvidadas.
  ...Array.from({ length: 30 }, (_, i) => [`ago:${i + 1}`, 'forgotten']),
];
let legacyTags = null;
const knownTags = () => (legacyTags ??= Promise.all(LEGACY_KEYS.map(async ([key, cat]) => [await tagFor(key), cat])).then((e) => new Map(e)));

/**
 * Categoría de una playlist que ya se sabe de Shuffl (`isAppPlaylist`). Con etiqueta de categoría, esa (o 'unknown'
 * si la escribió una versión futura: no se borra con ninguna); con etiqueta de origen sin categoría, la de su clave;
 * sin etiqueta (v1.2 y anteriores), «📸 …» son instantáneas y el resto («🔀 Baraja», «… · Shuffle») shuffles.
 */
export async function appCategory(p) {
  const cat = readCategory(p?.description);
  if (cat) return cat;
  // Una etiqueta de categoría con otro formato (de una versión futura) tampoco se borra.
  if (decodeEntities(p?.description).includes(CAT_PREFIX)) return 'unknown';
  const tag = readTag(p?.description);
  if (tag) return (await knownTags()).get(tag) ?? 'shuffle';
  return String(p?.name ?? '').startsWith(SNAPSHOT_PREFIX) ? 'snap' : 'shuffle';
}

/** Si al crear una playlist de `category` se quita una anterior de `other`: la misma categoría, o la prueba del diagnóstico. */
export const replacedBy = (category, other) => CATEGORIES.includes(category) && (other === category || other === 'diag');

/** La etiqueta de origen de una descripción de Spotify (viene con entidades HTML), o null. */
export function readTag(description) {
  return TAG_RE.exec(decodeEntities(description))?.[1] ?? null;
}

/** El resumen del nombre que lleva la etiqueta (v1.3.1), o null si no lo lleva. */
const readNameHash = (description) => TAG_RE.exec(decodeEntities(description))?.[2] ?? null;

// ---------- Reconocer las playlists de Shuffl ----------

/**
 * Descripciones que pusieron las versiones anteriores, sacadas del historial de git (js/i18n.js).
 * `shuffle`: la de «🔀 Baraja» (exacta). `snapshot`: las de las instantáneas (exactas). `fromPrefix`: las de la v1.2,
 * que terminaban con la lista de orígenes. Una playlist sin etiqueta solo es de Shuffl si su descripción es una de estas
 * y además su nombre es exactamente el que la app le habría puesto.
 */
export const LEGACY_DESCRIPTIONS = {
  shuffle: [
    'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado',
    'Shuffled with Baraja · uniform random · play it with Spotify shuffle off',
  ],
  snapshot: ['Instantánea creada con Baraja', 'Snapshot created with Baraja', 'Instantánea creada con Shuffl', 'Snapshot created with Shuffl'],
  fromPrefix: [
    'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: ',
    'Shuffled with Shuffl (uniform random; play it with Spotify shuffle off). Source: ',
  ],
};
/** Nombres de las instantáneas de todas las versiones (es y en). */
export const SNAPSHOT_LABELS = ['Top 4 semanas', 'Top 6 meses', 'Top siempre', 'Últimas escuchas', 'Top 4 weeks', 'Top 6 months', 'Top all time', 'Recently played'];
/** «Rock · Shuffle · 26/11/26, 10:00» (v1.2, «una nueva cada vez»): fecha corta con hora, también en formato inglés con AM/PM. */
const DATED_RE = / · \d{1,2}\/\d{1,2}\/\d{2,4},?\s\d{1,2}:\d{2}(?:\s?[AP]M)?$/;
/** El nombre con fecha de la v1.2 siempre llevaba « · Shuffle» antes de la fecha. */
const SHUFFLE_DATED_RE = new RegExp(`${LEGACY_SUFFIX}${DATED_RE.source}`);

/**
 * Nombres que ponían las versiones con etiqueta sin resumen del nombre (v1.3): «… · Shuffle», «📸 …», «🔀 Baraja» y la
 * v1.2 con fecha. No incluye «· Shuffl» (v1.4.1): esas llevan siempre el resumen del nombre y se reconocen por él.
 */
export function isAppName(name) {
  if (typeof name !== 'string' || !name.trim()) return false;
  return name.endsWith(LEGACY_SUFFIX) || SHUFFLE_DATED_RE.test(name) || name.startsWith(SNAPSHOT_PREFIX) || name === LEGACY_PLAYLIST;
}

/** Si la descripción (sin etiqueta) es una de las que generaron las versiones anteriores. */
function isKnownDescription(d) {
  return LEGACY_DESCRIPTIONS.shuffle.includes(d) || LEGACY_DESCRIPTIONS.snapshot.includes(d)
    || LEGACY_DESCRIPTIONS.fromPrefix.some((p) => d.startsWith(p) && d.length > p.length);
}

/**
 * El nombre tiene que ser exactamente el que corresponde a su descripción; si no, la renombraste.
 * `v13`: con etiqueta de la v1.3, que también hacía «35 min · Shuffle» y «Rock · Álbumes · Shuffle» con esa descripción.
 */
function isLegacyAppPlaylist(name, description, v13 = false) {
  const d = decodeEntities(description).trim();
  if (!d) return false;
  if (LEGACY_DESCRIPTIONS.shuffle.includes(d)) return name === LEGACY_PLAYLIST;
  if (LEGACY_DESCRIPTIONS.snapshot.includes(d)) return SNAPSHOT_LABELS.some((l) => name === snapshotName(l));
  const prefix = LEGACY_DESCRIPTIONS.fromPrefix.find((p) => d.startsWith(p) && d.length > p.length);
  if (!prefix) return false;
  const origin = d.slice(prefix.length);
  const expected = [cut(origin, MAX_NAME - LEGACY_SUFFIX.length) + LEGACY_SUFFIX];
  // Varias playlists se llamaban «Mix · Shuffle» y la descripción las listaba separadas por comas.
  if (origin.includes(', ')) expected.push(`Mix${LEGACY_SUFFIX}`);
  if (v13) {
    if (/^\d{1,3} min · Shuffle$/.test(name)) return true;
    for (const label of [origin, ...(origin.includes(', ') ? ['Mix'] : [])]) {
      for (const word of ['Álbumes', 'Albums']) expected.push(cut(`${label} · ${word}`, MAX_NAME - LEGACY_SUFFIX.length) + LEGACY_SUFFIX);
    }
  }
  const base = name.replace(DATED_RE, '');
  return expected.includes(name) || (base !== name && expected.includes(base));
}

/**
 * Si una playlist (tal como la devuelve GET /me/playlists) la creó Shuffl y se puede borrar: propia y no colaborativa, y
 * - con la etiqueta de la v1.3.1: el nombre tiene que seguir siendo el que puso la app (va resumido en la etiqueta);
 * - con la etiqueta de la v1.3 (sin resumen del nombre): el nombre exacto si la descripción es de las conocidas y, si
 *   no (Novedades, Descubre…), un nombre de los que pone la app;
 * - sin etiqueta: una descripción de una versión anterior y exactamente el nombre que le correspondía.
 * Renombrada, descripción vacía o distinta: es tuya y no se toca.
 */
export function isAppPlaylist(p, meId) {
  if (!p || !meId || p.owner?.id !== meId || p.collaborative || typeof p.name !== 'string') return false;
  if (readTag(p.description)) {
    const hash = readNameHash(p.description);
    // Spotify podría devolver el nombre con entidades HTML, como la descripción: se compara el texto real.
    if (hash) return hash === nameHash(decodeEntities(p.name));
    // Etiqueta de la v1.3 (sin resumen del nombre): si la descripción es de las conocidas, el nombre tiene que ser el exacto.
    const rest = String(p.description ?? '').replace(TAG_RE, '').trim();
    return isKnownDescription(decodeEntities(rest).trim()) ? isLegacyAppPlaylist(p.name, rest, true) : isAppName(p.name);
  }
  return isLegacyAppPlaylist(p.name, p.description);
}
