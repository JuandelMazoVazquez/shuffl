// Playlists generadas «· Shuffle»: nombre, descripción y correspondencia origen → playlist (vive en el dispositivo).

export const SHUFFLE_SUFFIX = ' · Shuffle';
export const MAX_NAME = 100;
export const MAX_DESCRIPTION = 300;
export const MAX_TARGETS = 200;
const SOURCE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PLAYLIST_ID = /^[A-Za-z0-9]{1,64}$/;
const BASE_KEY = '(library|mix:[A-Za-z0-9_-]{1,64}|pl:[A-Za-z0-9_-]{1,64}(,[A-Za-z0-9_-]{1,64})*)';
/** Claves de origen: las de barajar y las de la v1.3 (por tiempo, por álbumes, Descubrir, recuerdos y Mi top). */
const KEY_RE = new RegExp(`^(${BASE_KEY}|albums:(saved|${BASE_KEY})|time:[0-9]{1,3}|new|explore|ago:[0-9]{1,2}|forgotten|top)$`);
export const isTargetKey = (k) => typeof k === 'string' && KEY_RE.test(k);
const LEGACY_NAME = /^(🔀 Baraja|Baraja · |📸 )/;
export const LEGACY_PLAYLIST = '🔀 Baraja';

const cut = (s, max) => {
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
};

/**
 * Clave del origen: una mezcla guardada tiene la suya; si no, toda la biblioteca o el conjunto de playlists
 * (sin importar el orden en que se eligieron). Devuelve null si no hay origen válido.
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

/** Nombre para «una nueva cada vez»: el generado más la fecha, sin pasar del máximo de Spotify. */
export const datedName = (name, date) => cut(`${name} · ${date}`, MAX_NAME);

/** `intro` termina en «: »; la lista de orígenes se recorta para no pasar de 300 caracteres. */
export function generatedDescription(intro, names) {
  return cut(`${intro}${names.filter(Boolean).join(', ')}`, MAX_DESCRIPTION);
}

/** Spotify devuelve la descripción con entidades HTML; para compararla hay que deshacerlas. */
export function sameDescription(fromSpotify, wanted) {
  return decodeEntities(fromSpotify) === wanted;
}

/** Valida la correspondencia guardada (almacenamiento o copia): claves y ids con formato seguro, como mucho MAX_TARGETS. */
export function sanitizeTargets(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const ok = Object.entries(raw).filter(([k, v]) => KEY_RE.test(k) && typeof v === 'string' && PLAYLIST_ID.test(v));
  return Object.fromEntries(ok.slice(-MAX_TARGETS));
}

/** Devuelve una correspondencia nueva con `key` → `id` como la más reciente; descarta las más antiguas si hay demasiadas. */
export function setTarget(map, key, id) {
  const rest = Object.entries(map).filter(([k]) => k !== key);
  return Object.fromEntries([...rest, [key, id]].slice(-MAX_TARGETS));
}

export function removeTarget(map, key) {
  return Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
}

// ---------- Etiqueta de origen (v1.3) ----------
// Cada «· Shuffle» lleva al final de la descripción « · shuffl:src=<hash>», un resumen del origen que permite
// encontrarla desde cualquier dispositivo sin guardar nada. El hash no revela los ids ni el nombre del origen.

export const TAG_PREFIX = 'shuffl:src=';
const TAG_LEN = 10;
const TAG_SEP = ' · ';
const TAG_RE = /(?:^| · )shuffl:src=([a-f0-9]{10})\s*$/;

/** Primeros 10 caracteres hex del SHA-256 de la clave de origen. */
export async function tagFor(key) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`shuffl:${key}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, TAG_LEN);
}

const decodeEntities = (s) => String(s ?? '')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');

/** Descripción con la etiqueta al final; el texto se recorta para que la etiqueta quepa siempre. */
export function withTag(description, tag) {
  const suffix = `${TAG_SEP}${TAG_PREFIX}${tag}`;
  return cut(String(description ?? ''), MAX_DESCRIPTION - suffix.length) + suffix;
}

/** La etiqueta de una descripción de Spotify (viene con entidades HTML), o null. */
export function readTag(description) {
  return TAG_RE.exec(decodeEntities(description))?.[1] ?? null;
}

/** Una playlist que Shuffl puede tocar: tuya y con un nombre que sigue terminando en « · Shuffle». */
export const isManagedName = (name) => typeof name === 'string' && name.endsWith(SHUFFLE_SUFFIX);

/**
 * Playlists (tal como las devuelve GET /me/playlists) que son la «· Shuffle» de este origen: propias, con el nombre
 * acabado en « · Shuffle» y con su etiqueta; o, sin etiqueta (v1.2), con el mismo nombre y la misma descripción.
 * Las renombradas no aparecen nunca.
 */
export function findCandidates(playlists, { meId, tag, name, legacyDescription }) {
  return playlists.filter((p) => {
    if (!p || p.owner?.id !== meId || !isManagedName(p.name)) return false;
    const found = readTag(p.description);
    if (found) return found === tag;
    return legacyDescription != null && p.name === name && sameDescription(p.description, legacyDescription);
  });
}

/**
 * Cuál se queda de varias copias: la que se escribió más tarde (`lastWrite`: id → ms de la última canción añadida,
 * que al sobrescribir es la fecha de la baraja). En empate, la que este dispositivo ya usaba y, si no, la primera.
 */
export function pickKeep(candidates, lastWrite = new Map(), preferredId = null) {
  let best = null;
  for (const p of candidates) {
    const t = lastWrite.get(p.id) ?? -Infinity;
    const score = [t, p.id === preferredId ? 1 : 0];
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) best = { p, score };
  }
  return best?.p ?? null;
}

/**
 * Grupos de copias repetidas en toda la biblioteca: por etiqueta y, sin etiqueta, por nombre y descripción
 * iguales (v1.2). Solo playlists propias con nombre «… · Shuffle». Devuelve [{ key, name, playlists }] con 2 o más.
 */
export function duplicateGroups(playlists, meId) {
  const groups = new Map();
  for (const p of playlists) {
    if (!p || p.owner?.id !== meId || !isManagedName(p.name)) continue;
    const tag = readTag(p.description);
    const key = tag ? `tag:${tag}` : `legacy:${p.name}\n${decodeEntities(p.description)}`;
    if (!groups.has(key)) groups.set(key, { key, name: p.name, playlists: [] });
    groups.get(key).playlists.push(p);
  }
  return [...groups.values()].filter((g) => g.playlists.length > 1);
}

/** La antigua «🔀 Baraja» propia, si sigue en la biblioteca. */
export function findLegacyBaraja(playlists, meId, legacyId = null) {
  return playlists.find((p) => p && p.owner?.id === meId && (p.id === legacyId || p.name === LEGACY_PLAYLIST)) ?? null;
}

/** Playlists que crea la app (las de ahora, las de antes del cambio de nombre e instantáneas). */
export function isGeneratedPlaylist(pl, map = {}, legacyId = null) {
  return pl.id === legacyId || Object.values(map).includes(pl.id) || pl.name.endsWith(SHUFFLE_SUFFIX) || LEGACY_NAME.test(pl.name);
}
