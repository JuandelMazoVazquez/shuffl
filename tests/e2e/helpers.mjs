import { expect } from '@playwright/test';
import { CLIENT_ID, createState, mockSpotify } from './mock.mjs';

/** Estado simulado nuevo + rutas de Spotify + idioma y diálogos. Devuelve el estado. */
export async function installMock(page, { lang = 'es', logoNotice = false, purgeAsk = false } = {}) {
  const state = createState();
  await mockSpotify(page, state);
  page.on('dialog', (d) => (state.dismissNext ? ((state.dismissNext = false), d.dismiss()) : d.accept()));
  await page.addInitScript(({ l, notice, ask }) => {
    if (!localStorage.getItem('baraja.lang')) localStorage.setItem('baraja.lang', JSON.stringify(l));
    // Por defecto el borrado de las playlists antiguas ya está aceptado; los tests de la hoja pasan purgeAsk.
    if (!ask && localStorage.getItem('baraja.purgeOk') === null) localStorage.setItem('baraja.purgeOk', JSON.stringify({ me: 'me' }));
    if (!notice && localStorage.getItem('baraja.logoNotice.v12') === null) localStorage.setItem('baraja.logoNotice.v12', 'true');
    delete navigator.canShare;
  }, { l: lang, notice: logoNotice, ask: purgeAsk });
  return state;
}

export async function login(page) {
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Rock' }).first()).toBeVisible();
}

const PARENT_TAB = {
  sort: 'more', dups: 'more', backup: 'more', snap: 'more', orphans: 'more', split: 'more', proof: 'more', pin: 'more', settings: 'more',
  roulette: 'shuffle', new: 'discover', explore: 'discover', ago: 'discover', forgotten: 'discover', summary: 'discover',
};
/** Abre una pantalla secundaria desde su pestaña (Más, Descubrir o Shuffle), como lo haría una persona. */
export async function openPanel(page, key) {
  await page.locator(`#tab-${PARENT_TAB[key]}`).click();
  await page.locator(`#card-${key}`).click();
  await expect(page.locator(`#panel-${key}`)).toBeVisible();
}

/** Despliega «Más opciones» de Shuffle (quitar repetidas, filtros, destino, enlace, guardar mezcla) si está plegado. */
export async function moreOptions(page) {
  const box = page.locator('#shuffle-more');
  if (await box.getAttribute('open') === null) await box.locator(':scope > summary').click();
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
