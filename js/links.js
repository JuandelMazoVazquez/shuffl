// Enlaces profundos para Siri y Atajos: ?mezcla=<id>&play=1&k=<clave> o ?origen=<id de playlist>&play=1.
// Solo se aceptan ids con formato seguro; que existan en el dispositivo, y la clave, lo comprueba la app.

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9_-]{22}$/;
export const LINK_PARAMS = ['mezcla', 'origen', 'play', 'k'];

/** Lee el enlace profundo de `search` (location.search). Devuelve null si no hay o si el id no es válido. */
export function parseDeepLink(search) {
  const q = new URLSearchParams(search);
  const play = q.get('play') === '1';
  const k = q.get('k');
  const key = k !== null && KEY_RE.test(k) ? k : null;
  const mix = q.get('mezcla');
  const source = q.get('origen');
  if (mix !== null && source !== null) return null;
  if (mix !== null) return ID_RE.test(mix) ? { kind: 'mix', id: mix, play, key } : null;
  if (source !== null) return ID_RE.test(source) ? { kind: 'source', id: source, play, key } : null;
  return null;
}

/** Enlace del atajo de una mezcla. `base` es la dirección de la app; `key`, la clave de este navegador. */
export function buildDeepLink(base, { mixId, key, play = true }) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mezcla', mixId);
  if (play) url.searchParams.set('play', '1');
  if (key) url.searchParams.set('k', key);
  return url.href;
}

/** La misma URL sin los parámetros del enlace profundo (para que recargar no vuelva a ejecutarlo). */
export function withoutDeepLink(href) {
  const url = new URL(href);
  for (const p of LINK_PARAMS) url.searchParams.delete(p);
  return url.href;
}
