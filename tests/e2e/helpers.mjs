import { expect } from '@playwright/test';
import { CLIENT_ID, createState, mockSpotify } from './mock.mjs';

/** Estado simulado nuevo + rutas de Spotify + idioma y diálogos. Devuelve el estado. */
export async function installMock(page, { lang = 'es', logoNotice = false } = {}) {
  const state = createState();
  await mockSpotify(page, state);
  page.on('dialog', (d) => (state.dismissNext ? ((state.dismissNext = false), d.dismiss()) : d.accept()));
  await page.addInitScript(({ l, notice }) => {
    if (!localStorage.getItem('baraja.lang')) localStorage.setItem('baraja.lang', JSON.stringify(l));
    if (!notice && localStorage.getItem('baraja.logoNotice.v12') === null) localStorage.setItem('baraja.logoNotice.v12', 'true');
    delete navigator.canShare;
  }, { l: lang, notice: logoNotice });
  return state;
}

export async function login(page) {
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Rock' })).toBeVisible();
}

/** La app marca `body.busy` de forma síncrona al empezar una tarea; esperar a que se quite es esperar a que termine. */
export const idle = (page) => expect(page.locator('body')).not.toHaveClass(/busy/);
/** Marca la playlist cuyo nombre es exactamente `name` (si no, «Rock» también encontraría «Rock · Shuffle»). */
export const pick = (page, panel, name) => page.locator(`#panel-${panel} label.row`)
  .filter({ has: page.locator('.row-name', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).click();
/** Captura para el README esperando a que terminen las animaciones de entrada. */
export async function shot(page, path, opts = {}) {
  await page.waitForTimeout(800);
  await page.screenshot({ path, ...opts });
}
export const names = (list) => list.tracks.map((t) => t.name);
