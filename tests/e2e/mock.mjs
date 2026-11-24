// Spotify simulado para los tests e2e: intercepta accounts.spotify.com y api.spotify.com.
export const CLIENT_ID = '0123456789abcdef0123456789abcdef';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function makeTrack(i, o = {}) {
  return {
    id: `t${String(i).padStart(21, '0')}`, uri: `spotify:track:t${String(i).padStart(21, '0')}`, type: 'track', name: o.name ?? `Canción ${String(i).padStart(3, '0')}`,
    artists: [{ name: o.artist ?? `Artista ${i % 7}` }], duration_ms: 120000 + i * 1000,
    disc_number: 1, track_number: (i % 12) + 1, external_ids: o.isrc ? { isrc: o.isrc } : {},
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
    ['pl_rock', { id: 'pl_rock', name: 'Rock', owner: owner('me'), tracks: rock }],
    ['pl_chill', { id: 'pl_chill', name: 'Chill', owner: owner('me'), tracks: chill }],
    ['pl_dupes', { id: 'pl_dupes', name: 'Con repetidas', owner: owner('me'), tracks: dupes }],
    ['pl_top', { id: 'pl_top', name: 'Top 50 Global', owner: owner('spotify'), tracks: range(2000, 2050) }],
  ]);
  const devices = [{ id: 'dev-phone', name: 'iPhone de prueba', type: 'Smartphone', is_active: true }];
  return { catalog, lists, liked, created: 0, writes: [], tokens: 0, authorizeParams: null, devices, playerCalls: [] };
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
  const metaOf = (l) => ({ id: l.id, name: l.name, owner: l.owner, collaborative: false, images: [], items: { total: l.tracks.length } });

  await page.route('https://api.spotify.com/v1/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const path = url.pathname.replace('/v1', '');
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;

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
      state.writes.push({ op: 'create', id, name: body.name, public: body.public });
      return json(route, { id, name: body.name }, 201);
    }
    const m = /^\/playlists\/([^/]+)\/items$/.exec(path);
    if (m) {
      const list = state.lists.get(m[1]);
      if (!list) return json(route, { error: { status: 404, message: 'Not found' } }, 404);
      if (method === 'GET') {
        if (list.owner.id !== 'me') return json(route, { error: { status: 403, message: 'Forbidden' } }, 403);
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
