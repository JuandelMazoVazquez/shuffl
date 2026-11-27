import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
let failSet = () => false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (failSet(k)) throw new Error('QuotaExceededError');
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
};

const { KEYS, LEGACY, getItem, setItem, removeItem, migrateLegacyKeys } = await import('../../js/storage.js');

const old = (k) => `baraja.${k.slice('shuffl.'.length)}`;
const session = { access_token: 'a', refresh_token: 'r', expires_at: 1, scope: 's' };

beforeEach(() => {
  store.clear();
  failSet = () => false;
});

test('todas las claves empiezan por shuffl. y cada una tiene su antigua baraja.', () => {
  for (const k of Object.values(KEYS)) {
    assert.match(k, /^shuffl\./);
    assert.equal(LEGACY[k], old(k));
  }
});

test('migración: sesión, Client ID, mezclas, Deshacer y ajustes pasan a shuffl.* sin cambiar y se borra lo antiguo', () => {
  const before = {
    [KEYS.clientId]: '0123456789abcdef0123456789abcdef',
    [KEYS.tokens]: session,
    [KEYS.mixes]: [{ id: 'm1', name: 'Coche', ids: ['a'] }],
    [KEYS.lastMix]: { ids: ['a'], mode: 'new' },
    [KEYS.undo]: { playlistId: 'p', uris: ['spotify:track:x'] },
    [KEYS.lang]: 'en',
    [KEYS.theme]: 'light',
    [KEYS.logoNotice]: true,
    [KEYS.purgeOk]: { me: 'yo' },
    [KEYS.linkKey]: 'k'.repeat(32),
  };
  for (const [k, v] of Object.entries(before)) store.set(old(k), JSON.stringify(v));
  store.set('otra.app', '"x"');
  assert.equal(migrateLegacyKeys(), 0);
  for (const [k, v] of Object.entries(before)) {
    assert.deepEqual(getItem(k), v, k);
    assert.equal(store.get(k), JSON.stringify(v), `${k} copiada byte a byte`);
    assert.equal(store.has(old(k)), false, `${old(k)} borrada`);
  }
  assert.equal(store.get('otra.app'), '"x"', 'lo que no es de la app no se toca');
});

test('migración: si ya existe la clave nueva, gana la nueva; repetirla no cambia nada', () => {
  store.set(old(KEYS.theme), '"light"');
  store.set(KEYS.theme, '"dark"');
  migrateLegacyKeys();
  assert.equal(getItem(KEYS.theme), 'dark');
  assert.equal(store.has(old(KEYS.theme)), false);
  const snapshot = [...store];
  migrateLegacyKeys();
  assert.deepEqual([...store], snapshot);
});

test('migración a medias (almacenamiento lleno): la sesión se sigue leyendo de la antigua y se completa al reintentar', () => {
  store.set(old(KEYS.tokens), JSON.stringify(session));
  store.set(old(KEYS.lang), '"es"');
  failSet = (k) => k === KEYS.tokens;
  assert.equal(migrateLegacyKeys(), 1);
  assert.equal(store.has(old(KEYS.tokens)), true, 'no se borra lo que no se pudo copiar');
  assert.deepEqual(getItem(KEYS.tokens), session, 'sigue con la sesión');
  assert.equal(store.get(KEYS.lang), '"es"', 'las demás sí se migran');
  failSet = () => false;
  assert.equal(migrateLegacyKeys(), 0);
  assert.equal(store.get(KEYS.tokens), JSON.stringify(session));
  assert.equal(store.has(old(KEYS.tokens)), false);
});

test('cerrar sesión con una migración a medias borra también los tokens antiguos', () => {
  store.set(old(KEYS.tokens), JSON.stringify(session));
  removeItem(KEYS.tokens);
  assert.equal(getItem(KEYS.tokens), null);
  assert.equal(store.has(old(KEYS.tokens)), false);
});

test('escribir siempre va a la clave nueva y gana a la antigua al leer', () => {
  store.set(old(KEYS.lang), '"es"');
  setItem(KEYS.lang, 'en');
  assert.equal(store.get(KEYS.lang), '"en"');
  assert.equal(getItem(KEYS.lang), 'en');
});
