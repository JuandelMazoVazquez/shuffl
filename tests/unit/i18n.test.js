import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.navigator ??= { language: 'es' };
globalThis.document ??= { documentElement: {} };
const { t, setLang } = await import('../../js/i18n.js');

const app = readFileSync(new URL('../../js/app.js', import.meta.url), 'utf8');
/** Claves literales t('…') y las de listas que se traducen con t(variable). */
const used = new Set([...app.matchAll(/\bt\('([A-Za-z0-9_-]+)'/g)].map((m) => m[1]));
for (const m of app.matchAll(/'([a-z][A-Za-z0-9]+)'\]/g)) if (/^(tab|range_|snap)/.test(m[1])) used.add(m[1]);
for (const m of app.matchAll(/phase\('([A-Za-z]+)'\)/g)) used.add(`phase_${m[1]}`);
for (const k of ['newName', 'exploreName', 'newDesc', 'exploreDesc', 'forgottenDesc', 'topDesc', 'readingAlbums', 'discoverReading', 'readingLibrary', 'srcMineNew', 'srcMineExplore', 'seedNoArtists', 'genreNoArtists', 'newNoArtists']) used.add(k);
// v1.3.2: claves que se montan con una variable (accesos rápidos, pasos de la prueba completa, acciones del contador).
for (const p of ['commute', 'gym', 'run', 'trip', 'sleep']) used.add(`preset_${p}`);
for (const s of ['login', 'read', 'scopes', 'track', 'create', 'overwrite', 'recognize', 'devices', 'play', 'delete']) used.add(`full_${s}`);
for (const s of ['premium', 'restricted', 'forbidden', 'shuffle', 'other']) used.add(`fullPlay_${s}`);
for (const a of ['shuffle', 'new', 'explore', 'play', 'reshuffle', 'remove', 'diag', 'fulltest']) used.add(`act_${a}`);
for (const k of ['errSession', 'errScope', 'err403', 'errForbidden', 'errPremiumPlayer', 'err404', 'errRate', 'errServer', 'errNetwork', 'errQuota', 'errIncomplete', 'errBug']) used.add(k);

for (const lang of ['es', 'en']) {
  test(`todas las claves de texto existen en ${lang}`, () => {
    setLang(lang);
    const missing = [...used].filter((k) => t(k) === k);
    assert.deepEqual(missing, []);
  });
}

test('los plurales eligen singular con 1 y plural con el resto', () => {
  setLang('es');
  assert.equal(t('moreThanYears', { n: '1' }), 'más de 1 año');
  assert.equal(t('moreThanYears', { n: '3' }), 'más de 3 años');
  setLang('en');
  assert.equal(t('purgeDone', { n: '1' }), '1 old Shuffl playlist removed.');
  assert.equal(t('purgeDone', { n: '2' }), '2 old Shuffl playlists removed.');
});
