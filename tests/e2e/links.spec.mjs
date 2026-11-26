import { test, expect } from '@playwright/test';
import { installMock, login, idle, shot } from './helpers.mjs';

let state;

const MIX = { id: 'm1', name: 'Coche', library: false, ids: ['pl_rock'], names: ['Rock'], filters: { yearFrom: '2000' }, dedupe: true, mode: 'self' };

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
  await page.addInitScript((mix) => { if (!localStorage.getItem('baraja.mixes')) localStorage.setItem('baraja.mixes', JSON.stringify([mix])); }, MIX);
});

const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const writesTo = (id) => state.writes.filter((w) => w.id === id);

test('?mezcla=<id>&play=1 rebaraja la mezcla en «Coche · Shuffle» y la reproduce, nunca en el origen', async ({ page }) => {
  await login(page);
  await page.goto('/?mezcla=m1&play=1');
  await expect(page.getByText('Reproduciendo en iPhone de prueba.')).toBeVisible();
  const [gen] = byName('Coche · Shuffle');
  expect(gen.tracks).toHaveLength(80);
  expect(writesTo('pl_rock')).toEqual([]);
  expect(state.playerCalls.map((c) => c.path)).toEqual(['/me/player/shuffle', '/me/player/play']);
  expect(state.playerCalls[1].body.context_uri).toBe(`spotify:playlist:${gen.id}`);
  expect(page.url()).toBe('http://127.0.0.1:5173/');

  const writes = state.writes.length;
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.waitForTimeout(500);
  expect(state.writes.length).toBe(writes);
});

test('?origen=<playlist>&play=1 baraja esa playlist en su «· Shuffle»; sin play no reproduce', async ({ page }) => {
  await login(page);
  await page.goto('/?origen=pl_chill&play=1');
  await expect(page.getByText('Reproduciendo en iPhone de prueba.')).toBeVisible();
  expect(byName('Chill · Shuffle')[0].tracks).toHaveLength(80);

  await page.goto('/?origen=pl_rock');
  await expect(page.locator('#panel-shuffle .result-title')).toContainText('Listo: 120');
  await idle(page);
  expect(byName('Rock · Shuffle')).toHaveLength(1);
  expect(state.playerCalls.filter((c) => c.path === '/me/player/play')).toHaveLength(1);
});

test('enlaces con una mezcla o playlist que no existe, ajena o con id raro no escriben nada', async ({ page }) => {
  await login(page);
  for (const [q, msg] of [
    ['?mezcla=otra&play=1', 'no está guardada en este navegador'],
    ['?origen=pl_top&play=1', 'no está en tu biblioteca o no se puede leer'],
    ['?origen=nada&play=1', 'no está en tu biblioteca o no se puede leer'],
  ]) {
    await page.goto(`/${q}`);
    await expect(page.getByRole('alert')).toContainText(msg);
  }
  await page.goto('/?origen=..%2Fpl_rock&play=1');
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.waitForTimeout(400);
  expect(state.writes).toEqual([]);
  expect(state.playerCalls).toEqual([]);
});

test('sin sesión el enlace no hace nada y se quita de la dirección', async ({ page }) => {
  await page.goto('/?mezcla=m1&play=1');
  await expect(page.locator('#connect')).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:5173/');
  expect(state.writes).toEqual([]);
});

test('«Crear atajo de Siri» muestra el enlace de la mezcla, los pasos y el aviso de Safari', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await page.getByRole('button', { name: 'Crear atajo de Siri para Coche' }).click();
  const sheet = page.locator('#shortcut-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('#shortcut-link')).toHaveValue('http://127.0.0.1:5173/?mezcla=m1&play=1');
  await expect(sheet).toContainText('«Oye Siri, Shuffl coche»');
  await expect(sheet).toContainText('Abrir URL');
  await expect(sheet).toContainText('Safari');
  await expect(sheet.locator('ol li')).toHaveCount(5);
  await shot(page, 'docs/capturas/18-atajo-siri.png');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('la ayuda explica CarPlay y el atajo sale en inglés', async ({ page }) => {
  await login(page);
  await page.locator('#open-settings').click();
  await page.locator('#open-pin').click();
  await expect(page.locator('#panel-pin')).toContainText('CarPlay no admite apps web');
  await expect(page.locator('#panel-pin')).toContainText('«· Shuffle» dentro de Spotify');
  await page.locator('#open-settings').click();
  await page.locator('#lang-select').selectOption('en');
  await page.locator('#tab-home').click();
  await page.getByRole('button', { name: 'Create Siri shortcut for Coche' }).click();
  await expect(page.locator('#shortcut-sheet')).toContainText('Open URLs');
});
