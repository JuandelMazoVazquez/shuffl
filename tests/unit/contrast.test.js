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

test('las paletas usan los colores de la marca Shuffl', () => {
  const o = themes.oscuro;
  assert.deepEqual([o.bg, o.surface, o['surface-2'], o.accent, o.text, o.muted].map((c) => c.toLowerCase()),
    ['#0b0b0b', '#161616', '#1f1f1f', '#c6ff3d', '#f5f5f5', '#a3a3a3']);
  const c = themes.claro;
  assert.deepEqual([c.bg, c.surface, c.accent, c.lime].map((x) => x.toLowerCase()), ['#ffffff', '#f4f6f0', '#3d6b00', '#c6ff3d']);
  assert.ok(ratio(c.accent, '#ffffff') >= 4.5, 'verde oscuro AA sobre blanco');
});

test('el texto sobre la lima (botón principal, tarjeta destacada) cumple AA en los dos temas', () => {
  for (const t of Object.values(themes)) assert.ok(ratio(t['on-lime'], t.lime) >= 4.5);
});

test('ningún color de la paleta es el verde de Spotify ni se le parece', () => {
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b); const d = max - Math.min(r, g, b);
    if (d === 0) return null;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  for (const hex of css.match(/#[0-9a-fA-F]{6}\b/g)) {
    assert.ok(!['#1db954', '#1ed760'].includes(hex.toLowerCase()), hex);
    const h = hue(hex);
    assert.ok(h === null || h < 100 || h > 170, `${hex} tiene matiz ${h?.toFixed(0)}, demasiado cerca del de Spotify`);
  }
});
