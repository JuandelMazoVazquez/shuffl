import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (name) => readFileSync(new URL(`../../icons/${name}`, import.meta.url));

function hue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

test('el logo respeta las reglas de marca: sin verde, sin círculos ni arcos', () => {
  for (const name of ['icon.svg', 'favicon.svg']) {
    const svg = file(name).toString('utf8');
    const colors = [...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase());
    assert.ok(colors.length >= 4, 'tiene la paleta');
    assert.ok(colors.includes('#2E2A6B') && colors.includes('#FFB627') && colors.includes('#FF5A4E') && colors.includes('#FFF3E3'));
    for (const c of colors) {
      assert.notEqual(c, '#1DB954');
      assert.notEqual(c, '#1ED760');
      const h = hue(c);
      assert.ok(h === null || h < 90 || h > 160, `${c} tiene un matiz verde (${h})`);
    }
    assert.doesNotMatch(svg, /<(circle|ellipse)\b/);
    for (const d of svg.matchAll(/\bd="([^"]*)"/g)) assert.doesNotMatch(d[1], /[ACQSTacqst]/, 'sin curvas ni arcos');
    assert.equal((svg.match(/<rect\b[^>]*width="180"[^>]*height="250"/g) ?? []).length, 3);
  }
});

test('los PNG tienen el tamaño pedido y los opacos no llevan canal alfa', () => {
  const dims = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };
  for (const [name, size] of Object.entries(dims)) {
    const png = file(name);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size, `${name} ancho`);
    assert.equal(png.readUInt32BE(20), size, `${name} alto`);
  }
  assert.notEqual(file('apple-touch-icon.png')[25], 6, 'apple-touch-icon opaco (sin RGBA)');
});

test('favicon.ico contiene 16, 32 y 48', () => {
  const ico = file('favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  const n = ico.readUInt16LE(4);
  assert.equal(n, 3);
  const sizes = Array.from({ length: n }, (_, i) => ico.readUInt8(6 + 16 * i));
  assert.deepEqual(sizes, [16, 32, 48]);
});
