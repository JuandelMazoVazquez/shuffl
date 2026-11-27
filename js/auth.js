import { DEFAULT_CLIENT_ID } from './config.js';
import { KEYS, getItem, setItem, removeItem } from './storage.js';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SCOPE_LIST = [
  'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-private', 'playlist-modify-public', 'user-library-read',
  'user-read-playback-state', 'user-modify-playback-state',
  'ugc-image-upload', 'user-top-read', 'user-read-recently-played', 'user-follow-read',
  // DELETE /me/library (quitar las playlists antiguas de Shuffl) exige estos dos además de playlist-modify-public.
  'user-library-modify', 'user-follow-modify',
];
export const SCOPES = SCOPE_LIST.join(' ');

/** Scopes que la sesión guardada no tiene (sesiones de antes de añadir funciones). */
export function missingScopes(tokens) {
  const granted = new Set(String(tokens?.scope ?? '').split(/\s+/).filter(Boolean));
  return SCOPE_LIST.filter((s) => !granted.has(s));
}

export class AuthError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
}

/** Origen + ruta base: funciona en "/" y en "/shuffl/". */
export function redirectUri() {
  return new URL('./', location.href).href;
}

export const getClientId = () => getItem(KEYS.clientId) || DEFAULT_CLIENT_ID;
export const setClientId = (id) => setItem(KEYS.clientId, id.trim());
export const isLoggedIn = () => !!getItem(KEYS.tokens)?.refresh_token;
export const needsReconnect = () => isLoggedIn() && missingScopes(getItem(KEYS.tokens)).length > 0;

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const limit = 256 - (256 % chars.length);
  let out = '';
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(len))) {
      if (b < limit && out.length < len) out += chars[b % chars.length];
    }
  }
  return out;
}

export async function startLogin() {
  const clientId = getClientId();
  if (!clientId) throw new AuthError('noClientId');
  const verifier = randomString(96);
  const state = randomString(24);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  setItem(KEYS.pkce, { verifier, state });
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES,
  }).toString();
  location.assign(url.href);
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: getClientId(), ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // «Invalid redirect URI»: la del dashboard no es la de esta dirección (por ejemplo, tras la mudanza a /shuffl/).
    if (/redirect.?uri/i.test(String(data.error_description ?? ''))) throw new AuthError('redirectUri');
    throw new AuthError(data.error === 'invalid_grant' ? 'invalid_grant' : 'tokenFailed', data.error_description);
  }
  return data;
}

function storeTokens(data, previous) {
  setItem(KEYS.tokens, {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? previous?.refresh_token,
    scope: data.scope ?? previous?.scope,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
}

/**
 * Procesa ?code&state (o ?error) al volver de Spotify. Devuelve true si había callback.
 * Sin callback pero con un inicio de sesión a medias, Spotify no volvió aquí: lo más probable es que rechazara la
 * Redirect URI (su página de error no redirige). Se lanza `redirectStalled` para enseñar cómo añadirla.
 */
export async function handleCallback() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) {
    if (!getItem(KEYS.pkce)) return false;
    removeItem(KEYS.pkce);
    throw new AuthError('redirectStalled');
  }
  const saved = getItem(KEYS.pkce);
  removeItem(KEYS.pkce);
  history.replaceState(null, '', redirectUri());
  if (params.has('error')) throw new AuthError('denied', params.get('error'));
  if (!saved || params.get('state') !== saved.state) throw new AuthError('badState');
  const data = await tokenRequest({
    grant_type: 'authorization_code',
    code: params.get('code'),
    redirect_uri: redirectUri(),
    code_verifier: saved.verifier,
  });
  storeTokens(data);
  return true;
}

let refreshing = null;

export function refresh() {
  refreshing ??= (async () => {
    const tokens = getItem(KEYS.tokens);
    if (!tokens?.refresh_token) throw new AuthError('invalid_grant');
    try {
      storeTokens(await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }), tokens);
    } catch (e) {
      const current = getItem(KEYS.tokens)?.refresh_token;
      if (e.code === 'invalid_grant' && current && current !== tokens.refresh_token) return;
      if (e.code === 'invalid_grant' && current === tokens.refresh_token) logout();
      throw e;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function getAccessToken() {
  let tokens = getItem(KEYS.tokens);
  if (!tokens) throw new AuthError('invalid_grant');
  if (tokens.expires_at - 30000 < Date.now()) {
    await refresh();
    tokens = getItem(KEYS.tokens);
  }
  return tokens.access_token;
}

export function logout() {
  removeItem(KEYS.tokens);
  removeItem(KEYS.pkce);
  removeItem(KEYS.purgeOk);
  removeItem(KEYS.lastTarget);
}
