// Playlists generadas «· Shuffle»: nombre, descripción y correspondencia origen → playlist (vive en el dispositivo).

export const SHUFFLE_SUFFIX = ' · Shuffle';
export const MAX_NAME = 100;
export const MAX_DESCRIPTION = 300;
export const MAX_TARGETS = 200;
const SOURCE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PLAYLIST_ID = /^[A-Za-z0-9]{1,64}$/;
const KEY_RE = /^(library|mix:[A-Za-z0-9_-]{1,64}|pl:[A-Za-z0-9_-]{1,64}(,[A-Za-z0-9_-]{1,64})*)$/;
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
  const plain = String(fromSpotify ?? '')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');
  return plain === wanted;
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

/** Playlists que crea la app (las de ahora, las de antes del cambio de nombre e instantáneas). */
export function isGeneratedPlaylist(pl, map = {}, legacyId = null) {
  return pl.id === legacyId || Object.values(map).includes(pl.id) || pl.name.endsWith(SHUFFLE_SUFFIX) || LEGACY_NAME.test(pl.name);
}
