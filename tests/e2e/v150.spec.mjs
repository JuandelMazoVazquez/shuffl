// v1.5.0: elegir dónde barajar (nueva u original), borrado por categorías, variedad y Tus me gusta en Descubre y
// Novedades, y la guía de instalación como página propia.
import { test, expect } from '@playwright/test';
import { installMock, login, idle, pick, openPanel, moreOptions, BASE } from './helpers.mjs';
import { makeTrack } from './mock.mjs';

let state;
test.beforeEach(async ({ page }) => { state = await installMock(page); });

const byName = (name) => [...state.lists.values()].filter((l) => l.name === name);
const resultMeta = (page) => page.locator('#result-meta:visible');
const reuse = (page) => page.locator('#sh-dest-reuse');
const self = (page) => page.locator('#sh-dest-self');
const why = (page) => page.locator('#dest-self-why');
const back = (page, panel) => page.locator(`#panel-${panel} .result`).getByRole('button', { name: /^(Volver|Back)$/ }).click();

// ---------- Dónde barajar ----------

test('dónde barajar: a la vista sin abrir «Más opciones», «Crear una playlist nueva» por defecto', async ({ page }) => {
  await login(page);
  await expect(page.locator('#shuffle-more')).not.toHaveAttribute('open', '');
  await expect(page.locator('#dest-box')).toBeVisible();
  await expect(page.locator('#dest-box')).toContainText('Crear una playlist nueva');
  await expect(page.locator('#dest-box')).toContainText('Barajar mi playlist original');
  await expect(reuse(page)).toBeChecked();
  // Sin nada elegido, la original está desactivada pero dice por qué.
  await expect(self(page)).toBeDisabled();
  await expect(why(page)).toHaveText('Elige primero la playlist que quieres barajar.');
});

test('cada motivo de no poder barajar la original se explica en una línea; con una playlist tuya se puede', async ({ page }) => {
  state.lists.set('pl_collab', { id: 'pl_collab', name: 'Compartida', owner: { id: 'ana', display_name: 'ana' }, collaborative: true, tracks: state.lists.get('pl_chill').tracks.slice(0, 10) });
  await login(page);
  const expectBlocked = async (text) => { await expect(self(page)).toBeDisabled(); await expect(why(page)).toHaveText(text); };
  const expectFree = async () => { await expect(self(page)).toBeEnabled(); await expect(why(page)).toBeHidden(); };

  await pick(page, 'shuffle', 'Tus me gusta');
  await expectBlocked('Spotify no deja cambiar el orden de Tus me gusta.');
  await pick(page, 'shuffle', 'Tus me gusta');

  await pick(page, 'shuffle', 'Rock');
  await expectFree();
  await pick(page, 'shuffle', 'Chill');
  await expectBlocked('Con varias playlists a la vez se crea siempre una nueva.');
  await pick(page, 'shuffle', 'Chill');
  await expectFree();

  await page.locator('label[for="sh-kind-time"]').click();
  await expectBlocked('Por tiempo se usa solo una parte de las canciones: va a una playlist nueva.');
  await page.locator('label[for="sh-kind-songs"]').click();
  await expectFree();

  await moreOptions(page);
  await page.locator('#filters-box > summary').click();
  await page.locator('#f-yearFrom').fill('2000');
  await expectBlocked('Con filtros se quitarían canciones de tu playlist: quítalos para barajarla entera.');
  await page.locator('#f-yearFrom').fill('');
  await expectFree();

  await page.locator('#select-library').click();
  await expectBlocked('Con varias playlists a la vez se crea siempre una nueva.');

  // Una colaborativa de otra persona sí se puede reordenar.
  await page.reload();
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Compartida');
  await expectFree();
  // Pulsar la desactivada no hace nada raro: sigue marcada la nueva.
  await pick(page, 'shuffle', 'Compartida');
  await pick(page, 'shuffle', 'Tus me gusta');
  await page.locator('label[for="sh-dest-self"]').click({ force: true });
  await expect(reuse(page)).toBeChecked();
});

test('barajar la original: confirmación solo la primera vez, Deshacer y nunca borra playlists de Shuffl', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await login(page);
  // Antes hay un shuffle de Chill: barajar la original no lo toca.
  await pick(page, 'shuffle', 'Chill');
  await page.locator('#shuffle-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  expect(byName('Chill · Shuffl')).toHaveLength(1);
  await back(page, 'shuffle');
  await pick(page, 'shuffle', 'Chill');

  const before = state.lists.get('pl_rock').tracks.map((t) => t.uri);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('label[for="sh-dest-self"]').click();
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-playlist:visible')).toHaveText('Rock');
  await idle(page);
  expect(dialogs.filter((m) => m.includes('Se cambiará el orden de «Rock»'))).toHaveLength(1);
  const after = state.lists.get('pl_rock').tracks.map((t) => t.uri);
  expect([...after].sort()).toEqual([...before].sort());
  expect(after).not.toEqual(before);
  expect(byName('Chill · Shuffl')).toHaveLength(1);
  expect(byName('Rock · Shuffl')).toHaveLength(0);
  expect(state.unfollowCalls).toHaveLength(0);
  await expect(page.locator('#panel-shuffle .result').getByRole('button', { name: 'Deshacer último cambio' })).toBeVisible();

  // La segunda vez ya no pregunta (queda Deshacer).
  await back(page, 'shuffle');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-playlist:visible')).toHaveText('Rock');
  await idle(page);
  expect(dialogs.filter((m) => m.includes('Se cambiará el orden'))).toHaveLength(1);
});

test('desde «Barajar otra vez» de Inicio barajar la original pregunta siempre; si la playlist cambió, no escribe', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('label[for="sh-dest-self"]').click();
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#result-playlist:visible')).toHaveText('Rock');
  await idle(page);
  await page.locator('#tab-home').click();
  await page.locator('#card-last-mix').click();
  await expect(page.locator('#result-playlist:visible')).toHaveText('Rock');
  await idle(page);
  expect(dialogs.filter((m) => m.includes('Se cambiará el orden de «Rock»'))).toHaveLength(2);

  // Alguien añade una canción mientras está abierta la confirmación: no se escribe nada.
  const rock = state.lists.get('pl_rock');
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => { rock.tracks.push(makeTrack(9999)); await d.accept(); });
  const writes = state.writes.length;
  await page.locator('#tab-home').click();
  await page.locator('#card-last-mix').click();
  await expect(page.locator('#panel-shuffle [role="alert"]')).toContainText('ha cambiado');
  await idle(page);
  expect(state.writes.length).toBe(writes);
  expect(rock.tracks.at(-1).name).toBe(makeTrack(9999).name);
});

test('la última elección se recuerda; si ahora no se puede, se crea una nueva y vuelve cuando se pueda', async ({ page }) => {
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('label[for="sh-dest-self"]').click();
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
  await page.locator('#tab-shuffle').click();
  await pick(page, 'shuffle', 'Chill');
  await expect(self(page)).toBeChecked();
  await pick(page, 'shuffle', 'Rock');
  await expect(reuse(page)).toBeChecked();
  await expect(why(page)).toBeVisible();
  await pick(page, 'shuffle', 'Rock');
  await expect(self(page)).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.dest')))).toBe('self');
});

// ---------- Borrado por categorías ----------

test('borrado por categorías: shuffle y Descubre conviven; cada uno sustituye solo al suyo', async ({ page }) => {
  await login(page);
  const shuffleOf = async (name, prev = null) => {
    await page.locator('#tab-shuffle').click();
    if (await page.locator('#panel-shuffle .result:not([hidden])').count()) await back(page, 'shuffle');
    if (prev) await pick(page, 'shuffle', prev);
    await pick(page, 'shuffle', name);
    await page.locator('#shuffle-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
  };
  const explore = async () => {
    await openPanel(page, 'explore');
    if (await page.locator('#panel-explore .result:not([hidden])').count()) await back(page, 'explore');
    await page.locator('#explore-go').click();
    await expect(resultMeta(page)).toBeVisible();
    await idle(page);
  };
  const appNames = () => [...state.lists.values()].filter((l) => /shuffl:src=/.test(l.description ?? '')).map((l) => l.name).sort();

  await shuffleOf('Rock');
  expect(byName('Rock · Shuffl')[0].description).toMatch(/ · shuffl:cat=shuffle · shuffl:src=[a-f0-9]{10}\.[a-f0-9]{6}$/);
  await explore();
  expect(byName('Descubre · Shuffl')[0].description).toMatch(/ · shuffl:cat=explore · shuffl:src=/);
  expect(appNames()).toEqual(['Descubre · Shuffl', 'Rock · Shuffl']);
  const firstExplore = byName('Descubre · Shuffl')[0].id;

  await shuffleOf('Chill', 'Rock');
  expect(appNames()).toEqual(['Chill · Shuffl', 'Descubre · Shuffl']);
  expect(byName('Descubre · Shuffl')[0].id).toBe(firstExplore);

  await explore();
  expect(appNames()).toEqual(['Chill · Shuffl', 'Descubre · Shuffl']);
  expect(byName('Descubre · Shuffl')[0].id).not.toBe(firstExplore);
});

test('las antiguas sin categoría se clasifican por su etiqueta: un Descubre de antes solo lo quita un Descubre nuevo', async ({ page }) => {
  // Creadas por la v1.4.2 (sin categoría): las claves «explore» y «pl:…» dan su tipo; el nombre «Descubre» de una tuya no cuenta.
  const tagFor = async (key) => page.evaluate(async (k) => {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`shuffl:${k}`)));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
  }, key);
  await page.goto('/');
  const nameHash = (name) => {
    let h = 0x811c9dc5;
    for (const ch of name) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0').slice(0, 6);
  };
  const old = async (id, name, key) => state.lists.set(id, { id, name, description: `Antigua · shuffl:src=${await tagFor(key)}.${nameHash(name)}`, owner: { id: 'me' }, tracks: state.lists.get('pl_chill').tracks.slice(0, 3) });
  await old('oldExplore', 'Descubre · Shuffl', 'explore');
  await old('oldMine', 'Descubre · Shuffl', 'pl:pl_mia');
  await old('oldNew', 'Novedades · Shuffl', 'new');
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  // El shuffle quita el shuffle antiguo (la tuya llamada «Descubre», que era un shuffle) y deja Descubre y Novedades.
  expect(state.lists.has('oldMine')).toBe(false);
  expect(state.lists.has('oldExplore')).toBe(true);
  expect(state.lists.has('oldNew')).toBe(true);
  await openPanel(page, 'explore');
  await page.locator('#explore-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  expect(state.lists.has('oldExplore')).toBe(false);
  expect(state.lists.has('oldNew')).toBe(true);
  expect(byName('Rock · Shuffl')).toHaveLength(1);
});

test('la hoja de la primera vez enseña solo las del mismo tipo', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('shuffl.purgeOk'));
  state.lists.set('a1', { id: 'a1', name: '📸 Top 4 semanas', description: 'Instantánea creada con Baraja', owner: { id: 'me' }, tracks: [] });
  state.lists.set('a2', { id: 'a2', name: '🔀 Baraja', description: 'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado', owner: { id: 'me' }, tracks: [] });
  await login(page);
  await pick(page, 'shuffle', 'Rock');
  await page.locator('#shuffle-go').click();
  await expect(page.locator('#purge-list')).toBeVisible();
  await expect(page.locator('#purge-list li')).toHaveText(['🔀 Baraja']);
  await expect(page.locator('#purge-sheet')).toContainText('Las de otros tipos se quedan');
  await page.locator('#purge-ok').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  expect(state.lists.has('a2')).toBe(false);
  expect(state.lists.has('a1')).toBe(true);
});

// ---------- Descubre y Novedades: variedad y Tus me gusta ----------

/** Lanzamientos recientes: `perArtist` canciones de cada uno de los `n` primeros artistas seguidos. */
function seedReleases(n, perArtist = 6) {
  const day = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < n; i++) {
    const id = `art${i}`;
    const album = `rel_v150_${id}`;
    state.releases[id] = [{ id: album, name: `Disco ${id}`, album_type: 'album', release_date: day, release_date_precision: 'day', images: [] }];
    state.albumTracks[album] = Array.from({ length: perArtist }, (_, k) => {
      const tr = { ...makeTrack(8000 + i * 10 + k, { artistId: id, artist: `Artista ${id}` }), album: { id: album, name: `Disco ${id}`, images: [] }, track_number: k + 1 };
      state.catalog.set(tr.uri, tr);
      return tr;
    });
  }
}
const perArtistCounts = (list) => {
  const m = new Map();
  for (const t of list.tracks) m.set(t.artists[0].id, (m.get(t.artists[0].id) ?? 0) + 1);
  return [...m.values()];
};

test('Novedades: como mucho 3 por artista por defecto, repartidas entre artistas', async ({ page }) => {
  seedReleases(20);
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toContainText('30 canciones');
  await idle(page);
  const counts = perArtistCounts(byName('Novedades · Shuffl')[0]);
  expect(Math.max(...counts)).toBeLessThanOrEqual(3);
  expect(counts.length).toBeGreaterThanOrEqual(10);
});

test('si no hay artistas distintos suficientes lo explica en vez de rellenar con el mismo; el máximo se ajusta', async ({ page }) => {
  seedReleases(3, 10);
  state.topArtists = { short_term: [], medium_term: [], long_term: [] };
  state.artists = state.artists.slice(0, 3);
  await login(page);
  await openPanel(page, 'new');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toContainText('9 canciones');
  await expect(page.locator('#panel-new .note')).toContainText('con un máximo de 3 por artista');
  await idle(page);
  expect(Math.max(...perArtistCounts(byName('Novedades · Shuffl')[0]))).toBe(3);
  await back(page, 'new');
  await page.locator('#new-more > summary').click();
  await page.locator('label[for="new-per-artist-5"]').click();
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toContainText('15 canciones');
  await idle(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shuffl.perArtist')))).toBe(5);
});

test('Tus me gusta como base en Novedades y Descubre («Como mi playlist…»), leyendo solo las más recientes', async ({ page }) => {
  // Tus me gusta: 60 canciones de los artistas art0..art6 (makeTrack reparte i % 7).
  state.liked = state.liked.map((t, i) => ({ ...t, artists: [{ id: `art${i % 7}`, name: `Artista art${i % 7}` }] }));
  seedReleases(7);
  await login(page);
  for (const kind of ['new', 'explore']) {
    await openPanel(page, kind);
    await page.locator(`label[for="${kind}-style-playlist"]`).click();
    await expect(page.locator(`#${kind}-seed option`, { hasText: 'Tus me gusta' })).toHaveCount(1);
  }
  await openPanel(page, 'new');
  await page.locator('#new-seed').selectOption({ label: 'Tus me gusta' });
  await expect(page.locator('#new-source')).toContainText('tus 200 me gusta más recientes');
  await page.locator('#new-go').click();
  await expect(resultMeta(page)).toBeVisible();
  await idle(page);
  const list = byName('Novedades · Shuffl')[0];
  expect(list.tracks.every((t) => /^rel_v150_art[0-6]$/.test(t.album.id))).toBe(true);
  const liked = new Set(state.liked.map((t) => t.uri));
  expect(list.tracks.some((t) => liked.has(t.uri))).toBe(false);
});

// ---------- Asistente de alta y guía ----------

test('asistente: en la app instalada el paso 1 sale hecho y sin el aviso del navegador', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.goto('/');
  await expect(page.locator('#setup-installed')).toBeVisible();
  await expect(page.locator('#setup-setupInstall')).toHaveClass(/done/);
  await expect(page.locator('#setup-warn')).toHaveCount(0);
});

for (const [path, lang, other, cta] of [['guia/', 'es', 'guide/', 'Abrir Shuffl'], ['guide/', 'en', 'guia/', 'Open Shuffl']]) {
  test(`guía de instalación (${lang}): orden, campos, enlaces externos en otra pestaña y copiar la Redirect URI`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/${path}`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('.guide-steps > .step')).toHaveCount(3);
    await expect(page.locator('.setup-warn')).toBeVisible();
    for (const field of ['App name', 'App description', 'Website', 'Redirect URIs', 'Which API/SDKs are you planning to use?', 'Web API', 'Settings']) {
      await expect(page.locator('.guide-steps')).toContainText(field);
    }
    await expect(page.locator('#redirect-uri')).toHaveValue('https://juandelmazovazquez.github.io/shuffl/');
    for (const a of await page.locator('a[href^="http"]').all()) {
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await page.locator('button[data-copy="redirect-uri"]').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://juandelmazovazquez.github.io/shuffl/');
    await expect(page.locator('.guide-lang')).toHaveAttribute('href', `../${other}`);
    await expect(page.locator('.guide-cta a')).toHaveText(cta);
    // Sin desbordar en un iPhone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('.guide-lang').click();
    await expect(page).toHaveURL(`${BASE}${other}`);
  });
}

test('en la app todos los enlaces externos se abren en otra pestaña', async ({ page }) => {
  await login(page);
  for (const tab of ['home', 'shuffle', 'discover', 'more']) {
    await page.locator(`#tab-${tab}`).click();
    for (const a of await page.locator('a[href^="http"]:visible').all()) await expect(a).toHaveAttribute('target', '_blank');
  }
});
