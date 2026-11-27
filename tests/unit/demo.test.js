// Modo demo (v1.4.0): el Spotify inventado responde como la Web API, no sale a la red y no toca lo guardado de verdad.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage ??= { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.navigator ??= { userAgent: 'test', language: 'es' };

const { createDemoState, createDemoFetch, coverSvg, wantsDemo, demoMixes, DEMO_ME } = await import('../../js/demo.js');
const { SpotifyApi } = await import('../../js/api.js');
const { isImageUrl, pickThumb, normalizeEntries } = await import('../../js/core.js');
const { sanitizeMixes } = await import('../../js/mixes.js');

const demoApi = () => {
  const state = createDemoState('es', Date.UTC(2026, 10, 27));
  const api = new SpotifyApi({ auth: { getAccessToken: async () => 'demo', refresh: async () => {} }, fetchImpl: createDemoFetch(state, { delay: 0 }) });
  return { state, api };
};

test('wantsDemo: ?demo=1 o ?demo, pero no ?demo=0 ni otra cosa', () => {
  assert.equal(wantsDemo('?demo=1'), true);
  assert.equal(wantsDemo('?demo'), true);
  assert.equal(wantsDemo('?demo=0'), false);
  assert.equal(wantsDemo('?mezcla=abc'), false);
  assert.equal(wantsDemo(''), false);
});

test('los datos son siempre los mismos (semilla) y sin repetir ids', () => {
  const a = createDemoState('es', 0);
  const b = createDemoState('es', 0);
  assert.deepEqual([...a.lists.values()].map((l) => l.entries.map((e) => e.item.id)), [...b.lists.values()].map((l) => l.entries.map((e) => e.item.id)));
  assert.equal(new Set(a.catalog.keys()).size, a.catalog.size);
  for (const l of a.lists.values()) assert.match(l.id, /^[A-Za-z0-9]{1,64}$/, 'ids de playlist válidos para DELETE /me/library');
});

test('las carátulas son SVG en data: que la app acepta, y nada de http', () => {
  const url = coverSvg('x');
  assert.ok(url.startsWith('data:image/svg+xml,'));
  assert.ok(!decodeURIComponent(url).includes('<script'));
  assert.ok(isImageUrl(url));
  assert.ok(!isImageUrl('data:text/html,<script>alert(1)</script>'));
  assert.ok(!isImageUrl('http://inseguro/x.png'));
  assert.ok(!isImageUrl('javascript:alert(1)'));
  assert.equal(pickThumb([{ url, width: 640 }, { url, width: 300 }, { url, width: 64 }]), url);
});

test('la API de verdad funciona sobre la demo: leer, crear, escribir y quitar', async () => {
  const { state, api } = demoApi();
  assert.equal((await api.getMe()).id, DEMO_ME.id);
  const lists = await api.getMyPlaylists();
  assert.equal(lists.length, state.lists.size);
  const items = await api.getPlaylistItems('demopl1');
  assert.equal(items.length, 64, 'pagina de 50 en 50 como Spotify');
  const { tracks } = normalizeEntries(items);
  assert.ok(tracks.every((t) => t.durationMs > 0 && isImageUrl(t.thumb)));
  const liked = await api.getLikedTracks();
  assert.equal(liked.length, 160);
  const created = await api.createPlaylist('Domingo lento · Shuffle', 'x');
  await api.replaceItems(created.id, tracks.map((t) => t.uri).reverse());
  assert.deepEqual((await api.getPlaylistItems(created.id)).map((e) => e.item.uri), tracks.map((t) => t.uri).reverse());
  assert.deepEqual(await api.libraryContains([`spotify:playlist:${created.id}`]), [true]);
  await api.unfollowPlaylists([created.id]);
  assert.deepEqual(await api.libraryContains([`spotify:playlist:${created.id}`]), [false]);
});

test('como Spotify: una playlist ajena no se lee ni se borra, y lo desconocido da 404', async () => {
  const { state, api } = demoApi();
  await assert.rejects(api.getPlaylistItems('demopl7'), (e) => e.status === 403);
  await api.unfollowPlaylists(['demopl7']);
  assert.ok(state.lists.has('demopl7'));
  await assert.rejects(api.request('GET', '/browse/new-releases'), (e) => e.status === 404);
  assert.ok((await api.getPlaylistItems('demopl6')).length > 0, 'la colaborativa sí se lee');
});

test('reproducir: dispositivo activo y estado que pasa la comprobación', async () => {
  const { api } = demoApi();
  const [device] = await api.getDevices();
  assert.equal(device.is_active, true);
  assert.equal(await api.getPlayer(), null);
  await api.play('demopl0', device.id);
  await api.setShuffle(false, device.id);
  const st = await api.getPlayer();
  assert.deepEqual([st.is_playing, st.shuffle_state, st.context.uri], [true, false, 'spotify:playlist:demopl0']);
});

test('Descubrir tiene material: lanzamientos recientes, géneros y artistas que no sigues', async () => {
  const now = Date.UTC(2026, 10, 27);
  const { api } = demoApi();
  const followed = await api.getFollowedArtists();
  assert.equal(followed.length, 24);
  const albums = await api.getArtistAlbums(followed[0].id);
  assert.ok(albums.some((a) => now - Date.parse(a.release_date) < 90 * 86400000));
  const byGenre = await api.searchArtistsByGenre('lo-fi');
  assert.ok(byGenre.some((a) => !followed.some((f) => f.id === a.id)));
  assert.equal((await api.getTopArtists('short_term')).length, 20);
  assert.equal((await api.getRecentlyPlayed()).length, 40);
});

test('las mezclas de ejemplo pasan la validación de mezclas', () => {
  const { mixes, last } = demoMixes('en');
  assert.equal(sanitizeMixes(mixes).length, 2);
  assert.equal(sanitizeMixes(mixes)[0].preset, 'gym');
  assert.deepEqual(last.ids, ['demopl1']);
});

test('modo volátil: no lee ni escribe lo guardado, salvo idioma y tema', async () => {
  const { KEYS, getItem, setItem, removeItem, setVolatile } = await import('../../js/storage.js');
  localStorage.setItem(KEYS.tokens, JSON.stringify({ refresh_token: 'real' }));
  localStorage.setItem(KEYS.lang, JSON.stringify('en'));
  setVolatile();
  assert.equal(getItem(KEYS.tokens), null);
  assert.equal(getItem(KEYS.lang), 'en');
  setItem(KEYS.mixes, [{ id: 'x' }]);
  assert.deepEqual(getItem(KEYS.mixes), [{ id: 'x' }]);
  assert.equal(localStorage.getItem(KEYS.mixes), null);
  removeItem(KEYS.tokens);
  assert.equal(JSON.parse(localStorage.getItem(KEYS.tokens)).refresh_token, 'real');
  setItem(KEYS.theme, 'light');
  assert.equal(JSON.parse(localStorage.getItem(KEYS.theme)), 'light');
});
