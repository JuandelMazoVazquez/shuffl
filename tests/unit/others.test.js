import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizePlaylists, parsePlaylistRef, normalizePlaylist } from '../../js/core.js';

const ID = '37i9dQZF1DXcBWIGoYBM5M';
const pl = (o) => normalizePlaylist({ id: o.id, name: o.name, owner: { id: o.owner ?? 'me' }, collaborative: !!o.collab, items: { total: 5 } }, 'me');

test('parsePlaylistRef acepta enlaces, URI e ids y rechaza el resto', () => {
  for (const ok of [
    `https://open.spotify.com/playlist/${ID}`,
    `https://open.spotify.com/playlist/${ID}?si=abc123`,
    `https://open.spotify.com/intl-es/playlist/${ID}?si=x`,
    `https://open.spotify.com/intl-pt-BR/playlist/${ID}/`,
    `spotify:playlist:${ID}`,
    ID,
    `  ${ID}  `,
  ]) assert.equal(parsePlaylistRef(ok), ID, ok);
  for (const bad of [
    '', null, undefined, 'hola', `http://open.spotify.com/playlist/${ID}`, `https://evil.example/playlist/${ID}`,
    `https://open.spotify.com/album/${ID}`, `spotify:track:${ID}`, `https://open.spotify.com/playlist/${ID}x`,
    `https://open.spotify.com.evil.example/playlist/${ID}`, ID.slice(1),
  ]) assert.equal(parsePlaylistRef(bad), null, String(bad));
});

test('organizePlaylists: propias primero, seguidas después y detecta copias propias', () => {
  const liked = { id: '__liked__', name: 'Tus me gusta', isLiked: true, readable: true };
  const list = [
    pl({ id: 'f1', name: 'Éxitos 2024', owner: 'otra' }),
    pl({ id: 'm1', name: 'Mi lista' }),
    pl({ id: 'c1', name: 'Colab', owner: 'otra', collab: true }),
    pl({ id: 'm2', name: '  éxitos 2024 ' }),
    pl({ id: 'f2', name: 'Top 50', owner: 'spotify' }),
  ];
  const out = organizePlaylists([liked, ...list]);
  assert.deepEqual(out.map((p) => p.id), ['__liked__', 'm1', 'c1', 'm2', 'f1', 'f2']);
  assert.equal(out.find((p) => p.id === 'm2').copyOf, 'Éxitos 2024');
  assert.equal(out.find((p) => p.id === 'm1').copyOf, undefined);
  assert.equal(out.find((p) => p.id === 'c1').copyOf, undefined, 'una colaborativa ajena no es una copia propia');
  assert.equal(out.find((p) => p.id === 'f1').hasCopy, '  éxitos 2024 ');
  assert.equal(out.find((p) => p.id === 'f2').hasCopy, undefined);
  assert.equal(out.find((p) => p.id === 'c1').readable, true);
  assert.equal(list[3].copyOf, undefined, 'no muta la entrada');
});
