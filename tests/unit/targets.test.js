import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceKey, generatedName, snapshotName, generatedDescription, sameDescription, SHUFFLE_SUFFIX, MAX_NAME, MAX_DESCRIPTION,
  tagFor, withTag, readTag, isAppName, isAppPlaylist, LEGACY_DESCRIPTIONS,
} from '../../js/targets.js';

const es = { liked: 'Tus me gusta', library: 'Toda mi música' };
const en = { liked: 'Liked Songs', library: 'All my music' };

test('nombres de las playlists generadas en español e inglés', () => {
  assert.equal(generatedName({ sources: [{ name: 'Reggaeton' }] }, es), 'Reggaeton · Shuffle');
  assert.equal(generatedName({ sources: [{ name: 'x', isLiked: true }] }, es), 'Tus me gusta · Shuffle');
  assert.equal(generatedName({ sources: [{ name: 'x', isLiked: true }] }, en), 'Liked Songs · Shuffle');
  assert.equal(generatedName({ sources: [{ name: 'A' }, { name: 'B' }] }, es), 'Mix · Shuffle');
  assert.equal(generatedName({ mixName: 'Coche', sources: [{ name: 'A' }, { name: 'B' }] }, es), 'Coche · Shuffle');
  assert.equal(generatedName({ library: true }, en), 'All my music · Shuffle');
  assert.equal(snapshotName('Top 4 semanas'), '📸 Top 4 semanas');
});

test('el nombre generado no pasa de 100 caracteres y conserva el sufijo', () => {
  const name = generatedName({ sources: [{ name: '🎵'.repeat(150) }] }, es);
  assert.ok([...name].length <= MAX_NAME);
  assert.ok(name.endsWith(`…${SHUFFLE_SUFFIX}`));
});

test('la clave del origen no depende del orden y descarta ids raros', () => {
  assert.equal(sourceKey({ ids: ['b', 'a'] }), sourceKey({ ids: ['a', 'b', 'a'] }));
  assert.equal(sourceKey({ library: true, ids: ['a'] }), 'library');
  assert.equal(sourceKey({ mixId: 'm1', library: true }), 'mix:m1');
  assert.equal(sourceKey({ ids: ['../x', 'a/b'] }), null);
});

test('la descripción lista los orígenes sin pasar de 300 caracteres', () => {
  assert.equal(generatedDescription('Desde: ', ['Rock', 'Chill']), 'Desde: Rock, Chill');
  assert.equal([...generatedDescription('Desde: ', Array.from({ length: 80 }, (_, i) => `Playlist ${i}`))].length, MAX_DESCRIPTION);
  assert.ok(sameDescription('Rock &amp; Roll', 'Rock & Roll'));
});

test('la etiqueta es estable, corta y no contiene los ids; cabe siempre y se lee con entidades HTML', async () => {
  const a = await tagFor('pl:abc123');
  assert.match(a, /^[a-f0-9]{10}$/);
  assert.equal(await tagFor('pl:abc123'), a);
  assert.ok(!a.includes('abc123'));
  assert.equal(readTag(withTag('Desde: Rock & Roll', '0123456789')), '0123456789');
  assert.equal(readTag('Desde: Rock &amp; Roll · shuffl:src=0123456789'), '0123456789');
  assert.equal([...withTag('x'.repeat(400), 'abcdefabcd')].length, MAX_DESCRIPTION);
  assert.equal(readTag('shuffl:src=0123456789 y más texto'), null, 'solo al final');
});

const me = { id: 'me' };
const other = { id: 'otra' };
const pl = (name, description, o = {}) => ({ id: 'p', name, description, owner: me, collaborative: false, ...o });
const TAG = ' · shuffl:src=0123456789';
const V12 = LEGACY_DESCRIPTIONS.prefix[0];

test('isAppName: solo los nombres que pone Shuffl', () => {
  for (const n of ['Rock · Shuffle', 'Mix · Shuffle · 26/11/26, 10:00', '📸 Top 4 semanas', '🔀 Baraja', '12 years ago · Shuffle']) assert.ok(isAppName(n), n);
  for (const n of ['Rock', 'Shuffle', 'Mi Rock favorito', 'Baraja', '🔀 Baraja vieja', '', null]) assert.ok(!isAppName(n), String(n));
});

test('isAppPlaylist: con etiqueta y nombre de la app, propia y no colaborativa', () => {
  assert.ok(isAppPlaylist(pl('Rock · Shuffle', `Desde: Rock${TAG}`), 'me'));
  assert.ok(isAppPlaylist(pl('📸 Top 4 semanas', `Instantánea${TAG}`), 'me'));
  assert.ok(!isAppPlaylist(pl('Mi Rock favorito', `Desde: Rock${TAG}`), 'me'), 'renombrada: es tuya');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', `Desde: Rock${TAG}`, { owner: other }), 'me'), 'de otra persona');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', `Desde: Rock${TAG}`, { collaborative: true }), 'me'), 'colaborativa');
  assert.ok(!isAppPlaylist(null, 'me'));
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', `x${TAG}`), null));
});

test('isAppPlaylist: las antiguas sin etiqueta solo con una descripción de una versión anterior', () => {
  assert.ok(isAppPlaylist(pl('Spanish Rap · Shuffle', `${V12}Spanish Rap`), 'me'), 'v1.2');
  assert.ok(isAppPlaylist(pl('English Rap · Shuffle', 'Shuffled with Shuffl (uniform random; play it with Spotify shuffle off). Source: English Rap'), 'me'));
  assert.ok(isAppPlaylist(pl('Rock · Shuffle · 26/11/26', `${V12}Rock`), 'me'), 'v1.2 «una nueva cada vez»');
  assert.ok(isAppPlaylist(pl('📸 Recently played', 'Snapshot created with Baraja'), 'me'));
  assert.ok(isAppPlaylist(pl('📸 Top 4 weeks', 'Snapshot created with Shuffl'), 'me'));
  assert.ok(isAppPlaylist(pl('🔀 Baraja', 'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado'), 'me'));
  assert.ok(isAppPlaylist(pl('Rock · Shuffle', 'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Rock &amp; Roll'), 'me'), 'con entidades HTML');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', ''), 'me'), 'descripción vacía');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', null), 'me'), 'sin descripción');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', 'Mi playlist de rock'), 'me'), 'descripción propia');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', V12), 'me'), 'solo el prefijo, sin origen');
  assert.ok(!isAppPlaylist(pl('Mis instantáneas', 'Snapshot created with Shuffl'), 'me'), 'descripción de la app pero nombre propio');
  assert.ok(!isAppPlaylist(pl('📸 Top 4 weeks', 'Snapshot created with Shuffl', { owner: other }), 'me'));
});
