import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  randomInt, shuffle, chunk, uniqueByUri, capPlaylist, MAX_PLAYLIST, parseReleaseDate, sortTracks, SORT_KEYS,
  filterByAdded, normalizeTitle, findDuplicates, removeIndexes, normalizeEntry, normalizeEntries, normalizePlaylist,
  buildBackup, toCsv, validateBackup,
} from '../../js/core.js';

const tr = (o = {}) => ({
  uri: 'spotify:track:a', id: 'a', type: 'track', name: 'N', artists: ['A'], album: 'Al', albumId: 'al',
  releaseDate: '2000-01-01', releaseDatePrecision: 'day', durationMs: 1000, isrc: '', addedAt: '2020-01-01T00:00:00Z',
  discNumber: 1, trackNumber: 1, ...o,
});

test('randomInt: rechaza los valores que causan sesgo de módulo', () => {
  const seq = [4294967295, 5];
  let calls = 0;
  const fake = (buf) => { buf[0] = seq[calls++]; };
  assert.equal(randomInt(3, fake), 5 % 3);
  assert.equal(calls, 2);
});

test('randomInt: validación de argumentos', () => {
  for (const bad of [0, -1, 1.5, NaN, 2 ** 32 + 1]) assert.throws(() => randomInt(bad), RangeError);
  assert.equal(randomInt(1), 0);
});

test('randomInt: distribución uniforme (chi-cuadrado)', () => {
  const N = 120000, max = 6, counts = new Array(max).fill(0);
  for (let i = 0; i < N; i++) counts[randomInt(max)]++;
  const exp = N / max;
  const chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  assert.ok(chi < 25, `chi=${chi} (df=5, p<0.0002)`);
});

test('shuffle: no pierde ni duplica elementos ni muta la entrada', () => {
  const input = Array.from({ length: 500 }, (_, i) => i);
  const copy = input.slice();
  const out = shuffle(input);
  assert.deepEqual(input, copy);
  assert.deepEqual([...out].sort((a, b) => a - b), input);
  assert.notDeepEqual(out, input);
});

test('shuffle: casos límite', () => {
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle([7]), [7]);
});

test('shuffle: cada elemento es equiprobable en cada posición (chi-cuadrado)', () => {
  const n = 5, runs = 100000;
  const pos = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < runs; r++) shuffle([0, 1, 2, 3, 4]).forEach((el, p) => pos[p][el]++);
  const exp = runs / n;
  for (let p = 0; p < n; p++) {
    const chi = pos[p].reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
    assert.ok(chi < 25, `posición ${p}: chi=${chi} (df=4)`);
  }
});

test('shuffle: las 24 permutaciones de 4 elementos son equiprobables', () => {
  const runs = 120000, freq = new Map();
  for (let r = 0; r < runs; r++) {
    const k = shuffle([0, 1, 2, 3]).join('');
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  assert.equal(freq.size, 24);
  const exp = runs / 24;
  const chi = [...freq.values()].reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  assert.ok(chi < 55, `chi=${chi} (df=23)`);
});

test('chunk', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.equal(chunk(Array.from({ length: 250 }, (_, i) => i), 100).length, 3);
  assert.throws(() => chunk([1], 0), RangeError);
});

test('capPlaylist corta a 10.000 e informa de lo omitido', () => {
  const big = Array.from({ length: MAX_PLAYLIST + 5 }, (_, i) => tr({ uri: `spotify:track:${i}` }));
  const r = capPlaylist(big);
  assert.equal(r.tracks.length, MAX_PLAYLIST);
  assert.equal(r.truncated, 5);
  assert.equal(capPlaylist([tr()]).truncated, 0);
});

test('uniqueByUri conserva la primera aparición', () => {
  const r = uniqueByUri([tr({ uri: 'x', name: '1' }), tr({ uri: 'y' }), tr({ uri: 'x', name: '2' })]);
  assert.deepEqual(r.map((t) => t.name), ['1', 'N']);
});

test('parseReleaseDate: precisiones year/month/day y entradas inválidas', () => {
  assert.deepEqual(parseReleaseDate('1999', 'year'), { year: 1999, month: 0, day: 0, precision: 'year', key: 19990101 });
  assert.equal(parseReleaseDate('1999-07').key, 19990701);
  assert.equal(parseReleaseDate('1999-07-15').precision, 'day');
  for (const bad of ['', null, undefined, 'abc', '1999-13', '1999-01-32', '99']) assert.equal(parseReleaseDate(bad), null);
});

const lib = () => [
  tr({ uri: 'u1', name: 'b side', artists: ['Zeta'], album: 'Second', albumId: 's', releaseDate: '2010', releaseDatePrecision: 'year', discNumber: 1, trackNumber: 2, durationMs: 300, addedAt: '2021-03-01T10:00:00Z' }),
  tr({ uri: 'u2', name: 'a side', artists: ['alpha'], album: 'First', albumId: 'f', releaseDate: '1999-05-01', discNumber: 1, trackNumber: 1, durationMs: 100, addedAt: '2022-03-01T10:00:00Z' }),
  tr({ uri: 'u3', name: 'Álbum track', artists: ['Zeta'], album: 'Second', albumId: 's', releaseDate: '2010', releaseDatePrecision: 'year', discNumber: 1, trackNumber: 1, durationMs: 200, addedAt: '' }),
  tr({ uri: 'u4', name: 'no date', artists: ['Beta'], album: 'Zzz', albumId: 'z', releaseDate: '', durationMs: 50, addedAt: '2020-01-01T00:00:00Z' }),
];
const uris = (a) => a.map((t) => t.uri);

test('sortTracks: fecha de lanzamiento asc y desc, sin fecha al final, discos y pistas en orden', () => {
  assert.deepEqual(uris(sortTracks(lib(), 'release-asc')), ['u2', 'u3', 'u1', 'u4']);
  assert.deepEqual(uris(sortTracks(lib(), 'release-desc')), ['u3', 'u1', 'u2', 'u4']);
});

test('sortTracks: artista A-Z y dentro álbumes cronológicos', () => {
  assert.deepEqual(uris(sortTracks(lib(), 'artist')), ['u2', 'u4', 'u3', 'u1']);
});

test('sortTracks: álbum cronológico, título, duración, añadida', () => {
  assert.deepEqual(uris(sortTracks(lib(), 'album')), ['u2', 'u3', 'u1', 'u4']);
  assert.deepEqual(uris(sortTracks(lib(), 'title')), ['u2', 'u3', 'u1', 'u4']);
  assert.deepEqual(uris(sortTracks(lib(), 'duration-asc')), ['u4', 'u2', 'u3', 'u1']);
  assert.deepEqual(uris(sortTracks(lib(), 'duration-desc')), ['u1', 'u3', 'u2', 'u4']);
  assert.deepEqual(uris(sortTracks(lib(), 'added-desc')), ['u2', 'u1', 'u4', 'u3']);
  assert.deepEqual(uris(sortTracks(lib(), 'added-asc')), ['u4', 'u1', 'u2', 'u3']);
});

test('sortTracks: invertir, orden actual, estabilidad y entrada intacta', () => {
  const l = lib();
  assert.deepEqual(uris(sortTracks(l, 'reverse')), ['u4', 'u3', 'u2', 'u1']);
  assert.deepEqual(uris(sortTracks(l, 'current')), ['u1', 'u2', 'u3', 'u4']);
  assert.deepEqual(uris(l), ['u1', 'u2', 'u3', 'u4']);
  const same = [tr({ uri: 'a', durationMs: 5 }), tr({ uri: 'b', durationMs: 5 }), tr({ uri: 'c', durationMs: 5 })];
  assert.deepEqual(uris(sortTracks(same, 'duration-asc')), ['a', 'b', 'c']);
  assert.throws(() => sortTracks(l, 'nope'), RangeError);
  for (const k of SORT_KEYS) assert.equal(sortTracks(l, k).length, 4);
});

test('filterByAdded', () => {
  const l = lib();
  assert.equal(filterByAdded(l, '', '').length, 4);
  assert.deepEqual(uris(filterByAdded(l, '2021-01-01', '2021-12-31')), ['u1']);
  assert.deepEqual(uris(filterByAdded(l, '2021-03-01', '')), ['u1', 'u2']);
  assert.deepEqual(uris(filterByAdded(l, '', '2020-01-01')), ['u4']);
});

test('normalizeTitle: quita remaster/radio edit/feat. pero no Live ni Acoustic', () => {
  const same = [
    ['Song - Remastered 2011', 'Song'], ['Song (Remastered)', 'song'], ['Song - 2011 Remaster', 'Song'],
    ['Song - Radio Edit', 'Song'], ['Song (feat. Other)', 'Song'], ['Song - feat. Other', 'Song'],
    ['Canción', 'Cancion'], ['Song [Mono]', 'Song'], ['SONG', 'song'], ['Song - Single Version', 'Song'],
  ];
  for (const [a, b] of same) assert.equal(normalizeTitle(a), normalizeTitle(b), `${a} vs ${b}`);
  assert.notEqual(normalizeTitle('Song - Live at Wembley'), normalizeTitle('Song'));
  assert.notEqual(normalizeTitle('Song (Acoustic)'), normalizeTitle('Song'));
  assert.notEqual(normalizeTitle('Song - Live Remastered'), normalizeTitle('Song'));
  assert.notEqual(normalizeTitle('Song (Remix)'), normalizeTitle('Song'));
});

test('findDuplicates exacto: misma URI, conserva la primera y da posiciones', () => {
  const l = [tr({ uri: 'a' }), tr({ uri: 'b' }), tr({ uri: 'a' }), tr({ uri: 'a' })];
  const g = findDuplicates(l, 'exact');
  assert.equal(g.length, 1);
  assert.equal(g[0].keep.index, 0);
  assert.deepEqual(g[0].dupes.map((d) => d.index), [2, 3]);
  assert.deepEqual(findDuplicates([], 'exact'), []);
});

test('findDuplicates inteligente: ISRC, título+artista, y respeta Live/Acoustic', () => {
  const l = [
    tr({ uri: 'a', name: 'Hit', artists: ['X'], isrc: 'US123' }),
    tr({ uri: 'b', name: 'Hit - Remastered 2015', artists: ['X'], isrc: 'us123' }),
    tr({ uri: 'c', name: 'Otra', artists: ['Y'] }),
    tr({ uri: 'd', name: 'otra (Radio Edit)', artists: ['Y'] }),
    tr({ uri: 'e', name: 'Otra - Live', artists: ['Y'] }),
    tr({ uri: 'f', name: 'Otra', artists: ['Z'] }),
  ];
  const g = findDuplicates(l, 'smart');
  assert.equal(g.length, 2);
  assert.deepEqual(g.map((x) => x.dupes.map((d) => d.index)), [[1], [3]]);
  assert.equal(findDuplicates(l, 'exact').length, 0);
});

test('findDuplicates inteligente: episodios solo por URI', () => {
  const ep = (uri) => tr({ uri, type: 'episode', name: 'Ep', artists: ['Show'] });
  assert.equal(findDuplicates([ep('spotify:episode:1'), ep('spotify:episode:2')], 'smart').length, 0);
  assert.equal(findDuplicates([ep('spotify:episode:1'), ep('spotify:episode:1')], 'smart').length, 1);
});

test('removeIndexes', () => {
  assert.deepEqual(removeIndexes(['a', 'b', 'c', 'd'], [1, 3]), ['a', 'c']);
  assert.deepEqual(removeIndexes(['a'], []), ['a']);
});

test('normalizeEntry: formatos item y track, locales, nulos y episodios', () => {
  const base = { id: 'x', uri: 'spotify:track:x', name: 'T', artists: [{ name: 'A' }], duration_ms: 1, album: { id: 'al', name: 'Al', release_date: '2001', release_date_precision: 'year', images: [{ url: 'big' }, { url: 'small' }] }, external_ids: { isrc: 'I' } };
  const a = normalizeEntry({ added_at: '2020', item: base }).track;
  const b = normalizeEntry({ added_at: '2020', track: base }).track;
  assert.deepEqual(a, b);
  assert.equal(a.image, 'small');
  assert.equal(a.isrc, 'I');
  assert.equal(normalizeEntry({ item: null }).reason, 'empty');
  assert.equal(normalizeEntry(null).reason, 'empty');
  assert.equal(normalizeEntry({ is_local: true, item: base }).reason, 'local');
  assert.equal(normalizeEntry({ item: { ...base, uri: 'spotify:local:a:b:c:1' } }).reason, 'local');
  const ep = normalizeEntry({ item: { id: 'e', uri: 'spotify:episode:e', type: 'episode', name: 'Ep', show: { name: 'Show', publisher: 'Pub' }, duration_ms: 5 } }).track;
  assert.equal(ep.type, 'episode');
  assert.deepEqual(ep.artists, ['Pub']);
  const r = normalizeEntries([{ item: base }, { item: null }, { is_local: true, item: base }]);
  assert.equal(r.tracks.length, 1);
  assert.deepEqual(r.skipped, { local: 1, empty: 1 });
});

test('normalizePlaylist: items.total y tracks.total, propiedad y colaborativas', () => {
  const p = { id: 'p', name: 'P', owner: { id: 'me' }, images: null };
  assert.equal(normalizePlaylist({ ...p, items: { total: 4 } }, 'me').total, 4);
  assert.equal(normalizePlaylist({ ...p, tracks: { total: 5 } }, 'me').total, 5);
  assert.equal(normalizePlaylist(p, 'me').image, '');
  assert.equal(normalizePlaylist({ ...p, owner: { id: 'x' } }, 'me').readable, false);
  assert.equal(normalizePlaylist({ ...p, owner: { id: 'x' }, collaborative: true }, 'me').readable, true);
});

test('backup: construir, validar, CSV y rechazo de archivos malos', () => {
  const lists = [{ id: 'p', name: 'Mi "lista"', isLiked: false, tracks: [tr({ uri: 'spotify:track:abc', name: '=cmd()', artists: ['A', 'B'] })] }];
  const b = buildBackup(lists, new Date('2026-01-01T00:00:00Z'));
  assert.equal(b.app, 'baraja');
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, '2026-01-01T00:00:00.000Z');
  const back = validateBackup(JSON.parse(JSON.stringify(b)));
  assert.equal(back[0].tracks[0].uri, 'spotify:track:abc');
  const csv = toCsv(lists);
  assert.match(csv, /"Mi ""lista"""/);
  assert.match(csv, /'=cmd\(\)/);
  assert.match(csv, /"A, B"/);
  assert.match(toCsv([{ name: 'p', tracks: [tr({ name: 'x;=1+1' })] }]), /"x;=1\+1"/);
  assert.throws(() => validateBackup({ app: 'baraja', version: 1, playlists: [{ name: 'x', tracks: Array.from({ length: MAX_PLAYLIST + 1 }, () => ({ uri: 'spotify:track:a' })) }] }), { code: 'tooBig' });
  for (const bad of [null, {}, { app: 'otra', version: 1, playlists: [] }, { app: 'baraja', version: 1, playlists: 'x' }]) {
    assert.throws(() => validateBackup(bad), { code: 'notBackup' });
  }
  assert.throws(() => validateBackup({ app: 'baraja', version: 2, playlists: [] }), { code: 'badVersion' });
  assert.throws(() => validateBackup({ app: 'baraja', version: 1, playlists: [{ name: 'x', tracks: [{ uri: 'spotify:local:a:b:c:1' }] }] }), { code: 'badTrack' });
  assert.throws(() => validateBackup({ app: 'baraja', version: 1, playlists: [{ name: 'x', tracks: [{ uri: 'javascript:alert(1)' }] }] }), { code: 'badTrack' });
});
