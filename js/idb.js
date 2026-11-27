// Caché persistente en IndexedDB (v1.3.2): canciones de tus playlists, álbumes y artistas, para gastar menos cuota.
// Clave-valor con fecha. Si IndexedDB no está disponible (modo privado antiguo, bloqueado), se usa memoria.
const DB_NAME = 'shuffl-cache';
const STORE = 'kv';
const mem = new Map();
const FAILED = Symbol('failed');
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!globalThis.indexedDB) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Ejecuta `fn(store)` en una transacción; si algo falla, devuelve `fallback()`. */
async function run(mode, fn, fallback) {
  const db = await open();
  if (!db) return fallback();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => resolve(fallback());
      tx.onabort = () => resolve(fallback());
    } catch {
      resolve(fallback());
    }
  });
}

/** `{ t, d }` guardado con `cacheSet`, o undefined. */
export const idbGet = (key) => (mem.has(key) ? Promise.resolve(mem.get(key)) : run('readonly', (s) => s.get(key), () => undefined));

export function idbSet(key, data, now = Date.now()) {
  const value = { t: now, d: data };
  mem.set(key, value);
  // Mientras se escribe (o si IndexedDB falla) se sirve de memoria.
  return run('readwrite', (s) => s.put(value, key), () => FAILED).then((r) => { if (r !== FAILED && mem.get(key) === value) mem.delete(key); });
}

/** Borra todo (al cerrar sesión). */
export function idbClear() {
  mem.clear();
  return run('readwrite', (s) => s.clear(), () => undefined);
}

/** Quita las entradas con más de `maxAgeMs` (o sin formato). Se llama al arrancar. */
export async function idbPrune(maxAgeMs, now = Date.now()) {
  const db = await open();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        const v = c.value;
        if (!v || typeof v.t !== 'number' || now - v.t > maxAgeMs || v.t > now) c.delete();
        c.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = resolve;
      tx.onabort = resolve;
    } catch {
      resolve();
    }
  });
}
