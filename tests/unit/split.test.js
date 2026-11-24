import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitTracks, MAX_SPLIT_PARTS } from '../../js/core.js';

const t = (id, o = {}) => ({ uri: `spotify:track:${id}`, artists: ['A'], releaseDate: '2001-01-01', releaseDatePrecision: 'day', addedAt: '2022-05-05T00:00:00Z', ...o });
const uris = (groups) => groups.flatMap((g) => g.tracks.map((x) => x.uri));

test('parts: reparto equilibrado, en orden, sin perder ni repetir', () => {
  const tracks = Array.from({ length: 10 }, (_, i) => t(i));
  const g = splitTracks(tracks, 'parts', { parts: 3 });
  assert.deepEqual(g.map((x) => x.tracks.length), [4, 3, 3]);
  assert.deepEqual(uris(g), tracks.map((x) => x.uri));
});

test('parts: más partes que canciones no crea grupos vacíos y el número se acota', () => {
  const g = splitTracks([t(1), t(2)], 'parts', { parts: 5 });
  assert.deepEqual(g.map((x) => x.tracks.length), [1, 1]);
  assert.equal(splitTracks(Array.from({ length: 100 }, (_, i) => t(i)), 'parts', { parts: 999 }).length, MAX_SPLIT_PARTS);
  assert.equal(splitTracks([t(1), t(2), t(3)], 'parts', { parts: 1 }).length, 2);
  assert.deepEqual(splitTracks([], 'parts', { parts: 3 }), []);
});

test('decade: agrupa por década de lanzamiento y deja lo sin fecha al final', () => {
  const g = splitTracks([t(1, { releaseDate: '1999' }), t(2, { releaseDate: '2003-04' }), t(3, { releaseDate: '' }), t(4, { releaseDate: '1985-01-01' }), t(5, { releaseDate: '2009' })], 'decade');
  assert.deepEqual(g.map((x) => [x.key, x.label, x.tracks.length]), [['1980', '1980s', 1], ['1990', '1990s', 1], ['2000', '2000s', 2], ['none', '', 1]]);
});

test('addedYear: por año en que se añadió', () => {
  const g = splitTracks([t(1, { addedAt: '2021-01-01T00:00:00Z' }), t(2, { addedAt: '2023-06-01T00:00:00Z' }), t(3, { addedAt: '' }), t(4, { addedAt: '2021-12-31T00:00:00Z' })], 'addedYear');
  assert.deepEqual(g.map((x) => [x.key, x.tracks.length]), [['2021', 2], ['2023', 1], ['none', 1]]);
});

test('artist: artista principal con mínimo configurable y «otros»', () => {
  const tracks = [t(1, { artists: ['X', 'Z'] }), t(2, { artists: ['X'] }), t(3, { artists: ['Y'] }), t(4, { artists: [] }), t(5, { artists: ['X'] }), t(6, { artists: ['W'] })];
  const g2 = splitTracks(tracks, 'artist', { minArtist: 2 });
  assert.deepEqual(g2.map((x) => [x.label, x.tracks.length]), [['X', 3], ['', 3]]);
  assert.equal(g2.at(-1).key, 'others');
  const g1 = splitTracks(tracks, 'artist', { minArtist: 1 });
  assert.deepEqual(g1.map((x) => x.key), ['a:W', 'a:X', 'a:Y', 'others'], 'solo cuenta el artista principal; sin artista va a otros');
});

test('artist: si saldrían demasiadas playlists lanza tooMany', () => {
  const tracks = Array.from({ length: MAX_SPLIT_PARTS + 5 }, (_, i) => t(i, { artists: [`Artista ${i}`] }));
  assert.throws(() => splitTracks(tracks, 'artist', { minArtist: 1 }), { code: 'tooMany' });
  assert.equal(splitTracks(tracks, 'artist', { minArtist: 2 }).length, 1);
});

test('modo desconocido y entrada intacta', () => {
  const tracks = [t(1), t(2)];
  const copy = JSON.stringify(tracks);
  assert.throws(() => splitTracks(tracks, 'otro'), RangeError);
  splitTracks(tracks, 'decade');
  assert.equal(JSON.stringify(tracks), copy);
});

test('todos los modos conservan cada canción exactamente una vez', () => {
  const tracks = Array.from({ length: 57 }, (_, i) => t(i, { artists: [`A${i % 6}`], releaseDate: `${1970 + (i % 50)}`, addedAt: `${2015 + (i % 9)}-03-03T00:00:00Z` }));
  for (const [mode, opts] of [['parts', { parts: 7 }], ['decade', {}], ['addedYear', {}], ['artist', { minArtist: 3 }]]) {
    const out = uris(splitTracks(tracks, mode, opts));
    assert.equal(out.length, tracks.length, mode);
    assert.equal(new Set(out).size, tracks.length, mode);
  }
});
