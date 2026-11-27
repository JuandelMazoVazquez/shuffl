// Modo demo (v1.4.0): un Spotify inventado que vive en memoria. Se inyecta en SpotifyApi como `fetchImpl`, así que
// la app entera funciona igual que con una cuenta real pero sin ninguna petición a la red. Playlists, canciones,
// artistas y carátulas son ficticios y se generan aquí (formas y colores de la paleta de Shuffl).

export const DEMO_ME = { id: 'shuffldemo', display_name: 'Demo' };

/** Autenticación de mentira: SpotifyApi pide un token antes de cada petición; aquí nunca caduca. */
export const demoAuth = { getAccessToken: async () => 'demo', refresh: async () => {} };

/** ¿Hay que arrancar en modo demo? Con `?demo=1` (o `?demo`) en la dirección. */
export const wantsDemo = (search) => {
  const v = new URLSearchParams(search).get('demo');
  return v !== null && v !== '0';
};

// ---------- Azar con semilla: los mismos datos en cada carga (capturas estables) ----------

function hashSeed(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

function seeded(seed) {
  let a = typeof seed === 'number' ? seed : hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Carátulas generadas (SVG) ----------

/** Fondo y figura con buen contraste, solo con colores de Shuffl. */
const PAIRS = [
  ['#0b0b0b', '#c6ff3d', '#f4f6f0'], ['#c6ff3d', '#0b0b0b', '#3d6b00'], ['#3d6b00', '#c6ff3d', '#0b0b0b'],
  ['#f4f6f0', '#3d6b00', '#ff8a80'], ['#ff8a80', '#0b0b0b', '#f4f6f0'], ['#161616', '#ff8a80', '#c6ff3d'],
  ['#0b0b0b', '#f4f6f0', '#ff8a80'], ['#5a8f0a', '#f4f6f0', '#0b0b0b'],
];

const r1 = (n) => Math.round(n * 10) / 10;

const PATTERNS = [
  // Anillos concéntricos
  (rnd, fg, ac) => {
    const cx = r1(30 + rnd() * 40), cy = r1(30 + rnd() * 40);
    return [44, 34, 24, 14].map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i % 2 ? ac : fg}" stroke-width="5"/>`).join('');
  },
  // Franjas diagonales
  (rnd, fg, ac) => {
    const w = 6 + Math.floor(rnd() * 6);
    let out = '';
    for (let x = -100, i = 0; x < 100; x += w * 2, i++) out += `<rect x="${x}" y="-20" width="${w}" height="160" fill="${i % 4 === 3 ? ac : fg}" transform="rotate(35 50 50)"/>`;
    return out;
  },
  // Rejilla de puntos
  (rnd, fg, ac) => {
    const hole = Math.floor(rnd() * 16);
    let out = '';
    for (let i = 0; i < 16; i++) out += `<circle cx="${17 + (i % 4) * 22}" cy="${17 + Math.floor(i / 4) * 22}" r="${i === hole ? 9 : 6}" fill="${i === hole ? ac : fg}"/>`;
    return out;
  },
  // Sol sobre el horizonte
  (rnd, fg, ac) => {
    const y = r1(52 + rnd() * 14);
    let out = `<circle cx="50" cy="${y}" r="28" fill="${fg}"/><rect x="0" y="${y}" width="100" height="${100 - y}" fill="${ac}"/>`;
    for (let k = 1; k < 4; k++) out += `<rect x="0" y="${r1(y + k * 9)}" width="100" height="3" fill="${fg}" opacity=".5"/>`;
    return out;
  },
  // Ecualizador
  (rnd, fg, ac) => {
    let out = '';
    for (let i = 0; i < 7; i++) {
      const hgt = r1(18 + rnd() * 60);
      out += `<rect x="${10 + i * 12}" y="${r1(88 - hgt)}" width="8" height="${hgt}" rx="2" fill="${i === 3 ? ac : fg}"/>`;
    }
    return out;
  },
  // Triángulos
  (rnd, fg, ac) => {
    let out = '';
    for (let i = 0; i < 3; i++) {
      const x = r1(10 + rnd() * 50), y = r1(15 + rnd() * 45), s = r1(25 + rnd() * 25);
      out += `<path d="M${x} ${r1(y + s)}L${r1(x + s / 2)} ${y}L${r1(x + s)} ${r1(y + s)}Z" fill="${i === 1 ? ac : fg}" opacity="${i === 2 ? '.7' : '1'}"/>`;
    }
    return out;
  },
  // Media luna y punto
  (rnd, fg, ac) => {
    const cx = r1(40 + rnd() * 20);
    return `<circle cx="${cx}" cy="48" r="30" fill="${fg}"/><circle cx="${r1(cx + 14)}" cy="40" r="26" fill="var(--b)"/><circle cx="${r1(20 + rnd() * 60)}" cy="82" r="6" fill="${ac}"/>`;
  },
  // Naipes en abanico (el gesto de Shuffl)
  (rnd, fg, ac) => [-18, 0, 18].map((rot, i) => `<rect x="36" y="20" width="28" height="44" rx="4" fill="${i === 1 ? ac : fg}" transform="rotate(${rot + r1(rnd() * 6 - 3)} 50 84)"/>`).join(''),
];

/** SVG de 100x100 como dirección `data:` (se pinta en un <img>, donde un SVG no puede ejecutar nada). */
export function coverSvg(seed) {
  const rnd = seeded(`cover:${seed}`);
  const [bg, fg, ac] = PAIRS[Math.floor(rnd() * PAIRS.length)];
  const body = PATTERNS[Math.floor(rnd() * PATTERNS.length)](rnd, fg, ac).replaceAll('var(--b)', bg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Como las de Spotify: de mayor a menor. Es la misma imagen vectorial en los tres tamaños. */
const images = (seed) => {
  const url = coverSvg(seed);
  return [640, 300, 64].map((w) => ({ url, width: w, height: w }));
};

/** Portada de las playlists que crea Shuffl en la demo: naipes lima sobre negro. */
const SHUFFL_COVER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b0b0b"/><rect x="34" y="22" width="32" height="48" rx="5" fill="#3d6b00" transform="rotate(-16 50 80)"/><rect x="34" y="22" width="32" height="48" rx="5" fill="#c6ff3d" transform="rotate(12 50 80)"/></svg>')}`;

// ---------- Nombres inventados ----------

const ARTISTS = [
  ['Coral Eléctrico', ['indie pop', 'synthpop']], ['Las Polillas Lunares', ['indie rock', 'rock alternativo']], ['Martina Cuarzo', ['pop', 'indie pop']],
  ['Nube Ácida', ['electrónica', 'house']], ['Delta Sonora', ['jazz', 'soul']], ['Olivia Faro', ['folk', 'cantautor']],
  ['Ciclistas Nocturnos', ['synthwave', 'electrónica']], ['Brisa Mecánica', ['lo-fi', 'chill']], ['Pájaro Neón', ['funk', 'soul']],
  ['Sara Lumen', ['pop', 'r&b']], ['Volcán Suave', ['rock alternativo', 'indie rock']], ['Hotel Marea', ['indie pop', 'surf']],
  ['Teo Galaxia', ['hip hop', 'r&b']], ['Orquesta Diminuta', ['jazz', 'clásica moderna']], ['Los Mapas Rotos', ['punk', 'rock alternativo']],
  ['Lía Monzón', ['folk', 'indie pop']], ['Satélite Tímido', ['lo-fi', 'electrónica']], ['Club Ámbar', ['house', 'funk']],
  ['Ramiro Brújula', ['cantautor', 'folk']], ['Velvet Pomelo', ['synthpop', 'pop']], ['Tormenta de Azúcar', ['pop', 'surf']],
  ['Mar de Fondo Trío', ['jazz', 'chill']], ['Kiko Asteroide', ['hip hop', 'funk']], ['Las Hermanas Prisma', ['r&b', 'soul']],
  // Artistas que no sigues: aparecen al explorar géneros en Descubrir
  ['Cometa Lenta', ['indie pop', 'lo-fi']], ['Faro del Sur', ['folk', 'surf']], ['Neón Tropical', ['funk', 'house']],
  ['Bruma Dorada', ['synthwave', 'chill']], ['Gato Cósmico', ['rock alternativo', 'punk']], ['Alba Vinilo', ['soul', 'jazz']],
  ['Pista Siete', ['electrónica', 'synthpop']], ['Luz de Garaje', ['indie rock', 'surf']], ['Mía Satén', ['r&b', 'pop']],
  ['Bosque Digital', ['lo-fi', 'clásica moderna']], ['Ritmo Papel', ['hip hop', 'lo-fi']], ['Coro de Medianoche', ['cantautor', 'soul']],
];
const FOLLOWED = 24;

const WORDS = {
  es: {
    a: ['lentas', 'eléctricas', 'de cristal', 'dormidas', 'de verano', 'infinitas', 'de neón', 'tranquilas', 'salvajes', 'perdidas', 'de papel', 'doradas', 'nocturnas', 'secretas'],
    n: ['Luces', 'Mareas', 'Tardes', 'Ventanas', 'Olas', 'Estrellas', 'Calles', 'Nubes', 'Palabras', 'Señales', 'Bicicletas', 'Playas', 'Llamadas', 'Ciudades', 'Cometas', 'Postales'],
    album: ['Casa de huéspedes', 'Mapa del tesoro', 'Kilómetros', 'Vista al mar', 'Temporada alta', 'Fiebre de sábado', 'Sin cobertura', 'Primera fila', 'Cuaderno azul', 'Hora dorada', 'Rumbo norte', 'Volver a casa'],
  },
  en: {
    a: ['Slow', 'Electric', 'Glass', 'Sleepy', 'Summer', 'Endless', 'Neon', 'Quiet', 'Wild', 'Lost', 'Paper', 'Golden', 'Midnight', 'Secret'],
    n: ['Lights', 'Tides', 'Afternoons', 'Windows', 'Waves', 'Stars', 'Streets', 'Clouds', 'Words', 'Signals', 'Bicycles', 'Beaches', 'Calls', 'Cities', 'Kites', 'Postcards'],
    album: ['Guest House', 'Treasure Map', 'Miles', 'Sea View', 'High Season', 'Saturday Fever', 'No Signal', 'Front Row', 'Blue Notebook', 'Golden Hour', 'Heading North', 'Coming Home'],
  },
};

const PLAYLISTS = {
  es: ['Domingo lento', 'Carretera y manta', 'Para entrenar', 'Concentración total', 'Cocinando', 'Verano 2019', 'Fiesta en casa', 'Éxitos de la radio imaginaria'],
  en: ['Slow Sunday', 'Road Trip', 'Workout', 'Deep Focus', 'Cooking', 'Summer 2019', 'House Party', 'Imaginary Radio Hits'],
};

/** Dos mezclas guardadas y una «última baraja», para que Inicio no salga vacío en la demo. */
export function demoMixes(lang = 'es', now = Date.now()) {
  const P = PLAYLISTS[lang] ?? PLAYLISTS.es;
  const en = lang === 'en';
  return {
    mixes: [
      { id: 'demomixgym', name: en ? 'Gym' : 'Gimnasio', ids: ['demopl2'], names: [P[2]], kind: 'time', minutes: 45, preset: 'gym' },
      { id: 'demomixweekend', name: en ? 'Weekend' : 'Fin de semana', ids: ['demopl0', 'demopl4'], names: [P[0], P[4]], kind: 'songs' },
    ],
    last: { ids: ['demopl1'], names: [P[1]], kind: 'songs', mode: 'reuse', at: new Date(now - 2 * 3600000).toISOString() },
  };
}

// ---------- El Spotify de mentira ----------

const DAY = 86400000;
const pad = (n, w = 3) => String(n).padStart(w, '0');
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Crea el estado inicial (biblioteca, escuchas, artistas) para el idioma dado. */
export function createDemoState(lang = 'es', now = Date.now()) {
  const L = WORDS[lang] ?? WORDS.es;
  const P = PLAYLISTS[lang] ?? PLAYLISTS.es;
  const rnd = seeded('shuffl-demo');
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const catalog = new Map();
  const artists = ARTISTS.map(([name, genres], i) => ({ id: `demoar${pad(i)}`, uri: `spotify:artist:demoar${pad(i)}`, type: 'artist', name, genres, images: images(`artist${i}`), followers: { total: 1000 + i * 37 } }));
  const albums = [];
  const albumTracks = {};
  const usedTitles = new Set();
  const title = () => {
    for (;;) {
      const t = lang === 'en' ? `${pick(L.a)} ${pick(L.n)}` : `${pick(L.n)} ${pick(L.a)}`;
      if (!usedTitles.has(t) || usedTitles.size > 200) { usedTitles.add(t); return t; }
    }
  };
  let trackSeq = 0;
  artists.forEach((ar, ai) => {
    // Dos discos antiguos y un lanzamiento reciente (de hace 2 a 75 días) por artista.
    const kinds = [
      { type: 'album', date: now - (400 + Math.floor(rnd() * 3000)) * DAY, n: 8 },
      { type: 'album', date: now - (200 + Math.floor(rnd() * 900)) * DAY, n: 6 },
      { type: ai % 3 ? 'single' : 'album', date: now - (2 + Math.floor(rnd() * 74)) * DAY, n: ai % 3 ? 2 : 5 },
    ];
    kinds.forEach((k, ki) => {
      const id = `demoal${pad(ai)}${ki}`;
      const album = { id, uri: `spotify:album:${id}`, name: k.type === 'single' ? title() : pick(L.album), album_type: k.type, release_date: isoDay(k.date), release_date_precision: 'day', images: images(id), artists: [{ id: ar.id, name: ar.name }], total_tracks: k.n };
      albums.push(album);
      albumTracks[id] = Array.from({ length: k.n }, (_, ti) => {
        const tid = `demotr${pad(trackSeq++, 4)}`;
        const tr = {
          id: tid, uri: `spotify:track:${tid}`, type: 'track', name: ti === 0 && k.type === 'single' ? album.name : title(),
          artists: [{ id: ar.id, name: ar.name }], duration_ms: 140000 + Math.floor(rnd() * 160000), explicit: rnd() < 0.12,
          disc_number: 1, track_number: ti + 1, external_ids: { isrc: `ZZDEMO${pad(trackSeq, 6)}` },
          album: { id, name: album.name, release_date: album.release_date, release_date_precision: 'day', images: album.images },
        };
        catalog.set(tr.uri, tr);
        return tr;
      });
    });
  });
  const followed = artists.slice(0, FOLLOWED);
  const pool = followed.flatMap((ar) => albums.filter((al) => al.artists[0].id === ar.id && al.release_date < isoDay(now - 100 * DAY)).flatMap((al) => albumTracks[al.id]));
  const sample = (n) => {
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  };
  /** Fecha en la que «guardaste» la canción: de hace `minDays` a `maxDays`. */
  const added = (list, minDays, maxDays) => list.map((track) => ({ added_at: new Date(now - (minDays + Math.floor(rnd() * (maxDays - minDays))) * DAY).toISOString().replace(/\.\d+Z$/, 'Z'), item: track }));
  const me = DEMO_ME;
  const friend = { id: 'demofriend', display_name: lang === 'en' ? 'Alex (friend)' : 'Alex (amigo)' };
  const radio = { id: 'demoradio', display_name: lang === 'en' ? 'Imaginary Radio' : 'Radio Imaginaria' };
  const mk = (i, owner, entries, extra = {}) => [`demopl${i}`, { id: `demopl${i}`, name: P[i], description: '', owner, collaborative: false, entries, images: images(`pl${i}`), version: 1, ...extra }];
  const lists = new Map([
    mk(0, me, added(sample(42), 3, 500)),
    mk(1, me, added(sample(64), 10, 900)),
    mk(2, me, added(sample(55), 5, 700)),
    mk(3, me, added(sample(48), 20, 1200)),
    mk(4, me, added(sample(36), 30, 800)),
    mk(5, me, added(sample(40), 1800, 2400)),
    mk(6, friend, added(sample(38), 2, 300), { collaborative: true }),
    mk(7, radio, added(sample(50), 1, 30)),
  ]);
  const liked = added(sample(160), 1, 2600).sort((a, b) => b.added_at.localeCompare(a.added_at));
  const tops = (n, seed) => {
    const r = seeded(seed);
    return [...pool].sort(() => r() - 0.5).slice(0, n);
  };
  const topArtistsOf = (seed) => {
    const r = seeded(seed);
    return [...followed].sort(() => r() - 0.5).slice(0, 20);
  };
  return {
    me, catalog, lists, liked, artists, followed, albums, albumTracks,
    top: { short_term: tops(50, 's'), medium_term: tops(50, 'm'), long_term: tops(50, 'l') },
    topArtists: { short_term: topArtistsOf('s'), medium_term: topArtistsOf('m'), long_term: topArtistsOf('l') },
    recent: tops(40, 'r').map((track, i) => ({ track, played_at: new Date(now - i * 23 * 60000).toISOString() })),
    devices: [{ id: 'demodevice', name: lang === 'en' ? 'Demo iPhone' : 'iPhone de la demo', type: 'Smartphone', is_active: true, is_restricted: false, volume_percent: 60 }],
    player: null, created: 0,
  };
}

const res = (status, body) => (body === undefined
  ? new Response(null, { status })
  : new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const fail = (status, message) => res(status, { error: { status, message } });

/**
 * `fetch` de mentira para SpotifyApi. Responde como la Web API (mismas rutas, paginación y errores) con el estado de
 * `createDemoState`. Nada sale del dispositivo: cualquier ruta que no esté aquí da 404 en vez de ir a la red.
 * `delay` (ms) imita la latencia para que se vean las animaciones de carga; `npm run media` la alarga con
 * `globalThis.__shufflDemoDelay` para que los vídeos enseñen la animación de barajar.
 */
export function createDemoFetch(state, { delay = null } = {}) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = (items, url) => {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return { total: items.length, limit, offset, items: items.slice(offset, offset + limit), next: null };
  };
  const snap = (l) => `demo-${l.version}`;
  const meta = (l) => ({
    id: l.id, name: l.name, description: l.description, owner: l.owner, collaborative: l.collaborative, public: false,
    items: { total: l.entries.length }, snapshot_id: snap(l), images: l.images, uri: `spotify:playlist:${l.id}`,
  });
  const trackOf = (uri) => state.catalog.get(uri) ?? null;
  const readable = (l) => l.owner.id === state.me.id || l.collaborative;
  const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  return async function demoFetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/v1/, '');
    const body = typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null;
    const ms = delay ?? globalThis.__shufflDemoDelay ?? 90;
    if (ms) await wait(ms * (0.6 + Math.random() * 0.8));
    if (url.hostname !== 'api.spotify.com') return fail(404, 'demo');

    if (method === 'GET' && path === '/me') return res(200, { ...state.me, product: 'premium', country: 'ES' });
    if (method === 'GET' && path === '/me/playlists') return res(200, page([...state.lists.values()].map(meta), url));
    if (method === 'GET' && path === '/me/tracks') return res(200, page(state.liked, url));
    if (method === 'GET' && path === '/me/albums') return res(200, page(state.albums.slice(0, 12).map((album, i) => ({ added_at: new Date(Date.now() - i * 40 * DAY).toISOString(), album })), url));
    if (method === 'GET' && path === '/me/following') {
      const after = url.searchParams.get('after');
      const start = after ? state.followed.findIndex((a) => a.id === after) + 1 : 0;
      const items = state.followed.slice(start, start + 50);
      const more = start + 50 < state.followed.length;
      return res(200, { artists: { items, total: state.followed.length, cursors: { after: more ? items.at(-1).id : null } } });
    }
    if (method === 'GET' && path === '/me/top/tracks') return res(200, { items: (state.top[url.searchParams.get('time_range')] ?? []).slice(0, Number(url.searchParams.get('limit') ?? 20)) });
    if (method === 'GET' && path === '/me/top/artists') return res(200, { items: (state.topArtists[url.searchParams.get('time_range')] ?? []).slice(0, Number(url.searchParams.get('limit') ?? 20)) });
    if (method === 'GET' && path === '/me/player/recently-played') return res(200, { items: state.recent.slice(0, Number(url.searchParams.get('limit') ?? 20)) });
    if (method === 'GET' && path === '/me/player/devices') return res(200, { devices: state.devices });
    if (method === 'GET' && path === '/me/player') return state.player ? res(200, state.player) : res(204);
    if (method === 'PUT' && path === '/me/player/play') {
      state.player = { is_playing: true, shuffle_state: true, smart_shuffle: false, context: { uri: body?.context_uri ?? '' }, device: state.devices[0] };
      return res(204);
    }
    if (method === 'PUT' && path === '/me/player/shuffle') {
      if (state.player) state.player.shuffle_state = url.searchParams.get('state') === 'true';
      return res(204);
    }
    if (method === 'GET' && path === '/me/library/contains') {
      const uris = (url.searchParams.get('uris') ?? '').split(',').filter(Boolean);
      if (uris.length > 40) return fail(400, 'Too many ids');
      const liked = new Set(state.liked.map((e) => e.item.uri));
      return res(200, uris.map((u) => (u.startsWith('spotify:playlist:') ? state.lists.has(u.slice(17)) : liked.has(u))));
    }
    if (method === 'DELETE' && path === '/me/library') {
      for (const u of (url.searchParams.get('uris') ?? '').split(',')) {
        const id = u.replace('spotify:playlist:', '');
        if (state.lists.get(id)?.owner.id === state.me.id) state.lists.delete(id);
      }
      return res(200);
    }
    if (method === 'GET' && path === '/search') {
      const genre = /^genre:"(.+)"$/.exec(url.searchParams.get('q') ?? '')?.[1];
      const all = genre ? state.artists.filter((a) => a.genres.includes(genre)) : [];
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return res(200, { artists: { items: all.slice(offset, offset + 10), total: all.length } });
    }
    const artistAlbums = /^\/artists\/([^/]+)\/albums$/.exec(path);
    if (artistAlbums && method === 'GET') {
      const groups = (url.searchParams.get('include_groups') ?? 'album,single').split(',');
      const items = state.albums.filter((a) => a.artists[0].id === artistAlbums[1] && groups.includes(a.album_type))
        .sort((a, b) => b.release_date.localeCompare(a.release_date)).slice(0, 10);
      return res(200, { items, total: items.length, limit: 10, offset: 0 });
    }
    const albumTracks = /^\/albums\/([^/]+)\/tracks$/.exec(path);
    if (albumTracks && method === 'GET') return res(200, page((state.albumTracks[albumTracks[1]] ?? []).map(({ album, ...t }) => t), url));
    if (method === 'POST' && path === '/me/playlists') {
      const id = `demonew${++state.created}`;
      state.lists.set(id, { id, name: body?.name ?? '', description: body?.description ?? '', owner: state.me, collaborative: false, entries: [], images: [{ url: SHUFFL_COVER, width: 640, height: 640 }], version: 1 });
      return res(201, meta(state.lists.get(id)));
    }
    const img = /^\/playlists\/([^/]+)\/images$/.exec(path);
    if (img && method === 'PUT') return state.lists.has(img[1]) ? res(202) : fail(404, 'Not found');
    const one = /^\/playlists\/([^/]+)$/.exec(path);
    if (one) {
      const l = state.lists.get(one[1]);
      if (!l) return fail(404, 'Not found');
      if (method === 'GET') return res(200, meta(l));
      if (method === 'PUT') {
        if (l.owner.id !== state.me.id) return fail(403, 'Forbidden');
        if (typeof body?.name === 'string') l.name = body.name;
        if (typeof body?.description === 'string') l.description = body.description;
        l.version++;
        return res(200);
      }
    }
    const items = /^\/playlists\/([^/]+)\/items$/.exec(path);
    if (items) {
      const l = state.lists.get(items[1]);
      if (!l) return fail(404, 'Not found');
      if (method === 'GET') return readable(l) ? res(200, page(l.entries, url)) : fail(403, 'Forbidden');
      if (!readable(l)) return fail(403, 'Forbidden');
      const entries = (body?.uris ?? []).map(trackOf).filter(Boolean).map((item) => ({ added_at: stamp(), item }));
      if (method === 'PUT') l.entries = entries;
      else if (method === 'POST') l.entries.push(...entries);
      else return fail(405, 'Method not allowed');
      l.version++;
      return res(method === 'POST' ? 201 : 200, { snapshot_id: snap(l) });
    }
    return fail(404, 'Not found');
  };
}
