// Mezclas guardadas: fuentes + filtros + destino con un nombre. Todo vive en el dispositivo.
import { sanitizeFilters } from './core.js';
import { sanitizeMinutes, presetByKey } from './generators.js';

export const MAX_MIXES = 50;
/** «reuse»: una playlist de Shuffl nueva (sustituye a la anterior); «self»: la propia playlist. */
export const MIX_MODES = ['reuse', 'self'];
/** Canciones (lo de siempre) o a medida de tiempo. Las de antes («new», «albums») se convierten al leerlas. */
export const SHUFFLE_KINDS = ['songs', 'time'];
const MAX_IDS = 500;
/** Ids de playlist: solo letras, números, «_» y «-». Evita `..`, `/` o `%` que alterarían la ruta de la API. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Valida una mezcla venida de fuera (almacenamiento o copia de seguridad). Devuelve null si no sirve. */
export function sanitizeMix(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = ID_RE.test(String(raw.id ?? '')) ? str(raw.id, 40) : '';
  const name = str(raw.name, 60).trim();
  if (!id || !name) return null;
  const library = raw.library === true;
  const ids = Array.isArray(raw.ids) ? raw.ids.filter((x) => typeof x === 'string' && ID_RE.test(x)).slice(0, MAX_IDS) : [];
  if (!library && ids.length === 0) return null;
  const minutes = sanitizeMinutes(raw.minutes);
  const kind = raw.kind === 'time' && minutes ? 'time' : 'songs';
  const names = Array.isArray(raw.names) ? raw.names.map((x) => str(x, 100)).slice(0, MAX_IDS) : [];
  const mode = MIX_MODES.includes(raw.mode) ? raw.mode : 'reuse';
  // Acceso rápido (Gym, Correr…): solo si existe y sus minutos coinciden; si no, es «personalizado».
  const preset = kind === 'time' && presetByKey(raw.preset)?.minutes === minutes ? raw.preset : null;
  return {
    id, name, library, ids,
    names: names.length ? names : ids.map(() => ''),
    filters: sanitizeFilters(raw.filters),
    dedupe: raw.dedupe !== false,
    mode: kind === 'time' && mode === 'self' ? 'reuse' : mode,
    kind,
    ...(kind === 'time' ? { minutes } : {}),
    ...(preset ? { preset } : {}),
  };
}

export function sanitizeMixes(raw) {
  const out = [];
  for (const m of Array.isArray(raw) ? raw : []) {
    const clean = sanitizeMix(m);
    if (clean && !out.some((x) => x.id === clean.id)) out.push(clean);
    if (out.length >= MAX_MIXES) break;
  }
  return out;
}

export const newMixId = () => `m${Date.now().toString(36)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

/** Añade o sustituye (por id) sin tocar la lista original. Devuelve la lista y si había sitio. */
export function upsertMix(list, mix) {
  const i = list.findIndex((m) => m.id === mix.id);
  if (i >= 0) return { list: list.map((m, k) => (k === i ? mix : m)), ok: true };
  if (list.length >= MAX_MIXES) return { list, ok: false };
  return { list: [...list, mix], ok: true };
}

export const removeMix = (list, id) => list.filter((m) => m.id !== id);

/** Texto de resumen de las fuentes de una mezcla. */
export const mixSources = (mix, libraryLabel) => (mix.library ? [libraryLabel] : mix.names.filter(Boolean)).join(' + ');
