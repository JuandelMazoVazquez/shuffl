// Piezas puras de la parte interactiva: detector de agitado, ruleta «Elige por mí» y la simulación de «¿Es aleatorio de verdad?».
import { shuffle, randomInt } from './core.js';

/**
 * Devuelve `feed(x, y, z, t)`, que recibe la aceleración (con gravedad) y el instante en ms y dice si hubo un agitado:
 * `hits` sacudidas por encima de `threshold` en menos de `windowMs`. Tras uno, calla `cooldownMs`.
 */
export function createShakeDetector({ threshold = 14, hits = 3, windowMs = 1000, cooldownMs = 3000 } = {}) {
  let last = null;
  let peaks = [];
  let quietUntil = -Infinity;
  return (x, y, z, t) => {
    if ([x, y, z, t].some((v) => typeof v !== 'number' || Number.isNaN(v))) return false;
    if (last && Math.abs(x - last.x) + Math.abs(y - last.y) + Math.abs(z - last.z) > threshold) peaks.push(t);
    last = { x, y, z };
    peaks = peaks.filter((p) => t - p <= windowMs);
    if (t < quietUntil || peaks.length < hits) return false;
    peaks = [];
    quietUntil = t + cooldownMs;
    return true;
  };
}

/** Elige un índice de 0 a n-1 con la misma probabilidad para todos. */
export function pickIndex(n, rand = randomInt) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n debe ser un entero >= 1');
  return rand(n);
}

/**
 * Índices que va mostrando la ruleta: `steps` pasos seguidos que acaban en `chosen` (dura lo mismo con 3 o con 300 playlists).
 * La animación es decorativa: el resultado ya está elegido antes de empezar.
 */
export function spinSequence(n, chosen, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => (((chosen - steps + i) % n) + n) % n);
}

/** Retraso de cada paso de la ruleta: rápido al principio y frenando al final (en ms). */
export const spinDelays = (steps, { min = 40, max = 320 } = {}) =>
  Array.from({ length: steps }, (_, i) => Math.round(min + (max - min) * (i / Math.max(steps - 1, 1)) ** 3));

/** El error clásico: intercambiar cada posición con cualquier otra (no con una de las restantes). Está sesgado. */
export function naiveShuffle(items, rand = randomInt) {
  const a = items.slice();
  for (let i = 0; i < a.length; i++) {
    const j = rand(a.length);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cuántas veces suena primero cada una de `n` canciones tras `runs` barajas (lo justo es runs / n para todas). */
export function firstSongHistogram(shuffleFn, n, runs, rand = randomInt) {
  const counts = new Array(n).fill(0);
  const items = Array.from({ length: n }, (_, i) => i);
  for (let r = 0; r < runs; r++) counts[shuffleFn(items, rand)[0]]++;
  return counts;
}

/** Mayor desviación respecto a lo esperado (runs / n), en tanto por uno. */
export function maxDeviation(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return Math.max(...counts.map((c) => Math.abs(c - expected) / expected));
}

export const fairShuffle = shuffle;
