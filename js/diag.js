// Diagnóstico (v1.3.2): contador de peticiones a Spotify y registro local de errores, sin tokens ni datos personales.
import { KEYS, getItem, setItem, removeItem } from './storage.js';

const MAX_ERRORS = 50;
const MAX_ACTIONS = 12;
const today = (now = new Date()) => now.toISOString().slice(0, 10);

const counter = { session: 0, action: null, actionStart: 0, actions: [] };

/** Ruta de la API sin consulta y sin ids (`/playlists/:id/items`), para el registro y el informe. */
export function redactPath(url) {
  const m = /^([A-Z]+) (.*)$/.exec(String(url ?? ''));
  let path = m ? m[2] : String(url ?? '');
  try { path = new URL(path, 'https://api.spotify.com').pathname; } catch { return ''; }
  const clean = path.replace(/^\/v1/, '').split('/').map((seg) => (/^[A-Za-z0-9]{12,}$/.test(seg) || /^\d+$/.test(seg) ? ':id' : seg)).join('/');
  return `${m ? `${m[1]} ` : ''}${clean}`.slice(0, 80);
}

/** Una petición más a la API (la llama SpotifyApi antes de cada fetch, reintentos incluidos). */
export function countRequest() {
  counter.session++;
  const d = getItem(KEYS.reqDay);
  const n = d?.date === today() && Number.isInteger(d.n) ? d.n + 1 : 1;
  setItem(KEYS.reqDay, { date: today(), n });
}

export const requestStats = () => {
  const d = getItem(KEYS.reqDay);
  return { session: counter.session, today: d?.date === today() && Number.isInteger(d.n) ? d.n : 0, actions: [...counter.actions] };
};

/** Marca el inicio de una acción («shuffle», «new»…) para saber cuántas peticiones gastó. */
export function beginAction(name) {
  counter.action = name;
  counter.actionStart = counter.session;
}

/** Peticiones desde `beginAction`. */
export const actionSpent = () => counter.session - counter.actionStart;

export function endAction() {
  if (!counter.action) return;
  counter.actions.unshift({ name: counter.action, n: actionSpent() });
  counter.actions.length = Math.min(counter.actions.length, MAX_ACTIONS);
  counter.action = null;
}

export const currentAction = () => counter.action;

/**
 * Guarda un error: qué acción, qué clase y, si es de Spotify, el código, el motivo y la ruta sin ids.
 * Nunca el texto que pueda llevar nombres de playlists, ni tokens.
 */
export function logError(e, kind, where = counter.action) {
  const entry = {
    at: new Date().toISOString(),
    where: String(where ?? '').slice(0, 30),
    kind: String(kind ?? e?.name ?? typeof e).slice(0, 40),
    status: Number.isInteger(e?.status) ? e.status : undefined,
    reason: typeof e?.reason === 'string' ? e.reason.slice(0, 40) : undefined,
    path: e?.path ? redactPath(e.path) : undefined,
    msg: e?.apiMessage ? String(e.apiMessage).replace(/[A-Za-z0-9]{16,}/g, ':id').slice(0, 100) : undefined,
  };
  const list = Array.isArray(getItem(KEYS.errors)) ? getItem(KEYS.errors) : [];
  setItem(KEYS.errors, [entry, ...list].slice(0, MAX_ERRORS));
  return entry;
}

export const getErrors = () => (Array.isArray(getItem(KEYS.errors)) ? getItem(KEYS.errors) : []);
export const clearErrors = () => removeItem(KEYS.errors);

/** Informe en texto plano para copiar y pegar. */
export function buildReport({ version, lang, standalone, steps = null }) {
  const s = requestStats();
  const lines = [
    `Shuffl ${version} · ${lang} · ${standalone ? 'app instalada' : 'navegador'}`,
    `UA: ${navigator.userAgent.slice(0, 160)}`,
    `Peticiones: sesión ${s.session} · hoy ${s.today}`,
    ...s.actions.map((a) => `  ${a.name}: ${a.n}`),
  ];
  if (steps) lines.push('', 'Prueba completa:', ...steps.map((r) => `  ${r.ok ? 'OK ' : 'MAL'} ${r.key}${r.detail ? ` · ${r.detail}` : ''}`));
  const errors = getErrors();
  lines.push('', `Errores (${errors.length}):`);
  for (const e of errors.slice(0, 20)) {
    lines.push(`  ${e.at} ${e.where || '-'} ${e.kind}${e.status !== undefined ? ` ${e.status}` : ''}${e.reason ? ` ${e.reason}` : ''}${e.path ? ` ${e.path}` : ''}${e.msg ? ` «${e.msg}»` : ''}`);
  }
  return lines.join('\n');
}
