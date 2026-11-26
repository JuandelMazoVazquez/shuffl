import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpotifyApi, ApiError } from '../../js/api.js';

const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k] ?? null },
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
  json: async () => body,
  clone() { return this; },
});

function setup(handler) {
  const calls = [];
  const sleeps = [];
  const auth = { refreshes: 0, token: 't1', getAccessToken: async () => auth.token, refresh: async () => { auth.refreshes++; auth.token = 't2'; } };
  const fetchImpl = async (url, opts) => {
    const call = { url, method: opts.method, body: opts.body && JSON.parse(opts.body), auth: opts.headers.Authorization };
    calls.push(call);
    return handler(call, calls.length);
  };
  const api = new SpotifyApi({ auth, fetchImpl, sleep: async (ms) => { sleeps.push(ms); } });
  return { api, calls, sleeps, auth };
}

const offsetOf = (url) => Number(new URL(url).searchParams.get('offset'));

test('paginación en paralelo con total conocido (limit 50, concurrencia 3)', async () => {
  let inFlight = 0, maxInFlight = 0;
  const { api, calls } = setup(async (c) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    const o = offsetOf(c.url);
    return res(200, { total: 230, items: Array.from({ length: Math.min(50, 230 - o) }, (_, i) => ({ n: o + i })) });
  });
  const progress = [];
  const items = await api.paginate('/me/tracks', (d, t) => progress.push([d, t]));
  assert.equal(items.length, 230);
  assert.deepEqual(items.map((x) => x.n), Array.from({ length: 230 }, (_, i) => i));
  assert.equal(calls.length, 5);
  assert.ok(maxInFlight <= 3 && maxInFlight > 1, `concurrencia ${maxInFlight}`);
  assert.deepEqual(progress.at(-1), [230, 230]);
});

test('paginación por next cuando no hay total', async () => {
  const pages = {
    'https://api.spotify.com/v1/x?limit=50&offset=0': { items: [1, 2], next: 'https://api.spotify.com/v1/x?page=2' },
    'https://api.spotify.com/v1/x?page=2': { items: [3], next: null },
  };
  const { api, calls } = setup(async (c) => res(200, pages[c.url]));
  assert.deepEqual(await api.paginate('/x'), [1, 2, 3]);
  assert.equal(calls.length, 2);
});

test('playlist vacía: una sola petición y lista vacía', async () => {
  const { api, calls } = setup(async () => res(200, { total: 0, items: [] }));
  assert.deepEqual(await api.getPlaylistItems('p'), []);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/playlists\/p\/items\?/);
});

test('429 respeta Retry-After con tope de 30 s y 5 reintentos', async () => {
  const { api, sleeps } = setup(async (_c, n) => (n <= 2 ? res(429, {}, { 'Retry-After': n === 1 ? '3' : '999' }) : res(200, { ok: 1 })));
  assert.deepEqual(await api.getMe(), { ok: 1 });
  assert.deepEqual(sleeps, [3000, 30000]);

  const always = setup(async () => res(429, {}, { 'Retry-After': '1' }));
  await assert.rejects(() => always.api.getMe(), (e) => e instanceof ApiError && e.status === 429);
  assert.equal(always.calls.length, 6);
});

test('5xx: 3 reintentos con backoff y después error', async () => {
  const { api, calls, sleeps } = setup(async () => res(503, { error: { message: 'down' } }));
  await assert.rejects(() => api.getMe(), (e) => e.status === 503 && e.message === 'down');
  assert.equal(calls.length, 4);
  assert.deepEqual(sleeps, [500, 1000, 2000]);
});

test('401 refresca el token una vez y repite; si vuelve a fallar, error', async () => {
  const ok = setup(async (c) => (c.auth === 'Bearer t1' ? res(401, {}) : res(200, { id: 'me' })));
  assert.deepEqual(await ok.api.getMe(), { id: 'me' });
  assert.equal(ok.auth.refreshes, 1);
  assert.deepEqual(ok.calls.map((c) => c.auth), ['Bearer t1', 'Bearer t2']);

  const bad = setup(async () => res(401, {}));
  await assert.rejects(() => bad.api.getMe(), (e) => e.status === 401);
  assert.equal(bad.auth.refreshes, 1);
  assert.equal(bad.calls.length, 2);
});

test('errores 403/404 se propagan sin reintentos', async () => {
  for (const status of [403, 404]) {
    const { api, calls } = setup(async () => res(status, { error: { message: 'no' } }));
    await assert.rejects(() => api.getLikedTracks(), (e) => e.status === status);
    assert.equal(calls.length, 1);
  }
});

test('replaceItems: PUT con 100 y POST del resto en bloques de 100', async () => {
  const { api, calls } = setup(async () => res(200, { snapshot_id: 's' }));
  const uris = Array.from({ length: 250 }, (_, i) => `spotify:track:${i}`);
  const progress = [];
  await api.replaceItems('pl', uris, (d, t) => progress.push([d, t]));
  assert.deepEqual(calls.map((c) => [c.method, c.body.uris.length]), [['PUT', 100], ['POST', 100], ['POST', 50]]);
  assert.ok(calls.every((c) => c.url.endsWith('/playlists/pl/items')));
  assert.deepEqual(calls.flatMap((c) => c.body.uris), uris);
  assert.deepEqual(progress.at(-1), [250, 250]);
});

test('replaceItems con 0 canciones: PUT { uris: [] }', async () => {
  const { api, calls } = setup(async () => res(200, {}));
  await api.replaceItems('pl', []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual(calls[0].body, { uris: [] });
});

test('replaceItems con exactamente 100: solo PUT', async () => {
  const { api, calls } = setup(async () => res(200, {}));
  await api.replaceItems('pl', Array.from({ length: 100 }, (_, i) => `u${i}`));
  assert.equal(calls.length, 1);
});

test('createPlaylist usa POST /me/playlists privada; addItems en bloques', async () => {
  const { api, calls } = setup(async (c) => (c.method === 'POST' && c.url.endsWith('/me/playlists') ? res(201, { id: 'new' }) : res(201, {})));
  const pl = await api.createPlaylist('N', 'D');
  assert.equal(pl.id, 'new');
  assert.equal(calls[0].url, 'https://api.spotify.com/v1/me/playlists');
  assert.deepEqual(calls[0].body, { name: 'N', description: 'D', public: false });
  await api.addItems('new', Array.from({ length: 101 }, (_, i) => `u${i}`));
  assert.deepEqual(calls.slice(1).map((c) => c.body.uris.length), [100, 1]);
});

test('lista incompleta (página sin items o total que no cuadra) lanza error en vez de devolver menos', async () => {
  const short = setup(async (c) => res(200, { total: 120, items: Array.from({ length: offsetOf(c.url) === 100 ? 5 : 50 }, () => ({})) }));
  await assert.rejects(() => short.api.paginate('/x'), (e) => e instanceof ApiError && e.status === 0);
  const noItems = setup(async () => res(200, { total: 10 }));
  await assert.rejects(() => noItems.api.paginate('/x'), (e) => e.status === 0);
});

test('un 5xx en POST no se reintenta (evita duplicar canciones o playlists)', async () => {
  const { api, calls } = setup(async () => res(502, {}));
  await assert.rejects(() => api.addItems('p', ['spotify:track:a']), (e) => e.status === 502);
  assert.equal(calls.length, 1);
  const put = setup(async (_c, n) => (n === 1 ? res(502, {}) : res(200, {})));
  await put.api.replaceItems('p', []);
  assert.equal(put.calls.length, 2);
});

test('el token no se envía a URLs que no son de la API de Spotify', async () => {
  const { api, calls } = setup(async () => res(200, {}));
  await assert.rejects(() => api.request('GET', 'https://evil.example/x'), (e) => e.status === 0);
  assert.equal(calls.length, 0);
});

test('429 con QUOTA_EXCEEDED no se reintenta y expone la razón', async () => {
  const { api, calls, sleeps } = setup(async () => res(429, { error: { status: 429, message: 'quota', reason: 'QUOTA_EXCEEDED' } }, { 'Retry-After': '2' }));
  await assert.rejects(() => api.getMe(), (e) => e instanceof ApiError && e.status === 429 && e.reason === 'QUOTA_EXCEEDED');
  assert.equal(calls.length, 1);
  assert.equal(sleeps.length, 0);
});

test('playPlaylist apaga el aleatorio y reproduce desde la posición 0 en el dispositivo', async () => {
  const { api, calls } = setup(async () => ({ ok: true, status: 204, headers: { get: () => null }, text: async () => '' }));
  await api.playPlaylist('pl1', 'dev 1');
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [
    ['PUT', 'https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=dev%201'],
    ['PUT', 'https://api.spotify.com/v1/me/player/play?device_id=dev%201'],
  ]);
  assert.deepEqual(calls[1].body, { context_uri: 'spotify:playlist:pl1', offset: { position: 0 } });
});

test('getDevices tolera respuestas sin lista', async () => {
  const { api } = setup(async () => res(200, {}));
  assert.deepEqual(await api.getDevices(), []);
});

test('respuesta vacía (204) devuelve null', async () => {
  const { api } = setup(async () => ({ ok: true, status: 204, headers: { get: () => null }, text: async () => '' }));
  assert.equal(await api.request('PUT', '/x', {}), null);
});

test('v1.3: libraryContains va en lotes de 40 y exige una respuesta por URI', async () => {
  const { api, calls } = setup(async (c) => {
    const uris = new URL(c.url).searchParams.get('uris').split(',');
    return res(200, uris.map((u) => u.endsWith('1')));
  });
  const uris = Array.from({ length: 85 }, (_, i) => `spotify:track:t${i}`);
  const out = await api.libraryContains(uris);
  assert.equal(out.length, 85);
  assert.deepEqual(calls.map((c) => new URL(c.url).searchParams.get('uris').split(',').length), [40, 40, 5]);
  assert.equal(out[1], true);
  assert.equal(out[2], false);
  const bad = setup(async () => res(200, [true]));
  await assert.rejects(bad.api.libraryContains(['a', 'b']), ApiError);
});

test('v1.3: dejar de seguir playlists usa DELETE /me/library con sus URI y lotes de 40', async () => {
  const { api, calls } = setup(async () => res(200));
  await api.unfollowPlaylists(Array.from({ length: 41 }, (_, i) => `p${i}`));
  assert.deepEqual(calls.map((c) => c.method), ['DELETE', 'DELETE']);
  const first = new URL(calls[0].url);
  assert.equal(first.pathname, '/v1/me/library');
  assert.equal(first.searchParams.get('uris').split(',')[0], 'spotify:playlist:p0');
  assert.equal(first.searchParams.get('uris').split(',').length, 40);
  assert.equal(calls[0].body, undefined);
  await assert.rejects(api.unfollowPlaylists(['ok', 'p1/../x']), ApiError);
  await assert.rejects(api.unfollowPlaylists(['a,spotify:track:x']), ApiError);
});

test('v1.3: lanzamientos de un artista con limit 10', async () => {
  const { api, calls } = setup(async () => res(200, { items: [{ id: 'a' }] }));
  assert.deepEqual(await api.getArtistAlbums('art/../x', 'single'), [{ id: 'a' }]);
  assert.ok(calls[0].url.includes('/artists/art%2F..%2Fx/albums?include_groups=single&limit=10'));
});
