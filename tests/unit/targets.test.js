import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceKey, generatedName, snapshotName, generatedDescription, SHUFFLE_SUFFIX, MAX_NAME, MAX_DESCRIPTION,
  tagFor, withTag, readTag, nameHash, isAppName, isAppPlaylist, LEGACY_DESCRIPTIONS,
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
const V12 = LEGACY_DESCRIPTIONS.fromPrefix[0];

test('isAppName: solo los nombres que pone Shuffl', () => {
  for (const n of ['Rock · Shuffle', 'Mix · Shuffle · 26/11/26, 10:00', 'Mix · Shuffle · 11/26/26, 10:00\u202fAM', '📸 Top 4 semanas', '🔀 Baraja', '12 years ago · Shuffle']) assert.ok(isAppName(n), n);
  for (const n of ['Rock', 'Shuffle', 'Mi Rock favorito', 'Baraja', '🔀 Baraja vieja', 'Rock · Shuffle · buena', '', null]) assert.ok(!isAppName(n), String(n));
});

test('isAppPlaylist: con etiqueta y nombre de la app, propia y no colaborativa', () => {
  assert.ok(isAppPlaylist(pl('Rock · Shuffle', `Desde: Rock${TAG}`), 'me'), 'etiqueta v1.3 (sin resumen del nombre)');
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
  assert.ok(isAppPlaylist(pl('Rock · Shuffle · 26/11/26, 10:00', `${V12}Rock`), 'me'), 'v1.2 «una nueva cada vez»');
  assert.ok(isAppPlaylist(pl('📸 Recently played', 'Snapshot created with Baraja'), 'me'));
  assert.ok(isAppPlaylist(pl('📸 Top 4 weeks', 'Snapshot created with Shuffl'), 'me'));
  assert.ok(isAppPlaylist(pl('🔀 Baraja', 'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado'), 'me'));
  assert.ok(isAppPlaylist(pl('Rock & Roll · Shuffle', 'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Rock &amp; Roll'), 'me'), 'con entidades HTML');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', ''), 'me'), 'descripción vacía');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', null), 'me'), 'sin descripción');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', 'Mi playlist de rock'), 'me'), 'descripción propia');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle', V12), 'me'), 'solo el prefijo, sin origen');
  assert.ok(!isAppPlaylist(pl('Mis instantáneas', 'Snapshot created with Shuffl'), 'me'), 'descripción de la app pero nombre propio');
  assert.ok(!isAppPlaylist(pl('📸 Top 4 weeks', 'Snapshot created with Shuffl', { owner: other }), 'me'));
});

test('v1.3.1: la etiqueta lleva un resumen del nombre; si la renombras, aunque siga el patrón, no se borra', async () => {
  const tag = await tagFor('pl:x');
  const desc = withTag('Desde: Reggaeton', tag, 'Reggaeton · Shuffle');
  assert.match(desc, /shuffl:src=[a-f0-9]{10}\.[a-f0-9]{6}$/);
  assert.equal(readTag(desc), tag, 'el origen se sigue leyendo');
  assert.ok(isAppPlaylist(pl('Reggaeton · Shuffle', desc), 'me'));
  for (const renamed of ['Reggaeton fiesta · Shuffle', 'Reggaeton · Shuffle · buena', '📸 Mi verano', 'reggaeton · Shuffle']) {
    assert.ok(!isAppPlaylist(pl(renamed, desc), 'me'), renamed);
  }
  const snap = withTag('Instantánea', tag, '📸 Top 4 semanas');
  assert.ok(isAppPlaylist(pl('📸 Top 4 semanas', snap), 'me'));
  assert.ok(!isAppPlaylist(pl('📸 Mi verano', snap), 'me'));
  assert.equal(nameHash('Rock · Shuffle'), nameHash('Rock · Shuffle'));
  assert.notEqual(nameHash('Rock · Shuffle'), nameHash('Rock · Shuffle '));
  assert.match(nameHash(''), /^[a-f0-9]{6}$/);
});

test('v1.3.1: sin etiqueta solo vale el nombre exacto que le corresponde a su descripción', () => {
  assert.ok(!isAppPlaylist(pl('Rock bueno · Shuffle', `${V12}Rock`), 'me'), 'renombrada manteniendo el sufijo');
  assert.ok(!isAppPlaylist(pl('Rock · Shuffle · buena', `${V12}Rock`), 'me'));
  assert.ok(!isAppPlaylist(pl('📸 Mi verano', 'Snapshot created with Shuffl'), 'me'));
  assert.ok(!isAppPlaylist(pl('Baraja · Shuffle', 'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado'), 'me'));
  assert.ok(isAppPlaylist(pl('Mix · Shuffle', `${V12}Rock, Chill`), 'me'), 'varias playlists: «Mix · Shuffle»');
  assert.ok(isAppPlaylist(pl('Rock, Chill · Shuffle', `${V12}Rock, Chill`), 'me'), 'una playlist con coma en el nombre');
  assert.ok(!isAppPlaylist(pl('Coche · Shuffle', `${V12}Rock`), 'me'), 'mezcla de la v1.2 con otro nombre: no se sabe, no se toca');
  assert.ok(isAppPlaylist(pl('Tus me gusta · Shuffle', `${V12}Tus me gusta`), 'me'));
});

test('ronda 2: etiqueta v1.3 con descripción conocida exige el nombre exacto; fechas solo tras « · Shuffle»; nombres con entidades', async () => {
  const v13 = (name, origin) => pl(name, `${V12}${origin} · shuffl:src=0123456789`);
  assert.ok(isAppPlaylist(v13('Rock · Shuffle', 'Rock'), 'me'));
  assert.ok(!isAppPlaylist(v13('Rock bueno · Shuffle', 'Rock'), 'me'), 'renombrada conservando el sufijo');
  assert.ok(isAppPlaylist(v13('35 min · Shuffle', 'Rock'), 'me'), 'por tiempo (v1.3)');
  assert.ok(isAppPlaylist(v13('Rock · Álbumes · Shuffle', 'Rock'), 'me'), 'por álbumes (v1.3)');
  assert.ok(isAppPlaylist(v13('Mix · Albums · Shuffle', 'Rock, Chill'), 'me'));
  assert.ok(isAppPlaylist(pl('New releases · Shuffle', 'Releases from the last 30 days, with Shuffl. · shuffl:src=0123456789'), 'me'), 'v1.3 de Descubrir');
  assert.ok(!isAppName('Concierto · 12/5/24, 21:00'), 'una fecha sin « · Shuffle» no es un nombre de la app');
  assert.ok(isAppName('Rock · Shuffle · 12/5/24, 21:00'));
  const tag = await tagFor('pl:x');
  assert.ok(isAppPlaylist(pl('Rock &amp; Roll · Shuffle', withTag('d', tag, 'Rock & Roll · Shuffle')), 'me'), 'nombre devuelto con entidades');
});
