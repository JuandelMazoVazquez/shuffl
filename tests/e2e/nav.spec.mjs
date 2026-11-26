// Navegación, Inicio y resultado (v1.3.1): cambio de pestaña inmediato y sin saltos, scroll por pestaña, tarjeta de la
// última baraja, avisos de un solo uso, pantalla «Barajando…» al instante y lista con carátulas.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel, shot } from './helpers.mjs';

let state;
test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

test('4 pestañas, Inicio sin historial con «Empezar» y «volver» a la pestaña', async ({ page }) => {
  await login(page);
  await expect(page.locator('nav.tabs button')).toHaveText(['Inicio', 'Shuffle', 'Descubrir', 'Más']);
  await page.locator('#tab-home').click();
  await expect(page.locator('#welcome-card')).toContainText('Baraja de verdad tus playlists');
  await expect(page.locator('#mixes-empty')).toBeVisible();
  await page.locator('#hero-start').click();
  await expect(page.locator('#panel-shuffle')).toBeVisible();
  await openPanel(page, 'sort');
  await expect(page.locator('#tab-more')).toHaveAttribute('aria-current', 'page');
  await page.locator('#panel-sort .back-link').click();
  await expect(page.locator('#panel-more')).toBeVisible();
  await page.locator('#tab-discover').click();
  await shot(page, 'docs/capturas/21-descubrir.png');
  await page.locator('#tab-more').click();
  await shot(page, 'docs/capturas/22-mas.png');
});

test('el cambio de pestaña es inmediato, sin View Transitions ni saltos de layout (CLS ≈ 0)', async ({ page }) => {
  await login(page);
  const result = await page.evaluate(async () => {
    let cls = 0;
    const shifts = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) { cls += e.value; shifts.push([e.value.toFixed(4), ...(e.sources ?? []).map((x) => (x.node?.id || x.node?.className || x.node?.nodeName) + ' ' + JSON.stringify([x.previousRect.y, x.currentRect.y, x.previousRect.height, x.currentRect.height]))].join(' | ')); } }).observe({ type: 'layout-shift', buffered: false });
    const vt = typeof document.startViewTransition === 'function';
    let vtCalls = 0;
    if (vt) { const orig = document.startViewTransition.bind(document); document.startViewTransition = (...a) => { vtCalls++; return orig(...a); }; }
    const times = [];
    for (let round = 0; round < 3; round++) {
      for (const tab of ['home', 'shuffle', 'discover', 'more']) {
        const t0 = performance.now();
        document.getElementById(`tab-${tab}`).click();
        const panel = document.getElementById(`panel-${tab}`);
        if (panel.hidden) throw new Error(`${tab} no se ha mostrado al momento`);
        times.push(performance.now() - t0);
        await new Promise((r) => setTimeout(r, 180));
      }
    }
    await new Promise((r) => setTimeout(r, 300));
    console.log(JSON.stringify(shifts));
    return { cls, vtCalls, max: Math.max(...times), shifts };
  });
  expect(result.vtCalls).toBe(0);
  expect(result.max).toBeLessThan(100);
  expect(result.cls, JSON.stringify(result.shifts)).toBeLessThan(0.01);
});

test('cada pestaña conserva su posición de scroll', async ({ page }) => {
  await login(page);
  await page.locator('#tab-more').click();
  await page.evaluate(() => window.scrollTo(0, 400));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(100);
  await page.locator('#tab-home').click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.locator('#tab-more').click();
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
});

test('Inicio tras barajar: tarjeta con carátula, nombre, fecha, «Volver a barajar» y «Barajar otra cosa»', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-meta:visible')).toBeVisible();
  await idle(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#again-name')).toHaveText('Rock');
  await expect(page.locator('#again-card')).toContainText(/Barajada hoy, \d{2}:\d{2}/);
  await expect(page.locator('#again-card img.again-cover')).toHaveAttribute('src', /i\.scdn\.co/);
  const box = await page.locator('#card-last-mix').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeLessThan(80);
  await shot(page, 'docs/capturas/08-inicio.png');
  await page.locator('#hero-other').click();
  await expect(page.locator('#panel-shuffle')).toBeVisible();
  await page.locator('#tab-home').click();
  await page.locator('#card-last-mix').click();
  await expect(page.locator('#result-meta:visible')).toContainText('120 canciones');
});

test('el aviso de icono nuevo sale solo en Inicio, una vez, y no vuelve tras «Entendido»', async ({ page, context }) => {
  await page.close();
  page = await context.newPage();
  state = await installMock(page, { logoNotice: true });
  await login(page);
  await expect(page.locator('#logo-notice')).toBeHidden();
  await page.locator('#tab-home').click();
  await expect(page.locator('#logo-notice')).toBeVisible();
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#logo-notice')).toBeHidden();
  await page.locator('#tab-home').click();
  await page.locator('#logo-notice').getByRole('button', { name: 'Entendido' }).click();
  await expect(page.locator('#logo-notice')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#logo-notice')).toHaveCount(0);
});

test('al pulsar Shuffle sale al instante «Barajando…» con los naipes y el paso real', async ({ page }) => {
  await login(page);
  await page.route('https://api.spotify.com/v1/playlists/pl_rock/items**', async (route) => { await new Promise((r) => setTimeout(r, 800)); await route.fallback(); });
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#shuffle-working')).toBeVisible({ timeout: 100 });
  await expect(page.locator('#panel-shuffle .loader')).toHaveClass(/on/);
  await expect(page.locator('#panel-shuffle .live')).toContainText(/Leyendo canciones/);
  await expect(page.locator('#panel-shuffle form, #shuffle-go')).toBeHidden();
  await expect(page.locator('#result-meta:visible')).toBeVisible();
});

test('el resultado: nombre, canciones y duración, ▶ Reproducir y Abrir arriba, y lista con carátulas', async ({ page }) => {
  state.lists.get('pl_rock').tracks.forEach((t, i) => { t.album.images = [{ url: `https://i.scdn.co/image/a${i}-640`, width: 640 }, { url: `https://i.scdn.co/image/a${i}-300`, width: 300 }, { url: `https://i.scdn.co/image/a${i}-64`, width: 64 }]; });
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-meta:visible')).toBeVisible();
  await idle(page);
  await expect(page.locator('#result-playlist:visible')).toHaveText('Rock · Shuffle');
  await expect(page.locator('#result-meta:visible')).toHaveText(/^120 canciones · \d+ h \d+ min$/);
  const head = page.locator('#panel-shuffle .result-head');
  await expect(head.locator('#play-now')).toBeVisible();
  await expect(head.locator('#open-spotify')).toHaveAttribute('href', /open\.spotify\.com\/playlist\//);
  const covers = page.locator('#panel-shuffle .tracks img.track-cover');
  await expect(covers).toHaveCount(30);
  await expect(covers.first()).toHaveAttribute('src', /-300$/);
  const size = await covers.first().evaluate((img) => [img.getBoundingClientRect().width, img.getBoundingClientRect().height, getComputedStyle(img).objectFit]);
  expect(size).toEqual([48, 48, 'contain']);
  await expect(page.locator('#panel-shuffle .result .spotify-attrib')).toBeVisible();
  await shot(page, 'docs/capturas/03-resultado-barajar.png');
});
