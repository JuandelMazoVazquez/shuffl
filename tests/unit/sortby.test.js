import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTracksBy, MULTI_KEYS } from '../../js/core.js';

const t = (id, o = {}) => ({
  uri: `spotify:track:${id}`, name: `T${id}`, artists: ['A'], album: 'Alb', albumId: 'a1', releaseDate: '2000', releaseDatePrecision: 'year',
  discNumber: 1, trackNumber: 1, durationMs: 1000, addedAt: '2020-01-01T00:00:00Z', ...o,
});
const ids = (list) => list.map((x) => x.uri.split(':').pop()).join('');

test('artista → álbum cronológico → nº de pista', () => {
  const tracks = [
    t('1', { artists: ['Beta'], album: 'Segundo', albumId: 'b', releaseDate: '2010', trackNumber: 2 }),
    t('2', { artists: ['Alfa'], album: 'Nuevo', albumId: 'n', releaseDate: '2015', trackNumber: 1 }),
    t('3', { artists: ['Beta'], album: 'Primero', albumId: 'p', releaseDate: '2001', trackNumber: 5 }),
    t('4', { artists: ['Alfa'], album: 'Viejo', albumId: 'v', releaseDate: '1999', trackNumber: 3 }),
    t('5', { artists: ['Beta'], album: 'Segundo', albumId: 'b', releaseDate: '2010', trackNumber: 1 }),
  ];
  assert.equal(ids(sortTracksBy(tracks, ['artist', 'album-chrono', 'track-number'])), '42351');
});

test('el segundo criterio solo desempata dentro del primero y el tercero dentro del segundo', () => {
  const tracks = [t('1', { name: 'b', durationMs: 5 }), t('2', { name: 'a', durationMs: 5 }), t('3', { name: 'c', durationMs: 1 })];
  assert.equal(ids(sortTracksBy(tracks, ['duration-asc', 'title'])), '32' + '1');
  assert.equal(ids(sortTracksBy(tracks, ['duration-desc', 'title'])), '21' + '3');
});

test('es estable cuando todos los criterios empatan y no muta la entrada', () => {
  const tracks = [t('1'), t('2'), t('3')];
  const copy = JSON.stringify(tracks);
  assert.equal(ids(sortTracksBy(tracks, ['artist', 'album', 'title'].slice(0, 2))), '123');
  assert.equal(JSON.stringify(tracks), copy);
});

test('los datos que faltan van al final', () => {
  const tracks = [t('1', { releaseDate: '' }), t('2', { releaseDate: '1990' }), t('3', { releaseDate: '2005' })];
  assert.equal(ids(sortTracksBy(tracks, ['release-asc'])), '231');
  assert.equal(ids(sortTracksBy(tracks, ['release-desc'])), '321');
});

test('validación: entre 1 y 3 criterios, sin repetir y conocidos', () => {
  for (const bad of [[], ['artist', 'album', 'title', 'track-number'], ['artist', 'artist'], ['reverse'], ['nada'], 'artist']) {
    assert.throws(() => sortTracksBy([t('1')], bad), RangeError, JSON.stringify(bad));
  }
  assert.ok(MULTI_KEYS.includes('album-chrono') && MULTI_KEYS.includes('track-number'));
});

test('fecha de añadida ascendente y descendente', () => {
  const tracks = [t('1', { addedAt: '2022-01-01T00:00:00Z' }), t('2', { addedAt: '2020-01-01T00:00:00Z' }), t('3', { addedAt: '' })];
  assert.equal(ids(sortTracksBy(tracks, ['added-asc'])), '213');
  assert.equal(ids(sortTracksBy(tracks, ['added-desc'])), '123');
});
