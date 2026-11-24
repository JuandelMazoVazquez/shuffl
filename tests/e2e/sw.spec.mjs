import { test, expect } from '@playwright/test';
import { createAppServer } from '../../scripts/serve.mjs';

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
  expect(await cacheNames(page)).toEqual(['baraja-v1']);
  await expect(page.locator('#update-banner')).toHaveCount(0);

  build = 'v2';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await expect(page.locator('#update-banner')).toContainText('Nueva versión disponible');
  expect(await cacheNames(page)).toEqual(['baraja-v1', 'baraja-v2']);

  let loads = 0;
  page.on('load', () => { loads++; });
  await page.locator('#update-banner button').click();
  await expect.poll(() => loads).toBe(1);
  await expect.poll(() => cacheNames(page)).toEqual(['baraja-v2']);
  await expect(page.locator('#update-banner')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(loads).toBe(1);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#connect')).toBeVisible();
  await context.setOffline(false);
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
