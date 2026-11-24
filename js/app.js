import {
  LIKED_ID, shuffle, uniqueByUri, capPlaylist, normalizeEntries, normalizePlaylist, sortTracks, SORT_KEYS,
  filterByAdded, findDuplicates, removeIndexes, buildBackup, toCsv, validateBackup, MAX_BACKUP_BYTES,
} from './core.js';
import { SpotifyApi, ApiError } from './api.js';
import * as auth from './auth.js';
import { KEYS, getItem, setItem, removeItem } from './storage.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { REPO_URL } from './config.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const BARAJA_NAME = '🔀 Baraja';
const root = document.getElementById('app');
const S = { api: null, me: null, playlists: [], busy: false, tab: 'shuffle', pickers: [] };
let pickerSeq = 0;

// ---------- DOM ----------

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

function icon(...paths) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

const ICONS = {
  shuffle: ['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  sort: ['m21 16-4 4-4-4', 'M17 20V4', 'm3 8 4-4 4 4', 'M7 4v16'],
  dups: ['M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  backup: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
};

const fmt = (n) => Number(n).toLocaleString(getLang());
const spotifyUrl = (id) => `https://open.spotify.com/playlist/${encodeURIComponent(id)}`;
const nowLabel = () => new Date().toLocaleString(getLang(), { dateStyle: 'short', timeStyle: 'short' });
const artistsOf = (tr) => tr.artists.join(', ');

class UserError extends Error {}

function errorMessage(e) {
  if (e instanceof UserError) return e.message;
  if (e instanceof auth.AuthError) return t(e.code === 'invalid_grant' ? 'errSession' : `authErr_${e.code}`);
  if (e instanceof ApiError) {
    if (e.status === 0) return t('errIncomplete');
    if (e.status === 403) return t('err403');
    if (e.status === 404) return t('err404');
    if (e.status === 429) return t('errRate');
    return `${t('errGeneric')} (${e.status}${e.message ? `: ${e.message}` : ''})`;
  }
  if (e instanceof TypeError) return t('errNetwork');
  return e?.message || t('errGeneric');
}

// ---------- Estado de tarea (progreso y errores) ----------

function createStatus() {
  const bar = h('progress', { hidden: true, max: '1', value: '0' });
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' });
  const err = h('p', { class: 'error', role: 'alert', hidden: true });
  return {
    el: h('div', { class: 'status' }, live, bar, err),
    say(msg) { live.textContent = msg; err.hidden = true; },
    progress(key, done, total) {
      live.textContent = t(key, { done: fmt(done), total: fmt(total) });
      bar.hidden = false;
      bar.max = Math.max(total, 1);
      bar.value = done;
    },
    clear() { live.textContent = ''; bar.hidden = true; err.hidden = true; },
    fail(e) {
      console.error(e);
      live.textContent = '';
      bar.hidden = true;
      err.textContent = errorMessage(e);
      err.hidden = false;
    },
  };
}

async function task(status, fn) {
  if (S.busy) return;
  S.busy = true;
  document.body.classList.add('busy');
  status.clear();
  try {
    await fn();
  } catch (e) {
    status.fail(e);
  } finally {
    S.busy = false;
    document.body.classList.remove('busy');
    status.el.querySelector('progress').hidden = true;
  }
}

// ---------- Datos ----------

const likedEntry = (prev) => ({
  id: LIKED_ID, name: t('liked'), total: prev?.total ?? null, image: '', owner: '', owned: false,
  collaborative: false, readable: true, isLiked: true, error: prev?.error ?? false,
});

async function loadPlaylists() {
  const raw = await S.api.getMyPlaylists();
  S.playlists = [likedEntry(S.playlists.find((p) => p.isLiked)), ...raw.filter(Boolean).map((p) => normalizePlaylist(p, S.me.id))];
  S.pickers.forEach((p) => p.update());
}

async function probeLiked() {
  const liked = S.playlists.find((p) => p.isLiked);
  try {
    liked.total = (await S.api.request('GET', '/me/tracks?limit=1')).total;
    liked.error = false;
  } catch (e) {
    console.warn('Tus me gusta no disponible', e.status);
    liked.error = true;
  }
  S.pickers.forEach((p) => p.update());
}

async function readSource(pl, onProgress) {
  const entries = pl.isLiked ? await S.api.getLikedTracks(onProgress) : await S.api.getPlaylistItems(pl.id, onProgress);
  return normalizeEntries(entries);
}

async function readSources(list, status) {
  const grand = list.reduce((n, p) => n + (p.total ?? 0), 0);
  const tracks = [];
  const skipped = { local: 0, empty: 0 };
  let base = 0;
  for (const pl of list) {
    const r = await readSource(pl, (d, tot) => status.progress('reading', base + d, Math.max(grand, base + tot)));
    tracks.push(...r.tracks);
    skipped.local += r.skipped.local;
    skipped.empty += r.skipped.empty;
    base += r.tracks.length + r.skipped.local + r.skipped.empty;
  }
  return { tracks, skipped };
}

const skippedCount = (s) => s.local + s.empty;

// ---------- Deshacer ----------

/** Con `soft` no pisa un Deshacer ya guardado (así no se pierde el estado original). */
function saveUndo(playlistId, name, uris, { soft = false } = {}) {
  const prev = getItem(KEYS.undo);
  if (soft && prev) return;
  if (prev?.pending && prev.playlistId === playlistId) throw new UserError(t('errPending'));
  const entry = { playlistId, name, uris, pending: true, date: new Date().toISOString() };
  if (!setItem(KEYS.undo, entry, { strict: true })) throw new UserError(t('errUndoStorage'));
}

/** Marca el Deshacer como seguro de aplicar: la escritura terminó y la playlist tiene `count` elementos. */
function finishUndo(playlistId, count) {
  const u = getItem(KEYS.undo);
  if (u?.playlistId === playlistId) setItem(KEYS.undo, { ...u, pending: false, after: count });
}

async function overwritePlaylist(id, uris, status) {
  await S.api.replaceItems(id, uris, (d, tot) => status.progress('saving', d, tot));
  finishUndo(id, uris.length);
}

/** Comprueba el total y la primera página (si se pasa `expected`) antes de escribir con datos leídos antes. */
async function assertUnchanged(playlistId, expectedTotal, expected) {
  const page = await S.api.request('GET', `/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track,episode`);
  if (page.total !== expectedTotal) throw new UserError(t('errChanged'));
  if (!expected || !Array.isArray(page.items)) return;
  const head = normalizeEntries(page.items).tracks;
  if (head.some((x, i) => x.uri !== expected[i]?.uri)) throw new UserError(t('errChanged'));
}

function confirmOverwrite(name, skipped) {
  const lost = skipped ? ` ${t('confirmLost', { n: fmt(skipped) })}` : '';
  return confirm(t('confirmOverwrite', { name }) + lost);
}

async function applyUndo(status, expectedId) {
  const u = getItem(KEYS.undo);
  if (!u) return false;
  if (expectedId && u.playlistId !== expectedId) throw new UserError(t('errUndoOther'));
  if (!u.pending && Number.isInteger(u.after)) await assertUnchanged(u.playlistId, u.after);
  if (!confirm(t('confirmUndo', { name: u.name || u.playlistId, date: new Date(u.date).toLocaleString(getLang()) }))) return false;
  await S.api.replaceItems(u.playlistId, u.uris, (d, tot) => status.progress('saving', d, tot));
  removeItem(KEYS.undo);
  await loadPlaylists();
  return true;
}

// ---------- Selector de playlists ----------

function createPicker({ multi, disabledReason, onChange }) {
  const group = `pick-${++pickerSeq}`;
  const selected = new Set();
  const list = h('ul', { class: 'picker' });
  const search = h('input', {
    type: 'search', class: 'search', placeholder: t('search'), 'aria-label': t('search'),
    oninput: () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll('li').forEach((li) => { li.hidden = q !== '' && !li.dataset.name.includes(q); });
    },
  });

  function row(pl) {
    const reason = disabledReason?.(pl);
    const input = h('input', { type: multi ? 'checkbox' : 'radio', name: group, value: pl.id, disabled: !!reason, onchange: () => {
      if (multi) { if (input.checked) selected.add(pl.id); else selected.delete(pl.id); } else { selected.clear(); selected.add(pl.id); }
      onChange?.(picker.getSelected());
    } });
    input.checked = selected.has(pl.id);
    const cover = pl.isLiked
      ? h('span', { class: 'cover liked', 'aria-hidden': 'true' }, '♥')
      : pl.image.startsWith('https://') ? h('img', { class: 'cover', src: pl.image, alt: '', loading: 'lazy' }) : h('span', { class: 'cover', 'aria-hidden': 'true' }, '♪');
    const meta = reason || (pl.total != null ? t('songs', { n: fmt(pl.total) }) : '');
    return h('li', { 'data-name': pl.name.toLowerCase(), class: reason ? 'disabled' : '' },
      h('label', { class: 'row' }, input, cover,
        h('span', { class: 'row-text' }, h('span', { class: 'row-name' }, pl.name), h('span', { class: 'row-meta' }, meta))));
  }

  const picker = {
    el: h('div', { class: 'picker-wrap' }, search, list),
    getSelected: () => S.playlists.filter((p) => selected.has(p.id)),
    update(silent = false) {
      for (const id of [...selected]) if (!S.playlists.some((p) => p.id === id && !disabledReason?.(p))) selected.delete(id);
      list.replaceChildren(...S.playlists.map(row));
      search.dispatchEvent(new Event('input'));
      if (!silent) onChange?.(picker.getSelected());
    },
  };
  S.pickers.push(picker);
  picker.update(true);
  return picker;
}

function baseReason(pl) {
  if (pl.isLiked) return pl.error ? t('likedUnavailable') : '';
  return pl.readable ? '' : t('notReadable');
}

// ---------- Resultado compartido ----------

function renderResult(container, status, o) {
  const undoBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => task(status, async () => {
    if (await applyUndo(status, o.playlistId)) { status.say(t('undone')); undoBtn.hidden = true; }
  }) }, t('undo'));
  const sync = () => { const u = getItem(KEYS.undo); undoBtn.hidden = !(u && u.playlistId === o.playlistId); };
  sync();
  container.replaceChildren(
    h('h2', { class: 'result-title' }, o.title),
    ...o.notes.map((n) => h('p', { class: 'note' }, n)),
    h('ol', { class: 'preview', 'aria-label': t('preview') }, o.tracks.slice(0, 20).map((tr) => h('li', {}, h('strong', {}, tr.name), ' ', h('span', { class: 'muted' }, artistsOf(tr))))),
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: spotifyUrl(o.playlistId), target: '_blank', rel: 'noopener' }, t('openInSpotify')),
      ...(o.extra ?? []),
      undoBtn,
      h('button', { class: 'btn', type: 'button', onclick: o.onBack }, t('back'))),
  );
  container.hidden = false;
  window.scrollTo(0, 0);
  return sync;
}

const skipNotes = (s) => (skippedCount(s) ? [t('skipped', { n: fmt(skippedCount(s)) })] : []);

// ---------- Barajar ----------

function shufflePanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const dedupe = h('input', { type: 'checkbox', id: 'sh-dedupe', checked: true });
  const radios = {};
  const mkRadio = (value, label, hint) => {
    const input = h('input', { type: 'radio', name: 'sh-dest', value });
    radios[value] = input;
    return h('label', { class: 'choice' }, input, h('span', {}, h('strong', {}, label), h('small', {}, hint)));
  };
  const destBox = h('div', { class: 'choices' },
    mkRadio('reuse', t('destReuse'), t('destReuseHint')), mkRadio('new', t('destNew'), t('destNewHint')), mkRadio('self', t('destSelf'), t('destSelfHint')));
  radios.reuse.checked = true;
  const go = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => run() }, t('shuffleBtn'));

  const picker = createPicker({
    multi: true,
    disabledReason: baseReason,
    onChange(sel) {
      go.disabled = sel.length === 0;
      const selfOk = sel.length === 1 && sel[0].owned && !sel[0].isLiked;
      radios.self.disabled = !selfOk;
      if (!selfOk && radios.self.checked) radios.reuse.checked = true;
    },
  });

  const form = h('div', {},
    h('p', { class: 'lead' }, t('shuffleLead')),
    h('h2', {}, t('source')), picker.el,
    h('label', { class: 'check' }, dedupe, h('span', {}, t('dedupeOpt'))),
    h('h2', {}, t('destination')), destBox, go);

  let last = null;

  const dest = () => Object.values(radios).find((r) => r.checked).value;

  async function resolveTarget(mode, sel, originalTracks) {
    if (mode === 'self') {
      saveUndo(sel[0].id, sel[0].name, originalTracks.map((x) => x.uri));
      return sel[0].id;
    }
    if (mode === 'reuse') {
      const storedId = getItem(KEYS.barajaId);
      const fresh = storedId ? (await S.api.getMyPlaylists()).find((p) => p?.id === storedId && p.owner?.id === S.me.id) : null;
      if (fresh) {
        const current = normalizeEntries(await S.api.getPlaylistItems(fresh.id)).tracks;
        saveUndo(fresh.id, fresh.name, current.map((x) => x.uri), { soft: true });
        return fresh.id;
      }
      const created = await S.api.createPlaylist(BARAJA_NAME, t('barajaDesc'));
      setItem(KEYS.barajaId, created.id);
      return created.id;
    }
    return (await S.api.createPlaylist(`Baraja · ${nowLabel()}`, t('barajaDesc'))).id;
  }

  function showResult(info) {
    form.hidden = true;
    last = info;
    const notes = [...skipNotes(info.skipped)];
    if (info.dedupRemoved) notes.push(t('dedupRemoved', { n: fmt(info.dedupRemoved) }));
    if (info.truncated) notes.push(t('truncated', { n: fmt(info.truncated) }));
    renderResult(result, status, {
      title: t('shuffledDone', { n: fmt(info.order.length) }),
      notes, tracks: info.order, playlistId: info.playlistId,
      extra: [h('button', { class: 'btn', type: 'button', onclick: () => reshuffle() }, t('reshuffle'))],
      onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
    });
  }

  function run() {
    task(status, async () => {
      const sel = picker.getSelected();
      const mode = dest();
      const { tracks, skipped } = await readSources(sel, status);
      if (mode === 'self' && !confirmOverwrite(sel[0].name, skippedCount(skipped))) { status.clear(); return; }
      const base = dedupe.checked ? uniqueByUri(tracks) : tracks;
      if (!base.length) throw new UserError(t('errEmpty'));
      const { tracks: order, truncated } = capPlaylist(shuffle(base));
      const playlistId = await resolveTarget(mode, sel, tracks);
      await overwritePlaylist(playlistId, order.map((x) => x.uri), status);
      await loadPlaylists();
      status.clear();
      showResult({ base, order, skipped, truncated, dedupRemoved: tracks.length - base.length, playlistId });
    });
  }

  function reshuffle() {
    task(status, async () => {
      const { tracks: order, truncated } = capPlaylist(shuffle(last.base));
      await assertUnchanged(last.playlistId, last.order.length, last.order);
      saveUndo(last.playlistId, '', last.order.map((x) => x.uri), { soft: true });
      await overwritePlaylist(last.playlistId, order.map((x) => x.uri), status);
      status.clear();
      showResult({ ...last, order, truncated });
    });
  }

  return h('section', { class: 'panel', id: 'panel-shuffle' }, form, result, status.el);
}

// ---------- Ordenar ----------

function sortPanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const sortSel = h('select', { id: 'sort-key', 'aria-label': t('sortBy') }, SORT_KEYS.map((k) => h('option', { value: k }, t(`sort_${k}`))));
  const from = h('input', { type: 'date', id: 'sort-from', 'aria-label': t('addedFrom') });
  const to = h('input', { type: 'date', id: 'sort-to', 'aria-label': t('addedTo') });
  const nameIn = h('input', { type: 'text', id: 'sort-name', class: 'text', maxlength: '100', 'aria-label': t('newName') });
  const rNew = h('input', { type: 'radio', name: 'sort-dest', value: 'new', checked: true });
  const rOver = h('input', { type: 'radio', name: 'sort-dest', value: 'over', disabled: true });
  const go = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => run() }, t('sortBtn'));
  let touched = false;

  const suggest = () => {
    if (touched) return;
    const sel = picker.getSelected()[0];
    nameIn.value = sel ? `${sel.name} (${t(`sort_${sortSel.value}`).toLowerCase()})` : '';
  };
  const refresh = () => {
    const sel = picker.getSelected();
    go.disabled = sel.length === 0;
    const overOk = sel.length === 1 && sel[0].owned && !sel[0].isLiked && !from.value && !to.value;
    rOver.disabled = !overOk;
    if (!overOk && rOver.checked) rNew.checked = true;
    suggest();
  };
  const picker = createPicker({ multi: false, disabledReason: baseReason, onChange: refresh });
  [from, to].forEach((el) => el.addEventListener('change', refresh));
  sortSel.addEventListener('change', suggest);
  nameIn.addEventListener('input', () => { touched = true; });

  const likedShortcut = h('button', { class: 'btn shortcut', type: 'button', onclick: () => copyLiked() }, t('copyLikedShortcut'));
  const form = h('div', {},
    h('p', { class: 'lead' }, t('sortLead')), likedShortcut,
    h('h2', {}, t('source')), picker.el,
    h('h2', {}, t('sortBy')), sortSel,
    h('details', { class: 'more' }, h('summary', {}, t('dateFilter')),
      h('div', { class: 'dates' }, h('label', {}, t('addedFrom'), from), h('label', {}, t('addedTo'), to))),
    h('h2', {}, t('destination')),
    h('div', { class: 'choices' },
      h('label', { class: 'choice' }, rNew, h('span', {}, h('strong', {}, t('destNew')), nameIn)),
      h('label', { class: 'choice' }, rOver, h('span', {}, h('strong', {}, t('destOverwrite')), h('small', {}, t('destOverwriteHint'))))),
    go);

  const finish = (title, tracks, playlistId, skipped) => {
    form.hidden = true;
    renderResult(result, status, {
      title, notes: skipNotes(skipped), tracks, playlistId,
      onBack: () => { result.hidden = true; form.hidden = false; status.clear(); },
    });
  };

  function run() {
    task(status, async () => {
      const sel = picker.getSelected()[0];
      const overwrite = rOver.checked;
      const { tracks, skipped } = await readSources([sel], status);
      if (overwrite && !confirmOverwrite(sel.name, skippedCount(skipped))) { status.clear(); return; }
      const sorted = sortTracks(filterByAdded(tracks, from.value, to.value), sortSel.value);
      if (!sorted.length) throw new UserError(t('errEmpty'));
      let playlistId;
      if (overwrite) {
        saveUndo(sel.id, sel.name, tracks.map((x) => x.uri));
        playlistId = sel.id;
        await overwritePlaylist(playlistId, sorted.map((x) => x.uri), status);
      } else {
        playlistId = (await S.api.createPlaylist(nameIn.value.trim() || sel.name, t('barajaDesc'))).id;
        await S.api.addItems(playlistId, sorted.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
      }
      await loadPlaylists();
      status.clear();
      finish(t('sortedDone', { n: fmt(sorted.length) }), sorted, playlistId, skipped);
    });
  }

  function copyLiked() {
    task(status, async () => {
      const liked = S.playlists.find((p) => p.isLiked);
      const { tracks, skipped } = await readSource(liked, (d, tot) => status.progress('reading', d, tot));
      if (!tracks.length) throw new UserError(t('errEmpty'));
      const id = (await S.api.createPlaylist(t('likedCopyName'), t('barajaDesc'))).id;
      await S.api.addItems(id, tracks.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
      await loadPlaylists();
      status.clear();
      finish(t('copiedDone', { n: fmt(tracks.length) }), tracks, id, skipped);
    });
  }

  return h('section', { class: 'panel', id: 'panel-sort', hidden: true }, form, result, status.el);
}

// ---------- Duplicados ----------

function dupsPanel() {
  const status = createStatus();
  const result = h('div', { class: 'result', hidden: true });
  const modeExact = h('input', { type: 'radio', name: 'dup-mode', value: 'exact' });
  const modeSmart = h('input', { type: 'radio', name: 'dup-mode', value: 'smart', checked: true });
  const analyze = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => scan() }, t('analyze'));
  const picker = createPicker({
    multi: false,
    disabledReason: (pl) => (pl.isLiked ? t('likedNoDup') : pl.readable ? '' : t('notReadable')),
    onChange: (sel) => { analyze.disabled = sel.length === 0; },
  });
  const form = h('div', {},
    h('p', { class: 'lead' }, t('dupsLead')),
    h('h2', {}, t('source')), picker.el,
    h('h2', {}, t('dupMode')),
    h('div', { class: 'choices' },
      h('label', { class: 'choice' }, modeExact, h('span', {}, h('strong', {}, t('modeExact')), h('small', {}, t('modeExactHint')))),
      h('label', { class: 'choice' }, modeSmart, h('span', {}, h('strong', {}, t('modeSmart')), h('small', {}, t('modeSmartHint'))))),
    analyze);

  const back = () => { result.hidden = true; form.hidden = false; status.clear(); };

  function scan() {
    task(status, async () => {
      const pl = picker.getSelected()[0];
      const { tracks, skipped } = await readSources([pl], status);
      const groups = findDuplicates(tracks, modeSmart.checked ? 'smart' : 'exact');
      status.clear();
      form.hidden = true;
      if (!groups.length) {
        result.replaceChildren(h('h2', { class: 'result-title' }, t('noDups')), ...skipNotes(skipped).map((n) => h('p', { class: 'note' }, n)),
          h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: back }, t('back'))));
        result.hidden = false;
        return;
      }
      showGroups(pl, tracks, groups, skipped);
    });
  }

  function showGroups(pl, tracks, groups, skipped) {
    const boxes = [];
    const count = h('p', { class: 'note', 'aria-live': 'polite' });
    const items = groups.map((g) => h('li', { class: 'dup-group' },
      h('p', { class: 'dup-head' }, h('strong', {}, g.keep.track.name), ' ', h('span', { class: 'muted' }, artistsOf(g.keep.track))),
      h('p', { class: 'dup-keep' }, t('keeps', { pos: g.keep.index + 1 })),
      g.dupes.map((d) => {
        const box = h('input', { type: 'checkbox', 'data-index': String(d.index) });
        box.checked = true;
        box.addEventListener('change', update);
        boxes.push(box);
        return h('label', { class: 'check' }, box, h('span', {}, t('dupAt', { pos: d.index + 1 }), d.track.name !== g.keep.track.name ? ` · ${d.track.name}` : ''));
      })));
    const chosen = () => boxes.filter((b) => b.checked).map((b) => Number(b.dataset.index));
    function update() {
      const n = chosen().length;
      count.textContent = t('dupSelected', { n: fmt(n), g: fmt(groups.length) });
      removeBtn.disabled = copyBtn.disabled = n === 0;
    }
    const removeBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => remove() }, t('removeFromOriginal'));
    const copyBtn = h('button', { class: 'btn', type: 'button', onclick: () => clean() }, t('makeCleanCopy'));

    const finishWith = (title, remaining, playlistId) => renderResult(result, status, {
      title, notes: skipNotes(skipped), tracks: remaining, playlistId, onBack: back,
    });

    function remove() {
      if (!confirmOverwrite(pl.name, skippedCount(skipped))) return;
      task(status, async () => {
        await assertUnchanged(pl.id, tracks.length + skippedCount(skipped), tracks);
        const remaining = removeIndexes(tracks, chosen());
        saveUndo(pl.id, pl.name, tracks.map((x) => x.uri));
        await overwritePlaylist(pl.id, remaining.map((x) => x.uri), status);
        await loadPlaylists();
        status.clear();
        finishWith(t('dupsRemoved', { n: fmt(tracks.length - remaining.length) }), remaining, pl.id);
      });
    }

    function clean() {
      task(status, async () => {
        const remaining = removeIndexes(tracks, chosen());
        const id = (await S.api.createPlaylist(`${pl.name} (${t('cleanSuffix')})`, t('barajaDesc'))).id;
        await S.api.addItems(id, remaining.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
        await loadPlaylists();
        status.clear();
        finishWith(t('cleanDone', { n: fmt(remaining.length) }), remaining, id);
      });
    }

    result.replaceChildren(
      h('h2', { class: 'result-title' }, t('dupsFound', { n: fmt(groups.length) })),
      h('ul', { class: 'dup-list' }, items), count,
      h('div', { class: 'actions' }, removeBtn, copyBtn, h('button', { class: 'btn', type: 'button', onclick: back }, t('back'))));
    result.hidden = false;
    update();
  }

  return h('section', { class: 'panel', id: 'panel-dups', hidden: true }, form, result, status.el);
}

// ---------- Copia de seguridad ----------

function download(blob, filename) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function saveFile(blob, filename, status) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.warn('share falló, se descarga', e.name);
    }
  }
  download(blob, filename);
  status.say(t('downloaded', { name: filename }));
}

function backupPanel() {
  const status = createStatus();
  const out = h('div', { class: 'result', hidden: true });
  const exportBtn = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => prepare() }, t('exportBtn'));
  const picker = createPicker({ multi: true, disabledReason: baseReason, onChange: (sel) => { exportBtn.disabled = sel.length === 0; } });
  const restoreBox = h('div', { class: 'restore', hidden: true });
  const fileIn = h('input', { type: 'file', id: 'restore-file', accept: '.json,application/json', 'aria-label': t('restoreChoose'), onchange: () => loadRestore() });

  function prepare() {
    task(status, async () => {
      const sel = picker.getSelected();
      const lists = [];
      let skippedTotal = 0;
      for (const pl of sel) {
        const { tracks, skipped } = await readSources([pl], status);
        skippedTotal += skippedCount(skipped);
        lists.push({ id: pl.id, name: pl.name, isLiked: pl.isLiked, tracks });
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const jsonBlob = new Blob([JSON.stringify(buildBackup(lists), null, 1)], { type: 'application/json' });
      const csvBlob = new Blob(['﻿', toCsv(lists)], { type: 'text/csv' });
      const total = lists.reduce((n, p) => n + p.tracks.length, 0);
      status.clear();
      out.replaceChildren(
        h('h2', { class: 'result-title' }, t('backupReady', { n: fmt(total), p: fmt(lists.length) })),
        skippedTotal ? h('p', { class: 'note' }, t('skipped', { n: fmt(skippedTotal) })) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', id: 'save-json', onclick: () => saveFile(jsonBlob, `baraja-${stamp}.json`, status) }, t('saveJson')),
          h('button', { class: 'btn', type: 'button', id: 'save-csv', onclick: () => saveFile(csvBlob, `baraja-${stamp}.csv`, status) }, t('saveCsv'))));
      out.hidden = false;
    });
  }

  async function loadRestore() {
    status.clear();
    restoreBox.hidden = true;
    const file = fileIn.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new UserError(t('errBackupSize'));
      const playlists = validateBackup(JSON.parse(await file.text()));
      showRestore(playlists);
    } catch (e) {
      status.fail(e instanceof UserError ? e : e instanceof SyntaxError ? new UserError(t('restoreBad_notBackup')) : new UserError(t(`restoreBad_${e.code ?? 'notBackup'}`)));
    }
  }

  function showRestore(playlists) {
    const boxes = playlists.map((p) => {
      const box = h('input', { type: 'checkbox' });
      box.checked = true;
      return { p, box };
    });
    const go = h('button', { class: 'btn primary', type: 'button', onclick: () => restore() }, t('restoreBtn'));
    const upd = () => { go.disabled = !boxes.some((b) => b.box.checked); };
    boxes.forEach((b) => b.box.addEventListener('change', upd));
    restoreBox.replaceChildren(
      h('ul', { class: 'restore-list' }, boxes.map(({ p, box }) => h('li', {}, h('label', { class: 'check' }, box, h('span', {}, `${p.name} · ${t('songs', { n: fmt(p.tracks.length) })}`))))),
      go);
    restoreBox.hidden = false;

    function restore() {
      task(status, async () => {
        let n = 0;
        for (const { p, box } of boxes) {
          if (!box.checked) continue;
          const id = (await S.api.createPlaylist(`${p.name} (${t('restoredSuffix')})`, t('barajaDesc'))).id;
          await S.api.addItems(id, p.tracks.map((x) => x.uri), (d, tot) => status.progress('saving', d, tot));
          n++;
          box.checked = false;
          box.disabled = true;
        }
        await loadPlaylists();
        status.clear();
        status.say(t('restoredDone', { n: fmt(n) }));
        restoreBox.hidden = true;
        fileIn.value = '';
      });
    }
  }

  return h('section', { class: 'panel', id: 'panel-backup', hidden: true },
    h('p', { class: 'lead' }, t('backupLead')),
    h('h2', {}, t('source')), picker.el, exportBtn, out,
    h('h2', {}, t('restoreTitle')), h('p', { class: 'muted' }, t('restoreLead')), fileIn, restoreBox,
    status.el);
}

// ---------- Ajustes ----------

function copyBox(value) {
  const input = h('input', { type: 'text', class: 'text mono', readonly: true, value, 'aria-label': t('redirectUri') });
  const btn = h('button', { class: 'btn', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(value); btn.textContent = t('copied'); } catch { input.select(); btn.textContent = t('selected'); }
    setTimeout(() => { btn.textContent = t('copy'); }, 1800);
  } }, t('copy'));
  return h('div', { class: 'copybox' }, input, btn);
}

function settingsPanel() {
  const status = createStatus();
  const idIn = h('input', { type: 'text', id: 'settings-client-id', class: 'text mono', value: auth.getClientId(), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('clientId') });
  const langSel = h('select', { id: 'lang-select', 'aria-label': t('language'), onchange: () => { setLang(langSel.value); mountApp(); } },
    LANGS.map(([code, label]) => { const o = h('option', { value: code }, label); if (code === getLang()) o.selected = true; return o; }));
  const undoInfo = h('p', { class: 'muted' });
  const undoBtn = h('button', { class: 'btn', type: 'button', onclick: () => task(status, async () => {
    if (await applyUndo(status)) status.say(t('undone'));
    syncUndo();
  }) }, t('undo'));
  function syncUndo() {
    const u = getItem(KEYS.undo);
    undoBtn.disabled = !u;
    undoInfo.textContent = u ? t('undoInfo', { name: u.name || u.playlistId, n: fmt(u.uris.length), date: new Date(u.date).toLocaleString(getLang()) }) : t('undoNone');
  }
  syncUndo();
  const panel = h('section', { class: 'panel', id: 'panel-settings', hidden: true },
    h('h2', {}, t('clientId')), idIn,
    h('button', { class: 'btn', type: 'button', onclick: () => { auth.setClientId(idIn.value); status.say(t('saved')); } }, t('save')),
    h('h2', {}, t('redirectUri')), copyBox(auth.redirectUri()),
    h('h2', {}, t('language')), langSel,
    h('h2', {}, t('undoTitle')), undoInfo, undoBtn,
    h('h2', {}, t('account')), h('p', { class: 'muted' }, S.me?.display_name || S.me?.id || ''),
    h('button', { class: 'btn danger', type: 'button', id: 'logout', onclick: () => { auth.logout(); renderSetup(); } }, t('logout')),
    h('h2', {}, t('privacyTitle')), h('p', { class: 'muted' }, t('privacy')),
    h('p', { class: 'muted' }, t('notAffiliated')),
    h('p', {}, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, t('repoLink'))),
    status.el);
  panel.refresh = syncUndo;
  return panel;
}

// ---------- Estructura de la app ----------

const TABS = [['shuffle', 'tabShuffle'], ['sort', 'tabSort'], ['dups', 'tabDups'], ['backup', 'tabBackup']];

function mountApp() {
  S.pickers = [];
  const panels = { shuffle: shufflePanel(), sort: sortPanel(), dups: dupsPanel(), backup: backupPanel(), settings: settingsPanel() };
  const tabBtns = {};
  const show = (key) => {
    S.tab = key;
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== key;
    for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-current', k === key ? 'page' : 'false');
    gear.setAttribute('aria-pressed', String(key === 'settings'));
    panels.settings.refresh();
    window.scrollTo(0, 0);
  };
  const gear = h('button', { class: 'icon-btn', type: 'button', id: 'open-settings', 'aria-label': t('settings'), onclick: () => show(S.tab === 'settings' ? 'shuffle' : 'settings') }, icon(...ICONS.settings));
  const nav = h('nav', { class: 'tabs', 'aria-label': t('sections') }, TABS.map(([key, label]) => {
    const b = h('button', { type: 'button', id: `tab-${key}`, onclick: () => show(key) }, icon(...ICONS[key]), h('span', {}, t(label)));
    tabBtns[key] = b;
    return b;
  }));
  root.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, h('img', { src: 'icons/icon.svg', alt: '', width: '28', height: '28' }), 'Baraja'), gear),
    h('main', {}, Object.values(panels)),
    nav);
  show(S.tab);
  S.playlists = S.playlists.length ? S.playlists : [likedEntry()];
  S.pickers.forEach((p) => p.update());
}

// ---------- Pantalla inicial ----------

function renderSetup(problem) {
  S.playlists = [];
  const idIn = h('input', { type: 'text', id: 'client-id', class: 'text mono', value: auth.getClientId(), placeholder: t('clientIdPlaceholder'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('clientId') });
  const err = h('p', { class: 'error', role: 'alert', hidden: !problem }, problem ? errorMessage(problem) : '');
  const connect = h('button', { class: 'btn primary big', type: 'button', id: 'connect', onclick: async () => {
    const id = idIn.value.trim();
    if (!/^[a-f0-9]{32}$/i.test(id)) { err.textContent = t('badClientId'); err.hidden = false; return; }
    auth.setClientId(id);
    try { await auth.startLogin(); } catch (e) { err.textContent = errorMessage(e); err.hidden = false; }
  } }, t('connect'));
  const langSel = h('select', { 'aria-label': t('language'), onchange: () => { setLang(langSel.value); renderSetup(problem); } },
    LANGS.map(([code, label]) => { const o = h('option', { value: code }, label); if (code === getLang()) o.selected = true; return o; }));
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
  root.replaceChildren(h('main', { class: 'setup' },
    h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '', width: '72', height: '72' }), h('h1', {}, 'Baraja')),
    h('p', { class: 'lead' }, t('welcome')),
    h('h2', {}, t('guideTitle')),
    h('ol', { class: 'steps' }, steps.map((s) => h('li', {}, t(s)))),
    h('p', { class: 'muted' }, t('redirectUri')), copyBox(auth.redirectUri()),
    h('p', { class: 'muted' }, t('premiumNote')),
    h('h2', {}, t('clientId')), idIn, err, connect,
    h('p', { class: 'muted small' }, t('notAffiliated')),
    langSel));
}

// ---------- Arranque ----------

async function boot() {
  setLang();
  let problem = null;
  try {
    await auth.handleCallback();
  } catch (e) {
    problem = e;
  }
  if (!auth.getClientId() || !auth.isLoggedIn()) return renderSetup(problem);
  S.api = new SpotifyApi({ auth });
  try {
    S.me = await S.api.getMe();
    mountApp();
    await loadPlaylists();
    await probeLiked();
  } catch (e) {
    console.error(e);
    if (e instanceof auth.AuthError) return renderSetup(e);
    root.replaceChildren(h('main', { class: 'setup' }, h('p', { class: 'error', role: 'alert' }, errorMessage(e)),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, t('retry'))));
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker no registrado', e.message));
}
boot();
