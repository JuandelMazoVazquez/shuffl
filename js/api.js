import { chunk } from './core.js';

const BASE = 'https://api.spotify.com/v1';
const PAGE = 50;
const WRITE_CHUNK = 100;
const CONCURRENCY = 3;
const MAX_RETRY_AFTER_S = 30;

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.reason = body?.error?.reason ?? null;
  }
}

/**
 * Cliente mínimo de la Web API. `auth` aporta getAccessToken() y refresh();
 * `fetchImpl` y `sleep` son inyectables para los tests.
 */
export class SpotifyApi {
  constructor({ auth, fetchImpl = (...a) => globalThis.fetch(...a), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
    this.auth = auth;
    this.fetch = fetchImpl;
    this.sleep = sleep;
  }

  async request(method, path, body) {
    let refreshed = false;
    let rateRetries = 0;
    let serverRetries = 0;
    const url = path.startsWith('http') ? path : BASE + path;
    if (!url.startsWith(`${BASE}/`)) throw new ApiError(0, 'URL fuera de la API de Spotify');
    const retriable5xx = method === 'GET' || method === 'PUT';
    for (;;) {
      const token = await this.auth.getAccessToken();
      const res = await this.fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      }
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await this.auth.refresh();
        continue;
      }
      if (res.status === 429) {
        const detail = await res.clone().json().catch(() => null);
        if (detail?.error?.reason === 'QUOTA_EXCEEDED') throw new ApiError(429, detail.error.message || 'QUOTA_EXCEEDED', detail);
      }
      if (res.status === 429 && rateRetries < 5) {
        rateRetries++;
        const wait = Math.min(Number(res.headers.get('Retry-After')) || 1, MAX_RETRY_AFTER_S);
        await this.sleep(wait * 1000);
        continue;
      }
      if (res.status >= 500 && retriable5xx && serverRetries < 3) {
        await this.sleep(500 * 2 ** serverRetries);
        serverRetries++;
        continue;
      }
      let detail = null;
      try { detail = await res.json(); } catch { /* cuerpo no JSON */ }
      throw new ApiError(res.status, detail?.error?.message || `HTTP ${res.status}`, detail);
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

  /** Apaga el aleatorio de Spotify y reproduce la playlist desde la primera canción. */
  async playPlaylist(playlistId, deviceId) {
    const dev = deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : '';
    await this.request('PUT', `/me/player/shuffle?state=false${dev}`);
    await this.request('PUT', `/me/player/play${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, {
      context_uri: `spotify:playlist:${playlistId}`,
      offset: { position: 0 },
    });
  }

  createPlaylist(name, description = '') {
    return this.request('POST', '/me/playlists', { name, description, public: false });
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
