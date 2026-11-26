import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceKey, generatedName, datedName, generatedDescription, sameDescription, sanitizeTargets, setTarget, removeTarget,
  isGeneratedPlaylist, SHUFFLE_SUFFIX, MAX_NAME, MAX_DESCRIPTION, MAX_TARGETS,
} from '../../js/targets.js';

const es = { liked: 'Tus me gusta', library: 'Toda mi música' };
const en = { liked: 'Liked Songs', library: 'All my music' };

test('nombres de las playlists generadas en español e inglés', () => {
  assert.equal(generatedName({ sources: [{ name: 'Reggaeton' }] }, es), 'Reggaeton · Shuffle');
  assert.equal(generatedName({ sources: [{ name: 'x', isLiked: true }] }, es), 'Tus me gusta · Shuffle');
  assert.equal(generatedName({ sources: [{ name: 'x', isLiked: true }] }, en), 'Liked Songs · Shuffle');
  assert.equal(generatedName({ sources: [{ name: 'A' }, { name: 'B' }] }, es), 'Mix · Shuffle');
  assert.equal(generatedName({ mixName: 'Coche', sources: [{ name: 'A' }, { name: 'B' }] }, es), 'Coche · Shuffle');
  assert.equal(generatedName({ library: true, sources: [{ name: 'A' }] }, es), 'Toda mi música · Shuffle');
  assert.equal(generatedName({ library: true }, en), 'All my music · Shuffle');
  assert.equal(generatedName({ mixName: '   ', sources: [{ name: 'Rock' }] }, es), 'Rock · Shuffle', 'mezcla sin nombre usa el origen');
  assert.equal(generatedName({ sources: [{ name: '' }] }, es), 'Mix · Shuffle');
});

test('el nombre generado no pasa de 100 caracteres y conserva el sufijo', () => {
  const name = generatedName({ sources: [{ name: '🎵'.repeat(150) }] }, es);
  assert.ok([...name].length <= MAX_NAME);
  assert.ok(name.endsWith(`…${SHUFFLE_SUFFIX}`));
  assert.ok([...datedName(name, '26/11/26, 10:00')].length <= MAX_NAME);
  assert.equal(datedName('Rock · Shuffle', '26/11/26'), 'Rock · Shuffle · 26/11/26');
});

test('la clave del origen no depende del orden y distingue mezcla, biblioteca y playlists', () => {
  assert.equal(sourceKey({ ids: ['b', 'a'] }), sourceKey({ ids: ['a', 'b', 'a'] }));
  assert.equal(sourceKey({ ids: ['a', 'b'] }), 'pl:a,b');
  assert.equal(sourceKey({ ids: ['__liked__'] }), 'pl:__liked__');
  assert.equal(sourceKey({ library: true, ids: ['a'] }), 'library');
  assert.equal(sourceKey({ mixId: 'm1', library: true }), 'mix:m1');
  assert.equal(sourceKey({ mixId: '../x', ids: ['a'] }), 'pl:a', 'id de mezcla raro: se usa el de las playlists');
  assert.equal(sourceKey({ ids: ['../x', 'a/b'] }), null);
  assert.equal(sourceKey({}), null);
});

test('la descripción lista los orígenes sin pasar de 300 caracteres', () => {
  assert.equal(generatedDescription('Desde: ', ['Rock', 'Chill']), 'Desde: Rock, Chill');
  const long = generatedDescription('Desde: ', Array.from({ length: 80 }, (_, i) => `Playlist ${i}`));
  assert.equal([...long].length, MAX_DESCRIPTION);
  assert.ok(long.endsWith('…'));
});

test('sameDescription compara con la descripción escapada que devuelve Spotify', () => {
  assert.ok(sameDescription('Desde: Rock &amp; Roll, &quot;Chill&quot;, It&#x27;s', 'Desde: Rock & Roll, "Chill", It\'s'));
  assert.ok(!sameDescription('Desde: Rock', 'Desde: Chill'));
  assert.ok(!sameDescription(undefined, 'x'));
});

test('sanitizeTargets descarta claves e ids con formato peligroso', () => {
  const out = sanitizeTargets({
    'pl:a,b': 'abc123', library: 'lib1', 'mix:m_1': 'mix1',
    'pl:../x': 'bad1', 'otra:a': 'bad2', 'pl:a': '../etc', 'pl:c': 5, 'pl:d': 'a/b', __proto__: { polluted: 'x' },
  });
  assert.deepEqual(out, { 'pl:a,b': 'abc123', library: 'lib1', 'mix:m_1': 'mix1' });
  assert.deepEqual(sanitizeTargets(null), {});
  assert.deepEqual(sanitizeTargets(['pl:a']), {});
  assert.equal({}.polluted, undefined);
});

test('setTarget no muta, deja la más reciente al final y respeta el tope', () => {
  const a = setTarget({}, 'pl:a', 'id1');
  const b = setTarget(a, 'pl:b', 'id2');
  const c = setTarget(b, 'pl:a', 'id3');
  assert.deepEqual(a, { 'pl:a': 'id1' });
  assert.deepEqual(Object.entries(c), [['pl:b', 'id2'], ['pl:a', 'id3']]);
  let big = {};
  for (let i = 0; i < MAX_TARGETS + 5; i++) big = setTarget(big, `pl:p${i}`, `id${i}`);
  assert.equal(Object.keys(big).length, MAX_TARGETS);
  assert.ok(!('pl:p0' in big) && 'pl:p204' in big);
  assert.deepEqual(removeTarget(c, 'pl:a'), { 'pl:b': 'id2' });
  assert.equal(Object.keys(sanitizeTargets({ ...big, 'pl:extra': 'x1' })).length, MAX_TARGETS);
});

test('isGeneratedPlaylist reconoce las generadas de ahora, las de antes y las instantáneas', () => {
  const map = { 'pl:a': 'gen1' };
  assert.ok(isGeneratedPlaylist({ id: 'gen1', name: 'Renombrada' }, map));
  assert.ok(isGeneratedPlaylist({ id: 'x', name: 'Rock · Shuffle' }));
  assert.ok(isGeneratedPlaylist({ id: 'x', name: '🔀 Baraja' }));
  assert.ok(isGeneratedPlaylist({ id: 'x', name: 'Baraja · 1/1/26' }));
  assert.ok(isGeneratedPlaylist({ id: 'x', name: '📸 Top 4 semanas' }));
  assert.ok(isGeneratedPlaylist({ id: 'old', name: 'Lo que sea' }, {}, 'old'));
  assert.ok(!isGeneratedPlaylist({ id: 'x', name: 'Shuffle de verano' }));
});
