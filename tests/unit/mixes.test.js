import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMix, sanitizeMixes, upsertMix, removeMix, newMixId, mixSources, MAX_MIXES } from '../../js/mixes.js';
import { buildBackup, emptyFilters, filterTracks, hasFilters, sanitizeFilters, validateBackup } from '../../js/core.js';

const t = (o) => ({
  uri: `spotify:track:${o.id}`, releaseDate: '2000-05-01', releaseDatePrecision: 'day', addedAt: '2024-03-10T10:00:00Z',
  durationMs: 180000, explicit: false, ...o,
});

test('filterTracks sin filtros devuelve una copia y hasFilters lo sabe', () => {
  const tracks = [t({ id: 'a' })];
  assert.equal(hasFilters(emptyFilters()), false);
  const out = filterTracks(tracks, emptyFilters());
  assert.deepEqual(out, tracks);
  assert.notEqual(out, tracks);
});

test('filterTracks: años de lanzamiento, fecha de añadida, duración y explícitas', () => {
  const tracks = [
    t({ id: 'a', releaseDate: '1985', releaseDatePrecision: 'year', durationMs: 120000 }),
    t({ id: 'b', releaseDate: '1999-12-31', durationMs: 300000, explicit: true, addedAt: '2023-01-01T00:00:00Z' }),
    t({ id: 'c', releaseDate: '2010-06', releaseDatePrecision: 'month', durationMs: 200000, addedAt: '2025-02-02T00:00:00Z' }),
    t({ id: 'd', releaseDate: '', durationMs: 200000 }),
  ];
  const ids = (f) => filterTracks(tracks, { ...emptyFilters(), ...f }).map((x) => x.id).join('');
  assert.equal(ids({ yearFrom: '1990' }), 'bc');
  assert.equal(ids({ yearTo: '1999' }), 'ab');
  assert.equal(ids({ yearFrom: '1986', yearTo: '2000' }), 'b');
  assert.equal(ids({ addedFrom: '2024-01-01' }), 'acd');
  assert.equal(ids({ addedTo: '2023-12-31' }), 'b');
  assert.equal(ids({ minMin: '2.5' }), 'bcd');
  assert.equal(ids({ minMin: '4' }), 'b');
  assert.equal(ids({ maxMin: '2' }), 'a');
  assert.equal(ids({ explicit: 'only' }), 'b');
  assert.equal(ids({ explicit: 'none' }), 'acd');
  assert.equal(ids({ yearFrom: '1980', explicit: 'none', minMin: '4' }), '');
});

test('sanitizeFilters descarta valores con formato raro', () => {
  const f = sanitizeFilters({ yearFrom: '19x0', yearTo: '2001', addedFrom: '2024-1-1', addedTo: '2024-01-31', minMin: '3.5', maxMin: '-2', explicit: 'ja' });
  assert.deepEqual(f, { ...emptyFilters(), yearTo: '2001', addedTo: '2024-01-31', minMin: '3.5' });
  assert.deepEqual(sanitizeFilters(null), emptyFilters());
});

test('sanitizeMix valida y recorta', () => {
  const ok = sanitizeMix({ id: 'm1', name: '  Coche  ', ids: ['a', 'b'], names: ['A', 'B'], dedupe: false, mode: 'new', filters: { explicit: 'none' } });
  assert.deepEqual(ok, { id: 'm1', name: 'Coche', library: false, ids: ['a', 'b'], names: ['A', 'B'], filters: { ...emptyFilters(), explicit: 'none' }, dedupe: false, mode: 'new' });
  assert.equal(sanitizeMix({ id: 'm', name: 'x', ids: [] }), null, 'sin fuentes');
  assert.equal(sanitizeMix({ id: 'm', name: '', ids: ['a'] }), null, 'sin nombre');
  assert.equal(sanitizeMix('hola'), null);
  assert.equal(sanitizeMix({ id: 'm', name: 'Biblioteca', library: true, ids: [] }).library, true);
  const weird = sanitizeMix({ id: 'm', name: 'x'.repeat(200), ids: ['a', 5, {}, 'b'.repeat(100)], mode: 'raro' });
  assert.equal(weird.name.length, 60);
  assert.deepEqual(weird.ids, ['a']);
  assert.equal(weird.mode, 'reuse');
  assert.equal(weird.dedupe, true);
});

test('sanitizeMixes quita repetidas y respeta el tope', () => {
  const raw = Array.from({ length: MAX_MIXES + 10 }, (_, i) => ({ id: `m${i}`, name: `n${i}`, ids: ['a'] }));
  assert.equal(sanitizeMixes([...raw, raw[0]]).length, MAX_MIXES);
  assert.equal(sanitizeMixes('x').length, 0);
  assert.equal(sanitizeMixes([raw[0], { ...raw[0], name: 'otra' }]).length, 1);
});

test('upsertMix y removeMix no mutan y respetan el tope', () => {
  const a = sanitizeMix({ id: 'a', name: 'A', ids: ['x'] });
  const r1 = upsertMix([], a);
  assert.equal(r1.list.length, 1);
  const r2 = upsertMix(r1.list, { ...a, name: 'A2' });
  assert.equal(r2.list[0].name, 'A2');
  assert.equal(r1.list[0].name, 'A');
  const full = Array.from({ length: MAX_MIXES }, (_, i) => sanitizeMix({ id: `m${i}`, name: 'n', ids: ['x'] }));
  assert.equal(upsertMix(full, a).ok, false);
  assert.equal(removeMix(full, 'm3').length, MAX_MIXES - 1);
  assert.notEqual(newMixId(), newMixId());
  assert.equal(mixSources(a, 'Biblioteca'), '');
  assert.equal(mixSources({ ...a, library: true }, 'Biblioteca'), 'Biblioteca');
});

test('las mezclas viajan en la copia de seguridad y el archivo sigue siendo válido', () => {
  const mix = sanitizeMix({ id: 'a', name: 'A', ids: ['x'] });
  const backup = buildBackup([], new Date('2026-01-01T00:00:00Z'), { mixes: [mix] });
  assert.deepEqual(sanitizeMixes(JSON.parse(JSON.stringify(backup)).mixes), [mix]);
  assert.deepEqual(validateBackup(backup), []);
});
