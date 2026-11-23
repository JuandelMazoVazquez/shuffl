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

export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    memory.delete(key);
  } catch {
    memory.set(key, value);
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
};
