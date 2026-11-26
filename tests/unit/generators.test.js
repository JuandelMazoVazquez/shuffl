import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitDuration, sanitizeMinutes, MINUTE, TIME_MARGIN_MS, onThisDayGroups, topArtist, forgottenTracks, groupAlbums, shuffleAlbums,
  pickArtists, recentAlbums, albumsFromListening, withoutUris, pruneCache, cacheGet, cacheSet, CACHE_TTL_MS, MAX_CACHE_ENTRIES,
} from '../../js/generators.js';

const tr = (i, o = {}) => ({ uri: `spotify:track:${i}`, id: String(i), type: 'track', name: `T${i}`, artists: [o.artist ?? `A${i % 3}`], durationMs: o.ms ?? 3 * MINUTE, addedAt: o.added ?? '', albumId: o.album ?? '', album: o.album ?? '', discNumber: o.disc ?? 1, trackNumber: o.n ?? 1 });
/** Generador con semilla (mulberry32) con la firma de randomInt. */
const seeded = (seed) => {
  let a = seed >>> 0;
  return (max) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) % max);
  };
};

test('sanitizeMinutes solo admite enteros de 5 a 600', () => {
  assert.equal(sanitizeMinutes('35'), 35);
  assert.equal(sanitizeMinutes(5), 5);
  assert.equal(sanitizeMinutes(600), 600);
  for (const bad of [4, 601, '3.5', 'abc', null, -10, 30.5]) assert.equal(sanitizeMinutes(bad), null, String(bad));
});

test('fitDuration llena el tiempo con ±2 min y nunca se pasa', () => {
  const songs = Array.from({ length: 60 }, (_, i) => tr(i, { ms: (2 + (i % 5)) * MINUTE + (i * 7000) % 50000 }));
  for (let s = 1; s <= 50; s++) {
    const r = fitDuration(songs, 35, seeded(s));
    assert.ok(r.totalMs <= 35 * MINUTE + TIME_MARGIN_MS, `semilla ${s}: se pasa`);
    assert.ok(r.reached && r.totalMs >= 35 * MINUTE - TIME_MARGIN_MS, `semilla ${s}: se queda corto`);
    assert.equal(new Set(r.tracks.map((x) => x.uri)).size, r.tracks.length, 'sin repetidas');
  }
});

test('fitDuration busca entre las restantes una canción que encaje en el hueco', () => {
  // Con una larga al principio del orden que no cabe, debe saltarla y seguir.
  const songs = [tr(1, { ms: 40 * MINUTE }), tr(2, { ms: 10 * MINUTE }), tr(3, { ms: 10 * MINUTE }), tr(4, { ms: 9 * MINUTE })];
  const r = fitDuration(songs, 30, () => 0);
  assert.ok(!r.tracks.some((x) => x.uri.endsWith(':1')));
  assert.ok(r.reached);
});

test('fitDuration con poca música devuelve lo que hay y avisa de que no llega', () => {
  const r = fitDuration([tr(1), tr(2)], 60, seeded(3));
  assert.equal(r.tracks.length, 2);
  assert.equal(r.reached, false);
  assert.deepEqual(fitDuration([tr(1, { ms: 0 })], 15).tracks, [], 'sin duración no cuenta');
});

test('fitDuration es uniforme: cada canción tiene la misma probabilidad de entrar', () => {
  const songs = Array.from({ length: 10 }, (_, i) => tr(i, { ms: 3 * MINUTE }));
  const counts = new Array(10).fill(0);
  const rand = seeded(42);
  const runs = 20000;
  for (let k = 0; k < runs; k++) for (const x of fitDuration(songs, 15, rand).tracks) counts[Number(x.id)]++;
  const expected = runs * 5 / 10; // 15 min ± 2 → caben 5 de 3 min (17 min)
  for (const c of counts) assert.ok(Math.abs(c - expected) / expected < 0.05, `sesgo: ${counts}`);
});

test('onThisDayGroups agrupa por año lo guardado este mes en años anteriores', () => {
  const now = new Date(2026, 10, 26);
  const songs = [
    tr(1, { added: '2024-11-03T10:00:00Z' }), tr(2, { added: '2024-11-20T10:00:00Z' }), tr(3, { added: '2021-11-15T10:00:00Z' }),
    tr(4, { added: '2026-11-01T10:00:00Z' }), tr(5, { added: '2024-10-15T10:00:00Z' }), tr(6, { added: 'nada' }), tr(1, { added: '2024-11-04T10:00:00Z' }),
  ];
  const g = onThisDayGroups(songs, now);
  assert.deepEqual(g.map((x) => [x.year, x.yearsAgo, x.tracks.map((t) => t.id)]), [[2024, 2, ['1', '2']], [2021, 5, ['3']]]);
  assert.deepEqual(onThisDayGroups([], now), []);
});

test('topArtist devuelve el más repetido o null', () => {
  assert.equal(topArtist([tr(1, { artist: 'X' }), tr(2, { artist: 'Y' }), tr(3, { artist: 'Y' })]), 'Y');
  assert.equal(topArtist([]), null);
});

test('forgottenTracks: guardadas hace más de N años', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const songs = [tr(1, { added: '2023-01-01T00:00:00Z' }), tr(2, { added: '2025-06-01T00:00:00Z' }), tr(3, { added: '' }), tr(4, { added: '2024-11-25T00:00:00Z' })];
  assert.deepEqual(forgottenTracks(songs, 2, now).map((x) => x.id), ['1', '4']);
  assert.deepEqual(forgottenTracks(songs, 3, now).map((x) => x.id), ['1']);
  assert.deepEqual(forgottenTracks(songs, 5, now), []);
});

test('groupAlbums conserva el orden de disco y pista y quita episodios y repetidas', () => {
  const songs = [tr(1, { album: 'B', n: 2 }), tr(2, { album: 'A', n: 1 }), tr(3, { album: 'B', n: 1 }), tr(4, { album: 'B', disc: 2, n: 1 }), tr(1, { album: 'B', n: 2 }), { ...tr(9), type: 'episode', albumId: 'C' }, tr(5)];
  const g = groupAlbums(songs);
  assert.deepEqual(g.map((a) => [a.id, a.tracks.map((x) => x.id)]), [['B', ['3', '1', '4']], ['A', ['2']]]);
});

test('shuffleAlbums baraja el orden de los álbumes y nunca rompe un álbum', () => {
  const albums = ['A', 'B', 'C', 'D'].map((id) => ({ id, tracks: [1, 2, 3].map((n) => tr(`${id}${n}`, { album: id, n })) }));
  const firsts = {};
  const rand = seeded(7);
  for (let k = 0; k < 8000; k++) {
    const r = shuffleAlbums(albums, rand);
    const ids = r.tracks.map((x) => x.albumId);
    for (let i = 0; i < ids.length; i += 3) assert.equal(new Set(ids.slice(i, i + 3)).size, 1, 'álbum partido');
    assert.deepEqual(r.tracks.slice(0, 3).map((x) => x.trackNumber), [1, 2, 3]);
    firsts[r.albums[0].id] = (firsts[r.albums[0].id] ?? 0) + 1;
  }
  for (const c of Object.values(firsts)) assert.ok(Math.abs(c - 2000) < 200, JSON.stringify(firsts));
});

test('pickArtists alterna listas, quita repetidos y respeta el tope', () => {
  const a = (id) => ({ id, name: id });
  assert.deepEqual(pickArtists([[a('1'), a('2')], [a('2'), a('3')], [a('4')]]).map((x) => x.id), ['1', '2', '4', '3']);
  const many = Array.from({ length: 40 }, (_, i) => a(`x${i}`));
  assert.equal(pickArtists([many, many]).length, 25);
  assert.deepEqual(pickArtists([null, [{ name: 'sin id' }]]), []);
});

test('recentAlbums: solo precisión de día, dentro de los últimos N días y sin futuros', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const al = (id, date, precision = 'day') => ({ id, release_date: date, release_date_precision: precision });
  const list = [al('a', '2026-11-20'), al('b', '2026-10-01'), al('c', '2026-11', 'month'), al('f', '2026-11'),al('d', '2026-12-01'), al('a', '2026-11-20'), al('e', 'raro')];
  assert.deepEqual(recentAlbums(list, 30, now).map((x) => x.id), ['a']);
  assert.deepEqual(recentAlbums(list, 90, now).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(recentAlbums(list, 7, now).map((x) => x.id), ['a']);
});

test('albumsFromListening y withoutUris', () => {
  assert.deepEqual(albumsFromListening([tr(1, { album: 'X' }), tr(2, { album: 'X' }), tr(3), tr(4, { album: 'Y' })]), ['X', 'Y']);
  assert.equal(albumsFromListening(Array.from({ length: 40 }, (_, i) => tr(i, { album: `a${i}` }))).length, 25);
  assert.deepEqual(withoutUris([tr(1), tr(2), tr(2), tr(3)], ['spotify:track:3']).map((x) => x.id), ['1', '2']);
});

test('caché de 24 h: caduca, rechaza formatos raros y tiene tope', () => {
  const now = 1_000_000_000_000;
  let c = cacheSet({ cache: {} }, 'k', [1, 2], now).cache;
  assert.deepEqual(cacheGet(c, 'k', now + 1000), [1, 2]);
  assert.equal(cacheGet(c, 'k', now + CACHE_TTL_MS + 1), undefined);
  assert.equal(cacheGet(c, 'k', now - 1000), undefined, 'fecha en el futuro: no se fía');
  assert.deepEqual(pruneCache({ a: { t: now, d: 1 }, b: { t: now - CACHE_TTL_MS - 1, d: 2 }, c: 5, d: null }, now), { a: { t: now, d: 1 } });
  assert.deepEqual(pruneCache('x', now), {});
  assert.deepEqual(pruneCache([1], now), {});
  let st = { cache: c };
  for (let i = 0; i < MAX_CACHE_ENTRIES + 20; i++) st = cacheSet(st, `k${i}`, i, now + i);
  c = st.cache;
  assert.equal(st.size, JSON.stringify(c).length, 'el tamaño llevado a mano coincide');
  assert.equal(Object.keys(c).length, MAX_CACHE_ENTRIES);
  assert.equal(cacheGet(c, `k${MAX_CACHE_ENTRIES + 19}`, now + MAX_CACHE_ENTRIES + 20), MAX_CACHE_ENTRIES + 19);
});

test('la caché tiene tope de tamaño: se quitan las más antiguas y nunca pasa del máximo', () => {
  const now = 1_000_000_000_000;
  let st = { cache: {} };
  for (let i = 0; i < 50; i++) st = cacheSet(st, `album:${i}`, 'x'.repeat(1000), now + i, 10_000);
  const c = st.cache;
  assert.ok(JSON.stringify(c).length <= 10_000);
  assert.equal(st.size, JSON.stringify(c).length);
  assert.ok('album:49' in c && !('album:0' in c));
  assert.deepEqual(cacheSet({ cache: {} }, 'enorme', 'x'.repeat(20_000), now, 10_000).cache, {}, 'una entrada que no cabe no se guarda');
  const again = cacheSet(cacheSet({ cache: {} }, 'k', 'aaa', now), 'k', 'bbbbbb', now + 1);
  assert.equal(again.size, JSON.stringify(again.cache).length, 'sustituir una clave descuenta la anterior');
});
