// v1.4.1: las claves baraja.* pasan a shuffl.* sin cerrar la sesión ni perder datos, y la app explica cómo añadir la
// Redirect URI nueva cuando Spotify la rechaza.
import { test, expect } from '@playwright/test';
import { CLIENT_ID } from './mock.mjs';
import { installMock, BASE } from './helpers.mjs';
import { SCOPE_LIST } from '../../js/auth.js';

const SCOPE = SCOPE_LIST.join(' ');

test('una sesión de la v1.4.0 (claves baraja.*) sigue abierta y conserva mezclas, Deshacer y ajustes', async ({ page }) => {
  const state = await installMock(page);
  state.grantedScope = SCOPE;
  const old = {
    'baraja.clientId': CLIENT_ID,
    'baraja.tokens': { access_token: 'access-0', refresh_token: 'refresh-0', expires_at: Date.now() + 3600000, scope: SCOPE },
    'baraja.mixes': [{ id: 'm1', name: 'Coche', ids: ['pl_rock'], liked: false, mode: 'new', savedAt: 1 }],
    'baraja.undo': { playlistId: 'pl_rock', name: 'Rock', uris: ['spotify:track:x'], pending: false, after: 1, date: 1 },
    'baraja.theme': 'light',
    'baraja.cover': false,
    'baraja.linkKey': 'k'.repeat(22),
  };
  // Solo en la primera carga: es lo que había guardado la versión anterior.
  await page.addInitScript((o) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    for (const [k, v] of Object.entries(o)) localStorage.setItem(k, JSON.stringify(v));
  }, old);
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
  await expect(page.locator('#client-id')).toHaveCount(0);
  expect(state.authorizeParams, 'no hay que volver a iniciar sesión').toBeNull();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const stored = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, JSON.parse(localStorage.getItem(k))])));
  expect(Object.keys(stored).filter((k) => k.startsWith('baraja.'))).toEqual([]);
  for (const [k, v] of Object.entries(old)) expect(stored[k.replace('baraja.', 'shuffl.')], k).toEqual(v);
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
});

test('si Spotify rechaza la Redirect URI y no vuelve, la app enseña la URI nueva y los pasos una sola vez', async ({ page }) => {
  const state = await installMock(page);
  state.badRedirect = true;
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.getByText('INVALID_CLIENT: Invalid redirect URI')).toBeVisible();
  await page.goBack();
  const help = page.locator('#redirect-help');
  await expect(help).toBeVisible();
  await expect(help).toContainText('un error sobre la Redirect URI');
  await expect(help.locator('input')).toHaveValue(BASE);
  await expect(help.locator('ol li')).toHaveCount(4);
  await expect(page.locator('#connect')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.pkce')).reported)).toBe(true);
  await page.reload();
  await expect(page.locator('#client-id')).toBeVisible();
  await expect(help).toHaveCount(0);
});

test('si el token falla por la Redirect URI, el mensaje es claro y sin el texto de Spotify', async ({ page }) => {
  const state = await installMock(page, { lang: 'en' });
  state.tokenRedirectError = true;
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  const help = page.locator('#redirect-help');
  await expect(help).toBeVisible();
  await expect(help).toContainText('Spotify does not accept the Redirect URI of this address.');
  await expect(help.locator('input')).toHaveValue(BASE);
  await expect(page.locator('p.error')).toBeHidden();
});
