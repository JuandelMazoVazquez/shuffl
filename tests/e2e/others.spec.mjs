import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, shot } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const ANA = 'AbCdEfGhIjKlMnOpQrStUv';
const owner = (id) => ({ id, display_name: id === 'ana' ? 'Ana' : id });
const baraja = () => [...state.lists.values()].find((l) => l.name === '🔀 Baraja');

test('«Playlists que sigues»: sección propia, marcadas y con guía para hacerse una copia', async ({ page }) => {
  await login(page);
  const group = page.locator('#panel-shuffle .picker-group');
  await expect(group).toHaveText('Playlists que sigues');
  const row = page.locator('#panel-shuffle .followed', { hasText: 'Top 50 Global' });
  await expect(row).toContainText('No se puede leer');
  await expect(row.locator('input')).toHaveCount(0);
  await row.locator('button').click();
  const help = page.getByRole('dialog', { name: 'Top 50 Global' });
  await expect(help).toContainText('Spotify solo permite a las apps leer el contenido de playlists tuyas o colaborativas');
  await expect(help).toContainText('abre la playlist → ⋯ → «Añadir a otra playlist» → «Nueva playlist»');
  await expect(help).toContainText('Ctrl+A');
  await expect(page.locator('#followed-open')).toHaveAttribute('href', 'https://open.spotify.com/playlist/pl_top');
  await shot(page, 'docs/capturas/12-playlists-de-otros.png');
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  expect(state.itemRequests).not.toContain('pl_top');
});

test('una playlist propia con el mismo nombre que una seguida es «Tu copia de…» y se puede barajar', async ({ page }) => {
  state.lists.set('pl_copia', { id: 'pl_copia', name: 'Top 50 global', owner: owner('me'), tracks: [...state.lists.get('pl_chill').tracks.slice(0, 30)] });
  await login(page);
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Top 50 global' })).toContainText('Tu copia de «Top 50 Global»');
  await expect(page.locator('#panel-shuffle .followed', { hasText: 'Top 50 Global' })).toContainText('ya tienes una copia');
  await page.locator('#panel-shuffle .followed button').click();
  await expect(page.locator('#followed-has-copy')).toContainText('«Top 50 global»');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await pick(page, 'shuffle', 'Top 50 global');
  await page.locator('#shuffle-go').click();
  await expect(page.getByText('Listo: 30 canciones barajadas')).toBeVisible();
  await idle(page);
  expect(baraja().tracks).toHaveLength(30);
});

test('una colaborativa de otra persona se puede barajar como si fuera propia', async ({ page }) => {
  state.lists.set('pl_colab', { id: 'pl_colab', name: 'Colaborativa', owner: owner('ana'), collaborative: true, tracks: state.lists.get('pl_chill').tracks.slice(0, 12) });
  await login(page);
  await expect(page.locator('#panel-shuffle .followed', { hasText: 'Colaborativa' })).toHaveCount(0);
  await pick(page, 'shuffle', 'Colaborativa');
  await page.locator('#shuffle-go').click();
  await expect(page.getByText('Listo: 12 canciones barajadas')).toBeVisible();
});

test('enlace pegado: solo metadatos, nunca el contenido, y la misma guía', async ({ page }) => {
  state.lists.set(ANA, { id: ANA, name: 'Fiesta de Ana', owner: owner('ana'), tracks: [] });
  state.lists.set('A'.repeat(22), { id: 'A'.repeat(22), name: 'Mía', owner: owner('me'), tracks: [] });
  await login(page);
  await page.locator('#link-box summary').click();

  await page.locator('#link-input').fill('hola');
  await page.locator('#link-check').click();
  await expect(page.locator('#link-msg')).toContainText('no parece un enlace');

  await page.locator('#link-input').fill(`https://open.spotify.com/intl-es/playlist/${ANA}?si=abc`);
  await page.locator('#link-check').click();
  const help = page.getByRole('dialog', { name: 'Fiesta de Ana' });
  await expect(help).toContainText('Ana');
  await expect(help).toContainText('Ctrl+A');
  await expect(page.locator('#followed-open')).toHaveAttribute('href', `https://open.spotify.com/playlist/${ANA}`);
  expect(state.metaRequests).toEqual([ANA]);
  expect(state.itemRequests).not.toContain(ANA);
  await page.keyboard.press('Escape');

  await page.locator('#link-input').fill(`spotify:playlist:${'B'.repeat(22)}`);
  await page.locator('#link-check').click();
  await expect(page.locator('#link-msg')).toContainText('No se encontró esa playlist');

  await page.locator('#link-input').fill('A'.repeat(22));
  await page.locator('#link-check').click();
  await expect(page.locator('#link-msg')).toContainText('«Mía» es tuya o colaborativa');
  expect(state.itemRequests).not.toContain(ANA);
});

test('la ayuda de playlists ajenas sale en inglés', async ({ page }) => {
  await login(page);
  await page.locator('#open-settings').click();
  await page.locator('#lang-select').selectOption('en');
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle .picker-group')).toHaveText('Playlists you follow');
  await page.locator('#panel-shuffle .followed button').click();
  await expect(page.locator('#followed-help')).toContainText('On your phone');
  await expect(page.locator('#followed-help')).toContainText('"Add to other playlist" → "New playlist"');
});
