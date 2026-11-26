// Playlists que crea Shuffl: nombre, descripción con etiqueta y cómo reconocerlas para borrarlas (v1.3.1).
// En tu cuenta solo existe una playlist de Shuffl a la vez: antes de crear la nueva se quitan todas las anteriores.

export const SHUFFLE_SUFFIX = ' · Shuffle';
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
 * «Reggaeton · Shuffle», «Tus me gusta · Shuffle», «Mix · Shuffle», «Coche · Shuffle» o «Toda mi música · Shuffle».
 * `labels` trae los textos traducidos de Me gusta y de la biblioteca.
 */
export function generatedName({ mixName, library, sources = [] }, labels) {
  const base = (typeof mixName === 'string' && mixName.trim())
    || (library ? labels.library
      : sources.length === 1 ? (sources[0].isLiked ? labels.liked : sources[0].name)
        : 'Mix');
  return cut(String(base).trim() || 'Mix', MAX_NAME - SHUFFLE_SUFFIX.length) + SHUFFLE_SUFFIX;
}

/** Nombre de una instantánea: «📸 Top 4 semanas». */
export const snapshotName = (label) => cut(`${SNAPSHOT_PREFIX}${label}`, MAX_NAME);

/** `intro` termina en «: »; la lista de orígenes se recorta para no pasar de 300 caracteres. */
export function generatedDescription(intro, names) {
  return cut(`${intro}${names.filter(Boolean).join(', ')}`, MAX_DESCRIPTION);
}

const decodeEntities = (s) => String(s ?? '')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');

/** Spotify devuelve la descripción con entidades HTML; para compararla hay que deshacerlas. */
export function sameDescription(fromSpotify, wanted) {
  return decodeEntities(fromSpotify) === wanted;
}

// ---------- Etiqueta ----------
// Cada playlist de Shuffl lleva al final de la descripción « · shuffl:src=<hash>». El hash resume el origen y no revela
// ids ni nombres; sirve para reconocerla desde cualquier dispositivo.

export const TAG_PREFIX = 'shuffl:src=';
const TAG_LEN = 10;
const TAG_SEP = ' · ';
const TAG_RE = /(?:^| · )shuffl:src=([a-f0-9]{10})\s*$/;

/** Primeros 10 caracteres hex del SHA-256 de la clave de origen. */
export async function tagFor(key) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`shuffl:${key}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, TAG_LEN);
}

/** Descripción con la etiqueta al final; el texto se recorta para que la etiqueta quepa siempre. */
export function withTag(description, tag) {
  const suffix = `${TAG_SEP}${TAG_PREFIX}${tag}`;
  return cut(String(description ?? ''), MAX_DESCRIPTION - suffix.length) + suffix;
}

/** La etiqueta de una descripción de Spotify (viene con entidades HTML), o null. */
export function readTag(description) {
  return TAG_RE.exec(decodeEntities(description))?.[1] ?? null;
}

// ---------- Reconocer las playlists de Shuffl ----------

/**
 * Descripciones que pusieron las versiones anteriores, sacadas del historial de git (js/i18n.js): exactas o, las que
 * terminaban con la lista de orígenes, como prefijo. Una playlist sin etiqueta solo es de Shuffl si su descripción es una de estas.
 */
export const LEGACY_DESCRIPTIONS = {
  exact: [
    'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado',
    'Shuffled with Baraja · uniform random · play it with Spotify shuffle off',
    'Instantánea creada con Baraja', 'Snapshot created with Baraja',
    'Instantánea creada con Shuffl', 'Snapshot created with Shuffl',
  ],
  prefix: [
    'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: ',
    'Shuffled with Shuffl (uniform random; play it with Spotify shuffle off). Source: ',
  ],
};

/** Nombres que pone Shuffl: «… · Shuffle», «… · Shuffle · fecha» (v1.2), «📸 …» y «🔀 Baraja». */
export function isAppName(name) {
  if (typeof name !== 'string' || !name.trim()) return false;
  return name.endsWith(SHUFFLE_SUFFIX) || / · Shuffle · .+$/.test(name) || name.startsWith(SNAPSHOT_PREFIX) || name === LEGACY_PLAYLIST;
}

const isLegacyDescription = (description) => {
  const d = decodeEntities(description).trim();
  if (!d) return false;
  return LEGACY_DESCRIPTIONS.exact.includes(d) || LEGACY_DESCRIPTIONS.prefix.some((p) => d.startsWith(p) && d.length > p.length);
};

/**
 * Si una playlist (tal como la devuelve GET /me/playlists) la creó Shuffl y se puede borrar: propia, con un nombre de
 * los que pone la app (si la renombraste, es tuya) y con la etiqueta o, sin ella, con una descripción de una versión
 * anterior. Descripción vacía o distinta: no es de Shuffl.
 */
export function isAppPlaylist(p, meId) {
  if (!p || !meId || p.owner?.id !== meId || p.collaborative) return false;
  if (!isAppName(p.name)) return false;
  return !!readTag(p.description) || isLegacyDescription(p.description);
}
