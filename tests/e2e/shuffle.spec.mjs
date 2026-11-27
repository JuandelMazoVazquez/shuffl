import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { CLIENT_ID } from './mock.mjs';
import { installMock, login, idle, pick, names, shot, openPanel, moreOptions, BASE } from './helpers.mjs';

const SHOTS = 'docs/capturas';
mkdirSync(SHOTS, { recursive: true });

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

test('pantalla inicial, guía y login completo con PKCE', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Shuffl' })).toBeVisible();
  await expect(page.locator('.copybox input')).toHaveValue(BASE);
  await shot(page, `${SHOTS}/01-bienvenida.png`, { fullPage: true });

  await page.locator('#client-id').fill('mal');
  await page.locator('#connect').click();
  await expect(page.getByRole('alert')).toContainText('32 caracteres');

  await login(page);
  expect(state.authorizeParams.code_challenge_method).toBe('S256');
  expect(state.authorizeParams.client_id).toBe(CLIENT_ID);
  expect(state.authorizeParams.scope).toContain('playlist-modify-private');
  expect(state.authorizeParams.redirect_uri).toBe(BASE);
  expect(state.lastTokenBody.get('code_verifier')).toHaveLength(96);
  expect(page.url()).toBe(BASE);
  await expect(page.locator('#panel-shuffle .followed', { hasText: 'Top 50 Global' })).toContainText('No se puede leer');
  await expect(page.locator('#panel-shuffle input[type=checkbox]:disabled')).toHaveCount(0);
  await shot(page, `${SHOTS}/02-barajar.png`);
});

test('state incorrecto en el callback cierra el intento sin iniciar sesión', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('shuffl.pkce', JSON.stringify({ verifier: 'v', state: 'esperado' })));
  await page.goto('/?code=abc&state=otro');
  await expect(page.getByRole('alert')).toContainText('no coincide');
  expect(await page.evaluate(() => localStorage.getItem('shuffl.tokens'))).toBeNull();
  expect(page.url()).toBe(BASE);
});

test('barajar dos playlists combinadas en «Mix · Shuffl», volver a barajar y deshacer', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^180 (canciones|songs) ·/ })).toBeVisible();
  await expect(page.getByText('20 repetidas quitadas.')).toBeVisible();

  const created = [...state.lists.values()].find((l) => l.name === 'Mix · Shuffl');
  expect(created).toBeTruthy();
  expect(new Set(created.tracks.map((t) => t.uri)).size).toBe(180);
  expect(created.description).toMatch(/ · shuffl:cat=shuffle · shuffl:src=[a-f0-9]{10}.[a-f0-9]{6}$/);

  expect(created.description.replace(/ · shuffl:cat=shuffle · shuffl:src=[a-f0-9]{10}.[a-f0-9]{6}$/, '')).toBe('Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Rock, Chill');
  const natural = [...state.lists.get('pl_rock').tracks, ...state.lists.get('pl_chill').tracks].map((t) => t.name);
  expect(names(created)).not.toEqual(natural.slice(0, 180));
  // Playlist nueva: se crea y se llena en bloques de 100 (nada que sobrescribir).
  expect(state.writes.filter((w) => w.op === 'put' && w.id === created.id)).toHaveLength(0);
  expect(state.writes.filter((w) => w.op === 'post' && w.id === created.id)).toHaveLength(2);
  await expect(page.locator('#panel-shuffle .tracks .track')).toHaveCount(30);

  const first = names(created).join();
  await page.getByRole('button', { name: 'Volver a barajar' }).click();
  await idle(page);
  expect(created.tracks).toHaveLength(180);
  expect(names(created).join()).not.toBe(first);
  expect(new Set(created.tracks.map((t) => t.uri)).size).toBe(180);
  expect([...state.lists.values()].filter((l) => l.name === 'Mix · Shuffl')).toHaveLength(1);

  await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(page.getByText('Cambio deshecho.')).toBeVisible();
  expect(names(created).join()).toBe(first);

  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await idle(page);
  await expect(page.locator('#result-meta:visible', { hasText: /^180 (canciones|songs) ·/ })).toBeVisible();
  expect([...state.lists.values()].filter((l) => l.name === 'Mix · Shuffl')).toHaveLength(1);
});

test('si la playlist «· Shuffl» desaparece se crea una nueva', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^120 (canciones|songs) ·/ })).toBeVisible();
  const old = [...state.lists.values()].find((l) => l.name === 'Rock · Shuffl');
  state.lists.delete(old.id);
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^120 (canciones|songs) ·/ })).toBeVisible();
  const now = [...state.lists.values()].filter((l) => l.name === 'Rock · Shuffl');
  expect(now).toHaveLength(1);
  expect(now[0].id).not.toBe(old.id);
});

test('barajar la propia playlist pide confirmación y se puede deshacer', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  const before = names(state.lists.get('pl_rock')).join();
  await moreOptions(page);
  await page.locator('#panel-shuffle label.choice', { hasText: 'Barajar mi playlist original' }).click();
  state.dismissNext = true;
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect.poll(() => state.dismissNext).toBe(false);
  await page.waitForTimeout(300);
  expect(names(state.lists.get('pl_rock')).join()).toBe(before);
  expect(state.writes.some((w) => w.id === 'pl_rock')).toBe(false);

  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^120 (canciones|songs) ·/ })).toBeVisible();
  expect(names(state.lists.get('pl_rock')).join()).not.toBe(before);
  await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(page.getByText('Cambio deshecho.')).toBeVisible();
  expect(names(state.lists.get('pl_rock')).join()).toBe(before);
});

test('ordenar «Tus me gusta» por título a una playlist nueva y atajo de copia', async ({ page }) => {
  await login(page);
  await openPanel(page, 'sort');
  await shot(page, `${SHOTS}/04-ordenar.png`);
  await pick(page, 'sort', 'Tus me gusta');
  await page.locator('#sort-key').selectOption('title');
  await page.locator('#panel-sort .btn.primary.big').click();
  await expect(page.getByText('Listo: 60 canciones ordenadas')).toBeVisible();
  const created = state.lists.get('new1');
  expect(created.name).toContain('Tus me gusta');
  expect(names(created)).toEqual([...names(created)].sort((a, b) => a.localeCompare(b)));
  expect(created.tracks).toHaveLength(60);

  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: /Copiar Tus me gusta a una playlist/ }).click();
  await expect(page.getByText('Listo: 60 canciones copiadas')).toBeVisible();
  const copy = state.lists.get('new2');
  expect(copy.name).toBe('Tus me gusta (copia)');
  expect(names(copy)).toEqual(state.liked.map((t) => t.name));
});

test('ordenar por fecha de lanzamiento descendente', async ({ page }) => {
  await login(page);
  await openPanel(page, 'sort');
  await pick(page, 'sort', 'Rock');
  await page.locator('#sort-key').selectOption('release-desc');
  await page.locator('#panel-sort .btn.primary.big').click();
  await expect(page.getByText('Listo: 120 canciones ordenadas')).toBeVisible();
  const years = state.lists.get('new1').tracks.map((t) => Number(t.album.release_date.slice(0, 4)));
  expect(years).toEqual([...years].sort((a, b) => b - a));
});

test('duplicados: analizar, quitar del original y deshacer', async ({ page }) => {
  await login(page);
  await openPanel(page, 'dups');
  await expect(page.locator('#panel-dups label.row', { hasText: 'Tus me gusta' })).toContainText('No se puede modificar');
  await pick(page, 'dups', 'Con repetidas');
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.getByText('3 canciones repetidas')).toBeVisible();
  await shot(page, `${SHOTS}/05-duplicados.png`, { fullPage: true });

  const original = state.lists.get('pl_dupes').tracks.map((t) => t.uri);
  await page.getByRole('button', { name: 'Quitar del original' }).click();
  await expect(page.getByText('Listo: 3 repetidas quitadas')).toBeVisible();
  const after = state.lists.get('pl_dupes').tracks;
  expect(after).toHaveLength(5);
  expect(after.map((t) => t.name)).toContain('Otra - Live');
  expect(new Set(after.map((t) => t.uri)).size).toBe(5);

  await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(page.getByText('Cambio deshecho.')).toBeVisible();
  expect(state.lists.get('pl_dupes').tracks.map((t) => t.uri)).toEqual(original);
});

test('duplicados: modo exacto y copia limpia sin tocar el original', async ({ page }) => {
  await login(page);
  await openPanel(page, 'dups');
  await pick(page, 'dups', 'Con repetidas');
  await page.locator('input[name=dup-mode][value=exact]').check();
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.getByText('1 canción repetida')).toBeVisible();
  await page.getByRole('button', { name: 'Crear copia limpia' }).click();
  await expect(page.getByText(/copia limpia con 7 canciones/)).toBeVisible();
  expect(state.lists.get('pl_dupes').tracks).toHaveLength(8);
  expect(state.lists.get('new1').name).toBe('Con repetidas (sin repetidas)');
});

test('copia de seguridad: exportar JSON y CSV y restaurar', async ({ page }) => {
  await login(page);
  await openPanel(page, 'backup');
  await pick(page, 'backup', 'Rock');
  await pick(page, 'backup', 'Tus me gusta');
  await page.getByRole('button', { name: 'Preparar copia' }).click();
  await expect(page.getByText('Copia lista: 180 canciones en 2 listas')).toBeVisible();
  await shot(page, `${SHOTS}/06-copia.png`, { fullPage: true });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save-json').click()]);
  const path = await dl.path();
  expect(dl.suggestedFilename()).toMatch(/^shuffl-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  expect(data).toMatchObject({ app: 'shuffl', version: 1 });
  expect(data.playlists).toHaveLength(2);
  expect(data.playlists.find((p) => p.isLiked).tracks).toHaveLength(60);

  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('#save-csv').click()]);
  expect(readFileSync(await dl2.path(), 'utf8')).toContain('playlist,uri,name');

  await page.locator('#restore-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('{"hola":1}') });
  await expect(page.getByRole('alert')).toContainText('no es una copia de Shuffl');
  await page.locator('#restore-file').setInputFiles(path);
  await expect(page.getByRole('button', { name: 'Restaurar' })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Restauradas 2 playlists.')).toBeVisible();
  const restored = [...state.lists.values()].filter((l) => l.name.endsWith('(restaurada)'));
  expect(restored.map((l) => l.tracks.length).sort()).toEqual([120, 60]);
});

test('ajustes: Redirect URI, idioma e inglés, cerrar sesión', async ({ page }) => {
  await login(page);
  await openPanel(page, 'settings');
  await expect(page.locator('#panel-settings .copybox input')).toHaveValue(BASE);
  await expect(page.locator('#settings-client-id')).toHaveValue(CLIENT_ID);
  await shot(page, `${SHOTS}/07-ajustes.png`, { fullPage: true });
  await page.locator('#lang-select').selectOption('en');
  await expect(page.locator('#tab-shuffle')).toContainText('Shuffle');
  await expect(page.locator('#panel-settings')).toBeVisible();
  await page.locator('#logout').click();
  await expect(page.locator('#connect')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('shuffl.tokens'))).toBeNull();
});

test('sin horizontal scroll y objetivos táctiles de 44 px', async ({ page }) => {
  await login(page);
  for (const tab of ['home', 'shuffle', 'discover', 'more']) {
    await page.locator(`#tab-${tab}`).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
  const small = await page.evaluate(() => [...document.querySelectorAll('button, .row, select, input[type=search]')]
    .filter((el) => el.offsetParent && el.getBoundingClientRect().height < 43.5).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
});

test('escritura a medias: reintentar no pisa el Deshacer y Deshacer recupera el original', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  const original = state.lists.get('pl_rock').tracks.map((t) => t.uri);
  await moreOptions(page);
  await page.locator('#panel-shuffle label.choice', { hasText: 'Barajar mi playlist original' }).click();
  state.failNextPost = true;
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.lists.get('pl_rock').tracks).toHaveLength(100);

  const writesBefore = state.writes.length;
  await page.locator('#working-back').click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByRole('alert')).toContainText('no terminó');
  expect(state.writes).toHaveLength(writesBefore);

  await openPanel(page, 'settings');
  await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(page.getByText('Cambio deshecho.')).toBeVisible();
  expect(state.lists.get('pl_rock').tracks.map((t) => t.uri)).toEqual(original);
});

test('duplicados: si el orden cambió en Spotify con el mismo total no se escribe', async ({ page }) => {
  await login(page);
  await openPanel(page, 'dups');
  await pick(page, 'dups', 'Con repetidas');
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.getByText('3 canciones repetidas')).toBeVisible();
  const list = state.lists.get('pl_dupes');
  [list.tracks[0], list.tracks[1]] = [list.tracks[1], list.tracks[0]];
  const writesBefore = state.writes.length;
  await page.getByRole('button', { name: 'Quitar del original' }).click();
  await expect(page.getByRole('alert')).toContainText('ha cambiado');
  expect(state.writes).toHaveLength(writesBefore);
});

test('Deshacer no se aplica si la playlist cambió después de la operación', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await moreOptions(page);
  await page.locator('#panel-shuffle label.choice', { hasText: 'Barajar mi playlist original' }).click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^120 (canciones|songs) ·/ })).toBeVisible();
  const list = state.lists.get('pl_rock');
  list.tracks.push([...state.catalog.values()][500]);
  const writesBefore = state.writes.length;
  await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(page.getByRole('alert')).toContainText('ha cambiado');
  expect(state.writes).toHaveLength(writesBefore);
});

test('volver a barajar a medias: Deshacer sigue recuperando el original y otra playlist no lo pisa', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  const original = state.lists.get('pl_rock').tracks.map((t) => t.uri);
  await moreOptions(page);
  await page.locator('#panel-shuffle label.choice', { hasText: 'Barajar mi playlist original' }).click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^120 (canciones|songs) ·/ })).toBeVisible();
  state.failNextPost = true;
  await page.getByRole('button', { name: 'Volver a barajar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.lists.get('pl_rock').tracks).toHaveLength(100);

  await openPanel(page, 'dups');
  await pick(page, 'dups', 'Con repetidas');
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.getByText('3 canciones repetidas')).toBeVisible();
  const writesBefore = state.writes.length;
  await page.getByRole('button', { name: 'Quitar del original' }).click();
  await expect(page.getByRole('alert')).toContainText('no terminó');
  expect(state.writes).toHaveLength(writesBefore);

  await openPanel(page, 'settings');
  await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
  await expect(page.getByText('Cambio deshecho.')).toBeVisible();
  expect(state.lists.get('pl_rock').tracks.map((t) => t.uri)).toEqual(original);
});

test('ninguna pantalla de resultado muestra «null», «undefined» ni «false»', async ({ page }) => {
  const clean = async (label) => {
    const text = await page.locator('main').innerText();
    expect(text, label).not.toMatch(/\b(null|undefined|false)\b/);
  };
  await login(page);

  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  await clean('barajar');

  await openPanel(page, 'sort');
  await pick(page, 'sort', 'Chill');
  await page.locator('#panel-sort .btn.primary.big').click();
  await expect(page.locator('#panel-sort .result-title')).toBeVisible();
  await clean('ordenar');

  await openPanel(page, 'dups');
  await pick(page, 'dups', 'Rock');
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.locator('#panel-dups .result-title')).toBeVisible();
  await clean('duplicados');

  await openPanel(page, 'backup');
  await pick(page, 'backup', 'Rock');
  await page.getByRole('button', { name: 'Preparar copia' }).click();
  await expect(page.getByText('Copia lista: 120 canciones en 1 listas')).toBeVisible();
  await clean('copia');

  const uri = (i) => `spotify:track:${String(i).padStart(22, '0')}`;
  const backup = { app: 'shuffl', version: 1, playlists: [{ id: 'x', name: 'Mi lista', tracks: [{ uri: uri(1) }, { uri: uri(2) }] }] };
  await page.locator('#restore-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('button', { name: 'Restaurar' })).toBeVisible();
  await clean('restaurar (lista)');
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Restauradas 1 playlists.')).toBeVisible();
  await clean('restaurar (hecho)');
});

test('importar: archivo enorme se rechaza sin leerlo', async ({ page }) => {
  await login(page);
  await openPanel(page, 'backup');
  await page.locator('#restore-file').setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(21 * 1024 * 1024, 32) });
  await expect(page.getByRole('alert')).toContainText('demasiado grande');
});
