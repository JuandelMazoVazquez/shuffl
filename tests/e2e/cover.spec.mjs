import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick } from './helpers.mjs';

let state;

test.beforeEach(async ({ page }) => {
  state = await installMock(page);
});

/** Ancho y alto de un JPEG leyendo su marcador SOF. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

async function shuffleChill(page) {
  await login(page);
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByText('Listo: 80 canciones barajadas')).toBeVisible();
  await idle(page);
}

test('barajar sube una portada JPEG de 640x640 y menos de 256 KB, y pone la descripción fija', async ({ page }) => {
  await shuffleChill(page);
  const baraja = [...state.lists.values()].find((l) => l.name === '🔀 Baraja');
  expect(state.images).toHaveLength(1);
  const [img] = state.images;
  expect(img.id).toBe(baraja.id);
  expect(img.contentType).toBe('image/jpeg');
  expect(img.body.length).toBeLessThan(256 * 1024);
  const bytes = Buffer.from(img.body, 'base64');
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  expect(jpegSize(bytes)).toEqual({ width: 640, height: 640 });
  const create = state.writes.find((w) => w.op === 'create' && w.name === '🔀 Baraja');
  expect(create.description).toBe('Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado');

  await page.getByRole('button', { name: 'Volver a barajar' }).click();
  await idle(page);
  expect(state.images).toHaveLength(2);
});

test('si la portada falla la baraja sigue bien y solo hay un aviso discreto', async ({ page }) => {
  state.failImage = true;
  await shuffleChill(page);
  await expect(page.getByText('No se pudo subir la portada')).toBeVisible();
  expect([...state.lists.values()].find((l) => l.name === '🔀 Baraja').tracks).toHaveLength(80);
  await expect(page.getByRole('alert')).toBeHidden();
});

test('la portada se puede desactivar en Ajustes y no se sube al barajar la propia playlist', async ({ page }) => {
  await login(page);
  await page.locator('#open-settings').click();
  await page.locator('#cover-toggle').uncheck();
  await page.reload();
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByText('Listo: 80 canciones barajadas')).toBeVisible();
  expect(state.images).toHaveLength(0);

  await page.locator('#open-settings').click();
  await page.locator('#cover-toggle').check();
  await page.locator('#tab-shuffle').click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.locator('#panel-shuffle label.choice', { hasText: 'La propia playlist' }).click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.getByText('Listo: 80 canciones barajadas')).toBeVisible();
  await idle(page);
  expect(state.images).toHaveLength(0);
});

test('«Tenerla siempre a mano» explica pines, destino fijo y accesos de Inicio', async ({ page }) => {
  await shuffleChill(page);
  await page.locator('#open-pin-result').click();
  const panel = page.locator('#panel-pin');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('mantén pulsada «🔀 Baraja» y elige Fijar');
  await expect(panel).toContainText('hasta 20');
  await expect(panel).toContainText('sobrescribe siempre');
  await expect(panel).toContainText('Spotify según lo que reproduces a menudo y hace poco');
  const baraja = [...state.lists.values()].find((l) => l.name === '🔀 Baraja');
  await expect(page.locator('#pin-open')).toHaveAttribute('href', `https://open.spotify.com/playlist/${baraja.id}`);
  await page.locator('#pin-back').click();
  await expect(page.locator('#panel-shuffle')).toBeVisible();
});

test('la pantalla de ayuda y la portada salen en inglés', async ({ page }) => {
  await login(page);
  await page.locator('#open-settings').click();
  await page.locator('#lang-select').selectOption('en');
  await expect(page.getByText('Upload a custom cover')).toBeVisible();
  await page.locator('#open-pin').click();
  await expect(page.locator('#panel-pin')).toContainText('press and hold "🔀 Baraja" and choose Pin');
});
