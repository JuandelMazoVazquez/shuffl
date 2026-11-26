import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeUnderLimit, fitText, COVER_COLORS, MAX_IMAGE_B64 } from '../../js/cover.js';

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

test('la portada usa la paleta de Shuffl', () => {
  assert.deepEqual(COVER_COLORS, { bg: '#0B0B0B', title: '#C6FF3D', label: '#A3A3A3' });
});

const mono = (text, size) => [...text].length * size * 0.6;

test('fitText reduce la letra hasta que el nombre cabe', () => {
  assert.deepEqual(fitText(mono, 'Rock', 560), { size: 64, text: 'Rock' });
  const mid = fitText(mono, 'x'.repeat(20), 560);
  assert.ok(mid.size < 64 && mono(mid.text, mid.size) <= 560);
  assert.equal(mid.text, 'x'.repeat(20));
});

test('fitText recorta con «…» si ni con la letra mínima cabe', () => {
  const out = fitText(mono, 'Una playlist con un nombre larguísimo de verdad que no cabe', 560);
  assert.equal(out.size, 28);
  assert.ok(out.text.endsWith('…'));
  assert.ok(mono(out.text, out.size) <= 560);
  assert.ok(out.text.startsWith('Una playlist'));
});
