import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeUnderLimit, coverColor, MAX_IMAGE_B64 } from '../../js/cover.js';

test('encodeUnderLimit baja la calidad hasta que cabe', () => {
  const tried = [];
  const out = encodeUnderLimit((q) => { tried.push(q); return 'x'.repeat(Math.round(q * 1000)); }, 650);
  assert.deepEqual(tried, [0.9, 0.8, 0.7, 0.6]);
  assert.equal(out.length, 600);
});

test('encodeUnderLimit falla si ni con la calidad mínima cabe', () => {
  assert.throws(() => encodeUnderLimit(() => 'x'.repeat(2000), 1000), /imageTooBig/);
  assert.ok(MAX_IMAGE_B64 === 262144);
});

test('el color de fondo es de la paleta y cambia cada día', () => {
  const palette = ['#FF5A4E', '#FFB627', '#FFF3E3'];
  const seen = new Set();
  for (let d = 0; d < 6; d++) {
    const c = coverColor(new Date(Date.UTC(2026, 0, 1 + d, 15)));
    assert.ok(palette.includes(c));
    seen.add(c);
  }
  assert.equal(seen.size, 3);
  assert.equal(coverColor(new Date(Date.UTC(2026, 0, 1, 1))), coverColor(new Date(Date.UTC(2026, 0, 1, 23))));
});
