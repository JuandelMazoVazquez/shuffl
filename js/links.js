// Enlaces profundos para Siri y Atajos: ?mezcla=<id>&play=1 o ?origen=<id de playlist>&play=1.
// Solo se aceptan ids con formato seguro; que existan en el dispositivo lo comprueba la app antes de hacer nada.

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const LINK_PARAMS = ['mezcla', 'origen', 'play'];

/** Lee el enlace profundo de `search` (location.search). Devuelve null si no hay o si el id no es válido. */
export function parseDeepLink(search) {
  const q = new URLSearchParams(search);
  const play = q.get('play') === '1';
  const mix = q.get('mezcla');
  const source = q.get('origen');
  if (mix !== null && source !== null) return null;
  if (mix !== null) return ID_RE.test(mix) ? { kind: 'mix', id: mix, play } : null;
  if (source !== null) return ID_RE.test(source) ? { kind: 'source', id: source, play } : null;
  return null;
}

/** `base` es la dirección de la app (origen + ruta, sin parámetros). */
export function buildDeepLink(base, { mixId, sourceId, play = true }) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  if (mixId) url.searchParams.set('mezcla', mixId);
  else url.searchParams.set('origen', sourceId);
  if (play) url.searchParams.set('play', '1');
  return url.href;
}

/** La misma URL sin los parámetros del enlace profundo (para que recargar no vuelva a ejecutarlo). */
export function withoutDeepLink(href) {
  const url = new URL(href);
  for (const p of LINK_PARAMS) url.searchParams.delete(p);
  return url.href;
}
