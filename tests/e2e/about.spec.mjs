import { test, expect } from '@playwright/test';
import { installMock, login } from './helpers.mjs';

test('aviso único de logo nuevo, aviso de no afiliación y favicons', async ({ page }) => {
  await installMock(page, { logoNotice: true });
  await login(page);
  await expect(page.locator('#logo-notice')).toContainText('quitar la app de la pantalla de inicio');
  await page.locator('#logo-notice button').click();
  await expect(page.locator('#logo-notice')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#tab-shuffle')).toBeVisible();
  await expect(page.locator('#logo-notice')).toHaveCount(0);

  await page.locator('#open-settings').click();
  await expect(page.locator('#about-notice')).toHaveText('Proyecto independiente, no afiliado ni respaldado por Spotify. Spotify es una marca de Spotify AB.');
  await expect(page.locator('link[rel="icon"][href="icons/favicon.svg"]')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href="icons/favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icons/apple-touch-icon.png');
});

test('el aviso de no afiliación y el de logo salen en inglés', async ({ page }) => {
  await installMock(page, { lang: 'en' });
  await page.goto('/');
  await expect(page.getByText('Independent project, not affiliated with or endorsed by Spotify. Spotify is a trademark of Spotify AB.')).toBeVisible();
});
