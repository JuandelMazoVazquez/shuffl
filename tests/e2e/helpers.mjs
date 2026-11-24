import { expect } from '@playwright/test';
import { CLIENT_ID, createState, mockSpotify } from './mock.mjs';

/** Estado simulado nuevo + rutas de Spotify + idioma y diálogos. Devuelve el estado. */
export async function installMock(page, { lang = 'es' } = {}) {
  const state = createState();
  await mockSpotify(page, state);
  page.on('dialog', (d) => (state.dismissNext ? ((state.dismissNext = false), d.dismiss()) : d.accept()));
  await page.addInitScript((l) => {
    if (!localStorage.getItem('baraja.lang')) localStorage.setItem('baraja.lang', JSON.stringify(l));
    delete navigator.canShare;
  }, lang);
  return state;
}

export async function login(page) {
  await page.goto('/');
  await page.locator('#client-id').fill(CLIENT_ID);
  await page.locator('#connect').click();
  await expect(page.locator('#tab-shuffle')).toBeVisible();
  await expect(page.locator('#panel-shuffle label.row', { hasText: 'Rock' })).toBeVisible();
}

/** La app marca `body.busy` de forma síncrona al empezar una tarea; esperar a que se quite es esperar a que termine. */
export const idle = (page) => expect(page.locator('body')).not.toHaveClass(/busy/);
export const pick = (page, panel, name) => page.locator(`#panel-${panel} label.row`, { hasText: name }).click();
export const names = (list) => list.tracks.map((t) => t.name);
