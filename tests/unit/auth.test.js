import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { refresh } = await import('../../js/auth.js');
const { KEYS, getItem, setItem } = await import('../../js/storage.js');

const invalidGrant = () => ({ ok: false, json: async () => ({ error: 'invalid_grant' }) });

test('refresh: invalid_grant con el mismo refresh_token cierra la sesión', async () => {
  setItem(KEYS.tokens, { access_token: 'a', refresh_token: 'r1', expires_at: 0 });
  globalThis.fetch = async () => invalidGrant();
  await assert.rejects(() => refresh(), { code: 'invalid_grant' });
  assert.equal(getItem(KEYS.tokens), null);
});

test('refresh: si otra pestaña ya rotó el token, no falla ni cierra la sesión', async () => {
  setItem(KEYS.tokens, { access_token: 'a', refresh_token: 'r1', expires_at: 0 });
  globalThis.fetch = async () => {
    setItem(KEYS.tokens, { access_token: 'b', refresh_token: 'r2', expires_at: Date.now() + 3600000 });
    return invalidGrant();
  };
  await refresh();
  assert.equal(getItem(KEYS.tokens).refresh_token, 'r2');
});

test('storage: setItem estricto no usa la memoria cuando localStorage falla', async () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  assert.equal(setItem('k1', { a: 1 }, { strict: true }), false);
  assert.equal(getItem('k1'), null);
  assert.equal(setItem('k2', { a: 2 }), false);
  assert.deepEqual(getItem('k2'), { a: 2 });
  globalThis.localStorage = saved;
});
