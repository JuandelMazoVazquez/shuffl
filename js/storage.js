// localStorage con try/catch: en modo privado o con el almacenamiento bloqueado se usa memoria.
const memory = new Map();
/**
 * Modo demo (v1.4.0): todo va a memoria y no se lee nada guardado (ni tu sesión, ni tus mezclas, ni tu Deshacer).
 * Solo el idioma y el tema se comparten con la app de verdad.
 */
let volatile = false;
export function setVolatile() {
  volatile = true;
}
const shared = (key) => !volatile || key === KEYS.lang || key === KEYS.theme;

export function getItem(key, fallback = null) {
  if (memory.has(key)) return memory.get(key);
  if (!shared(key)) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Devuelve si quedó guardado en localStorage. Con `strict` no se usa la memoria de respaldo. */
export function setItem(key, value, { strict = false } = {}) {
  if (!shared(key)) {
    memory.set(key, value);
    return true;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    memory.delete(key);
    return true;
  } catch {
    if (!strict) memory.set(key, value);
    return false;
  }
}

export function removeItem(key) {
  memory.delete(key);
  if (!shared(key)) return;
  try {
    localStorage.removeItem(key);
  } catch { /* sin almacenamiento */ }
}

export const KEYS = {
  clientId: 'baraja.clientId',
  tokens: 'baraja.tokens',
  pkce: 'baraja.pkce',
  lang: 'baraja.lang',
  undo: 'baraja.undo',
  logoNotice: 'baraja.logoNotice.v12',
  cover: 'baraja.cover',
  lastMix: 'baraja.lastMix',
  mixes: 'baraja.mixes',
  theme: 'baraja.theme',
  lastTarget: 'baraja.lastTarget',
  shake: 'baraja.shake',
  linkKey: 'baraja.linkKey',
  recent: 'baraja.recent',
  discoverDays: 'baraja.discoverDays',
  purge: 'baraja.purge',
  purgeOk: 'baraja.purgeOk',
  reqDay: 'baraja.reqDay',
  errors: 'baraja.errors',
  artistsPerSearch: 'baraja.artistsPerSearch',
};

/** Claves de versiones anteriores que ya no se usan (v1.3.1: cada playlist de Shuffl es nueva; v1.3.2: las cachés pasan a IndexedDB). Se borran al arrancar. */
export const OBSOLETE_KEYS = ['baraja.snapshots', 'baraja.targets', 'baraja.migrationNotice', 'baraja.autoClean', 'baraja.playlistId', 'baraja.metaCache', 'baraja.libIndex'];
