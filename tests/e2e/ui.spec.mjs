import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, shot } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const bg = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());

/** Gesto táctil sintético: touchstart en `from` y touchend en `to` sobre el elemento de `selector`. */
const gesture = (page, from, to, selector = 'body') => page.evaluate(({ from, to, selector }) => {
  const target = document.querySelector(selector);
  const send = (type, p) => {
    const touch = new Touch({ identifier: 1, target, clientX: p[0], clientY: p[1] });
    target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
  };
  send('touchstart', from);
  send('touchend', to);
}, { from, to, selector });

test('Inicio: tarjetas de atajo, y «volver a barajar mi última mezcla» aparece tras barajar', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await expect(page.locator('#card-last-mix')).toHaveCount(0);
  for (const [card, panel] of [['sort', 'sort'], ['dups', 'dups'], ['backup', 'backup'], ['shuffle', 'shuffle']]) {
    await page.locator('#tab-home').click();
    await page.locator(`#card-${card}`).click();
    await expect(page.locator(`#panel-${panel}`)).toBeVisible();
  }

  await pick(page, 'shuffle', 'Rock');
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByText('Listo: 180 canciones barajadas')).toBeVisible();
  await idle(page);

  await page.locator('#tab-home').click();
  await expect(page.locator('#card-last-mix')).toContainText('Volver a barajar mi última mezcla');
  await expect(page.locator('#card-last-mix')).toContainText('Rock + Chill');
  await shot(page, 'docs/capturas/08-inicio.png');
  const before = state.writes.length;
  await page.locator('#card-last-mix').click();
  await expect(page.locator('#panel-shuffle')).toBeVisible();
  await expect.poll(() => state.writes.length).toBeGreaterThan(before);
  await idle(page);
  await expect(page.getByText('Listo: 180 canciones barajadas')).toBeVisible();
});

test('tema oscuro por defecto, se cambia en Ajustes, se recuerda y «como el sistema» respeta el sistema', async ({ page }) => {
  await login(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await bg(page)).toBe('#0b0b0b');
  await page.locator('#open-settings').click();
  await page.locator('#theme-select').selectOption('light');
  expect(await bg(page)).toBe('#ffffff');
  await page.locator('#tab-shuffle').click();
  await shot(page, 'docs/capturas/09-tema-claro.png');
  await page.reload();
  expect(await bg(page)).toBe('#ffffff');
  await page.locator('#open-settings').click();
  await page.locator('#theme-select').selectOption('auto');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await bg(page)).toBe('#0b0b0b');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await bg(page)).toBe('#ffffff');
});

test('el fondo toma el color dominante de la portada de la playlist seleccionada', async ({ page }) => {
  await login(page);
  const tint = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--tint'));
  expect(await tint()).toBe('');
  await pick(page, 'shuffle', 'Rock');
  await expect.poll(tint).toBe('rgb(200, 40, 60)');
  await pick(page, 'shuffle', 'Rock');
  await expect.poll(tint).toBe('');
});

test('esqueletos mientras cargan las playlists', async ({ page }) => {
  await page.route('https://api.spotify.com/v1/me/playlists*', async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.fallback();
  });
  await page.goto('/');
  await page.locator('#client-id').fill('0123456789abcdef0123456789abcdef');
  await page.locator('#connect').click();
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle .picker.skeleton .sk').first()).toBeVisible();
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Rock' })).toBeVisible();
  await expect(page.locator('#panel-shuffle .picker.skeleton')).toHaveCount(0);
});

test('la animación de naipes aparece mientras se baraja y sigue el progreso real', async ({ page }) => {
  await login(page);
  await page.route('https://api.spotify.com/v1/playlists/pl_rock/items*', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.fallback();
  });
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  const loader = page.locator('#panel-shuffle .loader');
  await expect(loader).toHaveClass(/on/);
  const p = await loader.evaluate((el) => Number(el.style.getPropertyValue('--p')));
  expect(p).toBeGreaterThan(0);
  expect(p).toBeLessThanOrEqual(1);
  await expect(page.getByText('Listo: 120 canciones barajadas')).toBeVisible();
  await expect(loader).not.toHaveClass(/on/);
});

test('el resultado muestra las canciones en cascada y cuenta hasta el total', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByText('Listo: 80 canciones barajadas')).toBeVisible();
  const delays = await page.locator('.preview li').evaluateAll((lis) => lis.slice(0, 4).map((li) => getComputedStyle(li).animationDelay));
  expect(delays).toEqual(['0s', '0.04s', '0.08s', '0.12s']);
});

test('con movimiento reducido no hay animaciones y el contador sale ya completo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#panel-shuffle .result-title')).toHaveText('Listo: 80 canciones barajadas');
  expect(await page.locator('.preview li').first().evaluate((li) => getComputedStyle(li).animationName)).toBe('none');
  expect(await page.locator('#panel-shuffle .result').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('deslizar a los lados cambia de pestaña, pero no sobre la lista de playlists', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await gesture(page, [300, 400], [100, 410]);
  await expect(page.locator('#panel-shuffle')).toBeVisible();
  await gesture(page, [300, 400], [100, 410]);
  await expect(page.locator('#panel-sort')).toBeVisible();
  await gesture(page, [100, 400], [300, 405]);
  await expect(page.locator('#panel-shuffle')).toBeVisible();

  await gesture(page, [300, 400], [100, 410], '#panel-shuffle .picker');
  await expect(page.locator('#panel-shuffle')).toBeVisible();
  await gesture(page, [300, 400], [290, 410]);
  await expect(page.locator('#panel-shuffle')).toBeVisible();
});

test('tirar hacia abajo desde arriba refresca las playlists', async ({ page }) => {
  await login(page);
  let loads = 0;
  page.on('request', (r) => { if (/\/v1\/me\/playlists/.test(r.url())) loads++; });
  state.lists.set('pl_nueva', { id: 'pl_nueva', name: 'Recién llegada', owner: { id: 'me' }, tracks: [] });
  await gesture(page, [200, 120], [205, 300]);
  await expect(page.locator('#ptr')).toHaveText('Playlists actualizadas');
  expect(loads).toBeGreaterThan(0);
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Recién llegada' })).toBeVisible();
});
