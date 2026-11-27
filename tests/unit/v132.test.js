// v1.3.2: reproducir (dispositivo, errores y comprobación), registro de errores, miniaturas, shuffle por tiempo y mezclas.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage ??= { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.navigator ??= { userAgent: 'test', language: 'es' };

const { pickDevice, playProblem, checkPlayback, usableDevices } = await import('../../js/player.js');
const { redactPath, logError, getErrors, clearErrors, countRequest, requestStats, beginAction, endAction, actionSpent, buildReport } = await import('../../js/diag.js');
const { pickThumb, normalizeEntry } = await import('../../js/core.js');
const { timeName, MAX_NAME, isAppPlaylist, withTag, tagFor } = await import('../../js/targets.js');
const { sanitizeMix } = await import('../../js/mixes.js');
const { TIME_PRESETS, presetByKey, sanitizeArtistsPerSearch, DEFAULT_ARTISTS_PER_SEARCH } = await import('../../js/generators.js');

test('pickDevice: el activo; si no, el único; si hay varios, preguntar; nunca uno restringido', () => {
  const a = { id: 'a', name: 'iPhone', is_active: false };
  const b = { id: 'b', name: 'Mac', is_active: true };
  const r = { id: 'r', name: 'Altavoz', is_active: true, is_restricted: true };
  assert.equal(pickDevice([a, b]).device, b);
  assert.equal(pickDevice([a]).device, a);
  assert.deepEqual(pickDevice([a, { id: 'c', name: 'TV' }]).choose.map((d) => d.id), ['a', 'c']);
  assert.equal(pickDevice([r, a]).device, a, 'el restringido activo no cuenta');
  assert.deepEqual(pickDevice([r]), { problem: 'restricted' });
  assert.deepEqual(pickDevice([]), { problem: 'none' });
  assert.deepEqual(pickDevice(null), { problem: 'none' });
  assert.deepEqual(usableDevices([{ id: '' }, null, { name: 'sin id' }]), []);
});

test('playProblem: Premium, sin dispositivo, restringido, prohibido y dormido; el resto no se disfraza', () => {
  assert.equal(playProblem({ status: 403, reason: 'PREMIUM_REQUIRED' }), 'premium');
  assert.equal(playProblem({ status: 403, apiMessage: 'Player command failed: Premium required' }), 'premium');
  assert.equal(playProblem({ status: 404, reason: 'NO_ACTIVE_DEVICE' }), 'device');
  assert.equal(playProblem({ status: 404 }), 'device');
  assert.equal(playProblem({ status: 403, apiMessage: 'Player command failed: Restriction violated', reason: 'UNKNOWN' }), 'restricted');
  assert.equal(playProblem({ status: 403, apiMessage: 'Forbidden' }), 'forbidden');
  assert.equal(playProblem({ status: 502 }), 'asleep');
  assert.equal(playProblem({ status: 401 }), null);
  assert.equal(playProblem({ status: 429, reason: 'QUOTA_EXCEEDED' }), null);
  assert.equal(playProblem(new TypeError('Failed to fetch')), null);
});

test('checkPlayback: esta playlist en orden, con aleatorio, en pausa, otra cosa o nada', () => {
  const st = (o) => ({ is_playing: true, shuffle_state: false, smart_shuffle: false, context: { uri: 'spotify:playlist:p1' }, ...o });
  assert.equal(checkPlayback(st(), 'p1'), 'ok');
  assert.equal(checkPlayback(st({ shuffle_state: true }), 'p1'), 'shuffle');
  assert.equal(checkPlayback(st({ smart_shuffle: true }), 'p1'), 'shuffle');
  assert.equal(checkPlayback(st({ is_playing: false }), 'p1'), 'paused');
  assert.equal(checkPlayback(st({ context: { uri: 'spotify:playlist:otra' } }), 'p1'), 'other');
  assert.equal(checkPlayback(st({ context: null, is_playing: false }), 'p1'), 'idle');
  assert.equal(checkPlayback(null, 'p1'), 'idle');
  assert.equal(checkPlayback(st({ context: { uri: 'spotify:user:x:playlist:p1' } }), 'p1'), 'ok', 'formato antiguo de URI');
});

test('el registro de errores no guarda ids, consultas, nombres ni tokens y tiene tope', () => {
  clearErrors();
  assert.equal(redactPath('https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/items?limit=50&access_token=x'), '/playlists/:id/items');
  assert.equal(redactPath('PUT /playlists/37i9dQZF1DXcBWIGoYBM5M/items'), 'PUT /playlists/:id/items');
  assert.equal(redactPath('GET /me/player'), 'GET /me/player');
  const e = Object.assign(new Error('Rock de Ana'), { status: 404, reason: 'NO_ACTIVE_DEVICE', path: 'PUT /playlists/37i9dQZF1DXcBWIGoYBM5M/items', apiMessage: 'Not found 37i9dQZF1DXcBWIGoYBM5M' });
  const entry = logError(e, 'notFound', 'shuffle');
  assert.equal(entry.kind, 'notFound');
  assert.equal(entry.where, 'shuffle');
  assert.ok(!JSON.stringify(entry).includes('37i9dQZF1DXcBWIGoYBM5M'));
  assert.ok(!JSON.stringify(entry).includes('Rock de Ana'), 'el mensaje (que puede llevar nombres) no se guarda');
  for (let i = 0; i < 70; i++) logError(new Error('x'), 'bug');
  assert.equal(getErrors().length, 50);
  clearErrors();
  assert.equal(getErrors().length, 0);
});

test('contador de peticiones: sesión, día y por acción; el informe las lleva sin datos personales', () => {
  const before = requestStats().session;
  beginAction('new');
  countRequest(); countRequest(); countRequest();
  assert.equal(actionSpent(), 3);
  endAction();
  const s = requestStats();
  assert.equal(s.session, before + 3);
  assert.ok(s.today >= 3);
  assert.deepEqual(s.actions[0], { name: 'new', n: 3 });
  logError(Object.assign(new Error('x'), { status: 429, reason: 'QUOTA_EXCEEDED' }), 'quota', 'new');
  const report = buildReport({ version: '1.3.2', lang: 'es', standalone: true, steps: [{ ok: true, key: 'login', detail: '' }, { ok: false, key: 'play', detail: 'premium' }] });
  assert.match(report, /Shuffl 1\.3\.2 · es · app instalada/);
  assert.match(report, /new: 3/);
  assert.match(report, /MAL play · premium/);
  assert.match(report, /quota 429 QUOTA_EXCEEDED/);
  clearErrors();
});

test('pickThumb: la más pequeña que llega a 120 px; sin tamaños, la penúltima; solo https', () => {
  const imgs = [640, 300, 64].map((w) => ({ url: `https://i.scdn.co/${w}`, width: w, height: w }));
  assert.equal(pickThumb(imgs), 'https://i.scdn.co/300');
  assert.equal(pickThumb([{ url: 'https://i.scdn.co/64', width: 64 }, { url: 'https://i.scdn.co/100', width: 100 }]), 'https://i.scdn.co/100', 'si ninguna llega, la mayor');
  assert.equal(pickThumb([{ url: 'https://a/1' }, { url: 'https://a/2' }, { url: 'https://a/3' }]), 'https://a/2');
  assert.equal(pickThumb([{ url: 'http://inseguro/1', width: 300 }]), '');
  assert.equal(pickThumb(null), '');
  const { track } = normalizeEntry({ track: { uri: 'spotify:track:x', id: 'x', name: 'X', artists: [], album: { images: imgs } } });
  assert.equal(track.thumb, 'https://i.scdn.co/300');
});

test('nombres por tiempo: «Gym 45 min · Shuffle» o «Rock · 45 min · Shuffle», sin cortar nunca los minutos', () => {
  assert.equal(timeName({ minutes: 45, presetLabel: 'Gym' }), 'Gym 45 min · Shuffle');
  assert.equal(timeName({ minutes: 45, base: 'Rock' }), 'Rock · 45 min · Shuffle');
  const long = timeName({ minutes: 120, base: 'x'.repeat(200) });
  assert.ok([...long].length <= MAX_NAME);
  assert.ok(long.endsWith('… · 120 min · Shuffle'));
});

test('las playlists por tiempo se reconocen como de Shuffl y, si las renombras, no', async () => {
  const name = timeName({ minutes: 45, presetLabel: 'Gym' });
  const desc = withTag('Desde: Rock', await tagFor('pl:x'), name);
  const pl = (n) => ({ id: 'p', name: n, description: desc, owner: { id: 'me' }, collaborative: false });
  assert.ok(isAppPlaylist(pl(name), 'me'));
  assert.ok(!isAppPlaylist(pl('Gym 50 min · Shuffle'), 'me'));
});

test('accesos rápidos y mezclas por tiempo: el acceso se guarda solo si existe y coincide con los minutos', () => {
  assert.deepEqual(TIME_PRESETS.map((p) => [p.key, p.minutes]), [['commute', 20], ['gym', 45], ['run', 30], ['trip', 90], ['sleep', 30]]);
  assert.equal(presetByKey('gym').minutes, 45);
  assert.equal(presetByKey('nada'), null);
  const base = { id: 'm1', name: 'Gym', ids: ['pl1'], kind: 'time' };
  assert.equal(sanitizeMix({ ...base, minutes: 45, preset: 'gym' }).preset, 'gym');
  assert.equal(sanitizeMix({ ...base, minutes: 50, preset: 'gym' }).preset, undefined, 'minutos que no son los del acceso: personalizado');
  assert.equal(sanitizeMix({ ...base, minutes: 45, preset: '<img>' }).preset, undefined);
  assert.equal(sanitizeMix({ ...base, kind: 'songs', minutes: 45, preset: 'gym' }).preset, undefined);
  assert.equal(sanitizeArtistsPerSearch(8), 8);
  assert.equal(sanitizeArtistsPerSearch(999), DEFAULT_ARTISTS_PER_SEARCH);
  assert.equal(sanitizeArtistsPerSearch('15'), DEFAULT_ARTISTS_PER_SEARCH);
});
