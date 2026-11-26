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
for (const k of ['kind_songs', 'kind_time', 'kind_albums', 'kindHint_songs', 'kindHint_time', 'kindHint_albums', 'newName', 'newDesc', 'exploreDesc', 'agoDesc', 'forgottenDesc', 'topDesc', 'readingAlbums', 'discoverReading']) used.add(k);

for (const lang of ['es', 'en']) {
  test(`todas las claves de texto existen en ${lang}`, () => {
    setLang(lang);
    const missing = [...used].filter((k) => t(k) === k);
    assert.deepEqual(missing, []);
  });
}

test('los plurales eligen singular con 1 y plural con el resto', () => {
  setLang('es');
  assert.equal(t('yearsAgo', { n: '1' }), 'Hace 1 año');
  assert.equal(t('yearsAgo', { n: '3' }), 'Hace 3 años');
  setLang('en');
  assert.equal(t('cleanRemoved', { n: '1' }), '1 repeated copy removed.');
  assert.equal(t('cleanRemoved', { n: '2' }), '2 repeated copies removed.');
});
