import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { CLIENT_ID } from './mock.mjs';
import { installMock, login, idle, pick, shot } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const baraja = () => [...state.lists.values()].find((l) => l.name.startsWith('Rock ('));

test('orden combinado: artista → álbum cronológico → nº de pista', async ({ page }) => {
  await login(page);
  await page.locator('#tab-sort').click();
  await pick(page, 'sort', 'Rock');
  await expect(page.locator('#sort-then2')).toBeDisabled();
  await page.locator('#sort-key').selectOption('artist');
  await page.locator('#sort-then1').selectOption('album-chrono');
  await expect(page.locator('#sort-then2')).toBeEnabled();
  await page.locator('#sort-then2').selectOption('track-number');
  await expect(page.locator('#sort-name')).toHaveValue(/artista a-z → álbum \(cronológico\) → nº de pista/);
  await page.locator('#panel-sort .btn.primary.big').click();
  await expect(page.locator('#panel-sort .result-title')).toBeVisible();
  await idle(page);
  const out = [...state.lists.values()].find((l) => l.name.startsWith('Rock ('));
  expect(out.tracks).toHaveLength(120);
  const key = (t) => [t.artists[0].name, t.album.release_date, t.album.name, t.track_number];
  const sorted = [...out.tracks].map(key).every((k, i, all) => i === 0 || (
    all[i - 1][0] < k[0] || (all[i - 1][0] === k[0] && (all[i - 1][1] < k[1] || (all[i - 1][1] === k[1] && (all[i - 1][2] < k[2] || (all[i - 1][2] === k[2] && all[i - 1][3] <= k[3])))))));
  expect(sorted).toBe(true);
  await shot(page, 'docs/capturas/15-orden-combinado.png');
});

test('orden combinado: criterios repetidos se rechazan y «invertir» desactiva los siguientes', async ({ page }) => {
  await login(page);
  await page.locator('#tab-sort').click();
  await pick(page, 'sort', 'Rock');
  await page.locator('#sort-key').selectOption('artist');
  await page.locator('#sort-then1').selectOption('artist');
  await page.locator('#panel-sort .btn.primary.big').click();
  await expect(page.getByRole('alert')).toContainText('No repitas el mismo criterio');
  expect(state.writes).toEqual([]);
  await page.locator('#sort-key').selectOption('reverse');
  await expect(page.locator('#sort-then1')).toBeDisabled();
  await expect(page.locator('#sort-then1')).toHaveValue('');
});

test('copia ampliada: álbumes guardados y artistas seguidos (cursor) con UPC en JSON y CSV', async ({ page }) => {
  await login(page);
  await page.locator('#tab-backup').click();
  await pick(page, 'backup', 'Chill');
  await page.getByRole('button', { name: 'Preparar copia' }).click();
  await expect(page.getByText('Copia lista: 80 canciones en 1 listas')).toBeVisible();
  await expect(page.locator('#backup-extra')).toHaveText('7 álbumes y 120 artistas (con UPC).');
  await shot(page, 'docs/capturas/16-copia-ampliada.png', { fullPage: true });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save-json').click()]);
  const data = JSON.parse(await readFile(await dl.path(), 'utf8'));
  expect(data.albums).toHaveLength(7);
  expect(data.albums[0]).toMatchObject({ uri: 'spotify:album:alb0', upc: '00000000000', totalTracks: 10 });
  expect(data.artists).toHaveLength(120);
  expect(data.artists[119].uri).toBe('spotify:artist:art119');
  expect(JSON.stringify(data)).not.toContain('popularity');

  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('#save-library-csv').click()]);
  const csv = await readFile(await dl2.path(), 'utf8');
  expect(csv).toContain('type,uri,name,artists,releaseDate,totalTracks,upc,addedAt');
  expect(csv.trim().split('\r\n')).toHaveLength(1 + 7 + 120);
  expect(csv).toContain('album,spotify:album:alb1,Álbum guardado 1,Artista 1,1991-01-01,11,00000000001');
});

test('copia ampliada: se puede desmarcar y no pide álbumes ni artistas', async ({ page }) => {
  await login(page);
  await page.locator('#tab-backup').click();
  await page.locator('#inc-albums').uncheck();
  await page.locator('#inc-artists').uncheck();
  await expect(page.getByRole('button', { name: 'Preparar copia' })).toBeDisabled();
  await pick(page, 'backup', 'Chill');
  const calls = [];
  page.on('request', (r) => { if (/\/v1\/me\/(albums|following)/.test(r.url())) calls.push(r.url()); });
  await page.getByRole('button', { name: 'Preparar copia' }).click();
  await expect(page.getByText('Copia lista: 80 canciones en 1 listas')).toBeVisible();
  expect(calls).toEqual([]);
  await expect(page.locator('#save-library-csv')).toHaveCount(0);
});

test('copia solo de álbumes y artistas, y restaurar avisa de que no los restaura', async ({ page }) => {
  await login(page);
  await page.locator('#tab-backup').click();
  await page.getByRole('button', { name: 'Preparar copia' }).click();
  await expect(page.locator('#backup-extra')).toBeVisible();
  await expect(page.locator('#save-csv')).toHaveCount(0);
  const backup = { app: 'baraja', version: 1, playlists: [], albums: [{}, {}], artists: [{}] };
  await page.locator('#restore-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#restore-library-note')).toContainText('2 álbumes y 1 artistas');
});

test('asistente de alta: pasos guiados, copiar la Redirect URI y ayuda de errores típicos', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#open-dashboard')).toHaveAttribute('href', 'https://developer.spotify.com/dashboard');
  const steps = page.locator('.steps .step');
  await expect(steps).toHaveCount(5);
  await expect(steps.nth(2).locator('.copybox input')).toHaveValue('http://127.0.0.1:5173/');
  await expect(steps.nth(3).locator('#client-id')).toBeVisible();
  await page.getByLabel('Paso 1 hecho').check();
  await expect(steps.nth(0)).toHaveClass(/done/);
  await page.locator('#setup-diagnosis summary').click();
  const diag = page.locator('#setup-diagnosis');
  await expect(diag).toContainText('Invalid redirect URI');
  await expect(diag).toContainText('User Management');
  await expect(diag).toContainText('Premium');
  await expect(diag).toContainText('QUOTA_EXCEEDED');
  await shot(page, 'docs/capturas/17-asistente.png', { fullPage: true });

  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.locator('#tab-home')).toBeVisible();
});

test('diagnóstico de conexión: todo bien y 403 por usuario no añadido', async ({ page }) => {
  await login(page);
  await page.locator('#open-settings').click();
  await page.locator('#run-diag').click();
  await expect(page.locator('#diag-results li.ok')).toHaveCount(3);
  await expect(page.locator('#diag-results')).toContainText('Usuaria Prueba');

  await page.route('https://api.spotify.com/v1/me/playlists?limit=1', (route) => route.fulfill({
    status: 403, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
    body: JSON.stringify({ error: { status: 403, message: 'User not registered in the Developer Dashboard' } }),
  }));
  await page.locator('#run-diag').click();
  await expect(page.locator('#diag-results li.bad')).toHaveCount(1);
  await expect(page.locator('#diag-results li.bad')).toContainText('User Management');
});
