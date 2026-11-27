// Reproducir ahora (v1.3.2): elegir dispositivo, dar la orden, comprobar con GET /me/player que suena la playlist
// correcta con el aleatorio apagado y, si algo falla, explicarlo con una acción que lo arregla.
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
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  await idle(page);
  return [...state.lists.values()].find((l) => l.name === 'Chill · Shuffle');
}
const calls = (path) => state.playerCalls.filter((c) => c.path === path);
const msg = (page) => page.locator('#play-msg');

test('con el dispositivo activo: reproduce desde 0, apaga el aleatorio y comprueba que suena esta playlist', async ({ page }) => {
  const created = await shuffleChill(page);
  await page.locator('#play-now').click();
  await expect(msg(page)).toHaveText('Sonando en iPhone de prueba, en este orden (aleatorio de Spotify apagado).');
  expect(state.playerCalls.map((c) => c.path)).toEqual(['/me/player/play', '/me/player/shuffle', '/me/player']);
  expect(calls('/me/player/play')[0].query.device_id).toBe('dev-phone');
  expect(calls('/me/player/play')[0].body).toEqual({ context_uri: `spotify:playlist:${created.id}`, offset: { position: 0 } });
  expect(calls('/me/player/shuffle')[0].query).toMatchObject({ state: 'false', device_id: 'dev-phone' });
});

test('sin ningún Spotify abierto: «Abre Spotify un momento y vuelve a pulsar», Abrir en Spotify y Volver a intentar', async ({ page }) => {
  state.devices = [];
  const created = await shuffleChill(page);
  await page.locator('#play-now').click();
  await expect(msg(page)).toHaveText('Abre Spotify un momento y vuelve a pulsar.');
  await expect(page.locator('#play-open')).toHaveAttribute('href', `https://open.spotify.com/playlist/${created.id}`);
  expect(state.playerCalls).toEqual([]);
  state.devices = [{ id: 'dev-phone', name: 'iPhone de prueba', type: 'Smartphone', is_active: false }];
  await page.locator('#play-again').click();
  await expect(msg(page)).toContainText('Sonando en iPhone de prueba');
});

test('con varios dispositivos inactivos deja elegir en una hoja; Escape cancela sin dar ninguna orden', async ({ page }) => {
  state.devices = [
    { id: 'd1', name: 'Altavoz salón', type: 'Speaker', is_active: false },
    { id: 'd2', name: 'Portátil', type: 'Computer', is_active: false },
  ];
  await shuffleChill(page);
  await page.locator('#play-now').click();
  await expect(page.getByRole('dialog', { name: 'Elige dónde reproducir' })).toBeVisible();
  await page.getByRole('button', { name: /Portátil/ }).click();
  await expect(msg(page)).toContainText('Sonando en Portátil');
  expect(calls('/me/player/play')[0].query.device_id).toBe('d2');

  state.playerCalls.length = 0;
  await page.locator('#play-now').click();
  await expect(page.getByRole('dialog', { name: 'Elige dónde reproducir' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await idle(page);
  expect(state.playerCalls).toEqual([]);
});

test('NO_ACTIVE_DEVICE al dar la orden: reintenta una vez y explica qué hacer', async ({ page }) => {
  await shuffleChill(page);
  state.playError = { status: 404, body: { error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } } };
  await page.locator('#play-now').click();
  await expect(msg(page)).toHaveText('Abre Spotify un momento y vuelve a pulsar.');
  expect(calls('/me/player/play')).toHaveLength(2);
  await expect(page.locator('#play-open')).toBeVisible();
});

test('cuenta sin Premium: lo dice claro, ofrece abrirla en Spotify y no insiste', async ({ page }) => {
  await shuffleChill(page);
  state.playError = { status: 403, body: { error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } } };
  await page.locator('#play-now').click();
  await expect(msg(page)).toHaveText('Reproducir desde Shuffl requiere Spotify Premium. Puedes escucharla en Spotify.');
  await expect(page.locator('#play-open')).toBeVisible();
  await expect(page.locator('#play-again')).toHaveCount(0);
  expect(calls('/me/player/play')).toHaveLength(1);
});

test('dispositivo restringido (no acepta órdenes de otras apps): se explica y no se manda nada', async ({ page }) => {
  state.devices = [{ id: 'car', name: 'Coche', type: 'Automobile', is_active: true, is_restricted: true }];
  await shuffleChill(page);
  await page.locator('#play-now').click();
  await expect(msg(page)).toHaveText('Ese dispositivo no deja que otras apps lo controlen. Ábrela en Spotify.');
  expect(calls('/me/player/play')).toHaveLength(0);
});

test('dispositivo dormido (502): reintenta una vez y pide abrir Spotify', async ({ page }) => {
  await shuffleChill(page);
  state.playError = { status: 502, body: { error: { status: 502, message: 'Bad gateway' } } };
  await page.locator('#play-now').click();
  await expect(msg(page)).toContainText('no responde; puede estar en reposo');
  expect(calls('/me/player/play')).toHaveLength(2);
});

test('Spotify acepta la orden pero no la ejecuta: lo comprueba, reintenta una vez y lo explica', async ({ page }) => {
  await shuffleChill(page);
  state.playIgnored = true;
  await page.locator('#play-now').click();
  await expect(msg(page)).toHaveText('Spotify ha recibido la orden, pero no ha empezado a sonar. Abre Spotify y pulsa play en la playlist.');
  expect(calls('/me/player/play')).toHaveLength(2);
  expect(calls('/me/player')).toHaveLength(2);
  await expect(page.locator('#play-again')).toBeVisible();
});

test('si el aleatorio de Spotify no se apaga, se avisa (sonaría en otro orden)', async ({ page }) => {
  await shuffleChill(page);
  state.shuffleStuck = true;
  await page.locator('#play-now').click();
  await expect(msg(page)).toContainText('el aleatorio de Spotify sigue encendido');
});

test('QUOTA_EXCEEDED: mensaje amable sin códigos y sin reintentos', async ({ page }) => {
  await shuffleChill(page);
  state.failures.push({ match: /GET \/me\/player\/devices/, status: 429, body: { error: { status: 429, message: 'quota', reason: 'QUOTA_EXCEEDED' } } });
  await page.locator('#play-now').click();
  const alert = page.locator('#panel-shuffle .error-box:visible');
  await expect(alert).toContainText('Spotify limita cuántas búsquedas puede hacer la app. Vuelve a intentarlo en un rato.');
  await expect(alert).not.toContainText(/429|QUOTA/);
  expect(state.apiCalls.filter((c) => c === 'GET /me/player/devices')).toHaveLength(1);
});

test('sesión caducada (401 tras refrescar): «Volver a conectar»; sin red: «Reintentar»', async ({ page }) => {
  await shuffleChill(page);
  state.failures.push({ match: /GET \/me\/player\/devices/, status: 401, body: { error: { status: 401, message: 'The access token expired' } } });
  await page.locator('#play-now').click();
  const box = page.locator('#panel-shuffle .error-box:visible');
  await expect(box).toContainText('Tu sesión de Spotify ha caducado. Vuelve a conectar.');
  await expect(box.getByRole('button', { name: 'Volver a conectar' })).toBeVisible();
  state.failures.length = 0;
  state.failures.push({ match: /GET \/me\/player\/devices/, network: true, times: 1 });
  await page.locator('#play-now').click();
  await expect(box).toContainText('No hay conexión. Revisa tu red y vuelve a intentarlo.');
  await box.getByRole('button', { name: 'Reintentar' }).click();
  await expect(msg(page)).toContainText('Sonando en iPhone de prueba');
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
