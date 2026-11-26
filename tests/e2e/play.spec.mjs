import { test, expect } from '@playwright/test';
import { CLIENT_ID } from './mock.mjs';
import { installMock, login, idle, pick } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

async function shuffleChill(page) {
  await login(page);
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  await idle(page);
}

test('Reproducir ahora con dispositivo activo: apaga el aleatorio y reproduce desde 0', async ({ page }) => {
  await shuffleChill(page);
  const created = [...state.lists.values()].find((l) => l.name === 'Chill · Shuffle');
  await page.locator('#play-now').click();
  await expect(page.getByText('Reproduciendo en iPhone de prueba.')).toBeVisible();
  expect(state.playerCalls.map((c) => c.path)).toEqual(['/me/player/shuffle', '/me/player/play']);
  expect(state.playerCalls[0].query).toMatchObject({ state: 'false', device_id: 'dev-phone' });
  expect(state.playerCalls[1].body).toEqual({ context_uri: `spotify:playlist:${created.id}`, offset: { position: 0 } });
});

test('Reproducir ahora sin dispositivo explica qué hacer y enlaza a Spotify', async ({ page }) => {
  state.devices = [];
  await shuffleChill(page);
  await page.locator('#play-now').click();
  await expect(page.getByText('Abre Spotify un momento en este móvil y vuelve a pulsar')).toBeVisible();
  await expect(page.getByRole('link', { name: 'LISTEN ON SPOTIFY' })).toHaveAttribute('href', 'https://open.spotify.com/');
  await expect(page.getByText('apagar el aleatorio de Spotify')).toBeVisible();
  expect(state.playerCalls).toEqual([]);
});

test('Reproducir ahora con dispositivos inactivos deja elegir en una hoja inferior', async ({ page }) => {
  state.devices = [
    { id: 'd1', name: 'Altavoz salón', type: 'Speaker', is_active: false },
    { id: 'd2', name: 'Portátil', type: 'Computer', is_active: false },
  ];
  await shuffleChill(page);
  await page.locator('#play-now').click();
  await expect(page.getByRole('dialog', { name: 'Elige dónde reproducir' })).toBeVisible();
  await page.getByRole('button', { name: /Portátil/ }).click();
  await expect(page.getByText('Reproduciendo en Portátil.')).toBeVisible();
  expect(state.playerCalls[1].query.device_id).toBe('d2');

  state.playerCalls.length = 0;
  await page.locator('#play-now').click();
  await expect(page.getByRole('dialog', { name: 'Elige dónde reproducir' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.playerCalls).toEqual([]);
});

test('si el dispositivo desaparece (404) se muestra la ayuda y si es Premium se avisa', async ({ page }) => {
  await shuffleChill(page);
  state.playError = { status: 404, body: { error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } } };
  await page.locator('#play-now').click();
  await expect(page.getByText('Abre Spotify un momento en este móvil')).toBeVisible();

  state.playError = { status: 403, body: { error: { status: 403, message: 'Premium required', reason: 'PREMIUM_REQUIRED' } } };
  await page.locator('#play-now').click();
  await expect(page.getByRole('alert')).toContainText('requiere Spotify Premium');
});

test('QUOTA_EXCEEDED se muestra claro y sin reintentos', async ({ page }) => {
  await shuffleChill(page);
  let calls = 0;
  await page.route('https://api.spotify.com/v1/me/player/devices', (route) => {
    calls++;
    return route.fulfill({
      status: 429, headers: { 'access-control-allow-origin': '*', 'retry-after': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ error: { status: 429, message: 'quota', reason: 'QUOTA_EXCEEDED' } }),
    });
  });
  await page.locator('#play-now').click();
  await expect(page.getByRole('alert')).toContainText('QUOTA_EXCEEDED');
  expect(calls).toBe(1);
});

test('una sesión sin los scopes nuevos pide volver a conectar con un solo botón', async ({ page }) => {
  state.grantedScope = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read';
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.locator('#reconnect-msg')).toContainText('funciones nuevas');
  state.grantedScope = undefined;
  await page.locator('#reconnect').click();
  await expect(page.locator('#tab-shuffle')).toBeVisible();
  expect(state.authorizeParams.scope).toContain('user-modify-playback-state');
});

test('el login pide los scopes de reproducción', async ({ page }) => {
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.locator('#tab-shuffle')).toBeVisible();
  expect(state.authorizeParams.scope.split(' ')).toEqual(expect.arrayContaining(['user-read-playback-state', 'user-modify-playback-state']));
});
