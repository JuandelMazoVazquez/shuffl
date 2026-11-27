// Cuota (v1.3.2): cuántas peticiones a la API hace cada acción con una cuenta de tamaño realista.
// La tabla de DECISIONES.md sale de aquí (se imprime al terminar). Ninguna acción normal pasa de 40.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel } from './helpers.mjs';
import { makeTrack } from './mock.mjs';

const MAX_PER_ACTION = 40;
const printTable = (rows) => console.log(`\n| Acción | Peticiones |\n|---|---|\n${rows.map(([l, n]) => `| ${l} | ${n} |`).join('\n')}\n`);
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

/** 16 playlists propias (una de 600), 1500 Me gusta, 50 artistas top por periodo y lanzamientos para 120 artistas. */
function realisticAccount(state) {
  const reg = (tr) => { state.catalog.set(tr.uri, tr); return tr; };
  const range = (from, n) => Array.from({ length: n }, (_, k) => reg(makeTrack(from + k)));
  state.lists.get('pl_rock').tracks = range(10000, 600);
  for (let i = 0; i < 15; i++) state.lists.set(`plx${i}`, { id: `plx${i}`, name: `Lista ${i}`, owner: { id: 'me', display_name: 'me' }, tracks: range(20000 + i * 200, 150) });
  state.liked = range(40000, 1500);
  const artist = (i) => ({ id: `art${i}`, name: `Seguido ${i}`, images: [], genres: [] });
  state.topArtists.short_term = Array.from({ length: 50 }, (_, i) => artist(i));
  state.topArtists.medium_term = Array.from({ length: 50 }, (_, i) => artist(i + 25));
  for (let i = 0; i < 120; i++) {
    const id = `art${i}`;
    const albums = [
      { id: `${id}_new`, name: `Nuevo ${id}`, album_type: 'album', release_date: day(5 + (i % 20)), release_date_precision: 'day', images: [] },
      { id: `${id}_single`, name: `Single ${id}`, album_type: 'single', release_date: day(12), release_date_precision: 'day', images: [] },
      { id: `${id}_old`, name: `Viejo ${id}`, album_type: 'album', release_date: day(900), release_date_precision: 'day', images: [] },
    ];
    state.releases[id] = albums;
    albums.forEach((al, k) => {
      state.albumTracks[al.id] = Array.from({ length: k === 1 ? 1 : 8 }, (_, n) => reg({ ...makeTrack(60000 + i * 30 + k * 10 + n), album: { id: al.id, name: al.name, images: [] }, track_number: n + 1 }));
    });
  }
}

test('peticiones por acción con una cuenta realista', async ({ page }) => {
  test.setTimeout(180000);
  const state = await installMock(page);
  realisticAccount(state);
  let count = 0;
  page.on('request', (req) => { if (req.url().startsWith('https://api.spotify.com/') && req.method() !== 'OPTIONS') count++; });
  const rows = [];
  const measure = async (label, fn) => {
    count = 0;
    await fn();
    await idle(page);
    await page.waitForTimeout(300);
    rows.push([label, count]);
  };

  await measure('Arranque (login y biblioteca)', async () => { await login(page); });
  await measure('Shuffle de una playlist de 600 (1.ª vez)', async () => {
    await pick(page, 'shuffle', 'Rock');
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#result-meta:visible')).toBeVisible();
  });
  await measure('Reproducir ahora', async () => {
    await page.locator('#play-now:visible').click();
    await expect(page.locator('.play-info:visible')).toContainText(/Reproduciendo|Sonando/);
  });
  await measure('Volver a barajar (misma playlist)', async () => {
    await page.locator('#reshuffle').click();
  });
  await measure('Shuffle de la misma playlist otra vez', async () => {
    await page.locator('#panel-shuffle .result').getByRole('button', { name: 'Volver', exact: true }).click();
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#result-meta:visible')).toBeVisible();
  });
  await measure('Novedades (1.ª vez)', async () => {
    await openPanel(page, 'new');
    await page.locator('#new-go').click();
    await expect(page.locator('#panel-new #result-meta')).toBeVisible();
  });
  await measure('Buscar más', async () => {
    await page.locator('#new-more-songs').click();
  });
  await measure('Descubre', async () => {
    await openPanel(page, 'explore');
    await page.locator('#explore-go').click();
    await expect(page.locator('#panel-explore #result-meta')).toBeVisible();
  });
  await measure('Instantánea (Top 4 semanas)', async () => {
    await openPanel(page, 'snap');
    await page.locator('#snap-go').click();
    await expect(page.locator('#panel-snap #result-meta')).toBeVisible();
  });
  await measure('Tu resumen', async () => {
    await openPanel(page, 'summary');
    await page.locator('#summary-go').click();
    await expect(page.locator('#summary-out')).toBeVisible();
  });
  await measure('Tu resumen → playlist', async () => {
    await page.locator('#summary-playlist').click();
    await expect(page.locator('#panel-summary #result-meta')).toBeVisible();
  });

  printTable(rows);
  for (const [label, n] of rows) expect.soft(n, label).toBeLessThanOrEqual(MAX_PER_ACTION);
});

test('peticiones en frío: Descubre, Olvidadas, Comprobar conexión y Prueba completa', async ({ page }) => {
  test.setTimeout(180000);
  const state = await installMock(page);
  realisticAccount(state);
  let count = 0;
  page.on('request', (req) => { if (req.url().startsWith('https://api.spotify.com/') && req.method() !== 'OPTIONS') count++; });
  const rows = [];
  const measure = async (label, fn) => {
    count = 0;
    await fn();
    await idle(page);
    await page.waitForTimeout(300);
    rows.push([label, count]);
  };
  await login(page);
  await measure('Descubre (1.ª vez, sin caché)', async () => {
    await openPanel(page, 'explore');
    await page.locator('#explore-go').click();
    await expect(page.locator('#panel-explore #result-meta')).toBeVisible();
  });
  await measure('Olvidadas (1.ª vez, 1500 Me gusta)', async () => {
    await openPanel(page, 'forgotten');
    await page.locator('#forgotten-go').click();
    await expect(page.locator('#panel-forgotten #result-meta')).toBeVisible();
  });
  await measure('Olvidadas (2.ª vez)', async () => {
    await page.locator('#panel-forgotten .result').getByRole('button', { name: 'Volver', exact: true }).click();
    await page.locator('#forgotten-go').click();
    await expect(page.locator('#panel-forgotten #result-meta')).toBeVisible();
  });
  await measure('Comprobar conexión', async () => {
    await openPanel(page, 'diag');
    await page.locator('#run-diag').click();
    await expect(page.locator('#diag-results li')).toHaveCount(4);
  });
  await measure('Prueba completa (con reproducción)', async () => {
    await page.locator('#full-test').click();
    await expect(page.locator('#full-results li')).toHaveCount(10);
  });
  printTable(rows);
  for (const [label, n] of rows) if (!label.startsWith('Olvidadas (1.ª')) expect.soft(n, label).toBeLessThanOrEqual(MAX_PER_ACTION);
});
