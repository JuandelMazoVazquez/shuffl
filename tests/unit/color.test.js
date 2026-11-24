import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dominantColor, rgbCss } from '../../js/color.js';

const px = (...rgba) => Uint8ClampedArray.from(rgba.flat());

test('dominantColor devuelve el color de una imagen lisa', () => {
  assert.deepEqual(dominantColor(px([200, 40, 40, 255], [200, 40, 40, 255])), [200, 40, 40]);
});

test('dominantColor ignora transparentes, casi negros y casi blancos', () => {
  const data = px([10, 10, 10, 255], [250, 250, 250, 255], [0, 200, 0, 0], [30, 90, 200, 255]);
  assert.deepEqual(dominantColor(data), [30, 90, 200]);
});

test('dominantColor prefiere el color saturado frente a los grises', () => {
  const data = px([120, 120, 120, 255], [120, 120, 120, 255], [120, 120, 120, 255], [230, 40, 60, 255]);
  const [r, g] = dominantColor(data);
  assert.ok(r > 150 && g < 100, `rojizo, no gris: ${r},${g}`);
});

test('dominantColor sin píxeles válidos devuelve null y rgbCss formatea', () => {
  assert.equal(dominantColor(px([0, 0, 0, 255], [255, 255, 255, 255])), null);
  assert.equal(dominantColor(new Uint8ClampedArray()), null);
  assert.equal(rgbCss([1, 2, 3]), 'rgb(1, 2, 3)');
});
