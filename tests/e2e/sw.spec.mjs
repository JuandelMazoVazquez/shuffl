import { test, expect } from '@playwright/test';
import { createAppServer } from '../../scripts/serve.mjs';
import { installMock } from './helpers.mjs';
import { CLIENT_ID } from './mock.mjs';

test.use({ serviceWorkers: 'allow' });

let server;
let base;
let build = 'v1';

test.beforeAll(async () => {
  server = createAppServer({ getBuild: () => build });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(() => new Promise((ok) => server.close(ok)));

const cacheNames = (page) => page.evaluate(() => caches.keys().then((k) => k.sort()));

test('el service worker avisa de la versión nueva, la aplica al pulsar y limpia cachés viejas', async ({ page, context }) => {
  build = 'v1';
  await page.addInitScript(() => localStorage.setItem('baraja.lang', JSON.stringify('es')));
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await cacheNames(page)).toEqual(['shuffl-v1']);
  await expect(page.locator('#update-banner')).toHaveCount(0);

  build = 'v2';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await expect(page.locator('#update-banner')).toContainText('Nueva versión disponible');
  expect(await cacheNames(page)).toEqual(['shuffl-v1', 'shuffl-v2']);

  let loads = 0;
  page.on('load', () => { loads++; });
  await page.locator('#update-banner button').click();
  await expect.poll(() => loads).toBe(1);
  await expect.poll(() => cacheNames(page)).toEqual(['shuffl-v2']);
  await expect(page.locator('#update-banner')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(loads).toBe(1);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#connect')).toBeVisible();
  await context.setOffline(false);
});

test('«Actualizar» no recarga mientras hay una tarea en curso y sí cuando termina', async ({ page }) => {
  build = 'b1';
  await installMock(page);
  await page.goto(base);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await page.locator('#tab-shuffle').click();
  await page.locator('#panel-shuffle label.row', { hasText: 'Rock' }).click();

  let release;
  const held = new Promise((ok) => { release = ok; });
  let reads = 0;
  await page.route(/api\.spotify\.com\/v1\/playlists\/[^/]+\/items/, async (route) => {
    if (route.request().method() === 'GET') { reads++; await held; }
    await route.fallback();
  });
  await page.locator('#shuffle-go').click();
  await expect.poll(() => reads).toBeGreaterThan(0);
  await expect(page.locator('body')).toHaveClass(/busy/);

  build = 'b2';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await expect(page.locator('#update-banner')).toBeVisible();
  let loads = 0;
  page.on('load', () => { loads++; });
  await page.locator('#update-apply').click();
  await expect(page.locator('#update-apply')).toHaveText('Termina la tarea en curso y pulsa otra vez');
  await page.waitForTimeout(500);
  expect(loads).toBe(0);
  expect(await cacheNames(page)).toEqual(['shuffl-b1', 'shuffl-b2']);

  release();
  await expect(page.locator('body')).not.toHaveClass(/busy/);
  await expect(page.locator('#panel-shuffle .result-title')).toBeVisible();
  expect(loads).toBe(0);
  await page.locator('#update-apply').click();
  await expect.poll(() => loads).toBe(1);
  await expect.poll(() => cacheNames(page)).toEqual(['shuffl-b2']);
});

test('el banner sale en inglés con el idioma en inglés', async ({ page }) => {
  build = 'a1';
  await page.addInitScript(() => localStorage.setItem('baraja.lang', JSON.stringify('en')));
  await page.goto(base);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  build = 'a2';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await expect(page.locator('#update-banner')).toContainText('New version available');
  await expect(page.locator('#update-banner button')).toHaveText('Update');
});
