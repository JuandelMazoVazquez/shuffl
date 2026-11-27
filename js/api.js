import { chunk } from './core.js';

const BASE = 'https://api.spotify.com/v1';
const PAGE = 50;
const WRITE_CHUNK = 100;
const CONCURRENCY = 3;
const MAX_RETRY_AFTER_S = 30;
export const LIBRARY_CHUNK = 40;
export const SEARCH_LIMIT = 10;
const ARTIST_ALBUMS_LIMIT = 10;

export class ApiError extends Error {
  constructor(status, message, body, path = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.reason = body?.error?.reason ?? null;
    this.apiMessage = body?.error?.message ?? (status === 0 ? message : '');
    this.path = path;
  }
}

/** Esperas de 429 más largas que esto no se esperan: se avisa (en iOS la app se congela en segundo plano). */
const MAX_RATE_RETRIES = 2;
const MAX_SERVER_RETRIES = 2;

/**
 * Cliente mínimo de la Web API. `auth` aporta getAccessToken() y refresh();
 * `fetchImpl` y `sleep` son inyectables para los tests. `onRequest` se llama antes de cada petición (contador de cuota).
 */
export class SpotifyApi {
  constructor({ auth, fetchImpl = (...a) => globalThis.fetch(...a), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onRequest = () => {} }) {
    this.auth = auth;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.onRequest = onRequest;
  }

  /** `opts.rawBody` + `opts.contentType` envían el cuerpo tal cual (la portada va en base64, no en JSON); `opts.retry5xx` decide si se repite un 5xx. */
  async request(method, path, body, opts = {}) {
    let refreshed = false;
    let rateRetries = 0;
    let serverRetries = 0;
    const url = path.startsWith('http') ? path : BASE + path;
    if (!url.startsWith(`${BASE}/`)) throw new ApiError(0, 'URL fuera de la API de Spotify');
    const where = `${method} ${url.slice(BASE.length).split('?')[0]}`;
    // Las órdenes al reproductor no se repiten aquí: Reproducir ahora comprueba el resultado y reintenta una vez.
    const retriable5xx = opts.retry5xx ?? (method === 'GET' || method === 'PUT');
    for (;;) {
      const token = await this.auth.getAccessToken();
      this.onRequest();
      const res = await this.fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(opts.rawBody !== undefined ? { 'Content-Type': opts.contentType } : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
      });
      if (res.ok) {
        const text = await res.text();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          throw new ApiError(0, 'incomplete', null, where);
        }
      }
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await this.auth.refresh();
        continue;
      }
      let detail = null;
      try { detail = await res.clone().json(); } catch { /* cuerpo no JSON */ }
      // Cuota agotada: reintentar solo gasta más. Se avisa enseguida.
      if (res.status === 429 && detail?.error?.reason === 'QUOTA_EXCEEDED') throw new ApiError(429, 'QUOTA_EXCEEDED', detail, where);
      if (res.status === 429) {
        const after = Number(res.headers.get('Retry-After')) || 1;
        if (rateRetries < MAX_RATE_RETRIES && after <= MAX_RETRY_AFTER_S) {
          rateRetries++;
          await this.sleep(after * 1000);
          continue;
        }
      }
      if (res.status >= 500 && retriable5xx && serverRetries < MAX_SERVER_RETRIES) {
        await this.sleep(500 * 2 ** serverRetries);
        serverRetries++;
        continue;
      }
      throw new ApiError(res.status, detail?.error?.message || `HTTP ${res.status}`, detail, where);
    }
  }

  getMe() {
    return this.request('GET', '/me');
  }

  /** Lee todas las páginas de una colección. Primera página; el resto en paralelo si hay total, si no por `next`. */
  async paginate(firstPath, onProgress) {
    const sep = firstPath.includes('?') ? '&' : '?';
    const pageItems = (page) => {
      if (!Array.isArray(page?.items)) throw new ApiError(0, 'incomplete');
      return page.items;
    };
    const first = await this.request('GET', `${firstPath}${sep}limit=${PAGE}&offset=0`);
    const items = [...pageItems(first)];
    const total = first.total;
    onProgress?.(items.length, total ?? items.length);
    if (Number.isInteger(total)) {
      const offsets = [];
      for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
      const pages = new Array(offsets.length);
      let next = 0;
      let loaded = items.length;
      const worker = async () => {
        while (next < offsets.length) {
          const i = next++;
          const page = await this.request('GET', `${firstPath}${sep}limit=${PAGE}&offset=${offsets[i]}`);
          pages[i] = pageItems(page);
          loaded += pages[i].length;
          onProgress?.(Math.min(loaded, total), total);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, offsets.length) }, worker));
      const all = items.concat(...pages);
      if (all.length !== total) throw new ApiError(0, 'incomplete');
      return all;
    }
    let url = first.next;
    while (url) {
      const page = await this.request('GET', url);
      items.push(...pageItems(page));
      onProgress?.(items.length, items.length);
      url = page.next;
    }
    return items;
  }

  getMyPlaylists() {
    return this.paginate('/me/playlists');
  }

  getPlaylistItems(id, onProgress) {
    return this.paginate(`/playlists/${encodeURIComponent(id)}/items?additional_types=track,episode`, onProgress);
  }

  getLikedTracks(onProgress) {
    return this.paginate('/me/tracks', onProgress);
  }

  async getDevices() {
    const data = await this.request('GET', '/me/player/devices');
    return Array.isArray(data?.devices) ? data.devices : [];
  }

  /** Reproduce la playlist desde la primera canción en `deviceId` (lo activa si estaba en pausa). */
  play(playlistId, deviceId) {
    return this.request('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      context_uri: `spotify:playlist:${playlistId}`,
      offset: { position: 0 },
    }, { retry5xx: false });
  }

  setShuffle(on, deviceId) {
    return this.request('PUT', `/me/player/shuffle?state=${on ? 'true' : 'false'}&device_id=${encodeURIComponent(deviceId)}`, undefined, { retry5xx: false });
  }

  /** Estado del reproductor, o null si no suena nada (Spotify responde 204 sin cuerpo). */
  async getPlayer() {
    const data = await this.request('GET', '/me/player');
    return data && typeof data === 'object' ? data : null;
  }

  /** Total de Tus me gusta y la más reciente: si no cambian, la copia guardada sigue valiendo. */
  async getLikedHead() {
    const data = await this.request('GET', '/me/tracks?limit=1');
    if (!Number.isInteger(data?.total) || !Array.isArray(data.items)) throw new ApiError(0, 'incomplete', null, 'GET /me/tracks');
    const first = data.items[0];
    return { total: data.total, first: first ? `${first.added_at ?? ''}|${(first.item ?? first.track)?.uri ?? ''}` : '' };
  }

  getSavedAlbums(onProgress) {
    return this.paginate('/me/albums', onProgress);
  }

  /** Artistas seguidos: la paginación es por cursor (`after`), no por offset. */
  /** Con `maxPages` se para ahí (Descubrir solo necesita los primeros); sin él, todos (copia de seguridad). */
  async getFollowedArtists(maxPages = 200) {
    const out = [];
    let after = '';
    for (let page = 0; page < maxPages; page++) {
      const data = await this.request('GET', `/me/following?type=artist&limit=50${after ? `&after=${encodeURIComponent(after)}` : ''}`);
      const items = data?.artists?.items;
      if (!Array.isArray(items)) throw new ApiError(0, 'incomplete');
      out.push(...items);
      after = data.artists.cursors?.after ?? '';
      if (!after || items.length === 0) return out;
    }
    if (maxPages < 200) return out;
    throw new ApiError(0, 'incomplete');
  }

  /** `range`: short_term (4 semanas), medium_term (6 meses) o long_term (siempre). */
  async getTopTracks(range) {
    const data = await this.request('GET', `/me/top/tracks?limit=50&time_range=${encodeURIComponent(range)}`);
    return Array.isArray(data?.items) ? data.items : [];
  }

  /** Tus artistas más escuchados (v1.3). */
  async getTopArtists(range, limit = 50) {
    const data = await this.request('GET', `/me/top/artists?limit=${limit}&time_range=${encodeURIComponent(range)}`);
    return Array.isArray(data?.items) ? data.items : [];
  }

  /**
   * Últimos lanzamientos de un artista (álbumes y singles en una sola petición, v1.3.2). En Development Mode el máximo
   * es 10, así que un artista con muchos singles recientes puede dejar fuera algún álbum: es el precio de gastar la mitad.
   */
  async getArtistAlbums(id, groups = 'album,single') {
    const data = await this.request('GET', `/artists/${encodeURIComponent(id)}/albums?include_groups=${encodeURIComponent(groups)}&limit=${ARTIST_ALBUMS_LIMIT}`);
    return Array.isArray(data?.items) ? data.items.filter((a) => a && typeof a.id === 'string') : [];
  }

  getAlbumTracks(id) {
    return this.paginate(`/albums/${encodeURIComponent(id)}/tracks`);
  }

  /** Para cada URI, si está en tu biblioteca (Tus me gusta, álbumes, playlists seguidas…). Lotes de 40. */
  async libraryContains(uris) {
    const out = [];
    for (const part of chunk(uris, LIBRARY_CHUNK)) {
      const data = await this.request('GET', `/me/library/contains?uris=${part.map(encodeURIComponent).join(',')}`);
      if (!Array.isArray(data) || data.length !== part.length) throw new ApiError(0, 'incomplete');
      out.push(...data.map(Boolean));
    }
    return out;
  }

  /** Deja de seguir (quitar de tu biblioteca) playlists por id: DELETE /me/library con sus URI. Lotes de 40. */
  async unfollowPlaylists(ids) {
    if (!ids.every((id) => typeof id === 'string' && /^[A-Za-z0-9]{1,64}$/.test(id))) throw new ApiError(0, 'id de playlist no válido');
    for (const part of chunk(ids, LIBRARY_CHUNK)) {
      await this.request('DELETE', `/me/library?uris=${part.map((id) => encodeURIComponent(`spotify:playlist:${id}`)).join(',')}`);
    }
  }

  /** Artistas de un género (`q=genre:"…"`, type=artist). En Development Mode `limit` no pasa de 10; se pagina con offset. */
  async searchArtistsByGenre(genre, offset = 0) {
    const q = encodeURIComponent(`genre:"${String(genre).replace(/"/g, '')}"`);
    const data = await this.request('GET', `/search?type=artist&limit=${SEARCH_LIMIT}&offset=${Math.max(0, Math.min(offset, 990))}&q=${q}`);
    return Array.isArray(data?.artists?.items) ? data.artists.items : [];
  }

  async getRecentlyPlayed() {
    const data = await this.request('GET', '/me/player/recently-played?limit=50');
    return Array.isArray(data?.items) ? data.items : [];
  }

  /** Solo metadatos: Spotify no deja leer el contenido de playlists ajenas y Shuffl no lo intenta. */
  getPlaylistMeta(id) {
    return this.request('GET', `/playlists/${encodeURIComponent(id)}?fields=${encodeURIComponent('id,name,owner(id,display_name),images,collaborative')}`);
  }

  /** Lo justo para saber si una playlist sigue siendo de Shuffl (nombre, descripción, dueña). Una petición. */
  async getPlaylistInfo(id) {
    const data = await this.request('GET', `/playlists/${encodeURIComponent(id)}?fields=${encodeURIComponent('id,name,description,owner(id),collaborative,snapshot_id')}`);
    if (!data || typeof data.id !== 'string') throw new ApiError(0, 'incomplete', null, 'GET /playlists/:id');
    return data;
  }

  /** `base64` es un JPEG de hasta 256 KB, sin el prefijo data:. */
  setPlaylistImage(id, base64) {
    return this.request('PUT', `/playlists/${encodeURIComponent(id)}/images`, undefined, { rawBody: base64, contentType: 'image/jpeg' });
  }

  async createPlaylist(name, description = '') {
    const data = await this.request('POST', '/me/playlists', { name, description, public: false });
    if (typeof data?.id !== 'string' || !data.id) throw new ApiError(0, 'incomplete', null, 'POST /me/playlists');
    return data;
  }

  /** Sustituye el contenido: PUT con las primeras 100 y POST del resto en bloques de 100. */
  async replaceItems(id, uris, onProgress) {
    const path = `/playlists/${encodeURIComponent(id)}/items`;
    const [first = [], ...rest] = chunk(uris, WRITE_CHUNK);
    await this.request('PUT', path, { uris: first });
    let done = first.length;
    onProgress?.(done, uris.length);
    for (const part of rest) {
      await this.request('POST', path, { uris: part });
      done += part.length;
      onProgress?.(done, uris.length);
    }
  }

  async addItems(id, uris, onProgress) {
    const path = `/playlists/${encodeURIComponent(id)}/items`;
    let done = 0;
    for (const part of chunk(uris, WRITE_CHUNK)) {
      await this.request('POST', path, { uris: part });
      done += part.length;
      onProgress?.(done, uris.length);
    }
  }
}
