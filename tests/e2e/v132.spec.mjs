// v1.3.2: caché y cuota, cada error con un mensaje humano y una acción, Diagnóstico (contador, prueba completa,
// registro e informe), quitar canciones deslizando, tirar para rebarajar, mezclas por tiempo y red de seguridad.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel } from './helpers.mjs';
import { makeTrack, albumImages, CLIENT_ID } from './mock.mjs';

let state;
test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const QUOTA = { status: 429, body: { error: { status: 429, message: 'API rate limit exceeded', reason: 'QUOTA_EXCEEDED' } } };
const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const resultMeta = (page, panel = 'shuffle') => page.locator(`#panel-${panel} #result-meta`);
const errorBox = (page, panel = 'shuffle') => page.locator(`#panel-${panel} .error-box:visible`);
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
function seedReleases(n) {
  for (let i = 0; i < n; i++) {
    const id = `art${i}`;
    state.releases[id] = [{ id: `rel_${id}`, name: `Disco ${id}`, album_type: 'album', release_date: day(3), release_date_precision: 'day', images: albumImages(`rel_${id}`) }];
    state.albumTracks[`rel_${id}`] = Array.from({ length: 4 }, (_, k) => {
      const tr = { ...makeTrack(7000 + i * 10 + k), album: { id: `rel_${id}`, name: `Disco ${id}`, images: albumImages(`rel_${id}`) }, track_number: k + 1 };
      state.catalog.set(tr.uri, tr);
      return tr;
    });
  }
}
async function shuffleOnce(page, name) {
  await pick(page, 'shuffle', name);
  await page.locator('#shuffle-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
}
const backToForm = (page) => page.locator('#panel-shuffle .result').getByRole('button', { name: 'Volver', exact: true }).click();

test.describe('caché y cuota', () => {
  test('una playlist que no ha cambiado no se vuelve a leer; si cambia (otro snapshot_id), sí', async ({ page }) => {
    await page.clock.install({ time: Date.now() });
    await login(page);
    await shuffleOnce(page, 'Chill');
    const reads = state.itemRequests.filter((id) => id === 'pl_chill').length;
    expect(reads).toBeGreaterThan(0);
    await backToForm(page);
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(state.itemRequests.filter((id) => id === 'pl_chill').length).toBe(reads);
    // La cambias en Spotify y vuelves más tarde: la lista de playlists se relee y, con otro snapshot_id, la playlist también.
    const extra = makeTrack(9100);
    state.catalog.set(extra.uri, extra);
    state.lists.get('pl_chill').tracks.push(extra);
    await page.clock.fastForward(61000);
    await backToForm(page);
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toContainText('81 canciones');
    await idle(page);
    expect(state.itemRequests.filter((id) => id === 'pl_chill').length).toBeGreaterThan(reads);
  });

  test('con la cuota agotada para leer, el shuffle de una playlist ya leída sigue funcionando', async ({ page }) => {
    await login(page);
    await shuffleOnce(page, 'Rock');
    state.failures.push({ match: /GET \/playlists\/pl_rock\/items/, ...QUOTA });
    await backToForm(page);
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toContainText('120 canciones');
  });

  test('Novedades: si la cuota se acaba a mitad, guarda lo conseguido y lo explica; «Buscar más» no reintenta', async ({ page }) => {
    seedReleases(20);
    state.failures.push({ match: /GET \/albums\/.+\/tracks/, skip: 4, ...QUOTA });
    await login(page);
    await openPanel(page, 'new');
    await page.locator('#new-go').click();
    await expect(resultMeta(page, 'new')).toBeVisible();
    await idle(page);
    const n = Number((await resultMeta(page, 'new').textContent()).match(/^(\d+) canciones/)[1]);
    expect(n).toBeGreaterThanOrEqual(10);
    await expect(page.locator('#panel-new .note')).toContainText(`Spotify limita cuántas búsquedas puede hacer la app, así que hay ${n} canciones`);
    expect(byName('Novedades · Shuffle')[0].tracks).toHaveLength(n);
    const calls = state.apiCalls.length;
    await page.locator('#new-more-songs').click();
    await expect(errorBox(page, 'new')).toContainText('Spotify limita cuántas búsquedas puede hacer la app. Vuelve a intentarlo en un rato.');
    await expect(errorBox(page, 'new')).not.toContainText(/QUOTA|429/);
    await expect(errorBox(page, 'new').getByRole('button', { name: 'Reintentar' })).toBeHidden();
    // Para en la primera respuesta de cuota agotada: ni la repite ni sigue con otros álbumes.
    expect(state.apiCalls.slice(calls).filter((c) => /\/albums\/.+\/tracks/.test(c))).toHaveLength(1);
  });

  test('Novedades: si la cuota se acaba antes de tener 10 canciones, no crea nada y lo explica', async ({ page }) => {
    seedReleases(20);
    state.failures.push({ match: /GET \/albums\/.+\/tracks/, skip: 1, ...QUOTA });
    await login(page);
    await openPanel(page, 'new');
    await page.locator('#new-go').click();
    await expect(errorBox(page, 'new')).toContainText('Spotify limita cuántas búsquedas');
    expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(0);
  });

  test('cada búsqueda de Novedades se para en unas 30 lecturas aunque haya muchos artistas', async ({ page }) => {
    seedReleases(100);
    await login(page);
    await openPanel(page, 'new');
    await page.locator('#new-more > summary').click();
    await page.locator('label[for="new-artists-25"]').click();
    await page.locator('label[for="new-count-100"]').click();
    const before = state.apiCalls.length;
    await page.locator('#new-go').click();
    await expect(resultMeta(page, 'new')).toBeVisible();
    await idle(page);
    expect(state.apiCalls.length - before).toBeLessThanOrEqual(40);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('baraja.artistsPerSearch')))).toBe(25);
  });
});

test.describe('errores: mensaje humano y una acción', () => {
  test('Spotify caído (5xx) al leer: «Spotify no responde» y «Reintentar» lo arregla', async ({ page }) => {
    await login(page);
    state.failures.push({ match: /GET \/playlists\/pl_chill\/items/, status: 503, body: { error: { status: 503, message: 'Service unavailable' } }, times: 3 });
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(errorBox(page)).toContainText('Spotify no responde ahora mismo. Vuelve a intentarlo en un momento.');
    await errorBox(page).getByRole('button', { name: 'Reintentar' }).click();
    await expect(resultMeta(page)).toContainText('80 canciones');
  });

  test('sin red al leer: «No hay conexión» y «Reintentar»', async ({ page }) => {
    await login(page);
    state.failures.push({ match: /GET \/playlists\/pl_chill\/items/, network: true, times: 1 });
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(errorBox(page)).toContainText('No hay conexión. Revisa tu red y vuelve a intentarlo.');
    await errorBox(page).getByRole('button', { name: 'Reintentar' }).click();
    await expect(resultMeta(page)).toContainText('80 canciones');
  });

  test('cuenta no añadida en el dashboard (403 al arrancar): explica User Management y deja reintentar', async ({ page }) => {
    state.failures.push({ match: /GET \/me$/, status: 403, body: { error: { status: 403, message: 'Check settings on developer.spotify.com/dashboard, the user may not be registered.' } } });
    await page.goto('/');
    await page.locator('#client-id').fill(CLIENT_ID);
    await page.locator('#connect').click();
    await expect(page.locator('#boot-error .error')).toContainText('User Management');
    await expect(page.locator('#boot-error')).not.toContainText('403');
    await expect(page.locator('#boot-error').getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('una petición que Spotify no encuentra (404) y un permiso que falta (403 scope) se explican sin códigos', async ({ page }) => {
    await login(page);
    state.failures.push({ match: /GET \/playlists\/pl_chill\/items/, status: 404, body: { error: { status: 404, message: 'Not found.' } }, times: 1 });
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(errorBox(page)).toContainText('Spotify no encuentra esa playlist o canción');
    await page.locator('#working-back').click();
    state.failures.push({ match: /POST \/me\/playlists/, status: 403, body: { error: { status: 403, message: 'Insufficient client scope' } } });
    await page.locator('#shuffle-go').click();
    await expect(errorBox(page)).toContainText('Falta un permiso de Spotify. Vuelve a conectar para darlo.');
    await expect(errorBox(page).getByRole('button', { name: 'Volver a conectar' })).toBeVisible();
    await expect(errorBox(page)).not.toContainText(/403|scope/);
  });

  test('respuestas con huecos (playlists nulas, top sin lista) no rompen nada', async ({ page }) => {
    await page.route('https://api.spotify.com/v1/me/top/tracks**', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{}' }));
    await page.route('https://api.spotify.com/v1/me/top/artists**', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"items":null}' }));
    await login(page);
    await openPanel(page, 'summary');
    await page.locator('#summary-go').click();
    await expect(page.locator('#summary-empty')).toContainText('Aún no hay top');
    await expect(page.locator('#summary-empty svg.empty-art')).toBeVisible();
  });

  test('un fallo inesperado no deja la pantalla en blanco: aviso con «Diagnóstico» y queda en el registro', async ({ page }) => {
    await login(page);
    await page.evaluate(() => { setTimeout(() => Promise.reject(new TypeError('x is undefined')), 0); });
    const toast = page.locator('#toast');
    await expect(toast).toContainText('Algo ha fallado. Vuelve a intentarlo; si se repite, copia el informe en Más → Diagnóstico.');
    await toast.getByRole('button', { name: 'Diagnóstico' }).click();
    await expect(page.locator('#panel-diag')).toBeVisible();
    await expect(page.locator('#error-log')).toContainText('bug');
  });
});

test.describe('Diagnóstico', () => {
  test('contador de peticiones, prueba completa con reproducción e informe copiable sin datos personales', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await login(page);
    await openPanel(page, 'diag');
    await expect(page.locator('#req-counts')).toContainText(/Esta sesión: \d+ · Hoy: \d+/);
    await page.locator('#full-test').click();
    const results = page.locator('#full-results li');
    await expect(results).toHaveCount(10);
    await expect(page.locator('#full-results li.bad')).toHaveCount(0);
    await expect(results.nth(8)).toContainText('Reproducir — Sonando en iPhone de prueba');
    const probe = state.writes.find((w) => w.op === 'create' && w.name === 'Shuffl · prueba de borrado & limpieza');
    expect(probe).toBeTruthy();
    expect(state.lists.has(probe.id)).toBe(false);
    await expect(page.locator('#panel-diag .live')).toContainText('Todo funciona.');
    await expect(page.locator('#req-actions')).toContainText('Prueba completa');
    await page.locator('#copy-report').click();
    await expect(page.locator('#copy-msg')).toContainText('Informe copiado');
    const report = await page.evaluate(() => navigator.clipboard.readText());
    expect(report).toMatch(/^Shuffl 1\.3\.2 · es · navegador/);
    expect(report).toContain('OK  play · ok');
    expect(report).not.toMatch(/Usuaria Prueba|iPhone de prueba|access-|refresh-1|Rock/);
  });

  test('la prueba completa sin Premium marca el paso de reproducir y quita igualmente la playlist de prueba', async ({ page }) => {
    state.playError = { status: 403, body: { error: { status: 403, message: 'Premium required', reason: 'PREMIUM_REQUIRED' } } };
    await login(page);
    await openPanel(page, 'diag');
    await page.locator('#full-test').click();
    await expect(page.locator('#full-results li')).toHaveCount(10);
    await expect(page.locator('#full-results li.bad')).toHaveCount(1);
    await expect(page.locator('#full-results li.bad')).toContainText('Hace falta Spotify Premium');
    await expect(page.locator('#panel-diag .live')).toContainText('Algo ha fallado');
    expect([...state.lists.values()].some((l) => l.name === 'Shuffl · prueba de borrado & limpieza')).toBe(false);
  });

  test('sin portapapeles, el informe sale en un cuadro para copiarlo a mano; el registro se puede borrar', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); });
    await login(page);
    state.failures.push({ match: /GET \/playlists\/pl_chill\/items/, status: 500, body: {}, times: 3 });
    await pick(page, 'shuffle', 'Chill');
    await page.locator('#shuffle-go').click();
    await expect(errorBox(page)).toBeVisible();
    await openPanel(page, 'diag');
    await expect(page.locator('#error-log')).toContainText('shuffle · server 500');
    await page.locator('#copy-report').click();
    await expect(page.locator('#report-text')).toHaveValue(/shuffle server 500 GET \/playlists\/[^/]+\/items/);
    await page.locator('#clear-errors').click();
    await expect(page.locator('#error-log')).toContainText('Ningún error registrado');
  });
});

test.describe('más interactiva', () => {
  test('quitar canciones con × (o deslizando) las quita de la playlist de Shuffl de una vez, y no vuelven al rebarajar', async ({ page }) => {
    await login(page);
    await shuffleOnce(page, 'Chill');
    const [list] = byName('Chill · Shuffle');
    const rows = page.locator('#panel-shuffle .tracks .track');
    const first = await rows.nth(0).locator('.track-name').textContent();
    const second = await rows.nth(1).locator('.track-name').textContent();
    await rows.nth(0).locator('.track-remove').click();
    await rows.nth(0).locator('.track-remove').click();
    await expect(resultMeta(page)).toContainText('78 canciones');
    await expect(page.locator('#panel-shuffle .live')).toContainText('Guardado en Spotify.');
    await idle(page);
    expect(list.tracks).toHaveLength(78);
    expect(list.tracks.some((t) => t.name === first || t.name === second)).toBe(false);
    await page.locator('#reshuffle').click();
    await idle(page);
    expect(list.tracks).toHaveLength(78);
    expect(list.tracks.some((t) => t.name === first || t.name === second)).toBe(false);
  });

  test('deslizar una fila a la izquierda la quita; en tu propia playlist no se puede', async ({ page }) => {
    await login(page);
    await shuffleOnce(page, 'Chill');
    const row = page.locator('#panel-shuffle .tracks .track').first();
    const box = await row.boundingBox();
    const y = box.y + box.height / 2;
    await row.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: box.x + 300, clientY: y }] });
    await row.dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: box.x + 150, clientY: y }] });
    await row.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: box.x + 150, clientY: y }] });
    await expect(resultMeta(page)).toContainText('79 canciones');
  });

  test('tirar hacia abajo en el resultado vuelve a barajar la misma playlist', async ({ page }) => {
    await login(page);
    await shuffleOnce(page, 'Rock');
    const [list] = byName('Rock · Shuffle');
    const before = list.tracks.map((t) => t.uri).join();
    const puts = state.writes.filter((w) => w.op === 'put').length;
    await page.evaluate(() => {
      const touch = (type, y) => {
        const t = new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y });
        document.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true }));
      };
      window.scrollTo(0, 0);
      touch('touchstart', 150);
      touch('touchend', 300);
    });
    await expect(page.locator('#ptr')).toContainText('Volviendo a barajar');
    await idle(page);
    await expect.poll(() => state.writes.filter((w) => w.op === 'put').length).toBeGreaterThan(puts);
    expect(list.tracks.map((t) => t.uri).join()).not.toBe(before);
    expect(byName('Rock · Shuffle')).toHaveLength(1);
  });

  test('una mezcla por tiempo guardada recuerda el acceso rápido y se baraja desde Inicio y desde el atajo de Siri', async ({ page }) => {
    await login(page);
    await pick(page, 'shuffle', 'Rock');
    await page.locator('label[for="sh-kind-time"]').click();
    await page.locator('#sh-preset-run').click();
    await page.locator('#shuffle-more > summary').click();
    await page.locator('#save-mix').click();
    await page.locator('#ask-name').fill('Mañanas');
    await page.locator('#ask-ok').click();
    const [mix] = await page.evaluate(() => JSON.parse(localStorage.getItem('baraja.mixes')));
    expect(mix).toMatchObject({ kind: 'time', minutes: 30, preset: 'run' });
    await page.locator('#tab-home').click();
    await expect(page.locator('[data-mix]', { hasText: 'Mañanas' })).toContainText('🏃 Correr 30 min');
    await page.locator('[data-mix]', { hasText: 'Mañanas' }).click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(byName('Correr 30 min · Shuffle')).toHaveLength(1);
    const key = await page.evaluate(() => JSON.parse(localStorage.getItem('baraja.linkKey')));
    await page.goto(`/?mezcla=${mix.id}${key ? `&k=${key}` : ''}`);
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
    expect(byName('Correr 30 min · Shuffle')).toHaveLength(1);
    const ms = byName('Correr 30 min · Shuffle')[0].tracks.reduce((n, t) => n + t.duration_ms, 0);
    expect(Math.abs(ms - 30 * 60000)).toBeLessThanOrEqual(2 * 60000);
  });
});
