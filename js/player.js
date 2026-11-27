// Reproducir ahora (v1.3.2): lógica pura para elegir dispositivo, entender los errores del reproductor
// y comprobar que de verdad suena la playlist correcta con el aleatorio apagado.

/** Dispositivos que se pueden controlar (Spotify marca `is_restricted` los que no aceptan órdenes de la API). */
export const usableDevices = (devices) => (Array.isArray(devices) ? devices : [])
  .filter((d) => d && typeof d.id === 'string' && d.id && !d.is_restricted);

/**
 * { device } si está claro a cuál mandar la orden (el activo, o el único), { choose: lista } si hay que preguntar,
 * o { problem: 'none' | 'restricted' } si no hay ninguno utilizable.
 */
export function pickDevice(devices) {
  const all = Array.isArray(devices) ? devices.filter(Boolean) : [];
  const usable = usableDevices(all);
  if (!usable.length) return { problem: all.length ? 'restricted' : 'none' };
  const active = usable.find((d) => d.is_active);
  if (active) return { device: active };
  if (usable.length === 1) return { device: usable[0] };
  return { choose: usable };
}

/** Qué ha pasado al dar la orden de reproducir, según el error de Spotify. */
export function playProblem(e) {
  const status = e?.status;
  const reason = String(e?.reason ?? '');
  const msg = String(e?.apiMessage ?? e?.message ?? '').toLowerCase();
  if (reason === 'PREMIUM_REQUIRED' || msg.includes('premium')) return 'premium';
  if (reason === 'NO_ACTIVE_DEVICE' || status === 404) return 'device';
  if (status === 403 && (msg.includes('restrict') || reason === 'UNKNOWN')) return 'restricted';
  if (status === 403) return 'forbidden';
  if (status === 502 || status === 503 || status === 504) return 'asleep';
  return null;
}

/**
 * Comprueba el estado del reproductor tras la orden:
 * 'ok' (suena esta playlist con el aleatorio apagado), 'shuffle' (suena, pero con el aleatorio o el aleatorio
 * inteligente encendido), 'paused' (está puesta pero en pausa), 'other' (suena otra cosa), 'idle' (no suena nada).
 */
export function checkPlayback(state, playlistId) {
  if (!state || typeof state !== 'object') return 'idle';
  const uri = state.context?.uri ?? '';
  const ours = uri === `spotify:playlist:${playlistId}` || uri.endsWith(`:playlist:${playlistId}`);
  if (!ours) return state.is_playing ? 'other' : 'idle';
  if (state.shuffle_state || state.smart_shuffle) return 'shuffle';
  if (state.is_playing === false) return 'paused';
  return 'ok';
}
