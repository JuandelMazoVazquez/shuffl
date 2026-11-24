// Spotify simulado para los tests e2e: intercepta accounts.spotify.com y api.spotify.com.
import { deflateSync } from 'node:zlib';

export const CLIENT_ID = '0123456789abcdef0123456789abcdef';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** PNG de 8x8 de un solo color. */
function solidPng(r, g, b) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: 8 }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: 8 }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function makeTrack(i, o = {}) {
  return {
    id: `t${String(i).padStart(21, '0')}`, uri: `spotify:track:t${String(i).padStart(21, '0')}`, type: 'track', name: o.name ?? `Canción ${String(i).padStart(3, '0')}`,
    artists: [{ name: o.artist ?? `Artista ${i % 7}` }], duration_ms: 120000 + i * 1000,
    explicit: o.explicit ?? i % 5 === 0, disc_number: 1, track_number: (i % 12) + 1, external_ids: o.isrc ? { isrc: o.isrc } : {},
    album: { id: `al${i % 9}`, name: `Álbum ${i % 9}`, release_date: o.release ?? `${1990 + (i % 30)}-0${1 + (i % 9)}-01`, release_date_precision: 'day', images: [] },
  };
}

const entry = (track, i) => ({ added_at: `2024-01-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`, item: track });

export function createState() {
  const catalog = new Map();
  const reg = (t) => { catalog.set(t.uri, t); return t; };
  const range = (from, to) => Array.from({ length: to - from }, (_, k) => reg(makeTrack(from + k)));

  const rock = range(0, 120);
  const chill = [...range(100, 180)];
  const dupes = [
    reg(makeTrack(500, { name: 'Hit', artist: 'Dúo', isrc: 'ES0000000001' })),
    reg(makeTrack(501, { name: 'Otra', artist: 'Solo' })),
    reg({ ...makeTrack(502, { name: 'Hit - Remastered 2015', artist: 'Dúo', isrc: 'ES0000000001' }) }),
    rock[0], rock[1],
    rock[0],
    reg({ ...makeTrack(503, { name: 'Otra (Radio Edit)', artist: 'Solo' }) }),
    reg({ ...makeTrack(504, { name: 'Otra - Live', artist: 'Solo' }) }),
  ];
  const liked = range(1000, 1060);

  const owner = (id) => ({ id, display_name: id });
  const lists = new Map([
    ['pl_rock', { id: 'pl_rock', name: 'Rock', owner: owner('me'), tracks: rock, cover: true }],
    ['pl_chill', { id: 'pl_chill', name: 'Chill', owner: owner('me'), tracks: chill }],
    ['pl_dupes', { id: 'pl_dupes', name: 'Con repetidas', owner: owner('me'), tracks: dupes }],
    ['pl_top', { id: 'pl_top', name: 'Top 50 Global', owner: owner('spotify'), tracks: range(2000, 2050) }],
  ]);
  const albums = Array.from({ length: 7 }, (_, i) => ({
    added_at: `2023-0${1 + (i % 9)}-15T10:00:00Z`,
    album: { id: `alb${i}`, uri: `spotify:album:alb${i}`, name: `Álbum guardado ${i}`, artists: [{ name: `Artista ${i % 3}` }], release_date: `${1990 + i}-01-01`, total_tracks: 10 + i, external_ids: { upc: `0000000000${i}` } },
  }));
  const artists = Array.from({ length: 120 }, (_, i) => ({ id: `art${i}`, uri: `spotify:artist:art${i}`, name: `Seguido ${i}`, type: 'artist' }));
  const top = { short_term: range(3000, 3030), medium_term: range(3100, 3150), long_term: range(3200, 3250) };
  const recent = [...range(3300, 3310), ...range(3300, 3305)];
  const devices = [{ id: 'dev-phone', name: 'iPhone de prueba', type: 'Smartphone', is_active: true }];
  return { catalog, lists, liked, created: 0, writes: [], tokens: 0, authorizeParams: null, devices, playerCalls: [], images: [], itemRequests: [], metaRequests: [], top, recent, topRequests: [], albums, artists };
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function mockSpotify(page, state) {
  await page.route('https://accounts.spotify.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    if (url.pathname === '/authorize') {
      state.authorizeParams = Object.fromEntries(url.searchParams);
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.searchParams.set('code', 'fake-code');
      back.searchParams.set('state', url.searchParams.get('state'));
      return route.fulfill({ status: 302, headers: { location: back.href } });
    }
    if (url.pathname === '/api/token') {
      state.tokens++;
      state.lastTokenBody = new URLSearchParams(req.postData());
      return json(route, {
        access_token: `access-${state.tokens}`, refresh_token: 'refresh-1', expires_in: 3600, token_type: 'Bearer',
        scope: state.grantedScope ?? state.authorizeParams?.scope ?? '',
      });
    }
    return route.fulfill({ status: 404 });
  });

  const page_ = (items, url) => {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return { total: items.length, limit, offset, items: items.slice(offset, offset + limit) };
  };
  const toEntries = (tracks) => tracks.map(entry);
  const metaOf = (l) => ({
    id: l.id, name: l.name, owner: l.owner, collaborative: !!l.collaborative, items: { total: l.tracks.length },
    images: l.cover ? [{ url: `https://i.scdn.co/image/${l.id}`, height: 64, width: 64 }] : [],
  });

  await page.route('https://i.scdn.co/**', (route) => route.fulfill({
    status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' }, body: solidPng(200, 40, 60),
  }));

  await page.route('https://api.spotify.com/v1/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const path = url.pathname.replace('/v1', '');
    const method = req.method();
    const isJson = (req.headers()['content-type'] ?? '').includes('json');
    const body = req.postData() && isJson ? JSON.parse(req.postData()) : null;

    if (method === 'GET' && path === '/me/albums') return json(route, page_(state.albums, url));
    if (method === 'GET' && path === '/me/following') {
      const after = url.searchParams.get('after');
      const start = after ? state.artists.findIndex((a) => a.id === after) + 1 : 0;
      const items = state.artists.slice(start, start + 50);
      const last = items.at(-1);
      const hasMore = start + 50 < state.artists.length;
      return json(route, { artists: { items, total: state.artists.length, cursors: { after: hasMore ? last.id : null } } });
    }
    if (method === 'GET' && path === '/me/top/tracks') {
      state.topRequests.push(Object.fromEntries(url.searchParams));
      return json(route, { items: state.top[url.searchParams.get('time_range')] ?? [] });
    }
    if (method === 'GET' && path === '/me/player/recently-played') {
      state.topRequests.push({ recent: true, limit: url.searchParams.get('limit') });
      return json(route, { items: state.recent.map((track, i) => ({ track, played_at: `2026-01-01T10:${String(i).padStart(2, '0')}:00Z` })) });
    }
    if (method === 'GET' && path === '/me/player/devices') return json(route, { devices: state.devices });
    if (method === 'PUT' && (path === '/me/player/shuffle' || path === '/me/player/play')) {
      state.playerCalls.push({ path, query: Object.fromEntries(url.searchParams), body });
      if (path === '/me/player/play' && state.playError) return json(route, state.playError.body, state.playError.status);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method === 'GET' && path === '/me') return json(route, { id: 'me', display_name: 'Usuaria Prueba' });
    if (method === 'GET' && path === '/me/playlists') return json(route, page_([...state.lists.values()].map(metaOf), url));
    if (method === 'GET' && path === '/me/tracks') return json(route, page_(toEntries(state.liked), url));
    if (method === 'POST' && path === '/me/playlists') {
      const id = `new${++state.created}`;
      state.lists.set(id, { id, name: body.name, owner: { id: 'me' }, tracks: [] });
      state.writes.push({ op: 'create', id, name: body.name, public: body.public, description: body.description });
      return json(route, { id, name: body.name }, 201);
    }
    const img = /^\/playlists\/([^/]+)\/images$/.exec(path);
    if (img && method === 'PUT') {
      if (state.failImage) return json(route, { error: { status: 403, message: 'Forbidden' } }, 403);
      state.images.push({ id: img[1], contentType: req.headers()['content-type'], body: req.postData() });
      return route.fulfill({ status: 202, headers: CORS });
    }
    const meta = /^\/playlists\/([^/]+)$/.exec(path);
    if (meta && method === 'GET') {
      const list = state.lists.get(meta[1]);
      if (!list) return json(route, { error: { status: 404, message: 'Not found' } }, 404);
      state.metaRequests.push(meta[1]);
      return json(route, { id: list.id, name: list.name, owner: list.owner, collaborative: !!list.collaborative, images: [] });
    }
    const m = /^\/playlists\/([^/]+)\/items$/.exec(path);
    if (m) {
      const list = state.lists.get(m[1]);
      if (!list) return json(route, { error: { status: 404, message: 'Not found' } }, 404);
      if (method === 'GET') {
        state.itemRequests.push(m[1]);
        if (list.owner.id !== 'me' && !list.collaborative) return json(route, { error: { status: 403, message: 'Forbidden' } }, 403);
        return json(route, page_(toEntries(list.tracks), url));
      }
      const tracksOf = (uris) => uris.map((u) => state.catalog.get(u) ?? { id: u.split(':').pop(), uri: u, type: 'track', name: u, artists: [], album: {} });
      if (method === 'PUT') { list.tracks = tracksOf(body.uris); state.writes.push({ op: 'put', id: m[1], n: body.uris.length }); return json(route, { snapshot_id: 's' }); }
      if (method === 'POST' && state.failNextPost) { state.failNextPost = false; return json(route, { error: { status: 500, message: 'boom' } }, 500); }
      if (method === 'POST') { list.tracks.push(...tracksOf(body.uris)); state.writes.push({ op: 'post', id: m[1], n: body.uris.length }); return json(route, { snapshot_id: 's' }, 201); }
    }
    return json(route, { error: { status: 404, message: `No simulado: ${method} ${path}` } }, 404);
  });
}
