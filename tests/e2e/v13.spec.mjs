// v1.3: una sola «· Shuffle» por origen en cualquier dispositivo, limpieza de copias, Shuffle por tiempo y por álbumes,
// Descubrir (Novedades, Descubre), recuerdos (Tal día como hoy, Olvidadas) y Tu resumen.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { installMock, login, idle, pick, openPanel, shot } from './helpers.mjs';

let state;
test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const tag = (key) => createHash('sha256').update(`shuffl:${key}`).digest('hex').slice(0, 10);
const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const DESC_ROCK = 'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Rock';
/** Playlist ya existente en la cuenta (de otro dispositivo o de antes), con canciones escritas en `writtenAt`. */
function addList(id, name, description, { writtenAt = '2026-01-01T10:00:00Z', owner = 'me' } = {}) {
  state.lists.set(id, { id, name, description, owner: { id: owner, display_name: owner }, tracks: [...state.lists.get('pl_chill').tracks.slice(0, 3)], writtenAt });
}
async function shuffleRock(page) {
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
}
const done = (page, panel = 'shuffle') => expect(page.locator(`#panel-${panel} .result-title`)).toBeVisible();

test('navegación: 4 pestañas, Inicio con la acción enorme y «volver» a la pestaña', async ({ page }) => {
  await login(page);
  await expect(page.locator('nav.tabs button')).toHaveText(['Inicio', 'Shuffle', 'Descubrir', 'Más']);
  await page.locator('#tab-home').click();
  await expect(page.locator('#hero-start')).toContainText('Elige qué barajar');
  await expect(page.locator('#mixes-empty')).toBeVisible();
  await page.locator('#hero-start').click();
  await expect(page.locator('#panel-shuffle')).toBeVisible();
  await expect(page.locator('#tab-shuffle')).toHaveAttribute('aria-current', 'page');
  await page.locator('#tab-discover').click();
  await shot(page, 'docs/capturas/21-descubrir.png');
  await page.locator('#tab-more').click();
  await shot(page, 'docs/capturas/22-mas.png');
  await openPanel(page, 'sort');
  await expect(page.locator('#tab-more')).toHaveAttribute('aria-current', 'page');
  await page.locator('#panel-sort .back-link').click();
  await expect(page.locator('#panel-more')).toBeVisible();
  await openPanel(page, 'new');
  await expect(page.locator('#panel-new .back-link')).toContainText('Descubrir');
  await expect(page.locator('#new-more')).not.toHaveAttribute('open', '');
});

test('reutiliza la «· Shuffle» entre dispositivos: con la caché local vacía la encuentra por su etiqueta', async ({ page }) => {
  await login(page);
  await shuffleRock(page);
  await done(page);
  await idle(page);
  const [rock] = byName('Rock · Shuffle');
  expect(rock.description).toBe(`${DESC_ROCK} · shuffl:src=${tag('pl:pl_rock')}`);
  // «Otro dispositivo»: sin correspondencia guardada.
  await page.evaluate(() => localStorage.removeItem('baraja.targets'));
  await page.reload();
  await shuffleRock(page);
  await done(page);
  await idle(page);
  expect(byName('Rock · Shuffle')).toHaveLength(1);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('baraja.targets')))).toEqual({ 'pl:pl_rock': rock.id });
});

test('tres copias: pide confirmación, deja la más reciente y quita las demás con DELETE /me/library', async ({ page }) => {
  const t = tag('pl:pl_rock');
  addList('dupA', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-03-01T10:00:00Z' });
  addList('dupB', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-09-01T10:00:00Z' });
  addList('dupC', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2025-01-01T10:00:00Z' });
  addList('renamed', 'Mi Rock de siempre', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-10-01T10:00:00Z' });
  await login(page);
  await shuffleRock(page);
  await expect(page.locator('#clean-sheet')).toContainText('Hemos encontrado 3 copias de «Rock · Shuffle». ¿Dejamos solo una?');
  await expect(page.locator('#clean-sheet')).toContainText('90 días');
  await shot(page, 'docs/capturas/23-copias-repetidas.png');
  await page.locator('#clean-ok').click();
  await done(page);
  await idle(page);
  expect(state.unfollowCalls).toEqual([['spotify:playlist:dupA', 'spotify:playlist:dupC']]);
  expect([...state.lists.keys()]).toContain('dupB');
  expect(state.writes.find((w) => w.op === 'put').id).toBe('dupB');
  expect(state.lists.get('renamed').name).toBe('Mi Rock de siempre');
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(0);
  await expect(page.locator('#panel-shuffle .note', { hasText: 'Se han quitado 2 copias repetidas.' })).toBeVisible();
});

test('«Ahora no» no borra nada y «siempre» activa la limpieza automática', async ({ page }) => {
  const t = tag('pl:pl_rock');
  addList('dupA', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-03-01T10:00:00Z' });
  addList('dupB', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-09-01T10:00:00Z' });
  await login(page);
  await shuffleRock(page);
  await page.locator('#clean-no').click();
  await done(page);
  await idle(page);
  expect(state.unfollowCalls).toEqual([]);
  expect(state.lists.has('dupA')).toBe(true);

  await page.reload();
  await expect(page.locator('#clean-notice')).toContainText('copias repetidas');
  await page.locator('#clean-notice').getByRole('button', { name: 'Revisar' }).click();
  await page.locator('#clean-always').check();
  await page.locator('#clean-ok').click();
  await expect.poll(() => state.unfollowCalls.length).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('baraja.autoClean'))).toBe('true');

  addList('dupC', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2020-01-01T10:00:00Z' });
  await shuffleRock(page);
  await done(page);
  await idle(page);
  await expect(page.locator('#clean-sheet')).toHaveCount(0);
  expect(state.unfollowCalls.at(-1)).toEqual(['spotify:playlist:dupC']);
});

test('marcar «siempre» y cancelar no activa la limpieza automática', async ({ page }) => {
  const t = tag('pl:pl_rock');
  addList('dupA', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-03-01T10:00:00Z' });
  addList('dupB', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-09-01T10:00:00Z' });
  await login(page);
  await shuffleRock(page);
  await page.locator('#clean-always').check();
  await page.locator('#clean-no').click();
  await done(page);
  await idle(page);
  expect(await page.evaluate(() => localStorage.getItem('baraja.autoClean'))).toBeNull();
  expect(state.unfollowCalls).toEqual([]);
});

test('si una copia cambia entre el aviso y «Revisar» (renombrada o con otra dueña) no se quita', async ({ page }) => {
  const t = tag('pl:pl_rock');
  addList('dupA', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-03-01T10:00:00Z' });
  addList('dupB', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-09-01T10:00:00Z' });
  await login(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#clean-notice')).toBeVisible();
  state.lists.get('dupA').name = 'Rock para el coche';
  await page.locator('#clean-notice').getByRole('button', { name: 'Revisar' }).click();
  await page.locator('#clean-ok').click();
  await page.waitForTimeout(500);
  expect(state.unfollowCalls).toEqual([]);
  expect(state.lists.has('dupA')).toBe(true);
});

test('si otra pestaña escribe en otra copia antes de «Revisar», la que se iba a quitar ahora es la buena y se salta', async ({ page }) => {
  const t = tag('pl:pl_rock');
  addList('dupA', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-03-01T10:00:00Z' });
  addList('dupB', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-09-01T10:00:00Z' });
  await login(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#clean-notice')).toBeVisible();
  state.lists.get('dupA').writtenAt = '2026-11-20T10:00:00Z';
  await page.locator('#clean-notice').getByRole('button', { name: 'Revisar' }).click();
  await page.locator('#clean-ok').click();
  await page.waitForTimeout(500);
  expect(state.unfollowCalls).toEqual([]);
});

test('copias v1.2 sin etiqueta: solo con confirmación y sin marcar por defecto; nunca en automático', async ({ page }) => {
  addList('old1', 'Rock · Shuffle', DESC_ROCK, { writtenAt: '2025-03-01T10:00:00Z' });
  addList('old2', 'Rock · Shuffle', DESC_ROCK, { writtenAt: '2025-09-01T10:00:00Z' });
  await page.addInitScript(() => localStorage.setItem('baraja.autoClean', 'true'));
  await login(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#clean-notice')).toBeVisible();
  expect(state.unfollowCalls).toEqual([]);
  await page.locator('#clean-notice').getByRole('button', { name: 'Revisar' }).click();
  const box = page.locator('#clean-sheet input[data-group]');
  await expect(box).not.toBeChecked();
  await expect(page.locator('#clean-sheet')).toContainText('sin etiqueta');
  await box.check();
  await page.locator('#clean-ok').click();
  await expect.poll(() => state.unfollowCalls).toEqual([['spotify:playlist:old1']]);
  // Barajar Rock con dos v1.2 iguales no adivina cuál es: crea una nueva con etiqueta.
});

test('barajar no reutiliza nunca un origen aunque tenga la etiqueta (por tiempo desde «35 min · Shuffle»)', async ({ page }) => {
  addList('src35', '35 min · Shuffle', `x · shuffl:src=${tag('time:35')}`);
  await login(page);
  await page.locator('label[for="sh-kind-time"]').click();
  await page.locator('label[for="sh-minutes-custom"]').click();
  await pick(page, 'shuffle', '35 min · Shuffle');
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await done(page);
  await idle(page);
  expect(state.writes.some((w) => w.id === 'src35')).toBe(false);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(1);
  expect(state.unfollowCalls).toEqual([]);
});

test('si quitar falla no se pierde nada: la baraja está escrita y se avisa', async ({ page }) => {
  const t = tag('pl:pl_rock');
  addList('dupA', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-03-01T10:00:00Z' });
  addList('dupB', 'Rock · Shuffle', `${DESC_ROCK} · shuffl:src=${t}`, { writtenAt: '2026-09-01T10:00:00Z' });
  state.failUnfollow = true;
  await login(page);
  await shuffleRock(page);
  await page.locator('#clean-ok').click();
  await done(page);
  await idle(page);
  await expect(page.locator('#panel-shuffle .note', { hasText: 'No se pudieron quitar las copias repetidas' })).toBeVisible();
  expect(state.lists.has('dupA') && state.lists.has('dupB')).toBe(true);
  expect(state.lists.get('dupB').tracks).toHaveLength(120);
});

test('una «· Shuffle» de la v1.2 sin etiqueta se reutiliza y se etiqueta', async ({ page }) => {
  addList('old12', 'Rock · Shuffle', DESC_ROCK);
  await login(page);
  await shuffleRock(page);
  await done(page);
  await idle(page);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(0);
  expect(state.lists.get('old12').description).toBe(`${DESC_ROCK} · shuffl:src=${tag('pl:pl_rock')}`);
});

test('la antigua «🔀 Baraja» se ofrece quitar solo con confirmación (nunca en automático)', async ({ page }) => {
  addList('legacy', '🔀 Baraja', '');
  await page.addInitScript(() => localStorage.setItem('baraja.autoClean', 'true'));
  await login(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#clean-notice')).toContainText('«🔀 Baraja»');
  expect(state.unfollowCalls).toEqual([]);
  await page.locator('#clean-notice').getByRole('button', { name: 'Revisar' }).click();
  await expect(page.locator('#clean-sheet')).toContainText('La antigua «🔀 Baraja»');
  await page.locator('#clean-ok').click();
  await expect.poll(() => state.unfollowCalls).toEqual([['spotify:playlist:legacy']]);
});

test('Shuffle por tiempo: «15 min · Shuffle» dura 15 min ± 2', async ({ page }) => {
  await login(page);
  await page.locator('label[for="sh-kind-time"]').click();
  await page.locator('label[for="sh-minutes-15"]').click();
  await pick(page, 'shuffle', 'Rock');
  await shot(page, 'docs/capturas/24-shuffle-tiempo.png');
  await page.locator('#shuffle-go').click();
  await done(page);
  await idle(page);
  const [list] = byName('15 min · Shuffle');
  const ms = list.tracks.reduce((n, t) => n + t.duration_ms, 0);
  expect(Math.abs(ms - 15 * 60000)).toBeLessThanOrEqual(2 * 60000);
  expect(list.description).toContain(`shuffl:src=${tag('time:15')}`);
  await expect(page.locator('#self-dest, input[value="self"]').first()).toBeDisabled();
});

test('Shuffle por álbumes: cada álbum entero y en orden, «Rock · Álbumes · Shuffle»', async ({ page }) => {
  await login(page);
  await page.locator('label[for="sh-kind-albums"]').click();
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await done(page);
  await idle(page);
  const [list] = byName('Rock · Álbumes · Shuffle');
  expect(list.tracks).toHaveLength(9 * 12);
  const albums = list.tracks.map((t) => t.album.id);
  const blocks = albums.filter((a, i) => a !== albums[i - 1]);
  expect(new Set(blocks).size).toBe(blocks.length);
  for (let i = 0; i < 12; i++) expect(list.tracks[i].track_number).toBe(i + 1);
});

test('Shuffle por álbumes con tus álbumes guardados', async ({ page }) => {
  await login(page);
  await page.locator('label[for="sh-kind-albums"]').click();
  await page.locator('#sh-saved-albums').check();
  await expect(page.locator('#shuffle-go')).toBeEnabled();
  await page.locator('#shuffle-go').click();
  await done(page);
  await idle(page);
  expect(byName('Tus álbumes · Álbumes · Shuffle')[0].tracks).toHaveLength(7 * 5);
});

test('Novedades: lanzamientos recientes de tus artistas sin lo que ya tienes, con caché de 24 h', async ({ page }) => {
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await done(page, 'new');
  await idle(page);
  const [list] = byName('Novedades · Shuffle');
  expect(list.tracks.map((t) => t.album.id).sort()).toEqual(['rel_new', 'rel_new', 'rel_new', 'rel_single']);
  await shot(page, 'docs/capturas/25-novedades.png');
  expect(state.artistAlbumCalls.every((c) => Number(c.limit) <= 10)).toBe(true);
  expect(state.containsCalls.every((n) => n <= 40)).toBe(true);
  const calls = state.artistAlbumCalls.length;
  await page.locator('#new-again').click();
  await idle(page);
  expect(state.artistAlbumCalls.length).toBe(calls);

  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#new-more summary').click();
  await page.locator('label[for="new-days-7"]').click();
  await page.locator('#new-go').click();
  await done(page, 'new');
  await idle(page);
  expect(list.tracks).toHaveLength(3);
});

test('Novedades sin artistas: estado vacío que dice qué hacer', async ({ page }) => {
  state.topArtists = { short_term: [], medium_term: [], long_term: [] };
  state.artists = [];
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(page.locator('#new-empty')).toContainText('Aún no hay artistas');
  expect(byName('Novedades · Shuffle')).toHaveLength(0);
});

test('Descubre: canciones de los álbumes que escuchas, sin las guardadas ni las escuchadas', async ({ page }) => {
  await login(page);
  await openPanel(page, 'explore');
  await page.locator('#explore-go').click();
  await done(page, 'explore');
  await idle(page);
  const [list] = byName('Descubre · Shuffle');
  const listened = new Set([...state.recent, ...state.top.short_term].map((t) => t.uri));
  expect(list.tracks.length).toBeGreaterThan(0);
  expect(list.tracks.some((t) => listened.has(t.uri))).toBe(false);
});

test('Tal día como hoy: lo guardado este mes en otros años, con texto nostálgico y otros años', async ({ page }) => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  state.likedDates = (i) => (i < 10 ? `${now.getFullYear() - 1}-${m}-05T10:00:00Z` : i < 15 ? `${now.getFullYear() - 3}-${m}-05T10:00:00Z` : '2020-01-01T10:00:00Z');
  await login(page);
  await openPanel(page, 'ago');
  await page.locator('#ago-go').click();
  await done(page, 'ago');
  await idle(page);
  expect(byName('Hace 1 año · Shuffle')[0].tracks).toHaveLength(10);
  await expect(page.locator('#panel-ago .note').first()).toContainText(`de ${now.getFullYear() - 1} te enganchaste a`);
  await page.locator(`#panel-ago [data-year="${now.getFullYear() - 3}"]`).click();
  await done(page, 'ago');
  await idle(page);
  expect(byName('Hace 3 años · Shuffle')[0].tracks).toHaveLength(5);
});

test('Olvidadas: Me gusta de hace más de 2 años; con 5 años, estado vacío', async ({ page }) => {
  await login(page);
  await openPanel(page, 'forgotten');
  await page.locator('#forgotten-go').click();
  await done(page, 'forgotten');
  await idle(page);
  expect(byName('Olvidadas · Shuffle')[0].tracks).toHaveLength(60);
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#forgotten-more summary').click();
  await page.locator('label[for="forgotten-years-5"]').click();
  await page.locator('#forgotten-go').click();
  await expect(page.locator('#forgotten-empty')).toContainText('Nada olvidado todavía');
});

test('Tu resumen: tarjeta vertical y cuadrada, logo de Spotify y «Mi top · Shuffle»', async ({ page }) => {
  await login(page);
  await openPanel(page, 'summary');
  await page.locator('#summary-go').click();
  await expect(page.locator('#summary-preview')).toBeVisible();
  const size = await page.locator('#summary-preview').evaluate((img) => [img.naturalWidth, img.naturalHeight]);
  expect(size).toEqual([1080, 1920]);
  await shot(page, 'docs/capturas/26-tu-resumen.png');
  await expect(page.locator('#summary-out .spotify-attrib')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#summary-share-square').click()]);
  expect(download.suggestedFilename()).toMatch(/^shuffl-resumen-cuadrado-\d{4}-\d{2}-\d{2}\.png$/);
  await page.locator('#summary-playlist').click();
  await idle(page);
  expect(byName('Mi top · Shuffle')[0].tracks).toHaveLength(30);
  expect(state.topRequests.some((r) => r.artists && r.limit === '5')).toBe(true);
});

test('en inglés: pestañas, tipos y nombres traducidos', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baraja.lang', JSON.stringify('en')));
  await login(page);
  await expect(page.locator('nav.tabs button')).toHaveText(['Home', 'Shuffle', 'Discover', 'More']);
  await expect(page.locator('#sh-kind')).toContainText('By time');
  await openPanel(page, 'forgotten');
  await page.locator('#forgotten-go').click();
  await idle(page);
  expect(byName('Forgotten · Shuffle')).toHaveLength(1);
});
