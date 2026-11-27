// Coherencia de marca (v1.4.1): un solo nombre, Shuffl, y una sola paleta, la de js/brand.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DARK, LIGHT, PALETTE, GLOW } from '../../js/brand.js';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const TEXT_EXT = /\.(js|mjs|json|webmanifest|html|css|svg|md|yml|yaml|txt)$/i;
// Los archivos del repo (los que no ignora git): así entran también los nuevos sin tocar este test.
const FILES = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean).filter((f) => !f.startsWith('node_modules/'));
const TEXT_FILES = FILES.filter((f) => TEXT_EXT.test(f) && f !== 'package-lock.json');

// Los nombres antiguos se escriben troceados para que este archivo no se encuentre a sí mismo.
const OLD_NAME = new RegExp(`\\b${'Bar'}aja\\b|\\b${'BAR'}AJA\\b`);
const OLD_KEY = new RegExp(`\\b${'bar'}aja\\.[A-Za-z]`);
const OLD_REPO = new RegExp(`${'new'}-spoti|\\b${'new'} spoti\\b`, 'i');

/** Historial y documentación de la marca: cuentan cómo se llamaba antes. */
const HISTORY = ['CHANGELOG.md', 'DECISIONES.md', 'docs/registro/', 'docs/bandeja.md', 'docs/BRAND.md', 'SIGUIENTES_PASOS.md'];
/** Migraciones necesarias: reconocer y quitar las playlists del nombre anterior, y pasar las claves a shuffl.*. */
const LEGACY_PLAYLISTS = ['js/targets.js', 'tests/unit/targets.test.js', 'tests/e2e/purge.spec.mjs', 'tests/e2e/tools.spec.mjs',
  // v1.5.0: clasificación por categorías de las playlists con el nombre antiguo.
  'tests/unit/v150.test.js', 'tests/e2e/v150.spec.mjs'];
const LEGACY_KEYS = ['js/storage.js', 'tests/e2e/rebrand.spec.mjs'];
/** La página que redirige desde la dirección antigua y su test. */
const OLD_ADDRESS = ['redirect/', 'tests/e2e/redirect.spec.mjs'];

const allowed = (file, list) => [...HISTORY, ...list].some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
const offenders = (re, list) => TEXT_FILES.filter((f) => !allowed(f, list)).flatMap((f) =>
  read(f).split('\n').flatMap((line, i) => (re.test(line) ? [`${f}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])));

test('no queda el nombre anterior de la app fuera del historial y de la migración de playlists', () => {
  assert.deepEqual(offenders(OLD_NAME, LEGACY_PLAYLISTS), []);
});

test('no quedan claves baraja.* fuera de la migración de almacenamiento', () => {
  assert.deepEqual(offenders(OLD_KEY, LEGACY_KEYS), []);
});

test('no queda el nombre antiguo del repo ni su dirección fuera de la redirección', () => {
  assert.deepEqual(offenders(OLD_REPO, OLD_ADDRESS), []);
  assert.deepEqual(FILES.filter((f) => OLD_REPO.test(f) || OLD_NAME.test(f) || new RegExp(`\\b${'bar'}aja\\b`).test(f)), [], 'nombres de archivos');
});

test('package.json y la app se llaman shuffl', async () => {
  assert.equal(JSON.parse(read('package.json')).name, 'shuffl');
  const { APP_NAME, REPO_URL } = await import('../../js/config.js');
  assert.equal(APP_NAME, 'Shuffl');
  assert.equal(REPO_URL, 'https://github.com/JuandelMazoVazquez/shuffl');
  assert.equal(JSON.parse(read('manifest.webmanifest')).name, 'Shuffl');
});

// ---------- Paleta ----------

const OLD_COLORS = ['#2E2A6B', '#FF5A4E', '#FFB627', '#FFF3E3'];
const kebab = (k) => k.replace(/([A-Z])/g, '-$1').replace(/(\d)/g, '-$1').toLowerCase();

/** Variables --nombre: #hex del bloque que empieza con `selector`. */
function cssVars(css, selector) {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2].toUpperCase()]));
}

test('css/styles.css usa exactamente los valores de js/brand.js en los dos temas', () => {
  const css = read('css/styles.css');
  for (const [selector, theme] of [[':root', DARK], [':root[data-theme="light"]', LIGHT], [':root[data-theme="auto"]', LIGHT]]) {
    const vars = cssVars(css, selector);
    for (const [k, v] of Object.entries(theme)) assert.equal(vars[kebab(k)], v, `${selector} --${kebab(k)}`);
  }
});

test('ningún color fuera de la paleta en la app, los iconos, los medios ni la redirección', () => {
  const allowedHex = new Set(PALETTE);
  const allowedRgb = new Set(PALETTE.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')));
  const scope = FILES.filter((f) => /^(css|js|scripts|redirect)\/.*\.(css|js|mjs|html)$/.test(f) || /^icons\/[^/]+\.svg$/.test(f)
    || ['index.html', 'manifest.webmanifest'].includes(f));
  const bad = [];
  for (const f of scope) {
    const src = read(f);
    for (const [hex] of src.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (!allowedHex.has(hex.toUpperCase())) bad.push(`${f}: ${hex}`);
    for (const m of src.matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/g)) if (!allowedRgb.has(`${m[1]},${m[2]},${m[3]}`)) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(allowedHex.has(GLOW));
});

test('los colores de la marca antigua no aparecen en ningún archivo fuera del historial', () => {
  const re = new RegExp(OLD_COLORS.map((c) => c.slice(1)).join('|'), 'i');
  assert.deepEqual(offenders(re, ['tests/unit/palette.test.js']), []);
});

test('manifest y theme-color con la paleta', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.theme_color.toUpperCase(), DARK.bg);
  assert.equal(manifest.background_color.toUpperCase(), DARK.bg);
  const html = read('index.html');
  assert.match(html, new RegExp(`theme-color" content="${DARK.bg}" media="\\(prefers-color-scheme: dark\\)"`, 'i'));
  assert.match(html, new RegExp(`theme-color" content="${LIGHT.bg}" media="\\(prefers-color-scheme: light\\)"`, 'i'));
});
