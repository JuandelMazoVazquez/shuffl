import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../css/styles.css', import.meta.url), 'utf8');

/** Variables --nombre: #hex del primer bloque cuyo selector contiene `selector`. */
function tokens(selector) {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const themes = { oscuro: tokens(':root {'), claro: tokens(':root[data-theme="light"]') };
const pairs = [['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['accent', 'bg'], ['accent', 'surface'], ['on-accent', 'accent'], ['danger', 'bg'], ['text', 'surface-2']];

for (const [name, t] of Object.entries(themes)) {
  test(`contraste AA (4,5:1) en el tema ${name}`, () => {
    for (const [fg, bgName] of pairs) {
      assert.ok(t[fg] && t[bgName], `faltan --${fg} o --${bgName}`);
      assert.ok(ratio(t[fg], t[bgName]) >= 4.5, `--${fg} sobre --${bgName}: ${ratio(t[fg], t[bgName]).toFixed(2)}`);
    }
  });
}

test('la paleta oscura usa los colores de la marca', () => {
  assert.equal(themes.oscuro.bg.toLowerCase(), '#0f0e17');
  assert.equal(themes.oscuro.surface.toLowerCase(), '#1a1927');
  assert.equal(themes.oscuro.accent.toLowerCase(), '#ff5a4e');
  assert.equal(themes.oscuro['accent-2'].toLowerCase(), '#ffb627');
  assert.equal(themes.oscuro.text.toLowerCase(), '#fff3e3');
});
