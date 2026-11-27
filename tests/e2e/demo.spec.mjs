// Modo demo (v1.4.0): la app entera con datos inventados, sin login, sin Client ID y sin ninguna petición a Spotify.
import { test, expect } from '@playwright/test';
import { idle, pick, openPanel } from './helpers.mjs';

/** Cualquier petición a Spotify (API, cuentas, imágenes) se apunta y se corta: en la demo no debe haber ninguna. */
async function watchSpotify(page) {
  const calls = [];
  await page.route(/https:\/\/([a-z0-9-]+\.)*(spotify\.com|scdn\.co|spotifycdn\.com)\//, (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  return calls;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('baraja.lang')) localStorage.setItem('baraja.lang', JSON.stringify('es'));
  });
});

test('desde la bienvenida, «Probar la demo» abre la app con la franja y sin tocar Spotify', async ({ page }) => {
  const calls = await watchSpotify(page);
  await page.goto('/');
  await page.locator('#try-demo').click();
  await expect(page).toHaveURL(/\?demo=1$/);
  await expect(page.locator('#demo-bar')).toHaveText('Modo demo · los cambios no se guardan en Spotify');
  await expect(page.locator('#demo-connect')).toBeVisible();
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Domingo lento' })).toBeVisible();
  // La franja sigue a la vista al bajar (va pegada arriba con la cabecera).
  await page.mouse.wheel(0, 1500);
  await expect(page.locator('#demo-bar')).toBeInViewport();
  expect(calls).toEqual([]);
});

test('barajar, ver las carátulas generadas y reproducir funciona entero en la demo', async ({ page }) => {
  const calls = await watchSpotify(page);
  await page.goto('/?demo=1');
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Domingo lento');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle #result-meta')).toBeVisible();
  await idle(page);
  const covers = page.locator('#panel-shuffle .result img.track-cover');
  await expect(covers.first()).toBeVisible();
  const srcs = await covers.evaluateAll((list) => list.map((i) => i.getAttribute('src')));
  expect(srcs.length).toBeGreaterThan(20);
  expect(srcs.every((s) => s.startsWith('data:image/svg+xml,'))).toBe(true);
  // Sin logo de Spotify: nada de lo que se ve viene de Spotify.
  await expect(page.locator('#panel-shuffle .spotify-attrib').first()).toBeHidden();
  await page.locator('#panel-shuffle #play-now').click();
  await expect(page.locator('#play-msg')).toContainText('iPhone de la demo');
  await expect(page.locator('#play-msg')).toHaveClass('play-ok');
  await idle(page);
  // «Abrir en Spotify» explica que la playlist no existe en Spotify.
  await page.locator('#panel-shuffle #open-spotify').click();
  await expect(page.locator('#toast')).toContainText('no existen en Spotify');
  expect(calls).toEqual([]);
});

test('Descubrir, Tu resumen y la prueba de aleatoriedad tienen datos en la demo', async ({ page }) => {
  test.setTimeout(90000);
  const calls = await watchSpotify(page);
  await page.goto('/?demo=1');
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(page.locator('#panel-new #result-meta')).toBeVisible();
  await idle(page);
  expect(await page.locator('#panel-new .result .track').count()).toBeGreaterThan(5);

  await openPanel(page, 'explore');
  await page.locator('#explore-go').click();
  await expect(page.locator('#panel-explore #result-meta')).toBeVisible();
  await idle(page);

  await openPanel(page, 'summary');
  await page.locator('#summary-go').click();
  await expect(page.locator('#summary-out')).toBeVisible();
  await idle(page);
  await expect(page.locator('#summary-artists .track').first()).toBeVisible();

  await openPanel(page, 'proof');
  await expect(page.locator('#proof-fair .bar')).toHaveCount(10);
  expect(calls).toEqual([]);
});

test('la demo no lee ni escribe tu sesión, tus mezclas ni tu caché de la app de verdad', async ({ page }) => {
  const calls = await watchSpotify(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('baraja.clientId', JSON.stringify('0123456789abcdef0123456789abcdef'));
    localStorage.setItem('baraja.tokens', JSON.stringify({ access_token: 'real', refresh_token: 'real', expires_at: Date.now() + 3600000, scope: '' }));
    localStorage.setItem('baraja.mixes', JSON.stringify([]));
  });
  await page.goto('/?demo=1');
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Cocinando');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle #result-meta')).toBeVisible();
  await idle(page);
  const stored = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  expect(JSON.parse(stored['baraja.tokens']).access_token).toBe('real');
  expect(stored['baraja.mixes']).toBe('[]');
  for (const k of ['baraja.undo', 'baraja.lastMix', 'baraja.reqDay', 'baraja.recent', 'baraja.purgeOk']) expect(stored[k], k).toBeUndefined();
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(dbs).not.toContain('shuffl-cache');
  expect(calls).toEqual([]);
});

test('Diagnóstico sale todo en verde en la demo (sin pedir permisos que no hay) y sin atajos de Siri', async ({ page }) => {
  const calls = await watchSpotify(page);
  await page.goto('/?demo=1');
  await expect(page.locator('[data-mix]').first()).toBeVisible();
  await expect(page.locator('[data-shortcut]')).toHaveCount(0);
  await openPanel(page, 'diag');
  await page.locator('#run-diag').click();
  await expect(page.locator('#diag-results li')).toHaveCount(4);
  await expect(page.locator('#diag-results li.bad')).toHaveCount(0);
  expect(calls).toEqual([]);
});

test('«Conectar mi Spotify» sale de la demo a la pantalla de conexión', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.locator('#demo-connect').click();
  await expect(page.locator('#client-id')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#demo-bar')).toHaveCount(0);
});

test('la demo también está en inglés', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baraja.lang', JSON.stringify('en')));
  await page.goto('/?demo=1');
  await expect(page.locator('#demo-bar')).toHaveText('Demo mode · changes are not saved to Spotify');
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Slow Sunday' })).toBeVisible();
});
