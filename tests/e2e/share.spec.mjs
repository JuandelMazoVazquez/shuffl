import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

async function shuffleChill(page) {
  await login(page);
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByText('Listo: 80 canciones barajadas')).toBeVisible();
  await idle(page);
  return [...state.lists.values()].find((l) => l.name === 'Chill · Shuffle');
}

test('Compartir usa la hoja del sistema (Web Share) con el enlace de la playlist', async ({ page }) => {
  await page.addInitScript(() => { navigator.share = async (data) => { window.__shared = data; }; });
  const list = await shuffleChill(page);
  await page.locator('#share-link').click();
  await expect.poll(() => page.evaluate(() => window.__shared)).toEqual({ title: 'Shuffl', url: `https://open.spotify.com/playlist/${list.id}` });
});

test('si el usuario cancela la hoja de compartir no se muestra ningún error', async ({ page }) => {
  await page.addInitScript(() => { navigator.share = async () => { throw new DOMException('cancelado', 'AbortError'); }; });
  await shuffleChill(page);
  await page.locator('#share-link').click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.locator('#panel-shuffle .play-info')).toBeEmpty();
});

test('sin Web Share copia el enlace, y si no puede lo muestra para copiarlo a mano', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  const list = await shuffleChill(page);
  await page.locator('#share-link').click();
  await expect(page.locator('#share-done')).toHaveText('Enlace copiado.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://open.spotify.com/playlist/${list.id}`);

  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denegado')); });
  await page.locator('#share-link').click();
  await expect(page.locator('#panel-shuffle .play-info .copybox input')).toHaveValue(`https://open.spotify.com/playlist/${list.id}`);
});
