import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tagFor, withTag, readTag, isAppPlaylist, readCategory, appCategory, replacedBy, CATEGORIES, MAX_DESCRIPTION,
} from '../../js/targets.js';
import { selfBlocker } from '../../js/core.js';
import { spreadByArtist, countArtists, mainArtist, sanitizePerArtist, DEFAULT_PER_ARTIST } from '../../js/generators.js';
import { SpotifyApi } from '../../js/api.js';

const pl = (name, description, extra = {}) => ({ id: name, name, description, owner: { id: 'me' }, collaborative: false, ...extra });
/** Una playlist como la crea la v1.5.0: etiqueta con categoría, origen y resumen del nombre. */
const v150 = async (name, key, cat) => pl(name, withTag('Desde: algo', await tagFor(key), name, cat));
/** Como la creaban la v1.3.1 a la v1.4.2: sin categoría. */
const v14 = async (name, key) => pl(name, withTag('Desde: algo', await tagFor(key), name));

// ---------- Categorías ----------

test('la etiqueta lleva la categoría antes del origen; las versiones anteriores siguen leyendo la etiqueta', async () => {
  const tag = await tagFor('explore');
  const d = withTag('Canciones nuevas', tag, 'Descubre · Shuffl', 'explore');
  assert.match(d, / · shuffl:cat=explore · shuffl:src=[a-f0-9]{10}\.[a-f0-9]{6}$/);
  assert.equal(readTag(d), tag);
  assert.equal(readCategory(d), 'explore');
  // La expresión de la v1.4.2, copiada tal cual: una app antigua la sigue reconociendo como de Shuffl.
  const OLD_TAG_RE = /(?:^| · )shuffl:src=([a-f0-9]{10})(?:\.([a-f0-9]{6}))?\s*$/;
  assert.equal(OLD_TAG_RE.exec(d)?.[1], tag);
  assert.ok(isAppPlaylist(pl('Descubre · Shuffl', d), 'me'));
  assert.ok(!isAppPlaylist(pl('Mi Descubre', d), 'me'), 'renombrada: no es de Shuffl aunque lleve categoría');
  assert.equal([...withTag('x'.repeat(400), tag, 'n', 'snap')].length, MAX_DESCRIPTION, 'cabe siempre en 300');
  assert.equal(readCategory(withTag('x', tag, 'n', 'inventada')), null, 'una categoría desconocida no se escribe');
  assert.equal(readCategory('Algo · shuffl:cat=futura · shuffl:src=0123456789.abcdef'), 'unknown', 'de una versión futura');
  assert.equal(readCategory('Algo · shuffl:cat=shuffle'), null, 'sin origen detrás no cuenta');
  assert.equal(readCategory('Rock &amp; Roll · shuffl:cat=new · shuffl:src=0123456789.abcdef'), 'new', 'con entidades HTML');
  // Con otro formato (guion, cifras, algo en medio) tampoco se trata como shuffle: no se borra con ninguna.
  for (const d of ['x · shuffl:cat=top-mix · shuffl:src=0123456789.abcdef', 'x · shuffl:cat=mix2 · shuffl:src=0123456789.abcdef', 'x · shuffl:cat=a · otro · shuffl:src=0123456789.abcdef']) {
    const cat = await appCategory(pl('n', d));
    assert.equal(cat, 'unknown', d);
    assert.equal(replacedBy('shuffle', cat), false);
  }
});

test('categoría de las playlists nuevas, de las de la v1.3 a la v1.4.2 (por su clave) y de las sin etiqueta (por su nombre)', async () => {
  assert.equal(await appCategory(await v150('Rock · Shuffl', 'pl:a', 'shuffle')), 'shuffle');
  assert.equal(await appCategory(await v150('Novedades · Shuffl', 'new', 'new')), 'new');
  const byKey = [
    ['Novedades · Shuffl', 'new', 'new'], ['New releases · Shuffl', 'new', 'new'], ['Descubre · Shuffl', 'explore', 'explore'],
    ['Explore · Shuffle', 'explore', 'explore'], ['Olvidadas · Shuffl', 'forgotten', 'forgotten'], ['Forgotten · Shuffle', 'forgotten', 'forgotten'],
    ['Mi top · Shuffl', 'top', 'snap'], ['📸 Top 4 semanas', 'snap:top_short', 'snap'], ['📸 Recently played', 'snap:recent', 'snap'],
    ['Hace 3 años · Shuffle', 'ago:3', 'forgotten'], ['Shuffl · prueba de borrado & limpieza', 'diag', 'diag'],
    ['Rock · Shuffl', 'pl:abc', 'shuffle'], ['Coche · Shuffl', 'mix:m1', 'shuffle'], ['Toda mi música · Shuffl', 'library', 'shuffle'],
    ['Gym 45 min · Shuffl', 'pl:abc', 'shuffle'], ['35 min · Shuffle', 'time:35', 'shuffle'], ['Rock · Álbumes · Shuffle', 'albums:pl:x', 'shuffle'],
  ];
  for (const [name, key, cat] of byKey) assert.equal(await appCategory(await v14(name, key)), cat, `${name} (${key})`);
  // Una playlist tuya llamada «Descubre» y barajada es un shuffle: manda la clave, no el nombre.
  assert.equal(await appCategory(await v14('Descubre · Shuffl', 'pl:mia')), 'shuffle');
  assert.equal(await appCategory(await v14('Novedades · Rock · Shuffl', 'pl:mia')), 'shuffle');
  // Sin etiqueta (v1.2 y anteriores).
  assert.equal(await appCategory(pl('🔀 Baraja', 'Barajada con Baraja · aleatorio uniforme · reprodúcela con el aleatorio de Spotify apagado')), 'shuffle');
  assert.equal(await appCategory(pl('📸 Top 4 semanas', 'Instantánea creada con Baraja')), 'snap');
  assert.equal(await appCategory(pl('Rock · Shuffle', 'Barajada con Shuffl (aleatorio uniforme; reprodúcela con el aleatorio de Spotify apagado). Origen: Rock')), 'shuffle');
});

test('borrado por categorías: cada una sustituye solo a la suya (y a una prueba del diagnóstico que se quedara)', () => {
  const creatable = ['shuffle', 'explore', 'new', 'forgotten', 'snap'];
  for (const made of creatable) {
    for (const other of [...CATEGORIES, 'unknown', null, undefined]) {
      const expected = other === made || other === 'diag';
      assert.equal(replacedBy(made, other), expected, `${made} quita ${other}: ${expected}`);
    }
  }
  assert.equal(replacedBy('inventada', 'inventada'), false, 'una categoría desconocida no borra nada');
  assert.equal(replacedBy(undefined, undefined), false);
});

test('ejemplo del encargo: shuffle y Descubre conviven; otro shuffle quita solo el shuffle anterior', async () => {
  const library = [
    await v150('Rock · Shuffl', 'pl:rock', 'shuffle'),
    await v150('Descubre · Shuffl', 'explore', 'explore'),
    await v14('Novedades · Shuffl', 'new'),
    await v14('📸 Top 4 semanas', 'snap:top_short'),
    pl('Mi playlist', 'Mía'),
    pl('Rock · Shuffl', withTag('d', await tagFor('pl:x'), 'Rock · Shuffl', 'shuffle'), { owner: { id: 'otra' } }),
  ];
  const removedBy = async (cat) => {
    const out = [];
    for (const p of library) if (isAppPlaylist(p, 'me') && replacedBy(cat, await appCategory(p))) out.push(p.name);
    return out;
  };
  assert.deepEqual(await removedBy('shuffle'), ['Rock · Shuffl'], 'la de otra persona nunca');
  assert.deepEqual(await removedBy('explore'), ['Descubre · Shuffl']);
  assert.deepEqual(await removedBy('new'), ['Novedades · Shuffl']);
  assert.deepEqual(await removedBy('snap'), ['📸 Top 4 semanas']);
  assert.deepEqual(await removedBy('forgotten'), []);
});

// ---------- Barajar en la original ----------

test('selfBlocker: cuándo no se puede barajar en la playlist original y por qué', () => {
  const mine = { id: 'a', owned: true, collaborative: false };
  const collab = { id: 'b', owned: false, collaborative: true };
  const liked = { id: 'liked', isLiked: true, owned: false, collaborative: false };
  const other = { id: 'c', owned: false, collaborative: false };
  assert.equal(selfBlocker({ sel: [mine] }), null);
  assert.equal(selfBlocker({ sel: [collab] }), null, 'las colaborativas también se pueden reordenar');
  assert.equal(selfBlocker({ sel: [] }), 'selfWhyPick');
  assert.equal(selfBlocker({ sel: [mine, collab] }), 'selfWhyMulti');
  assert.equal(selfBlocker({ sel: [mine], library: true }), 'selfWhyMulti');
  assert.equal(selfBlocker({ sel: [liked] }), 'selfWhyLiked');
  assert.equal(selfBlocker({ sel: [other] }), 'selfWhyNotYours');
  assert.equal(selfBlocker({ sel: [mine], timed: true }), 'selfWhyTime');
  assert.equal(selfBlocker({ sel: [mine], filtered: true }), 'selfWhyFilters');
});

// ---------- Variedad en Descubre y Novedades ----------

const tr = (artist, n) => ({ uri: `spotify:track:${artist}${n}`, artistIds: [artist], artists: [artist.toUpperCase()] });

test('spreadByArtist: por turnos entre artistas y sin pasar del máximo', () => {
  const pool = [tr('a', 1), tr('a', 2), tr('a', 3), tr('a', 4), tr('b', 1), tr('b', 2), tr('c', 1)];
  const { ordered, overflow } = spreadByArtist(pool, 2);
  assert.deepEqual(ordered.map((x) => x.uri.slice(-2)), ['a1', 'b1', 'c1', 'a2', 'b2']);
  assert.deepEqual(overflow.map((x) => x.uri.slice(-2)), ['a3', 'a4']);
  assert.equal(spreadByArtist(pool, 1).ordered.length, 3, 'una por artista');
  // Lo que ya lleva la playlist cuenta («Buscar más»).
  const used = countArtists([tr('a', 9), tr('a', 8)]);
  assert.deepEqual(spreadByArtist(pool, 2, used).ordered.map((x) => x.uri.slice(-2)), ['b1', 'c1', 'b2']);
  // Si un artista lo llena todo, no se rellena con él.
  assert.equal(spreadByArtist(Array.from({ length: 30 }, (_, i) => tr('a', i)), 3).ordered.length, 3);
});

test('mainArtist y el máximo por artista ajustable', () => {
  assert.equal(mainArtist({ artistIds: ['x', 'y'], artists: ['X', 'Y'] }), 'x');
  assert.equal(mainArtist({ artistIds: [], artists: ['Solo nombre'] }), 'Solo nombre');
  assert.equal(sanitizePerArtist(3), 3);
  assert.equal(sanitizePerArtist(99), DEFAULT_PER_ARTIST);
  assert.equal(sanitizePerArtist('2'), DEFAULT_PER_ARTIST, 'solo números de la lista');
});

// ---------- Tus me gusta como base ----------

test('getLikedRecent: solo las más recientes, sin leer toda la lista', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    const offset = Number(new URL(url).searchParams.get('offset'));
    const body = { total: 5000, items: Array.from({ length: 50 }, (_, i) => ({ track: { id: `t${offset + i}` } })) };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body), json: async () => body, clone() { return this; } };
  };
  const api = new SpotifyApi({ auth: { getAccessToken: async () => 't', refresh: async () => {} }, fetchImpl, sleep: async () => {} });
  const items = await api.getLikedRecent(200);
  assert.equal(items.length, 200);
  assert.equal(urls.length, 4, '4 peticiones para 200, aunque haya 5000');
  assert.ok(urls.every((u) => new URL(u).pathname === '/v1/me/tracks'));
});
