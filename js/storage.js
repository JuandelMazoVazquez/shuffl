// localStorage con try/catch: en modo privado o con el almacenamiento bloqueado se usa memoria.
const memory = new Map();

export function getItem(key, fallback = null) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Devuelve si quedó guardado en localStorage. Con `strict` no se usa la memoria de respaldo. */
export function setItem(key, value, { strict = false } = {}) {
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
  barajaId: 'baraja.playlistId',
  logoNotice: 'baraja.logoNotice.v12',
  cover: 'baraja.cover',
  lastMix: 'baraja.lastMix',
  mixes: 'baraja.mixes',
  snaps: 'baraja.snapshots',
  theme: 'baraja.theme',
  targets: 'baraja.targets',
  lastTarget: 'baraja.lastTarget',
  migrationNotice: 'baraja.migrationNotice',
  shake: 'baraja.shake',
  linkKey: 'baraja.linkKey',
  autoClean: 'baraja.autoClean',
  metaCache: 'baraja.metaCache',
  recent: 'baraja.recent',
  discoverDays: 'baraja.discoverDays',
};
