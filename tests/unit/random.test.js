import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from '../../js/core.js';
import {
  createShakeDetector, pickIndex, spinSequence, spinDelays, naiveShuffle, fairShuffle, firstSongHistogram, maxDeviation,
} from '../../js/random.js';

/** mulberry32 con la forma de crypto.getRandomValues: estadística reproducible. */
function seeded(seed) {
  let a = seed >>> 0;
  return (buf) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    buf[0] = (t ^ (t >>> 14)) >>> 0;
  };
}
const rnd = (seed) => { const g = seeded(seed); return (n) => randomInt(n, g); };

test('agitado: tres sacudidas en un segundo disparan; luego calla el tiempo de espera', () => {
  const feed = createShakeDetector();
  const shake = (t0) => [0, 20, 0, 20, 0, 20].map((x, i) => feed(x, 0, 9.8, t0 + i * 100));
  assert.deepEqual(shake(0), [false, false, false, true, false, false]);
  assert.ok(!shake(1000).includes(true), 'en el tiempo de espera no vuelve a disparar');
  assert.ok(shake(5000).includes(true));
});

test('agitado: moverse suave, sacudidas espaciadas o datos nulos no disparan', () => {
  const feed = createShakeDetector();
  for (let i = 0; i < 50; i++) assert.equal(feed(Math.sin(i) * 2, 0, 9.8, i * 50), false);
  const slow = createShakeDetector();
  assert.ok(![0, 20, 0, 20, 0, 20].map((x, i) => slow(x, 0, 9.8, i * 900)).includes(true));
  const nulls = createShakeDetector();
  assert.ok(![null, 20, null, 20].map((x, i) => nulls(x, 0, 9.8, i * 50)).includes(true));
});

test('la ruleta elige uniforme (chi-cuadrado, semilla fija)', () => {
  const r = rnd(7);
  const n = 7, N = 70000, counts = new Array(n).fill(0);
  for (let i = 0; i < N; i++) counts[pickIndex(n, r)]++;
  const chi = counts.reduce((s, c) => s + (c - N / n) ** 2 / (N / n), 0);
  assert.ok(chi < 22.46, `chi² ${chi.toFixed(2)} (p=0.001 con 6 g.l.)`);
  assert.throws(() => pickIndex(0), RangeError);
});

test('la ruleta termina siempre en la elegida tras las vueltas', () => {
  for (const [n, chosen] of [[5, 0], [5, 3], [300, 299], [300, 2], [1, 0]]) {
    const seq = spinSequence(n, chosen);
    assert.equal(seq.at(-1), chosen);
    assert.equal(seq.length, 25);
    assert.ok(seq.every((i) => Number.isInteger(i) && i >= 0 && i < n));
    assert.ok(seq.every((x, i) => i === 0 || x === (seq[i - 1] + 1) % n), 'avanza de una en una');
  }
  const d = spinDelays(20);
  assert.equal(d.length, 20);
  assert.ok(d.every((x, i) => i === 0 || x >= d[i - 1]), 'frena, nunca acelera');
  assert.equal(d[0], 40);
  assert.equal(d.at(-1), 320);
});

test('la prueba: el barajado de Shuffl sale plano y el sesgado no', () => {
  const runs = 20000, n = 10;
  const fair = firstSongHistogram(fairShuffle, n, runs, rnd(1));
  const biased = firstSongHistogram(naiveShuffle, n, runs, rnd(1));
  assert.equal(fair.reduce((a, b) => a + b), runs);
  assert.ok(maxDeviation(fair) < 0.06, `Shuffl ${maxDeviation(fair)}`);
  assert.ok(maxDeviation(biased) > 0.2, `sesgado ${maxDeviation(biased)}`);
  assert.equal(maxDeviation([10, 10, 10]), 0);
  assert.equal(maxDeviation([5, 15]), 0.5);
});
