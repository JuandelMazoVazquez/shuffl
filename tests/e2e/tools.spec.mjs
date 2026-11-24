import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, shot } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const open = async (page, card) => {
  await page.locator('#tab-home').click();
  await page.locator(`#card-${card}`).click();
};
const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);

test('instantáneas: Top 4 semanas pide limit 50, crea «📸 Top 4 semanas» y la siguiente vez la actualiza', async ({ page }) => {
  await login(page);
  await open(page, 'snap');
  await page.locator('#snap-go').click();
  await expect(page.getByText('«📸 Top 4 semanas» lista: 30 canciones.')).toBeVisible();
  await idle(page);
  expect(state.topRequests).toEqual([{ limit: '50', time_range: 'short_term' }]);
  const [snap] = byName('📸 Top 4 semanas');
  expect(snap.tracks).toHaveLength(30);
  expect(state.writes.find((w) => w.op === 'create' && w.name === '📸 Top 4 semanas').public).toBe(false);

  state.top.short_term = state.top.short_term.slice(0, 10);
  await page.getByRole('button', { name: 'Volver', exact: true }).first().click();
  await page.locator('#snap-go').click();
  await expect(page.getByText('«📸 Top 4 semanas» lista: 10 canciones.')).toBeVisible();
  await idle(page);
  expect(byName('📸 Top 4 semanas')).toHaveLength(1);
  expect(byName('📸 Top 4 semanas')[0].tracks).toHaveLength(10);
  const undo = await page.evaluate(() => JSON.parse(localStorage.getItem('baraja.undo')));
  expect(undo.uris).toHaveLength(30);
});

test('instantáneas: 6 meses, siempre y últimas escuchas (sin repetidas) con opción de barajar', async ({ page }) => {
  await login(page);
  await open(page, 'snap');
  await page.locator('#snap-top_medium').check();
  await page.locator('#snap-go').click();
  await expect(page.getByText('«📸 Top 6 meses» lista: 50 canciones.')).toBeVisible();
  await idle(page);
  await page.getByRole('button', { name: 'Volver', exact: true }).first().click();
  await page.locator('#snap-top_long').check();
  await page.locator('#snap-go').click();
  await expect(page.getByText('«📸 Top siempre» lista: 50 canciones.')).toBeVisible();
  await idle(page);
  await page.getByRole('button', { name: 'Volver', exact: true }).first().click();
  await page.locator('#snap-recent').check();
  await page.locator('#snap-shuffle').check();
  await page.locator('#snap-go').click();
  await expect(page.getByText('«📸 Últimas escuchas» lista: 10 canciones.')).toBeVisible();
  await idle(page);
  expect(state.topRequests.map((r) => r.time_range ?? 'recent')).toEqual(['medium_term', 'long_term', 'recent']);
  expect(state.topRequests[2].limit).toBe('50');
  const recent = byName('📸 Últimas escuchas')[0].tracks;
  expect(new Set(recent.map((t) => t.uri)).size).toBe(10);
  await shot(page, 'docs/capturas/13-instantaneas.png');
});

test('Me gusta sin playlist: encuentra las que no están en ninguna playlist propia y crea la playlist', async ({ page }) => {
  const rock = state.lists.get('pl_rock').tracks;
  state.liked = [...state.liked.slice(0, 20), rock[0], rock[1], rock[2]];
  await login(page);
  await open(page, 'orphans');
  await page.locator('#orphans-scan').click();
  await expect(page.locator('#orphans-count')).toHaveText('20 canciones de Tus me gusta no están en ninguna de tus 3 playlists.');
  await page.locator('#orphans-create').click();
  await expect(page.getByText('Playlist creada con 20 canciones.')).toBeVisible();
  await idle(page);
  const [created] = [...state.lists.values()].filter((l) => l.name.startsWith('Me gusta sin playlist'));
  expect(created.tracks.map((t) => t.uri).sort()).toEqual(state.liked.slice(0, 20).map((t) => t.uri).sort());
  expect(state.itemRequests).not.toContain('pl_top');
});

test('Me gusta sin playlist: no cuenta las playlists que genera Baraja y avisa si no hay ninguna', async ({ page }) => {
  state.lists.set('pl_baraja', { id: 'pl_baraja', name: '🔀 Baraja', owner: { id: 'me' }, tracks: state.liked.slice(0, 5) });
  state.liked = state.liked.slice(0, 5);
  await login(page);
  await open(page, 'orphans');
  await page.locator('#orphans-scan').click();
  await expect(page.locator('#orphans-count')).toContainText('5 canciones');

  state.lists.set('pl_todo', { id: 'pl_todo', name: 'Todo', owner: { id: 'me' }, tracks: state.liked.slice() });
  await page.reload();
  await open(page, 'orphans');
  await page.locator('#orphans-scan').click();
  await expect(page.locator('#orphans-none')).toBeVisible();
});

test('dividir en N partes: vista previa con nombres editables y creación', async ({ page }) => {
  await login(page);
  await open(page, 'split');
  await pick(page, 'split', 'Chill');
  await page.locator('#split-parts').fill('3');
  await page.locator('#split-preview-btn').click();
  await expect(page.locator('#split-summary')).toHaveText('3 playlists con 80 canciones');
  const inputs = page.locator('#split-preview input[type=text]');
  await expect(inputs).toHaveCount(3);
  await expect(inputs.first()).toHaveValue('Chill · parte 1');
  await inputs.nth(1).fill('Segunda mitad');
  await shot(page, 'docs/capturas/14-dividir.png', { fullPage: true });
  await page.locator('#split-create').click();
  await expect(page.getByText('3 playlists creadas.')).toBeVisible();
  await idle(page);
  const made = ['Chill · parte 1', 'Segunda mitad', 'Chill · parte 3'].map((n) => byName(n)[0]);
  expect(made.map((l) => l.tracks.length)).toEqual([27, 27, 26]);
  const all = made.flatMap((l) => l.tracks.map((t) => t.uri));
  expect(all).toEqual(state.lists.get('pl_chill').tracks.map((t) => t.uri));
  expect(state.lists.get('pl_chill').tracks).toHaveLength(80);
});

test('dividir por década y por artista con mínimo configurable', async ({ page }) => {
  await login(page);
  await open(page, 'split');
  await pick(page, 'split', 'Rock');
  await page.locator('#split-mode').selectOption('decade');
  await page.locator('#split-preview-btn').click();
  await expect(page.locator('#split-summary')).toHaveText('3 playlists con 120 canciones');
  await expect(page.locator('#split-preview input[type=text]').first()).toHaveValue('Rock · 1990s');

  await page.locator('#split-mode').selectOption('artist');
  await expect(page.locator('#split-preview')).toBeHidden();
  await page.locator('#split-min').fill('10');
  await page.locator('#split-preview-btn').click();
  await expect(page.locator('#split-summary')).toHaveText('7 playlists con 120 canciones');
  await page.locator('#split-min').fill('1000');
  await page.locator('#split-preview-btn').click();
  await expect(page.getByRole('alert')).toContainText('un solo grupo');
  expect(state.writes).toEqual([]);

  await page.locator('#split-mode').selectOption('addedYear');
  await page.locator('#split-preview-btn').click();
  await expect(page.locator('#split-summary')).toContainText('120 canciones');
});

test('las herramientas nuevas salen en inglés', async ({ page }) => {
  await login(page);
  await page.locator('#open-settings').click();
  await page.locator('#lang-select').selectOption('en');
  await page.locator('#tab-home').click();
  await page.locator('#card-split').click();
  await expect(page.locator('#panel-split')).toContainText('Splits one of your playlists');
  await expect(page.locator('#split-mode option').first()).toHaveText('Into N equal parts');
});
