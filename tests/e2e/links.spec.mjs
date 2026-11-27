import { test, expect } from '@playwright/test';
import { installMock, login, idle, shot, openPanel, BASE } from './helpers.mjs';

let state;

const MIX = { id: 'm1', name: 'Coche', library: false, ids: ['pl_rock'], names: ['Rock'], filters: { yearFrom: '2000' }, dedupe: true, mode: 'self' };

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
  await page.addInitScript((mix) => { if (!localStorage.getItem('shuffl.mixes')) localStorage.setItem('shuffl.mixes', JSON.stringify([mix])); }, MIX);
});

const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const writesTo = (id) => state.writes.filter((w) => w.id === id);

const KEY = 'AbCdEfGhIjKlMnOpQrSt_-';

test('?mezcla=<id>&play=1&k=<clave> rebaraja la mezcla en «Coche · Shuffl» y la reproduce sin preguntar, nunca en el origen', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await page.addInitScript((k) => localStorage.setItem('shuffl.linkKey', JSON.stringify(k)), KEY);
  await login(page);
  await page.goto(`/?mezcla=m1&play=1&k=${KEY}`);
  await expect(page.locator('#play-msg')).toContainText('Sonando en iPhone de prueba');
  const [gen] = byName('Coche · Shuffl');
  expect(gen.tracks).toHaveLength(80);
  expect(writesTo('pl_rock')).toEqual([]);
  expect(state.playerCalls.map((c) => c.path)).toEqual(['/me/player/play', '/me/player/shuffle', '/me/player']);
  expect(state.playerCalls[0].body.context_uri).toBe(`spotify:playlist:${gen.id}`);
  expect(page.url()).toBe(BASE);
  expect(dialogs).toEqual([]);

  const writes = state.writes.length;
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.waitForTimeout(500);
  expect(state.writes.length).toBe(writes);
});

test('?origen=<playlist>&play=1 baraja esa playlist en su «· Shuffl»; sin play no reproduce', async ({ page }) => {
  await login(page);
  await page.goto('/?origen=pl_chill&play=1');
  await expect(page.locator('#play-msg')).toContainText('Sonando en iPhone de prueba');
  expect(byName('Chill · Shuffl')[0].tracks).toHaveLength(80);

  await page.goto('/?origen=pl_rock');
  await expect(page.locator('#result-meta:visible')).toContainText('120 canciones');
  await idle(page);
  expect(byName('Rock · Shuffl')).toHaveLength(1);
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
  expect(page.url()).toBe(BASE);
  expect(state.writes).toEqual([]);
});

test('«Crear atajo de Siri» muestra el enlace de la mezcla, los pasos y el aviso de Safari', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await page.getByRole('button', { name: 'Crear atajo de Siri para Coche' }).click();
  const sheet = page.locator('#shortcut-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('#shortcut-link')).toHaveValue(new RegExp(`^${BASE.replace(/[.?]/g, (c) => `\\${c}`)}\\?mezcla=m1&play=1&k=[A-Za-z0-9_-]{22}$`));
  const key = await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.linkKey')));
  await expect(page.locator('#shortcut-link')).toHaveValue(new RegExp(`k=${key}$`));
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
  await openPanel(page, 'settings');
  await openPanel(page, 'pin');
  await expect(page.locator('#panel-pin')).toContainText('CarPlay no admite apps web');
  await expect(page.locator('#panel-pin')).toContainText('tu playlist de Shuffl dentro de Spotify');
  await openPanel(page, 'settings');
  await page.locator('#lang-select').selectOption('en');
  await page.locator('#tab-home').click();
  await page.getByRole('button', { name: 'Create Siri shortcut for Coche' }).click();
  await expect(page.locator('#shortcut-sheet')).toContainText('Open URLs');
});

test('un enlace sin la clave de este navegador (por ejemplo, desde otra web) pregunta antes y, si se cancela, no hace nada', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await login(page);
  state.dismissNext = true;
  await page.goto('/?origen=__liked__&play=1');
  await expect(page.getByText('Enlace cancelado: no se ha cambiado nada.')).toBeVisible();
  expect(dialogs).toEqual(['Un enlace quiere barajar «Tus me gusta» en una playlist nueva de Shuffl y reproducirla. ¿Seguir?']);
  expect(state.writes).toEqual([]);
  expect(state.playerCalls).toEqual([]);

  state.dismissNext = true;
  await page.goto('/?mezcla=m1&play=1&k=ClaveDeOtroNavegador01');
  await expect(page.getByText('Enlace cancelado')).toBeVisible();
  expect(dialogs[1]).toContain('«Coche»');
  expect(state.writes).toEqual([]);

  await page.goto('/?origen=pl_chill');
  await expect(page.locator('#result-meta:visible')).toContainText('80 canciones');
  expect(dialogs[2]).toBe('Un enlace quiere barajar «Chill» en una playlist nueva de Shuffl. ¿Seguir?');
  expect(byName('Chill · Shuffl')).toHaveLength(1);
});
