import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceKey, generatedName, datedName, generatedDescription, sameDescription, sanitizeTargets, setTarget, removeTarget,
  isGeneratedPlaylist, SHUFFLE_SUFFIX, MAX_NAME, MAX_DESCRIPTION, MAX_TARGETS,
  isTargetKey, tagFor, withTag, readTag, findCandidates, pickKeep, duplicateGroups, findLegacyBaraja, isManagedName,
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

test('claves de la v1.3 válidas y peligrosas', () => {
  for (const k of ['time:35', 'albums:saved', 'albums:pl:a,b', 'albums:library', 'albums:mix:m1', 'new', 'explore', 'ago:2', 'forgotten', 'top']) assert.ok(isTargetKey(k), k);
  for (const k of ['time:', 'time:abcd', 'albums:', 'albums:pl:../x', 'ago:x', 'similar:1', 'pl:a/b', '', null]) assert.ok(!isTargetKey(k), String(k));
});

test('la etiqueta es estable, corta, distinta por origen y no contiene los ids', async () => {
  const a = await tagFor('pl:abc123');
  assert.match(a, /^[a-f0-9]{10}$/);
  assert.equal(await tagFor('pl:abc123'), a);
  assert.notEqual(await tagFor('pl:abc124'), a);
  assert.ok(!a.includes('abc123'));
});

test('withTag y readTag: la etiqueta cabe siempre y se lee también con entidades HTML', () => {
  const d = withTag('Desde: Rock & Roll', '0123456789');
  assert.equal(d, 'Desde: Rock & Roll · shuffl:src=0123456789');
  assert.equal(readTag(d), '0123456789');
  assert.equal(readTag('Desde: Rock &amp; Roll · shuffl:src=0123456789'), '0123456789');
  const long = withTag('x'.repeat(400), 'abcdefabcd');
  assert.equal([...long].length, MAX_DESCRIPTION);
  assert.equal(readTag(long), 'abcdefabcd');
  assert.equal(readTag('texto · shuffl:src=XYZ'), null);
  assert.equal(readTag('shuffl:src=0123456789 y más texto'), null, 'solo al final');
  assert.equal(readTag(null), null);
});

const me = { id: 'me' };
const other = { id: 'otra' };
const pl = (id, name, description, owner = me) => ({ id, name, description, owner });

test('findCandidates: propias, con la etiqueta y con el nombre «· Shuffle»; las v1.2 sin etiqueta por nombre y descripción', () => {
  const tag = '0123456789';
  const list = [
    pl('a', 'Rock · Shuffle', `Desde: Rock · shuffl:src=${tag}`),
    pl('b', 'Rock · Shuffle', 'Desde: Rock'),
    pl('c', 'Mi Rock favorito', `Desde: Rock · shuffl:src=${tag}`),
    pl('d', 'Rock · Shuffle', `Desde: Rock · shuffl:src=${tag}`, other),
    pl('e', 'Rock · Shuffle', 'Desde: Rock · shuffl:src=9999999999'),
    pl('f', 'Rock · Shuffle', 'Desde: Chill'),
    null,
  ];
  assert.deepEqual(findCandidates(list, { meId: 'me', tag, name: 'Rock · Shuffle', legacyDescription: 'Desde: Rock' }).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(findCandidates(list, { meId: 'me', tag, name: 'Rock · Shuffle', legacyDescription: null }).map((p) => p.id), ['a']);
});

test('pickKeep se queda con la escrita más tarde; en empate, con la que ya usaba el dispositivo', () => {
  const cands = [pl('a', 'x · Shuffle'), pl('b', 'x · Shuffle'), pl('c', 'x · Shuffle')];
  assert.equal(pickKeep(cands, new Map([['a', 10], ['b', 30], ['c', 20]])).id, 'b');
  assert.equal(pickKeep(cands, new Map([['a', 10], ['b', 10], ['c', 10]]), 'c').id, 'c');
  assert.equal(pickKeep(cands, new Map()).id, 'a');
  assert.equal(pickKeep([], new Map()), null);
});

test('duplicateGroups agrupa copias por etiqueta o (sin etiqueta) por nombre y descripción, y nunca toca renombradas ni ajenas', () => {
  const t1 = 'aaaaaaaaaa';
  const list = [
    pl('1', 'Rock · Shuffle', `Desde: Rock · shuffl:src=${t1}`),
    pl('2', 'Rock · Shuffle', `Desde: Rock · shuffl:src=${t1}`),
    pl('3', 'Renombrada', `Desde: Rock · shuffl:src=${t1}`),
    pl('4', 'Rock · Shuffle', `Desde: Rock · shuffl:src=${t1}`, other),
    pl('5', 'Mix · Shuffle', 'Desde: A, B'),
    pl('6', 'Mix · Shuffle', 'Desde: A, B'),
    pl('7', 'Mix · Shuffle', 'Desde: C, D'),
    pl('8', 'Solo · Shuffle', 'x'),
  ];
  const groups = duplicateGroups(list, 'me');
  assert.deepEqual(groups.map((g) => g.playlists.map((p) => p.id)), [['1', '2'], ['5', '6']]);
});

test('findLegacyBaraja encuentra la antigua propia por nombre o id', () => {
  assert.equal(findLegacyBaraja([pl('z', '🔀 Baraja')], 'me').id, 'z');
  assert.equal(findLegacyBaraja([pl('z', 'Otra')], 'me', 'z').id, 'z');
  assert.equal(findLegacyBaraja([pl('z', '🔀 Baraja', '', other)], 'me'), null);
  assert.equal(isManagedName('Rock · Shuffle'), true);
  assert.equal(isManagedName('Rock · Shuffle · 26/11'), false);
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
