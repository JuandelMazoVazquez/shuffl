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

test('el logo es la opción B (naipes lima sobre negro) y no se parece al de Spotify', () => {
  for (const name of ['icon.svg', 'favicon.svg']) {
    const svg = file(name).toString('utf8');
    const colors = new Set([...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase()));
    assert.deepEqual([...colors].sort(), ['#0B0B0B', '#C6FF3D']);
    for (const c of colors) {
      const h = hue(c);
      assert.ok(h === null || h < 90 || h > 170, `${c} se parece al verde de Spotify (${h})`);
    }
    assert.match(svg, /<rect width="512" height="512" fill="#0B0B0B"\/>/, 'fondo negro a sangre');
    assert.doesNotMatch(svg, /<(circle|ellipse)\b/);
    for (const d of svg.matchAll(/\bd="([^"]*)"/g)) assert.doesNotMatch(d[1], /[ACQSTacqst]/, 'sin curvas ni arcos');
    const cards = [...svg.matchAll(/<rect\b[^>]*width="180"[^>]*height="250"[^>]*rotate\((-?\d+)[^>]*>/g)];
    assert.deepEqual(cards.map((m) => m[1]), ['-18', '18', '0']);
    assert.equal(cards.filter((m) => /fill="#0B0B0B" stroke="#C6FF3D"/.test(m[0])).length, 2, 'dos naipes de contorno');
    assert.match(cards[2][0], /fill="#C6FF3D"/, 'el delantero relleno de lima');
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
