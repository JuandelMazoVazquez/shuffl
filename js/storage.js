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
    // Si la migración no pudo copiar una clave (almacenamiento lleno), se sigue leyendo la de antes.
    const raw = localStorage.getItem(key) ?? (LEGACY[key] ? localStorage.getItem(LEGACY[key]) : null);
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
    // Lleno con la migración a medias: borrar la clave antigua libera sitio y evita que se vuelva a leer al recargar.
    if (LEGACY[key]) {
      let prev = null;
      try {
        prev = localStorage.getItem(LEGACY[key]);
        localStorage.removeItem(LEGACY[key]);
        localStorage.setItem(key, JSON.stringify(value));
        memory.delete(key);
        return true;
      } catch {
        // Estricto (Deshacer): si no se pudo escribir lo nuevo, no se pierde lo que había.
        if (strict && prev !== null) try { localStorage.setItem(LEGACY[key], prev); } catch { /* sin sitio */ }
      }
    }
    if (!strict) memory.set(key, value);
    return false;
  }
}

export function removeItem(key) {
  memory.delete(key);
  if (!shared(key)) return;
  try {
    localStorage.removeItem(key);
    // También la de antes: si no, cerrar sesión con una migración a medias recuperaría los tokens viejos.
    if (LEGACY[key]) localStorage.removeItem(LEGACY[key]);
  } catch { /* sin almacenamiento */ }
}

export const KEYS = {
  clientId: 'shuffl.clientId',
  tokens: 'shuffl.tokens',
  pkce: 'shuffl.pkce',
  lang: 'shuffl.lang',
  undo: 'shuffl.undo',
  logoNotice: 'shuffl.logoNotice.v12',
  cover: 'shuffl.cover',
  lastMix: 'shuffl.lastMix',
  mixes: 'shuffl.mixes',
  theme: 'shuffl.theme',
  lastTarget: 'shuffl.lastTarget',
  shake: 'shuffl.shake',
  linkKey: 'shuffl.linkKey',
  recent: 'shuffl.recent',
  discoverDays: 'shuffl.discoverDays',
  purge: 'shuffl.purge',
  purgeOk: 'shuffl.purgeOk',
  reqDay: 'shuffl.reqDay',
  errors: 'shuffl.errors',
  artistsPerSearch: 'shuffl.artistsPerSearch',
  dest: 'shuffl.dest',
  selfOk: 'shuffl.selfOk',
  perArtist: 'shuffl.perArtist',
};

/** Claves de versiones anteriores que ya no se usan (v1.3.1: cada playlist de Shuffl es nueva; v1.3.2: las cachés pasan a IndexedDB). Se borran al arrancar. */
export const OBSOLETE_KEYS = ['baraja.snapshots', 'baraja.targets', 'baraja.migrationNotice', 'baraja.autoClean', 'baraja.playlistId', 'baraja.metaCache', 'baraja.libIndex'];

// ---------- Migración de las claves (v1.4.1) ----------
// Hasta la v1.4.0 las claves empezaban por «baraja.» (el nombre anterior de la app). El origen es el mismo, así que
// los datos siguen ahí: se copian a «shuffl.» y se borra la antigua, sin cerrar la sesión ni perder nada.

const OLD_PREFIX = 'baraja.';
/** Clave nueva → la misma con el prefijo antiguo. */
export const LEGACY = Object.fromEntries(Object.values(KEYS).map((k) => [k, OLD_PREFIX + k.slice(k.indexOf('.') + 1)]));

/**
 * Copia cada «baraja.x» a «shuffl.x» si la nueva aún no existe (la nueva gana siempre) y después borra la antigua.
 * Si una copia falla (almacenamiento lleno), la antigua se queda, `getItem` la sigue leyendo y se reintenta en el
 * próximo arranque. Devuelve cuántas claves quedan sin migrar.
 */
export function migrateLegacyKeys() {
  let pending = 0;
  for (const [key, old] of Object.entries(LEGACY)) {
    try {
      const value = localStorage.getItem(old);
      if (value === null) continue;
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      localStorage.removeItem(old);
    } catch {
      pending += 1;
    }
  }
  return pending;
}
