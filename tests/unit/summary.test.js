import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryLayout, containRect, FORMATS, SPOTIFY_LOGO_RATIO } from '../../js/summary.js';

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const imgBox = (r) => ({ x: r.img.x, y: r.img.y, w: r.img.s, h: r.img.s });

for (const format of Object.keys(FORMATS)) {
  test(`tarjeta ${format}: tamaño, carátulas cuadradas sin texto encima y dentro del lienzo`, () => {
    const L = summaryLayout(format);
    assert.deepEqual([L.w, L.h], [FORMATS[format].w, FORMATS[format].h]);
    assert.equal(L.rows.length, 10);
    const images = L.rows.map(imgBox);
    const texts = [...L.rows.map((r) => r.text), { x: L.title.x, y: L.title.y - L.title.size, w: L.title.w, h: L.title.size }];
    const brand = { x: L.brand.x, y: L.brand.y, w: L.brand.s, h: L.brand.s };
    assert.ok(!overlaps(brand, texts.at(-1)), 'el icono pisa el título');
    for (const im of images) {
      assert.ok(im.x >= 0 && im.y >= 0 && im.x + im.w <= L.w && im.y + im.h <= L.h, 'carátula fuera');
      for (const tx of texts) assert.ok(!overlaps(im, tx), 'texto sobre una carátula');
      for (const other of images) if (other !== im) assert.ok(!overlaps(im, other), 'carátulas solapadas');
    }
  });

  test(`tarjeta ${format}: logo de Spotify con su proporción, tamaño mínimo y zona de seguridad`, () => {
    const L = summaryLayout(format);
    assert.ok(L.logo.w >= 70);
    assert.ok(Math.abs(L.logo.w / L.logo.h - SPOTIFY_LOGO_RATIO) < 1e-9, 'logo deformado');
    const safe = L.logo.h / 2;
    const zone = { x: L.logo.x - safe, y: L.logo.y - safe, w: L.logo.w + safe * 2, h: L.logo.h + safe * 2 };
    assert.ok(zone.x >= 0 && zone.y >= 0 && zone.x + zone.w <= L.w && zone.y + zone.h <= L.h, 'zona de seguridad fuera del lienzo');
    for (const r of L.rows) assert.ok(!overlaps(zone, imgBox(r)) && !overlaps(zone, r.text), 'algo dentro de la zona de seguridad');
  });
}

test('con menos de 5 artistas la tarjeta vertical no deja hueco antes de las canciones', () => {
  const L = summaryLayout('story', { artists: 2, tracks: 5 });
  assert.equal(L.rows.filter((r) => r.kind === 'artists').length, 2);
  const lastArtist = L.rows.filter((r) => r.kind === 'artists').at(-1);
  assert.ok(L.heads[1].y - (lastArtist.img.y + lastArtist.img.s) <= 40);
  assert.equal(summaryLayout('story', { artists: 0, tracks: 0 }).rows.length, 2, 'al menos un hueco por sección');
});

test('containRect encaja la imagen entera sin deformarla ni recortarla', () => {
  const slot = { x: 10, y: 20, s: 100 };
  assert.deepEqual(containRect(slot, 640, 640), { x: 10, y: 20, w: 100, h: 100 });
  const wide = containRect(slot, 200, 100);
  assert.deepEqual(wide, { x: 10, y: 45, w: 100, h: 50 });
  assert.ok(Math.abs(wide.w / wide.h - 2) < 1e-9);
  assert.equal(containRect(slot, 0, 100), null);
});
