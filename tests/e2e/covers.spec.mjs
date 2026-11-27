// Carátulas en todas partes (v1.3.2): cada fila de canción (o álbum o artista) lleva su carátula de 48 px, entera
// (object-fit: contain), en diferido y con un hueco del mismo tamaño mientras carga. Recorre todas las pantallas.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel } from './helpers.mjs';
import { makeTrack, albumImages } from './mock.mjs';

let state;
test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

/** Falla si alguna fila de `scope` no tiene su carátula https en un hueco de 48×48 sin recortar (tamaño de layout: la animación de reparto no cuenta). */
async function expectCovers(page, scope, label) {
  const rows = page.locator(`${scope} .track:visible, ${scope} .split-row:visible`);
  await expect(rows.first(), label).toBeVisible();
  const bad = await rows.evaluateAll((list) => list.map((row, i) => {
    const slot = row.querySelector('.cover-slot');
    const img = slot?.querySelector('img.track-cover');
    const ok = slot && img && img.getAttribute('src')?.startsWith('https://') && img.loading === 'lazy'
      && slot.offsetWidth === 48 && slot.offsetHeight === 48 && getComputedStyle(img).objectFit === 'contain';
    return ok ? null : `${i}: ${row.textContent.slice(0, 40)}`;
  }).filter(Boolean));
  expect(bad, `${label}: filas sin carátula`).toEqual([]);
}

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

test('todas las pantallas con canciones muestran la carátula de cada fila', async ({ page }) => {
  test.setTimeout(120000);
  // Novedades: lanzamientos recientes de los artistas seguidos, con sus imágenes.
  for (let i = 0; i < 6; i++) {
    const id = `art${i}`;
    state.releases[id] = [{ id: `rel_${id}`, name: `Disco ${id}`, album_type: 'album', release_date: day(3), release_date_precision: 'day', images: albumImages(`rel_${id}`) }];
    state.albumTracks[`rel_${id}`] = Array.from({ length: 6 }, (_, k) => {
      const tr = { ...makeTrack(8000 + i * 10 + k), album: { id: `rel_${id}`, name: `Disco ${id}`, images: albumImages(`rel_${id}`) }, track_number: k + 1 };
      state.catalog.set(tr.uri, tr);
      return tr;
    });
  }
  for (const list of Object.values(state.topArtists)) list.forEach((a) => { a.images = albumImages(a.id); });
  const rock = state.lists.get('pl_rock').tracks;
  state.liked = [...state.liked.slice(0, 20), rock[0]];
  await login(page);

  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-shuffle .result', 'Shuffle');

  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(page.locator('#panel-new #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-new .result', 'Novedades');

  await openPanel(page, 'explore');
  await page.locator('#explore-go').click();
  await expect(page.locator('#panel-explore #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-explore .result', 'Descubre');

  await openPanel(page, 'forgotten');
  await page.locator('#forgotten-go').click();
  await expect(page.locator('#panel-forgotten #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-forgotten .result', 'Olvidadas');

  await openPanel(page, 'snap');
  await page.locator('#snap-go').click();
  await expect(page.locator('#panel-snap #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-snap .result', 'Instantánea');

  await openPanel(page, 'summary');
  await page.locator('#summary-go').click();
  await expect(page.locator('#summary-out')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#summary-artists', 'Tu resumen: artistas');
  await expectCovers(page, '#summary-tracks', 'Tu resumen: canciones');
  await page.locator('#summary-playlist').click();
  await expect(page.locator('#panel-summary #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-summary .result', 'Mi top');

  await openPanel(page, 'dups');
  await pick(page, 'dups', 'Con repetidas');
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.locator('#panel-dups .result-title')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-dups .dup-list', 'Duplicados');

  await openPanel(page, 'sort');
  await pick(page, 'sort', 'Chill');
  await page.locator('#panel-sort .btn.primary.big').click();
  await expect(page.locator('#panel-sort .result-title')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-sort .result', 'Ordenar');

  await openPanel(page, 'orphans');
  await page.locator('#orphans-scan').click();
  await page.locator('#orphans-create').click();
  await expect(page.locator('#panel-orphans #result-meta')).toBeVisible();
  await idle(page);
  await expectCovers(page, '#panel-orphans .result', 'Me gusta sin playlist');

  await openPanel(page, 'split');
  await pick(page, 'split', 'Chill');
  await page.locator('#split-preview-btn').click();
  await expect(page.locator('#split-summary')).toBeVisible();
  await expectCovers(page, '#split-preview', 'Dividir');
});

test('sin imagen, o si la imagen falla, queda el hueco de 48 px con ♪ (nada salta)', async ({ page }) => {
  state.lists.get('pl_chill').tracks.forEach((t, i) => { t.album.images = i % 2 ? [] : [{ url: `https://i.scdn.co/image/roto-${i}`, width: 300 }]; });
  await page.route('https://i.scdn.co/image/roto-**', (route) => route.fulfill({ status: 404 }));
  await login(page);
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle #result-meta')).toBeVisible();
  await idle(page);
  const slots = page.locator('#panel-shuffle .result .cover-slot');
  await expect(slots).toHaveCount(30);
  await expect(page.locator('#panel-shuffle .result img.track-cover')).toHaveCount(0);
  const sizes = await slots.evaluateAll((list) => [...new Set(list.map((s) => `${s.offsetWidth}x${s.offsetHeight}`))]);
  expect(sizes).toEqual(['48x48']);
});
