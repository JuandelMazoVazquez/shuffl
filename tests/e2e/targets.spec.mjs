import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const targets = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('baraja.targets') ?? '{}'));

async function shuffle(page, ...names) {
  for (const n of names) await pick(page, 'shuffle', n);
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle .result-title')).toContainText(/Listo|Done/);
  await idle(page);
  await page.getByRole('button', { name: /^(Volver|Back)$/ }).first().click();
  for (const n of names) await pick(page, 'shuffle', n);
}

test('cada origen tiene su propia playlist «· Shuffle» y se reutiliza al volver a barajarlo', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Rock');
  const [rock] = byName('Rock · Shuffle');
  expect(rock.tracks).toHaveLength(120);
  expect(rock.description).toBe('Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Rock');
  expect(await targets(page)).toEqual({ 'pl:pl_rock': rock.id });

  await shuffle(page, 'Chill');
  await shuffle(page, 'Rock');
  expect(byName('Rock · Shuffle')).toHaveLength(1);
  expect(byName('Chill · Shuffle')).toHaveLength(1);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(2);
  expect(state.writes.filter((w) => w.op === 'put' && w.id === rock.id)).toHaveLength(2);
  expect(state.writes.filter((w) => w.op === 'details')).toEqual([]);

  await shuffle(page, 'Chill', 'Rock');
  await shuffle(page, 'Rock', 'Chill');
  expect(byName('Mix · Shuffle')).toHaveLength(1);
  expect(byName('Mix · Shuffle')[0].description).toContain('Origen: Rock, Chill');
  expect(Object.keys(await targets(page)).sort()).toEqual(['pl:pl_chill', 'pl:pl_chill,pl_rock', 'pl:pl_rock']);
});

test('Tus me gusta y toda la biblioteca tienen nombres propios', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Tus me gusta');
  expect(byName('Tus me gusta · Shuffle')).toHaveLength(1);
  await page.locator('#select-library').click();
  await page.locator('#shuffle-go').click();
  await idle(page);
  expect(byName('Toda mi música · Shuffle')).toHaveLength(1);
  expect(byName('Toda mi música · Shuffle')[0].description).toContain('Origen: Toda mi música');
  expect(Object.keys(await targets(page)).sort()).toEqual(['library', 'pl:__liked__']);
});

test('en inglés: «Liked Songs · Shuffle», «All my music · Shuffle» y descripción traducida', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baraja.lang', JSON.stringify('en')));
  await login(page);
  await pick(page, 'shuffle', 'Liked Songs');
  await page.locator('#shuffle-go').click();
  await idle(page);
  const [liked] = byName('Liked Songs · Shuffle');
  expect(liked.description).toBe('Shuffled with Shuffl (uniform random; play it with Spotify shuffle off). Source: Liked Songs');
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await page.locator('#select-library').click();
  await page.locator('#shuffle-go').click();
  await idle(page);
  expect(byName('All my music · Shuffle')).toHaveLength(1);
});

test('toda la biblioteca no lee las playlists generadas', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Rock');
  await page.locator('#select-library').click();
  await expect(page.locator('#selection-info')).toContainText('4 playlists');
  const reads = [];
  page.on('request', (r) => { if (r.method() === 'GET') reads.push(r.url()); });
  await page.locator('#shuffle-go').click();
  await idle(page);
  const rockGen = byName('Rock · Shuffle')[0];
  expect(reads.some((u) => u.includes(`/playlists/${rockGen.id}/items`))).toBe(false);
});

test('si el origen cambia de nombre, la generada se renombra en la siguiente baraja (misma playlist)', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Rock');
  const [gen] = byName('Rock · Shuffle');
  state.lists.get('pl_rock').name = 'Rock clásico';
  await page.reload();
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Rock clásico');
  await page.locator('#shuffle-go').click();
  await idle(page);
  expect(state.lists.get(gen.id).name).toBe('Rock clásico · Shuffle');
  expect(state.lists.get(gen.id).description).toContain('Origen: Rock clásico');
  expect(state.writes.filter((w) => w.op === 'details')).toEqual([
    { op: 'details', id: gen.id, name: 'Rock clásico · Shuffle', description: expect.stringContaining('Rock clásico') },
  ]);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(1);
});

test('si no se puede renombrar, la baraja sigue y hay un aviso', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Rock');
  state.failDetails = true;
  state.lists.get('pl_rock').name = 'Rock 2';
  await page.reload();
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Rock 2');
  await page.locator('#shuffle-go').click();
  await expect(page.getByText('No se pudo actualizar el nombre de la playlist')).toBeVisible();
  await expect(page.locator('#panel-shuffle .result-title')).toContainText('Listo: 120');
});

test('si renombras la generada para conservarla (sin «· Shuffle»), se deja intacta y se crea otra', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Rock');
  const [kept] = byName('Rock · Shuffle');
  kept.name = 'Rock junio';
  const before = kept.tracks.map((t) => t.uri);
  const writesBefore = state.writes.filter((w) => w.id === kept.id).length;
  await shuffle(page, 'Rock');
  expect(state.lists.get(kept.id).name).toBe('Rock junio');
  expect(state.lists.get(kept.id).tracks.map((t) => t.uri)).toEqual(before);
  expect(state.writes.filter((w) => w.id === kept.id)).toHaveLength(writesBefore);
  expect(state.images.filter((i) => i.id === kept.id)).toHaveLength(1);
  const [fresh] = byName('Rock · Shuffle');
  expect(fresh.id).not.toBe(kept.id);
  expect(await targets(page)).toEqual({ 'pl:pl_rock': fresh.id });
});

test('si otra pestaña está escribiendo, la baraja espera a que termine (Web Locks)', async ({ page, context }) => {
  await login(page);
  const other = await context.newPage();
  // Mismo origen pero sin la app: así no arranca otra sesión contra el Spotify real.
  await other.goto('/manifest.webmanifest');
  await other.evaluate(() => { navigator.locks.request('shuffl-write', () => new Promise((ok) => { window.__release = ok; })); });
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await page.waitForTimeout(1500);
  expect(state.writes.filter((w) => w.op === 'put')).toEqual([]);
  await expect(page.locator('body')).toHaveClass(/busy/);
  await other.evaluate(() => window.__release());
  await expect(page.locator('#panel-shuffle .result-title')).toContainText('Listo: 120');
  expect(byName('Rock · Shuffle')).toHaveLength(1);
});

test('si la generada desaparece se crea otra y se actualiza la correspondencia', async ({ page }) => {
  await login(page);
  await shuffle(page, 'Rock');
  const [old] = byName('Rock · Shuffle');
  state.lists.delete(old.id);
  await shuffle(page, 'Rock');
  const [now] = byName('Rock · Shuffle');
  expect(now.id).not.toBe(old.id);
  expect(await targets(page)).toEqual({ 'pl:pl_rock': now.id });
});

test('«una nueva cada vez» crea «Rock · Shuffle · fecha» y no toca la correspondencia', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#panel-shuffle label.choice', { hasText: 'Playlist nueva' }).click();
  await page.locator('#shuffle-go').click();
  await idle(page);
  const made = [...state.lists.values()].filter((l) => l.name.startsWith('Rock · Shuffle · '));
  expect(made).toHaveLength(1);
  expect(await targets(page)).toEqual({});
});

test('la correspondencia guardada con formato raro se ignora y nunca se escribe en otra playlist', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baraja.targets', JSON.stringify({ 'pl:pl_rock': '../pl_chill', 'pl:pl_chill': 'pl_rock' })));
  await login(page);
  await shuffle(page, 'Chill');
  expect(state.writes.some((w) => w.id === 'pl_rock')).toBe(false);
  expect(byName('Chill · Shuffle')).toHaveLength(1);
  expect(state.lists.get('pl_rock').tracks).toHaveLength(120);
});

test('migración: aviso único para borrar a mano la antigua «🔀 Baraja», que no se toca', async ({ page }) => {
  state.lists.set('pl_old', { id: 'pl_old', name: '🔀 Baraja', owner: { id: 'me' }, tracks: state.liked.slice(0, 5) });
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('baraja.playlistId', JSON.stringify('pl_old')); sessionStorage.setItem('seeded', '1'); } });
  await login(page);
  const notice = page.locator('#migration-notice');
  await expect(notice).toContainText('La antigua «🔀 Baraja» ya no se actualiza');
  await expect(notice).toContainText('bórrala a mano en Spotify');
  await shuffle(page, 'Rock');
  expect(state.lists.get('pl_old').tracks).toHaveLength(5);
  expect(state.writes.some((w) => w.id === 'pl_old')).toBe(false);
  await notice.getByRole('button').click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#migration-notice')).toHaveCount(0);
});

test('sin «🔀 Baraja» antigua no hay aviso de migración', async ({ page }) => {
  await login(page);
  await page.waitForTimeout(300);
  await expect(page.locator('#migration-notice')).toHaveCount(0);
});
