// v1.3.1: en tu cuenta solo hay una playlist de Shuffl a la vez. Antes de crear la nueva se quitan TODAS las anteriores
// (con etiqueta, o antiguas con una descripción de una versión anterior), nunca una renombrada, ajena ni sin esa descripción.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel, moreOptions, shot } from './helpers.mjs';

let state;

const V12_ES = 'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: ';
const V12_EN = 'Shuffled with Shuffl (uniform random; play it with Spotify shuffle off). Source: ';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const appLists = () => [...state.lists.values()].filter((l) => l.owner.id === 'me' && /shuffl:src=/.test(l.description ?? ''));
/** Playlist que ya estaba en la cuenta. */
function addList(id, name, description, { owner = 'me', collaborative = false } = {}) {
  state.lists.set(id, { id, name, description, owner: { id: owner, display_name: owner }, collaborative, tracks: state.lists.get('pl_chill').tracks.slice(0, 3) });
}
const resultMeta = (page) => page.locator('#result-meta:visible');
async function shuffle(page, ...names) {
  await page.locator('#tab-shuffle').click();
  if (await page.locator('#panel-shuffle .result:not([hidden])').count()) await page.locator('#panel-shuffle .result').getByRole('button', { name: /^(Volver|Back)$/ }).click();
  for (const n of names) await pick(page, 'shuffle', n);
  await page.locator('#shuffle-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  await page.locator('#panel-shuffle .result').getByRole('button', { name: /^(Volver|Back)$/ }).click();
  for (const n of names) await pick(page, 'shuffle', n);
}

test.describe('con la hoja ya aceptada', () => {
  test.beforeEach(async ({ page }) => { state = await installMock(page); });

  test('nombres y descripción; cada shuffle deja una sola playlist de Shuffl', async ({ page }) => {
    await login(page);
    await shuffle(page, 'Rock');
    const [rock] = byName('Rock · Shuffl');
    expect(rock.description).toMatch(new RegExp(`^${esc(V12_ES)}Rock · shuffl:src=[a-f0-9]{10}.[a-f0-9]{6}$`));
    await shuffle(page, 'Chill');
    expect(byName('Rock · Shuffl')).toHaveLength(0);
    expect(byName('Chill · Shuffl')).toHaveLength(1);
    await shuffle(page, 'Tus me gusta');
    await shuffle(page, 'Chill', 'Rock');
    expect(appLists().map((l) => l.name)).toEqual(['Mix · Shuffl']);
    expect(state.unfollowCalls).toEqual([[`spotify:playlist:${rock.id}`], ['spotify:playlist:new2'], ['spotify:playlist:new3']]);
  });

  test('borra las antiguas sin etiqueta solo si su descripción es de una versión anterior; nunca renombradas, ajenas ni sin descripción', async ({ page }) => {
    addList('v12a', 'Spanish Rap · Shuffle', `${V12_ES}Spanish Rap`);
    addList('v12b', 'English Rap · Shuffle', `${V12_EN}English Rap`);
    addList('snap', '📸 Recently played', 'Snapshot created with Baraja');
    addList('snap2', '📸 Top 4 weeks', 'Snapshot created with Shuffl');
    addList('baraja', '🔀 Baraja', 'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado');
    addList('v13', '12 years ago · Shuffle', 'Lo que guardabas · shuffl:src=0123456789');
    addList('renamed', 'Mi rap favorito', `${V12_ES}Spanish Rap · shuffl:src=0123456789`);
    addList('mine', 'Gym · Shuffle', 'Mi playlist del gym');
    addList('empty', 'Coche · Shuffle', '');
    addList('foreign', 'Otro · Shuffle', `${V12_ES}Otro · shuffl:src=0123456789`, { owner: 'otra' });
    addList('collab', 'Colab · Shuffle', `${V12_ES}Colab`, { collaborative: true });
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(state.unfollowCalls.flat().sort()).toEqual(['baraja', 'snap', 'snap2', 'v12a', 'v12b', 'v13'].map((id) => `spotify:playlist:${id}`).sort());
    for (const id of ['renamed', 'mine', 'empty', 'foreign', 'collab']) expect(state.lists.has(id), id).toBe(true);
    expect(byName('Rock · Shuffl')).toHaveLength(1);
    await expect(page.locator('#panel-shuffle .note', { hasText: 'Se han quitado 6 playlists antiguas de Shuffl.' })).toBeVisible();
  });

  test('las playlists de Shuffl no se ofrecen como origen (ni en «toda mi biblioteca»)', async ({ page }) => {
    addList('v13', 'Rock · Shuffle', 'x · shuffl:src=0123456789');
    addList('renamed', 'Mi Rock', 'x · shuffl:src=0123456789');
    await login(page);
    await expect(page.locator('#panel-shuffle .row-name', { hasText: /^Rock · Shuffle$/ })).toHaveCount(0);
    await expect(page.locator('#panel-shuffle .row-name', { hasText: /^Mi Rock$/ })).toHaveCount(1);
    await page.locator('#select-library').click();
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(state.itemRequests).not.toContain('v13');
    expect(state.lists.has('v13')).toBe(false);
    expect(state.lists.has('renamed')).toBe(true);
  });

  test('si Spotify no deja borrar, se ve el error real, no se crea nada y «Reintentar» sigue sin volver a leer', async ({ page }) => {
    addList('old', 'Rock · Shuffle', 'x · shuffl:src=0123456789');
    state.failUnfollow = true;
    await login(page);
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#panel-shuffle .error')).toContainText('Spotify no ha dejado quitar las playlists antiguas');
    await expect(page.locator('#panel-shuffle .error')).toContainText('Spotify no ha permitido hacerlo');
    await expect(page.locator('#panel-shuffle .error')).not.toContainText(/403|\.\./);
    await expect(page.locator('#panel-shuffle .error-box').getByRole('button', { name: 'Volver a conectar' })).toBeVisible();
    expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(0);
    const reads = state.itemRequests.length;
    state.failUnfollow = false;
    await page.locator('#panel-shuffle .error-box').getByRole('button', { name: 'Reintentar' }).click();
    await expect(resultMeta(page)).toContainText('80 canciones');
    expect(state.itemRequests.length).toBe(reads);
    expect(state.lists.has('old')).toBe(false);
    expect(byName('Chill · Shuffl')[0].tracks).toHaveLength(80);
  });

  test('si falla crear la nueva después de borrar, error claro y «Reintentar» con las canciones en memoria', async ({ page }) => {
    addList('old', 'Rock · Shuffle', 'x · shuffl:src=0123456789');
    state.failCreate = true;
    await login(page);
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#panel-shuffle .error')).toContainText('No se pudo crear la playlist');
    await expect(page.locator('#working-back')).toBeVisible();
    expect(state.lists.has('old')).toBe(false);
    const reads = state.itemRequests.length;
    state.failCreate = false;
    await page.locator('#panel-shuffle .error-box').getByRole('button', { name: 'Reintentar' }).click();
    await expect(resultMeta(page)).toContainText('80 canciones');
    expect(state.itemRequests.length).toBe(reads);
    expect(appLists()).toHaveLength(1);
  });

  test('el diagnóstico prueba el borrado de verdad (crea y quita una playlist vacía)', async ({ page }) => {
    await login(page);
    await openPanel(page, 'diag');
    await page.locator('#run-diag').click();
    await expect(page.locator('#diag-results')).toContainText('✓ Quitar playlists — creada y quitada una playlist de prueba');
    expect(state.unfollowCalls.at(-1)[0]).toMatch(/^spotify:playlist:new\d+$/);
    expect(state.lists.size).toBe(4);
  });

  test('si Spotify responde bien pero no quita nada, se ve el error (nunca en silencio) y no se crea la nueva', async ({ page }) => {
    addList('old', 'Rock · Shuffle', 'x · shuffl:src=0123456789');
    state.unfollowNoop = true;
    await login(page);
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#panel-shuffle .error')).toContainText('las playlists siguen en tu biblioteca');
    expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(0);
    await openPanel(page, 'diag');
    await page.locator('#run-diag').click();
    await expect(page.locator('#diag-results')).toContainText('✗ Quitar playlists');
    await expect(page.locator('#diag-results')).toContainText('Shuffl · prueba de borrado');
  });

  test('una renombrada que conserva el sufijo no se borra (la etiqueta guarda el nombre original)', async ({ page }) => {
    await login(page);
    await shuffle(page, 'Rock');
    const [rock] = byName('Rock · Shuffl');
    rock.name = 'Rock del bueno · Shuffl';
    await shuffle(page, 'Chill');
    expect(state.lists.has(rock.id)).toBe(true);
    expect(state.unfollowCalls).toEqual([]);
  });

  test('si falla añadir canciones tras crear, «Reintentar» rellena la misma playlist (no crea otra)', async ({ page }) => {
    state.failNextPost = true;
    await login(page);
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#panel-shuffle .error')).toContainText('No se pudo crear la playlist');
    await page.locator('#panel-shuffle .error-box').getByRole('button', { name: 'Reintentar' }).click();
    await expect(resultMeta(page)).toContainText('80 canciones');
    expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(1);
    expect(byName('Chill · Shuffl')).toHaveLength(1);
    expect(byName('Chill · Shuffl')[0].tracks).toHaveLength(80);
  });

  test('«Volver a barajar» no escribe en una playlist que ya no está (otra pestaña la quitó): lo explica', async ({ page }) => {
    await login(page);
    await openPanel(page, 'forgotten');
    await page.locator('#forgotten-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    const [list] = byName('Olvidadas · Shuffl');
    state.lists.delete(list.id);
    const writes = state.writes.length;
    await page.locator('#forgotten-again').click();
    await expect(page.locator('#panel-forgotten .error')).toContainText('ya no está en tu biblioteca');
    expect(state.writes.length).toBe(writes);
  });

  test('el diagnóstico muestra el error real si Spotify no deja borrar', async ({ page }) => {
    state.failUnfollow = true;
    await login(page);
    await openPanel(page, 'diag');
    await page.locator('#run-diag').click();
    await expect(page.locator('#diag-results')).toContainText('✗ Quitar playlists — Spotify no ha dejado quitar las playlists antiguas: Spotify no ha permitido hacerlo');
  });

  test('desactivado en Ajustes, no se borra nada', async ({ page }) => {
    addList('old', 'Rock · Shuffle', 'x · shuffl:src=0123456789');
    await login(page);
    await openPanel(page, 'settings');
    await page.locator('#purge-toggle').uncheck();
    await shuffle(page, 'Chill');
    expect(state.unfollowCalls).toEqual([]);
    expect(state.lists.has('old')).toBe(true);
  });

  test('«Volver a barajar» reordena la misma playlist: no crea ni borra', async ({ page }) => {
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    const creates = state.writes.filter((w) => w.op === 'create').length;
    await page.locator('#reshuffle').click();
    await idle(page);
    expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(creates);
    expect(state.unfollowCalls).toEqual([]);
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
    expect(state.writes.filter((w) => w.op === 'create')).toEqual([]);
    await expect(page.locator('body')).toHaveClass(/busy/);
    await other.evaluate(() => window.__release());
    await expect(resultMeta(page)).toContainText('120 canciones');
    expect(byName('Rock · Shuffl')).toHaveLength(1);
  });

  test('en inglés: «Liked Songs · Shuffl», «All my music · Shuffl» y descripción traducida', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('shuffl.lang', JSON.stringify('en')));
    await login(page);
    await shuffle(page, 'Liked Songs');
    const [liked] = byName('Liked Songs · Shuffl');
    expect(liked.description).toMatch(new RegExp(`^${esc(V12_EN)}Liked Songs · shuffl:src=[a-f0-9]{10}.[a-f0-9]{6}$`));
    await pick(page, 'shuffle', 'Liked Songs');
    await page.locator('#select-library').click();
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(byName('All my music · Shuffl')).toHaveLength(1);
    expect(byName('Liked Songs · Shuffl')).toHaveLength(0);
  });

  test('«Por tiempo» a la vista: «Gym 45 min · Shuffl» con el acceso rápido y «Rock · 25 min · Shuffl» a medida', async ({ page }) => {
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('label[for="sh-kind-time"]').click();
    await expect(page.locator('#time-box')).toBeVisible();
    await page.locator('#sh-preset-gym').click();
    await expect(page.locator('#shuffle-go')).toHaveText('Barajar 45 min');
    await shot(page, 'docs/capturas/24-shuffle-tiempo.png');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    await expect(page.locator('#panel-shuffle .result-kicker')).toHaveText('Listo · 45 min ± 2');
    const [gym] = byName('Gym 45 min · Shuffl');
    const ms = gym.tracks.reduce((n, t) => n + t.duration_ms, 0);
    expect(Math.abs(ms - 45 * 60000)).toBeLessThanOrEqual(2 * 60000);
    await expect(resultMeta(page)).toContainText(`${Math.round(ms / 60000)} min`);
    await page.locator('#panel-shuffle .result').getByRole('button', { name: 'Volver', exact: true }).click();
    await page.locator('#sh-preset-custom').click();
    await page.locator('#sh-slider').fill('25');
    await expect(page.locator('#sh-slider-out')).toHaveText('25 min');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(byName('Rock · 25 min · Shuffl')).toHaveLength(1);
    expect(byName('Gym 45 min · Shuffl')).toHaveLength(0);
  });
});

test.describe('primera vez', () => {
  test.beforeEach(async ({ page }) => { state = await installMock(page, { purgeAsk: true }); });

  test('enseña lo que se va a borrar con un único botón «Borrar y no volver a preguntar»; después es automático', async ({ page }) => {
    addList('old', 'Spanish Rap · Shuffle', `${V12_ES}Spanish Rap`);
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('#shuffle-go').click();
    await expect(page.locator('#purge-sheet')).toContainText('Spanish Rap · Shuffle');
    await expect(page.locator('#purge-sheet')).toContainText('90 días');
    await expect(page.locator('#purge-ok')).toHaveText('Borrar y no volver a preguntar');
    await shot(page, 'docs/capturas/23-borrar-antiguas.png');
    await page.locator('#purge-ok').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(await page.evaluate(() => localStorage.getItem('shuffl.purgeOk'))).toBe(JSON.stringify({ me: 'me' }));
    await page.locator('#panel-shuffle .result').getByRole('button', { name: 'Volver', exact: true }).click();
    await pick(page, 'shuffle', 'Rock');
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await expect(page.locator('#purge-sheet')).toHaveCount(0);
    expect(appLists().map((l) => l.name)).toEqual(['Chill · Shuffl']);
  });

  test('cancelar no borra ni crea nada y lo explica', async ({ page }) => {
    addList('old', 'Spanish Rap · Shuffle', `${V12_ES}Spanish Rap`);
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('#shuffle-go').click();
    await page.locator('#purge-cancel').click();
    await expect(page.locator('#panel-shuffle .error')).toContainText('No se ha borrado ni creado nada');
    expect(state.unfollowCalls).toEqual([]);
    expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('shuffl.purgeOk'))).toBeNull();
  });

  test('una playlist de Shuffl que aparece entre la lectura previa y la del candado no se borra sin enseñar la hoja', async ({ page }) => {
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    // Justo después de la lectura previa (vacía), otra pestaña crea una playlist de Shuffl.
    state.afterPlaylists = () => addList('other', 'Chill · Shuffle', 'x · shuffl:src=0123456789');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(state.lists.has('other')).toBe(true);
    expect(state.unfollowCalls).toEqual([]);
    await expect(page.locator('#purge-sheet')).toHaveCount(0);
  });

  test('sin playlists antiguas no hay hoja', async ({ page }) => {
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await expect(page.locator('#purge-sheet')).toHaveCount(0);
  });
});

test('una sesión sin los permisos de borrado (user-library-modify) pide volver a conectar', async ({ page }) => {
  state = await installMock(page);
  await login(page);
  await page.evaluate(() => {
    const tokens = JSON.parse(localStorage.getItem('shuffl.tokens'));
    tokens.scope = tokens.scope.replace('user-library-modify', '').replace('user-follow-modify', '');
    localStorage.setItem('shuffl.tokens', JSON.stringify(tokens));
  });
  await page.reload();
  await expect(page.locator('#reconnect-msg')).toBeVisible();
  expect(state.authorizeParams.scope).toContain('user-library-modify');
  expect(state.authorizeParams.scope).toContain('user-follow-modify');
});
