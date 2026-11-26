import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

test('todos los módulos de js/ están en la caché del service worker (si no, la app no arranca sin conexión)', () => {
  const shell = sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];', sw.indexOf('const SHELL')));
  for (const f of readdirSync(new URL('../../js/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
    assert.ok(shell.includes(`'js/${f}'`), `falta js/${f} en SHELL`);
  }
});
