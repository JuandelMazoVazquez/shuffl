import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, shot, openPanel, moreOptions } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const shake = (page) => page.evaluate(() => {
  for (const x of [0, 20, 0, 20, 0, 20]) window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y: 0, z: 9.8 } }));
});
const heights = (page, id) => page.locator(`#${id} .bar`).evaluateAll((bars) => bars.map((b) => Number(/--h:\s*([\d.]+)%/.exec(b.getAttribute('style'))[1])));
/** Como en Android: el navegador no pide permiso para el acelerómetro. */
const noPermissionApi = (page) => page.addInitScript(() => Object.defineProperty(DeviceMotionEvent, 'requestPermission', { value: undefined, configurable: true }));
const spread = (hs) => { const avg = hs.reduce((a, b) => a + b) / hs.length; return Math.max(...hs.map((h) => Math.abs(h - avg) / avg)); };

async function shuffleRock(page) {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
  await idle(page);
}

test('«¿Es aleatorio de verdad?»: Shuffl sale plano, el sesgado no, con tabla y otra simulación', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await openPanel(page, 'proof');
  await expect(page.locator('#proof-fair .bar')).toHaveCount(10);
  await expect(page.locator('#proof-biased .bar')).toHaveCount(10);
  expect(spread(await heights(page, 'proof-fair'))).toBeLessThan(0.1);
  expect(spread(await heights(page, 'proof-biased'))).toBeGreaterThan(0.15);
  await expect(page.locator('#proof-summary')).toContainText('con Shuffl');
  await expect(page.locator('#proof-fair .bar').first()).toHaveAttribute('title', /^Canción 1: suena primero el \d+(,\d)? % de las veces$/);
  await page.locator('#proof-table summary').click();
  await expect(page.locator('#proof-table tbody tr')).toHaveCount(10);
  await shot(page, 'docs/capturas/19-prueba-aleatorio.png');
  const before = await heights(page, 'proof-fair');
  await page.locator('#proof-again').click();
  await expect.poll(async () => JSON.stringify(await heights(page, 'proof-fair'))).not.toBe(JSON.stringify(before));
  expect(state.writes).toEqual([]);
});

test('«Elige por mí»: la ruleta se para en una de tus playlists (nunca en una generada) y la baraja', async ({ page }) => {
  await shuffleRock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const valid = ['Tus me gusta', 'Rock', 'Chill', 'Con repetidas', 'Top 50 global'];
  for (let i = 0; i < 3; i++) {
    await page.locator('#tab-home').click();
    await openPanel(page, 'roulette');
    await page.locator('#roulette-go').click();
    await expect(page.locator('#reel')).toHaveClass(/landed/);
    const name = await page.locator('#reel').textContent();
    expect(valid).toContain(name);
    // El resultado anterior sigue en la página: se espera a la escritura de esta baraja.
    await expect.poll(() => state.writes.filter((w) => w.op === 'create').length).toBe(i + 2);
    await idle(page);
    expect(byName(`${name} · Shuffl`)).toHaveLength(1);
  }
  expect(state.writes.some((w) => w.op === 'put' && ['pl_rock', 'pl_chill', 'pl_dupes'].includes(w.id))).toBe(false);
});

test('la ruleta anima los nombres antes de pararse (sin movimiento reducido)', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await openPanel(page, 'roulette');
  await page.locator('#roulette-go').click();
  await expect(page.locator('#reel')).toHaveClass(/spinning/);
  await expect(page.locator('#roulette-go')).toBeDisabled();
  await shot(page, 'docs/capturas/20-ruleta.png');
  await expect(page.locator('#reel')).toHaveClass(/landed/, { timeout: 8000 });
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
});

test('agitar en Inicio rebaraja la última mezcla tras confirmar; cancelar o estar en otra pantalla no hace nada', async ({ page }) => {
  await noPermissionApi(page);
  await shuffleRock(page);
  const [gen] = byName('Rock · Shuffl');
  await page.locator('#tab-home').click();
  await expect(page.locator('#shake-hint')).toBeVisible();

  state.dismissNext = true;
  await shake(page);
  await page.waitForTimeout(300);
  const puts = () => state.writes.filter((w) => w.op === 'create').length;
  expect(puts()).toBe(1);

  await page.waitForTimeout(3100);
  await shake(page);
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
  await idle(page);
  expect(puts()).toBe(2);
  expect(byName('Rock · Shuffl')).toHaveLength(1);

  await page.waitForTimeout(3100);
  await openPanel(page, 'sort');
  await shake(page);
  await page.waitForTimeout(300);
  expect(puts()).toBe(2);
});

test('agitar se puede desactivar en Ajustes', async ({ page }) => {
  await noPermissionApi(page);
  await shuffleRock(page);
  await openPanel(page, 'settings');
  await page.locator('#shake-toggle').uncheck();
  await page.locator('#tab-home').click();
  await expect(page.locator('#shake-hint')).toHaveCount(0);
  await shake(page);
  await page.waitForTimeout(300);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('shuffl.shake'))).toBe('false');
});

test('en iOS pide el permiso del acelerómetro con un toque antes de escuchar', async ({ page }) => {
  await page.addInitScript(() => {
    window.__asked = 0;
    // Como en iOS: solo se concede justo después de un toque en esta página.
    addEventListener('pointerdown', () => { window.__gesture = true; setTimeout(() => { window.__gesture = false; }, 800); }, true);
    DeviceMotionEvent.requestPermission = async () => {
      if (!window.__gesture) throw new DOMException('Requiere un gesto', 'NotAllowedError');
      window.__asked++;
      return 'granted';
    };
  });
  await shuffleRock(page);
  await page.waitForTimeout(900);
  await page.locator('#tab-home').click();
  await page.waitForTimeout(900);
  await shake(page);
  await page.waitForTimeout(300);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(1);
  await page.locator('#shake-enable').click();
  await expect(page.locator('#shake-hint')).toBeVisible();
  expect(await page.evaluate(() => window.__asked)).toBe(1);
  await shake(page);
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
  await idle(page);
  expect(state.writes.filter((w) => w.op === 'create')).toHaveLength(2);
});

test('agitar tras barajar «la propia playlist» escribe en su «· Shuffl», nunca en la original', async ({ page }) => {
  await noPermissionApi(page);
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await moreOptions(page);
  await page.locator('#panel-shuffle label.choice', { hasText: 'La propia playlist' }).click();
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#panel-shuffle .result-kicker')).toContainText('Listo');
  await idle(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.lastMix')).mode)).toBe('self');
  const ownPuts = () => state.writes.filter((w) => w.op === 'put' && w.id === 'pl_rock').length;
  expect(ownPuts()).toBe(1);
  await page.locator('#tab-home').click();
  await expect(page.locator('#shake-hint')).toBeVisible();
  await shake(page);
  await expect.poll(() => byName('Rock · Shuffl').length).toBe(1);
  await idle(page);
  expect(ownPuts()).toBe(1);
});

test('la ruleta lleva la atribución de Spotify', async ({ page }) => {
  await login(page);
  await page.locator('#tab-home').click();
  await openPanel(page, 'roulette');
  await expect(page.locator('#panel-roulette .spotify-attrib')).toBeVisible();
});

test('celebración al terminar, salvo con movimiento reducido', async ({ page }) => {
  await shuffleRock(page);
  await expect(page.locator('#panel-shuffle .confetti')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Volver a barajar' }).click();
  await idle(page);
  await page.waitForTimeout(1700);
  await expect(page.locator('#panel-shuffle .confetti')).toHaveCount(0);
});

test('lo nuevo sale en inglés y los botones miden al menos 44 px', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shuffl.lang', JSON.stringify('en')));
  await login(page);
  await page.locator('#tab-shuffle').click();
  await expect(page.locator('#card-roulette')).toContainText('Pick for me');
  await expect(page.locator('#card-roulette')).toBeVisible();
  expect((await page.locator('#card-roulette').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator('#tab-more').click();
  await expect(page.locator('#card-proof')).toContainText('Is it really random?');
  await expect(page.locator('#card-proof')).toBeVisible();
  expect((await page.locator('#card-proof').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await openPanel(page, 'proof');
  await expect(page.locator('#proof-summary')).toContainText('with Shuffl');
  const again = await page.locator('#proof-again').boundingBox();
  expect(again.height).toBeGreaterThanOrEqual(44);
  await openPanel(page, 'settings');
  await expect(page.locator('#panel-settings')).toContainText('Shake to shuffle');
});
