import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, shot, openPanel, moreOptions } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const openFilters = async (page) => {
  await moreOptions(page);
  await page.locator('#filters-box summary').click();
  await expect(page.locator('#filters-box')).toHaveAttribute('open', '');
};
/** La última playlist escrita por la app (la generada «· Shuffl»). */
const created = () => state.lists.get(state.writes.filter((w) => w.op === 'create').at(-1).id);
const yearOf = (t) => Number(t.album.release_date.slice(0, 4));

test('filtros: contador en vivo, barajado solo del subconjunto y la propia playlist queda bloqueada', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await openFilters(page);
  await expect(page.locator('#filter-count')).toHaveText('120 de 120 canciones pasan los filtros.');
  await moreOptions(page);
  await page.locator('#f-yearFrom').fill('2000');
  await expect(page.locator('#filter-count')).toHaveText('80 de 120 canciones pasan los filtros.');
  await moreOptions(page);
  await page.locator('#f-explicit').selectOption('none');
  await expect(page.locator('#filter-count')).toHaveText('64 de 120 canciones pasan los filtros.');
  await expect(page.locator('#panel-shuffle label.choice', { hasText: 'Barajar mi playlist original' }).locator('input')).toBeDisabled();
  await shot(page, 'docs/capturas/10-filtros.png', { fullPage: true });

  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^64 (canciones|songs) ·/ })).toBeVisible();
  await idle(page);
  const out = created().tracks;
  expect(out).toHaveLength(64);
  expect(out.every((t) => yearOf(t) >= 2000 && !t.explicit)).toBe(true);
  await expect(page.getByText('56 canciones quedaron fuera por los filtros.')).toBeVisible();
});

test('filtros: si nada pasa no se escribe nada', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await openFilters(page);
  await moreOptions(page);
  await page.locator('#f-yearFrom').fill('2050');
  await expect(page.locator('#filter-count')).toHaveText('0 de 120 canciones pasan los filtros.');
  await page.locator('#shuffle-go').click();
  await expect(page.getByRole('alert')).toContainText('Ninguna canción pasa los filtros');
  expect(state.writes).toEqual([]);
});

test('toda la biblioteca: resumen, salta las de otros y no se lee a sí misma', async ({ page }) => {
  await login(page);
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.locator('#select-library').click();
  await expect(page.locator('#selection-info')).toContainText('4 playlists · 268 canciones');
  await expect(page.locator('#selection-info')).toContainText('Se saltan 1 playlists de otras personas');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
  await idle(page);
  const unique = new Set([...state.lists.get('pl_rock').tracks, ...state.lists.get('pl_chill').tracks, ...state.lists.get('pl_dupes').tracks, ...state.liked].map((t) => t.uri));
  expect(created().name).toBe('Toda mi música · Shuffl');
  expect(created().tracks).toHaveLength(unique.size);
  expect(requested.some((u) => u.includes('pl_top'))).toBe(false);

  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#select-library').click();
  await expect(page.locator('#selection-info')).toContainText('4 playlists');
});

test('mezclas guardadas: guardar con filtros, reutilizar desde Inicio, editar, borrar y que persistan', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await openFilters(page);
  await moreOptions(page);
  await page.locator('#f-yearFrom').fill('2000');
  await moreOptions(page);
  await page.locator('#save-mix').click();
  await page.locator('#ask-name').fill('Coche');
  await page.locator('#ask-ok').click();
  await expect(page.getByText('Mezcla «Coche» guardada.')).toBeVisible();

  await page.reload();
  await page.locator('#tab-home').click();
  const card = page.locator('[data-mix]', { hasText: 'Coche' });
  await expect(card).toContainText('Rock · con filtros');
  await shot(page, 'docs/capturas/11-mezclas.png');
  await card.click();
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  await idle(page);
  expect(created().tracks.every((t) => yearOf(t) >= 2000)).toBe(true);
  expect(created().name).toBe('Coche · Shuffl');

  await page.locator('#tab-home').click();
  await page.getByRole('button', { name: 'Editar mezcla Coche' }).click();
  await expect(page.locator('#f-yearFrom')).toHaveValue('2000');
  await expect(page.locator('#save-mix')).toHaveText('Guardar cambios en «Coche»');
  await moreOptions(page);
  await page.locator('#f-yearFrom').fill('2010');
  await moreOptions(page);
  await page.locator('#save-mix').click();
  await expect(page.locator('#ask-name')).toHaveValue('Coche');
  await page.locator('#ask-name').fill('Gym');
  await page.locator('#ask-ok').click();
  await expect(page.getByText('Mezcla «Gym» guardada.')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.mixes')));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ name: 'Gym', filters: { yearFrom: '2010' }, ids: ['pl_rock'] });

  await page.locator('#tab-home').click();
  await expect(page.locator('[data-mix]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Borrar mezcla Gym' }).click();
  await expect(page.locator('[data-mix]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.mixes')))).toEqual([]);
});

test('una mezcla de biblioteca incluye las playlists nuevas al volver a barajarla', async ({ page }) => {
  await login(page);
  await page.locator('#select-library').click();
  await moreOptions(page);
  await page.locator('#save-mix').click();
  await page.locator('#ask-ok').click();
  await expect(page.getByText('Mezcla «Toda mi biblioteca» guardada.')).toBeVisible();
  state.lists.set('pl_nueva', { id: 'pl_nueva', name: 'Recién llegada', owner: { id: 'me' }, tracks: [...state.lists.get('pl_chill').tracks.slice(0, 0), ...state.catalog.values()].slice(600, 610) });
  await page.locator('#tab-home').click();
  await expect(page.locator('[data-mix]')).toHaveCount(1);
  await page.evaluate(() => document.querySelector('[data-mix]').click());
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
});

test('una mezcla cuyas playlists ya no existen avisa sin escribir nada', async ({ page }) => {
  await login(page);
  await page.evaluate(() => localStorage.setItem('shuffl.mixes', JSON.stringify([
    { id: 'm1', name: 'Fantasma', ids: ['no_existe'], names: ['X'], dedupe: true, mode: 'reuse' },
  ])));
  await page.reload();
  await page.locator('#tab-home').click();
  await page.locator('[data-mix]').click();
  await expect(page.getByRole('alert')).toContainText('ya no está disponible');
  expect(state.writes).toEqual([]);
});

test('las mezclas viajan en la copia de seguridad: se restauran y se limpian las inválidas', async ({ page }) => {
  await login(page);
  await openPanel(page, 'backup');
  const backup = {
    app: 'shuffl', version: 1, playlists: [],
    mixes: [
      { id: 'a1', name: 'Gym', ids: ['pl_rock'], names: ['Rock'], dedupe: true, mode: 'reuse', filters: { explicit: 'none', yearFrom: 'abc' } },
      { id: 'a2', name: '', ids: [] },
      'basura',
    ],
  };
  await page.locator('#restore-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#restore-mixes')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Mezclas restauradas: 1.')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.mixes')));
  expect(stored).toHaveLength(1);
  expect(stored[0].filters).toMatchObject({ explicit: 'none', yearFrom: '' });
  await page.locator('#tab-home').click();
  await expect(page.locator('[data-mix]', { hasText: 'Gym' })).toBeVisible();
});

test('restaurar no pisa una mezcla local con el mismo id', async ({ page }) => {
  await login(page);
  await page.evaluate(() => localStorage.setItem('shuffl.mixes', JSON.stringify([
    { id: 'a1', name: 'Editada', ids: ['pl_rock'], names: ['Rock'], dedupe: true, mode: 'reuse', filters: {} },
  ])));
  await openPanel(page, 'backup');
  const backup = {
    app: 'shuffl', version: 1, playlists: [],
    mixes: [
      { id: 'a1', name: 'Antigua', ids: ['pl_rock'], names: ['Rock'] },
      { id: 'a2', name: 'Nueva', ids: ['pl_chill'], names: ['Chill'] },
    ],
  };
  await page.locator('#restore-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Mezclas restauradas: 1. 1 ya existían y no se han tocado.')).toBeVisible();
  const names = (await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.mixes')))).map((m) => m.name);
  expect(names).toEqual(['Editada', 'Nueva']);
});

test('el JSON exportado incluye las mezclas guardadas', async ({ page }) => {
  await login(page);
  await page.evaluate(() => localStorage.setItem('shuffl.mixes', JSON.stringify([
    { id: 'a1', name: 'Gym', ids: ['pl_rock'], names: ['Rock'], dedupe: true, mode: 'reuse', filters: {} },
  ])));
  await openPanel(page, 'backup');
  await pick(page, 'backup', 'Chill');
  await page.getByRole('button', { name: 'Preparar copia' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save-json').click()]);
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'));
  expect(data.mixes).toHaveLength(1);
  expect(data.mixes[0].name).toBe('Gym');
});
