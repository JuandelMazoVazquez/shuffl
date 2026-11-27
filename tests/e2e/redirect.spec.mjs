// Página de redirección de la dirección antigua (redirect/, publicada en el repo new-spoti): ruta, query y hash se
// conservan; un callback de OAuth no se reenvía. Las dos direcciones se simulan con page.route, sin red.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const HOST = 'https://juandelmazovazquez.github.io';
const OLD = `${HOST}/new-spoti/`;
const NEW = `${HOST}/shuffl/`;
const PAGE = readFileSync(new URL('../../redirect/index.html', import.meta.url), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.route(`${HOST}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith('/new-spoti/')) return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
    if (pathname.startsWith('/shuffl/')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Nueva</title><p>nueva</p>' });
    return route.fulfill({ status: 404, body: 'fuera' });
  });
});

for (const suffix of ['', '?demo=1', '?mezcla=m_abc&play=1&k=0123', '?origen=37i9dQZF1DXcBWIGoYBM5M&play=1', '?demo=1#resumen', 'icons/icon.svg?x=1']) {
  test(`redirige ${suffix || 'la raíz'} a la dirección nueva con lo mismo`, async ({ page }) => {
    await page.goto(OLD + suffix);
    await page.waitForURL(`${NEW}**`);
    expect(page.url()).toBe(NEW + suffix);
    await expect(page.locator('p')).toHaveText('nueva');
  });
}

test('una ruta que intenta salir de la app nueva acaba en su raíz', async ({ page }) => {
  await page.goto(`${HOST}/new-spoti//otro-sitio/x?demo=1`);
  await page.waitForURL(`${NEW}**`);
  expect(page.url()).toBe(NEW);
});

for (const callback of ['?code=secreto&state=abc', '?error=access_denied&state=abc']) {
  test(`un callback de OAuth (${callback.split('=')[0]}) no se reenvía y avisa de volver a conectar`, async ({ page }) => {
    const seen = [];
    page.on('request', (r) => seen.push(r.url()));
    await page.goto(OLD + callback);
    await expect(page.locator('#oauth')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Shuffl se ha mudado → nueva dirección');
    await expect(page.locator('#oauth')).toContainText('https://juandelmazovazquez.github.io/shuffl/');
    await expect(page.locator('#go')).toHaveAttribute('href', NEW);
    await page.waitForTimeout(1200);
    expect(page.url()).toBe(OLD);
    expect(seen.filter((u) => u.startsWith(NEW))).toEqual([]);
  });
}

test('sin JavaScript se ve el aviso con el enlace a la dirección nueva', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route(`${HOST}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  await page.goto(`${OLD}?demo=1`);
  await expect(page.locator('h1')).toHaveText('Shuffl se ha mudado → nueva dirección');
  await expect(page.locator('#go')).toHaveAttribute('href', NEW);
  await context.close();
});
