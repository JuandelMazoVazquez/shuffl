import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

/** Mide el logo visible de una atribución: que cargó, su tamaño y la zona de seguridad. */
const measure = (attrib) => attrib.evaluate((a) => {
  const img = [...a.querySelectorAll('img')].find((i) => getComputedStyle(i).display !== 'none');
  const r = img.getBoundingClientRect();
  const box = a.getBoundingClientRect();
  const cs = getComputedStyle(a);
  return {
    src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, width: r.width, height: r.height,
    pad: Math.min(...['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`padding${s}`]))),
    href: a.href, visibleImgs: [...a.querySelectorAll('img')].filter((i) => getComputedStyle(i).display !== 'none').length,
    inside: r.left - box.left >= 12 && box.right - r.right >= 12 && r.top - box.top >= 12 && box.bottom - r.bottom >= 12,
  };
});

const expectLogo = (m, color, href) => {
  expect(m.src).toBe(`icons/spotify/full-logo-${color}.svg`);
  expect(m.loaded).toBe(true);
  expect(m.visibleImgs).toBe(1);
  expect(m.width).toBeGreaterThanOrEqual(70);
  expect(m.height).toBeGreaterThan(0);
  expect(m.pad).toBeGreaterThanOrEqual(m.height / 2);
  expect(m.inside).toBe(true);
  expect(m.href).toMatch(href);
};

test('el logo oficial de Spotify acompaña a carátulas y metadatos: selector, resultado y duplicados', async ({ page }) => {
  await login(page);
  const pickerLogo = page.locator('#panel-shuffle .picker-wrap .spotify-attrib');
  await expect(pickerLogo).toBeVisible();
  await expect(pickerLogo).toHaveAccessibleName('Contenido de Spotify: abrir Spotify');
  expectLogo(await measure(pickerLogo), 'white', /^https:\/\/open\.spotify\.com\/$/);

  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await idle(page);
  const resultLogo = page.locator('#panel-shuffle .spotify-attrib').last();
  await expect(resultLogo).toBeVisible();
  expectLogo(await measure(resultLogo), 'white', /^https:\/\/open\.spotify\.com\/playlist\//);

  state.lists.get('pl_rock').tracks.push(state.lists.get('pl_rock').tracks[0]);
  await openPanel(page, 'dups');
  await pick(page, 'dups', 'Rock');
  await page.locator('#panel-dups button.primary').first().click();
  await idle(page);
  const dupLogo = page.locator('#panel-dups .dup-list + .spotify-attrib');
  await expect(dupLogo).toBeVisible();
  expectLogo(await measure(dupLogo), 'white', /^https:\/\/open\.spotify\.com\/playlist\/pl_rock$/);
});

test('en tema claro se ve el logo negro; en automático sigue al sistema', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baraja.theme', JSON.stringify('light')));
  await login(page);
  expectLogo(await measure(page.locator('#panel-shuffle .picker-wrap .spotify-attrib')), 'black', /open\.spotify\.com/);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'auto'));
  await page.emulateMedia({ colorScheme: 'light' });
  expectLogo(await measure(page.locator('#panel-shuffle .picker-wrap .spotify-attrib')), 'black', /open\.spotify\.com/);
  await page.emulateMedia({ colorScheme: 'dark' });
  expectLogo(await measure(page.locator('#panel-shuffle .picker-wrap .spotify-attrib')), 'white', /open\.spotify\.com/);
});

test('la hoja de una playlist de otra persona lleva el logo enlazado a esa playlist', async ({ page }) => {
  await login(page);
  const followed = page.locator('#panel-shuffle li.followed button').first();
  await followed.click();
  const logo = page.locator('#followed-help .spotify-attrib');
  await expect(logo).toBeVisible();
  expectLogo(await measure(logo), 'white', /^https:\/\/open\.spotify\.com\/playlist\//);
});
