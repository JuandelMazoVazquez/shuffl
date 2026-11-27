import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { refresh, missingScopes, SCOPE_LIST } = await import('../../js/auth.js');
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

test('Redirect URI: «Invalid redirect URI» al pedir el token es un error propio, sin el texto de Spotify', async () => {
  const { handleCallback } = await import('../../js/auth.js');
  setItem(KEYS.clientId, '0123456789abcdef0123456789abcdef');
  setItem(KEYS.pkce, { verifier: 'v', state: 's' });
  globalThis.location = { href: 'https://x.github.io/shuffl/?code=c&state=s', search: '?code=c&state=s' };
  globalThis.history = { replaceState: () => {} };
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'invalid_grant', error_description: 'Invalid redirect URI' }) });
  await assert.rejects(() => handleCallback(), (e) => e.code === 'redirectUri' && e.message === 'redirectUri');
  assert.equal(getItem(KEYS.pkce), null);
});

test('Redirect URI: un inicio de sesión reciente que no volvió avisa una vez, sin romper el que sigue en curso', async () => {
  const { handleCallback } = await import('../../js/auth.js');
  globalThis.location = { href: 'https://x.github.io/shuffl/', search: '' };
  setItem(KEYS.pkce, { verifier: 'v', state: 's', at: Date.now() });
  await assert.rejects(() => handleCallback(), { code: 'redirectStalled' });
  assert.equal(await handleCallback(), false, 'la segunda vez ya no avisa');
  // Otra pestaña recargó mientras Spotify pedía un código: el callback de verdad tiene que poder terminar.
  globalThis.location = { href: 'https://x.github.io/shuffl/?code=c&state=s', search: '?code=c&state=s' };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'x' }) });
  assert.equal(await handleCallback(), true);
  assert.equal(getItem(KEYS.tokens).refresh_token, 'r');
  assert.equal(getItem(KEYS.pkce), null);
});

test('Redirect URI: un intento antiguo, o de una versión sin fecha, no avisa', async () => {
  const { handleCallback } = await import('../../js/auth.js');
  globalThis.location = { href: 'https://x.github.io/shuffl/', search: '' };
  for (const pkce of [{ verifier: 'v', state: 's', at: Date.now() - 16 * 60 * 1000 }, { verifier: 'v', state: 's' }]) {
    setItem(KEYS.pkce, pkce);
    assert.equal(await handleCallback(), false);
  }
});

test('missingScopes: sesiones antiguas piden volver a conectar', () => {
  assert.deepEqual(missingScopes({ scope: SCOPE_LIST.join(' ') }), []);
  assert.deepEqual(missingScopes(null), SCOPE_LIST);
  assert.deepEqual(missingScopes({ scope: 'playlist-read-private user-library-read' }).includes('user-modify-playback-state'), true);
  assert.deepEqual(missingScopes({ scope: SCOPE_LIST.slice(1).join(' ') }), [SCOPE_LIST[0]]);
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
