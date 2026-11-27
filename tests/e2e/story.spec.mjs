// v1.4.2: por qué existe Shuffl, contado igual en la bienvenida, Acerca de y «¿Es aleatorio de verdad?».
import { test, expect } from '@playwright/test';
import { installMock, login, openPanel } from './helpers.mjs';

const NEWS = 'https://newsroom.spotify.com/2025-11-13/shuffle-update-fewer-repeats/';

test('la historia sale en la bienvenida, en Acerca de y en la prueba, con el anuncio de Spotify como fuente', async ({ page }) => {
  await installMock(page);
  await page.goto('/');
  await expect(page.locator('main.setup .lead')).toContainText('te pone siempre las mismas canciones');
  await login(page);
  await openPanel(page, 'settings');
  await expect(page.locator('#about-story')).toContainText('me ponía siempre las mismas canciones');
  await openPanel(page, 'proof');
  await expect(page.locator('#proof-why')).toContainText('Según Spotify, su aleatorio por defecto tiene en cuenta lo que has escuchado hace poco');
  await expect(page.locator('#proof-source')).toHaveAttribute('href', NEWS);
  await expect(page.locator('#proof-source')).toHaveAttribute('rel', 'noopener noreferrer');
});

test('la historia también está en inglés', async ({ page }) => {
  await installMock(page, { lang: 'en' });
  await page.goto('/');
  await expect(page.locator('main.setup .lead')).toContainText('keep playing you the same songs');
  await login(page);
  await openPanel(page, 'proof');
  await expect(page.locator('#proof-why')).toContainText('According to Spotify, its default shuffle takes your recent listening into account');
  await expect(page.locator('#proof-source')).toHaveText('Spotify’s announcement');
});
