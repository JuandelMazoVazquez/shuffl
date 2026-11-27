// Descubrir (v1.3.1): ~30 canciones por defecto, «Buscar más», número o duración, «Como mi playlist…», géneros,
// y nunca canciones que ya están en tus playlists o en Tus me gusta. Olvidadas y Tu resumen.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, openPanel, shot } from './helpers.mjs';
import { makeTrack } from './mock.mjs';

let state;
test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
/** Un lanzamiento reciente de 4 canciones para cada uno de los `n` primeros artistas seguidos. */
function seedReleases(n, { offset = 3, prefix = 'art' } = {}) {
  for (let i = 0; i < n; i++) {
    const id = `${prefix}${i}`;
    const album = `rel_${id}`;
    state.releases[id] = [{ id: album, name: `Disco ${id}`, album_type: 'album', release_date: day(offset), release_date_precision: 'day', images: [] }];
    state.albumTracks[album] = Array.from({ length: 4 }, (_, k) => {
      const tr = { ...makeTrack(7000 + i * 10 + k), album: { id: album, name: `Disco ${id}`, images: [] }, track_number: k + 1, duration_ms: 150000 + k * 20000 };
      state.catalog.set(tr.uri, tr);
      return tr;
    });
  }
}
const resultMeta = (page) => page.locator('#result-meta:visible');

test('Novedades: 30 canciones por defecto, «Buscar más» añade 30 a la misma playlist, y nada que ya tengas', async ({ page }) => {
  seedReleases(40);
  // Una de las novedades ya está en una playlist tuya: no puede salir.
  const owned = state.albumTracks.rel_art0[0];
  state.lists.get('pl_chill').tracks.push(owned);
  await login(page);
  await openPanel(page, 'new');
  await expect(page.locator('#new-source')).toContainText('Nunca canciones que ya tienes');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toContainText('30 canciones');
  await idle(page);
  await shot(page, 'docs/capturas/25-novedades.png');
  const [list] = byName('Novedades · Shuffl');
  expect(list.tracks).toHaveLength(30);
  expect(list.tracks.some((t) => t.uri === owned.uri)).toBe(false);
  const liked = new Set(state.liked.map((t) => t.uri));
  expect(list.tracks.some((t) => liked.has(t.uri))).toBe(false);
  expect(state.artistAlbumCalls.every((c) => Number(c.limit) <= 10)).toBe(true);
  await page.locator('#new-more-songs').click();
  await expect(resultMeta(page)).toContainText('60 canciones');
  await idle(page);
  expect(byName('Novedades · Shuffl')).toHaveLength(1);
  expect(list.tracks).toHaveLength(60);
  expect(new Set(list.tracks.map((t) => t.uri)).size).toBe(60);
});

test('Novedades por duración (60 min ± 2) desde «Más opciones»', async ({ page }) => {
  seedReleases(40);
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-more > summary').click();
  await page.locator('#new-bytime').check();
  await page.locator('label[for="new-minutes-60"]').click();
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  const ms = byName('Novedades · Shuffl')[0].tracks.reduce((n, t) => n + t.duration_ms, 0);
  expect(Math.abs(ms - 60 * 60000)).toBeLessThanOrEqual(2 * 60000);
});

test('Novedades «Como mi playlist…»: usa los artistas de la playlist elegida', async ({ page }) => {
  seedReleases(7, { prefix: 'artist' });
  await login(page);
  await openPanel(page, 'new');
  await page.locator('label[for="new-style-playlist"]').click();
  await expect(page.locator('#new-go')).toBeDisabled();
  await page.locator('#new-seed').selectOption({ label: 'Rock' });
  await expect(page.locator('#new-source')).toContainText('Canciones de los artistas de «Rock»');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  const albums = new Set(byName('Novedades · Shuffl')[0].tracks.map((t) => t.album.id));
  expect([...albums].every((a) => /^rel_artist\d$/.test(a))).toBe(true);
});

test('Novedades por género: chips de tus artistas y búsqueda de más artistas con /search (limit ≤ 10)', async ({ page }) => {
  state.topArtists.short_term[0].genres = ['trap latino'];
  state.genreArtists['trap latino'] = Array.from({ length: 12 }, (_, i) => ({ id: `gen${i}`, name: `Trapero ${i}`, genres: ['trap latino'] }));
  seedReleases(12, { prefix: 'gen' });
  await login(page);
  await openPanel(page, 'new');
  await expect(page.locator('label[for="new-style-genre"]')).toBeVisible();
  await page.locator('label[for="new-style-genre"]').click();
  await page.locator('#new-genre').selectOption('trap latino');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  expect(state.searchCalls.length).toBeGreaterThan(0);
  expect(state.searchCalls.every((c) => c.type === 'artist' && Number(c.limit) <= 10 && c.q === 'genre:"trap latino"')).toBe(true);
  // Tus artistas de ese género (art0, con «rel_new») y los que encuentra la búsqueda.
  const albums = new Set(byName('Novedades · Shuffl')[0].tracks.map((t) => t.album.id));
  expect([...albums].every((a) => /^rel_gen\d+$/.test(a) || a === 'rel_new')).toBe(true);
  expect([...albums].some((a) => /^rel_gen/.test(a))).toBe(true);
});

test('sin géneros en los artistas (Spotify los da vacíos) la opción no sale', async ({ page }) => {
  await login(page);
  await openPanel(page, 'new');
  await page.waitForTimeout(400);
  await expect(page.locator('label[for="new-style-genre"]')).toBeHidden();
});

test('Novedades sin artistas: estado vacío que dice qué hacer', async ({ page }) => {
  state.topArtists = { short_term: [], medium_term: [], long_term: [] };
  state.artists = [];
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(page.locator('#new-empty')).toContainText('No hay artistas de los que tirar');
  expect(byName('Novedades · Shuffl')).toHaveLength(0);
});

test('Descubre: canciones de los álbumes que escuchas, sin las que ya tienes ni las escuchadas', async ({ page }) => {
  await login(page);
  await openPanel(page, 'explore');
  await page.locator('#explore-go').click();
  await expect(resultMeta(page)).toContainText('30 canciones');
  await idle(page);
  const [list] = byName('Descubre · Shuffl');
  const listened = new Set([...state.recent, ...state.top.short_term].map((t) => t.uri));
  const owned = new Set([...state.liked, ...state.lists.get('pl_rock').tracks, ...state.lists.get('pl_chill').tracks].map((t) => t.uri));
  expect(list.tracks.some((t) => listened.has(t.uri) || owned.has(t.uri))).toBe(false);
});

test('el índice de tu biblioteca se guarda y no se vuelve a leer si las playlists no cambian', async ({ page }) => {
  seedReleases(10);
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  const reads = state.itemRequests.filter((id) => id === 'pl_rock').length;
  await page.locator('#panel-new .result').getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  expect(state.itemRequests.filter((id) => id === 'pl_rock').length).toBe(reads);
});

test('Olvidadas: Me gusta de hace más de 2 años; con 5 años, estado vacío', async ({ page }) => {
  await login(page);
  await openPanel(page, 'forgotten');
  await page.locator('#forgotten-go').click();
  await expect(resultMeta(page)).toContainText('60 canciones');
  await idle(page);
  await page.locator('#panel-forgotten .result').getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#forgotten-more > summary').click();
  await page.locator('label[for="forgotten-years-5"]').click();
  await page.locator('#forgotten-go').click();
  await expect(page.locator('#forgotten-empty')).toContainText('Nada olvidado todavía');
});

test('Tu resumen: tarjeta vertical y cuadrada, logo de Spotify y «Mi top · Shuffl»', async ({ page }) => {
  await login(page);
  await openPanel(page, 'summary');
  await page.locator('#summary-go').click();
  await expect(page.locator('#summary-preview')).toBeVisible();
  expect(await page.locator('#summary-preview').evaluate((img) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920]);
  await expect(page.locator('#summary-out .spotify-attrib')).toBeVisible();
  await shot(page, 'docs/capturas/26-tu-resumen.png');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#summary-share-square').click()]);
  expect(download.suggestedFilename()).toMatch(/^shuffl-resumen-cuadrado-\d{4}-\d{2}-\d{2}\.png$/);
  await page.locator('#summary-playlist').click();
  await idle(page);
  expect(byName('Mi top · Shuffl')[0].tracks).toHaveLength(30);
});

test('«Tal día como hoy» y «Por álbumes» ya no existen', async ({ page }) => {
  await login(page);
  await page.locator('#tab-discover').click();
  await expect(page.locator('#card-ago')).toHaveCount(0);
  await expect(page.locator('#panel-ago')).toHaveCount(0);
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#sh-kind-albums, #sh-saved-albums')).toHaveCount(0);
});

test('en inglés: Discover y Novedades traducidos', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shuffl.lang', JSON.stringify('en')));
  seedReleases(10);
  await login(page);
  await openPanel(page, 'new');
  await expect(page.locator('#new-source')).toContainText('Never songs you already have');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toContainText('songs');
  await idle(page);
  expect(byName('New releases · Shuffl')).toHaveLength(1);
});
