import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAlbum, normalizeFollowedArtist as normalizeArtist, toLibraryCsv, buildBackup, validateBackup } from '../../js/core.js';
import { SpotifyApi, ApiError } from '../../js/api.js';

const album = (i, o = {}) => ({
  added_at: '2024-02-03T10:00:00Z',
  album: { id: `a${i}`, uri: `spotify:album:a${i}`, name: `Álbum ${i}`, artists: [{ name: 'X' }, { name: 'Y' }], release_date: '2001-05-06', total_tracks: 12, external_ids: { upc: `00${i}` }, ...o },
});

test('normalizeAlbum recoge UPC, artistas y fecha de guardado', () => {
  assert.deepEqual(normalizeAlbum(album(1)), {
    id: 'a1', uri: 'spotify:album:a1', name: 'Álbum 1', artists: ['X', 'Y'], releaseDate: '2001-05-06', totalTracks: 12, upc: '001', addedAt: '2024-02-03T10:00:00Z',
  });
  assert.equal(normalizeAlbum(album(2, { external_ids: undefined })).upc, '');
  assert.equal(normalizeAlbum({ added_at: 'x', album: null }), null);
  assert.equal(normalizeAlbum(null), null);
  assert.equal(normalizeAlbum({ album: { name: 'sin uri' } }), null);
});

test('normalizeArtist exige uri y nombre', () => {
  assert.deepEqual(normalizeArtist({ id: 'r', uri: 'spotify:artist:r', name: 'R', popularity: 99, genres: ['x'] }), { id: 'r', uri: 'spotify:artist:r', name: 'R' });
  assert.equal(normalizeArtist({ name: 'sin uri' }), null);
  assert.equal(normalizeArtist(undefined), null);
});

test('toLibraryCsv: álbumes y artistas con UPC y protección de fórmulas', () => {
  const albums = [normalizeAlbum(album(1)), normalizeAlbum(album(2, { name: '=SUMA(1;2)' }))];
  const csv = toLibraryCsv(albums, [normalizeArtist({ uri: 'spotify:artist:r', name: 'R, el "grande"' })]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'type,uri,name,artists,releaseDate,totalTracks,upc,addedAt');
  assert.match(lines[1], /^album,spotify:album:a1,Álbum 1,"X, Y",2001-05-06,12,001,2024-02-03T10:00:00Z$/);
  assert.match(lines[2], /'=SUMA/);
  assert.match(lines[3], /^artist,spotify:artist:r,"R, el ""grande"""/);
});

test('la copia con álbumes y artistas sigue siendo válida', () => {
  const backup = buildBackup([], new Date('2026-01-01T00:00:00Z'), { albums: [normalizeAlbum(album(1))], artists: [normalizeArtist({ uri: 'spotify:artist:r', name: 'R' })] });
  const back = JSON.parse(JSON.stringify(backup));
  assert.equal(back.albums.length, 1);
  assert.equal(back.artists.length, 1);
  assert.deepEqual(validateBackup(back), []);
});

const res = (status, body) => ({ ok: status < 300, status, headers: { get: () => null }, text: async () => JSON.stringify(body), json: async () => body, clone() { return this; } });
const apiWith = (handler) => new SpotifyApi({ auth: { getAccessToken: async () => 't', refresh: async () => {} }, fetchImpl: async (url) => handler(new URL(url)), sleep: async () => {} });

test('getFollowedArtists recorre los cursores hasta que no hay más', async () => {
  const afters = [];
  const api = apiWith((u) => {
    const after = u.searchParams.get('after');
    afters.push(after);
    const page = after === null ? 0 : after === 'c1' ? 1 : 2;
    return res(200, { artists: { items: [{ id: `p${page}` }], cursors: { after: page === 0 ? 'c1' : page === 1 ? 'c2' : null } } });
  });
  assert.deepEqual((await api.getFollowedArtists()).map((x) => x.id), ['p0', 'p1', 'p2']);
  assert.deepEqual(afters, [null, 'c1', 'c2']);
});

test('getFollowedArtists falla si la respuesta no trae la lista', async () => {
  const api = apiWith(() => res(200, {}));
  await assert.rejects(() => api.getFollowedArtists(), (e) => e instanceof ApiError && e.status === 0);
});
