import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel, moreOptions } from './helpers.mjs';

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
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  await idle(page);
}

test('barajar sube una portada JPEG de 640x640 y menos de 256 KB, y pone la descripción fija', async ({ page }) => {
  await shuffleChill(page);
  const created = [...state.lists.values()].find((l) => l.name === 'Chill · Shuffl');
  expect(state.images).toHaveLength(1);
  const [img] = state.images;
  expect(img.id).toBe(created.id);
  expect(img.contentType).toBe('image/jpeg');
  expect(img.body.length).toBeLessThan(256 * 1024);
  const bytes = Buffer.from(img.body, 'base64');
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  expect(jpegSize(bytes)).toEqual({ width: 640, height: 640 });
  const create = state.writes.find((w) => w.op === 'create' && w.name === 'Chill · Shuffl');
  expect(create.description).toMatch(/ · shuffl:cat=shuffle · shuffl:src=[a-f0-9]{10}.[a-f0-9]{6}$/);

  expect(create.description.replace(/ · shuffl:cat=shuffle · shuffl:src=[a-f0-9]{10}.[a-f0-9]{6}$/, '')).toBe('Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Chill');

  // Volver a barajar reordena la misma playlist: su portada no cambia, así que no se vuelve a subir (una petición menos).
  await page.getByRole('button', { name: 'Volver a barajar' }).click();
  await idle(page);
  expect(state.images).toHaveLength(1);
});

test('si la portada falla el shuffle sigue bien y solo hay un aviso discreto', async ({ page }) => {
  state.failImage = true;
  await shuffleChill(page);
  await expect(page.getByText('No se pudo subir la portada')).toBeVisible();
  expect([...state.lists.values()].find((l) => l.name === 'Chill · Shuffl').tracks).toHaveLength(80);
  await expect(page.getByRole('alert')).toBeHidden();
});

test('la portada se puede desactivar en Ajustes y no se sube al barajar la propia playlist', async ({ page }) => {
  await login(page);
  await openPanel(page, 'settings');
  await page.locator('#cover-toggle').uncheck();
  await page.reload();
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  expect(state.images).toHaveLength(0);

  await openPanel(page, 'settings');
  await page.locator('#cover-toggle').check();
  await page.locator('#tab-shuffle').click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await moreOptions(page);
  await page.locator('#panel-shuffle label.choice', { hasText: 'Barajar mi playlist original' }).click();
  await page.locator('#panel-shuffle .btn.primary.big').click();
  await expect(page.locator('#result-meta:visible', { hasText: /^80 (canciones|songs) ·/ })).toBeVisible();
  await idle(page);
  expect(state.images).toHaveLength(0);
});

test('«Tenerla siempre a mano» explica pines, destino fijo y accesos de Inicio', async ({ page }) => {
  await shuffleChill(page);
  await page.locator('#open-pin-result').click();
  const panel = page.locator('#panel-pin');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('mantén pulsada tu playlist «… · Shuffl» y elige Fijar');
  await expect(panel).toContainText('el pin de Tu biblioteca no pasa a la nueva');
  await expect(panel).toContainText('90 días');
  await expect(panel).toContainText('Spotify según lo que reproduces a menudo y hace poco');
  const created = [...state.lists.values()].find((l) => l.name === 'Chill · Shuffl');
  await expect(page.locator('#pin-open')).toHaveAttribute('href', `https://open.spotify.com/playlist/${created.id}`);
  await page.locator('#pin-back').click();
  await expect(page.locator('#panel-shuffle')).toBeVisible();
});

test('la pantalla de ayuda y la portada salen en inglés', async ({ page }) => {
  await login(page);
  await openPanel(page, 'settings');
  await page.locator('#lang-select').selectOption('en');
  await expect(page.getByText('Upload a custom cover')).toBeVisible();
  await openPanel(page, 'pin');
  await expect(page.locator('#panel-pin')).toContainText('press and hold your “… · Shuffl” playlist and choose Pin');
});
