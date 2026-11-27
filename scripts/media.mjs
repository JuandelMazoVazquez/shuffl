// `npm run media`: capturas, GIFs, vídeo vertical, social preview y cabecera del README, todo con el modo demo
// (datos inventados: ningún dato personal ni contenido real de Spotify). Salida en docs/media/.
// Los GIF y el MP4 necesitan ffmpeg en el PATH (o su ruta en la variable FFMPEG); sin él se generan solo las imágenes.
// Partes sueltas: `npm run media -- screens gifs video images`.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createAppServer } from './serve.mjs';

const OUT = resolve('docs/media');
const TMP = resolve('test-results/media-tmp');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VIEW = { width: 390, height: 844 };
const LANGS = ['es', 'en'];
const THEMES = ['dark', 'light'];
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const parts = process.argv.slice(2);
const want = (k) => !parts.length || parts.includes(k);

const TEXT = {
  es: {
    playlist: 'Domingo lento',
    slogan: 'El shuffle de Spotify, por fin aleatorio de verdad',
    sub: 'Baraja tus playlists con un Fisher-Yates uniforme. Gratis, libre y sin servidor.',
    cta: 'Pruébala sin cuenta',
  },
  en: {
    playlist: 'Slow Sunday',
    slogan: 'Spotify shuffle, finally truly random',
    sub: 'Shuffle your playlists with a uniform Fisher-Yates. Free, open source, no server.',
    cta: 'Try it without an account',
  },
};
const SITE = 'juandelmazovazquez.github.io/new-spoti';

function hasFfmpeg() {
  try {
    execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const ffmpeg = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const mb = (file) => (statSync(file).size / 1024 / 1024).toFixed(2);

// ---------- Navegador ----------

/**
 * Playwright graba vídeo en píxeles CSS, no del dispositivo. Para un vídeo nítido (`video: 2`) el viewport es el doble
 * y la página va con `zoom: 2`: la app sigue viendo 390 px de ancho, pero cada fotograma tiene 780.
 */
async function newPage(browser, base, { lang, theme = 'dark', video = 0, delay = 70 }) {
  const zoom = video || 1;
  const context = await browser.newContext({
    viewport: { width: VIEW.width * zoom, height: VIEW.height * zoom }, deviceScaleFactor: video ? 1 : 2, isMobile: true, hasTouch: true, colorScheme: theme,
    locale: lang === 'es' ? 'es-ES' : 'en-US', serviceWorkers: 'block',
    ...(video ? { recordVideo: { dir: TMP, size: { width: VIEW.width * zoom, height: VIEW.height * zoom } } } : {}),
  });
  if (zoom > 1) await context.addInitScript((z) => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = String(z); }), zoom);
  await context.addInitScript(({ l, th, d, touches }) => {
    localStorage.setItem('baraja.lang', JSON.stringify(l));
    localStorage.setItem('baraja.theme', JSON.stringify(th));
    globalThis.__shufflDemoDelay = d;
    if (!touches) return;
    // En los vídeos, cada toque deja un círculo lima que se desvanece.
    addEventListener('pointerdown', (e) => {
      const dot = document.createElement('div');
      const z = Number(document.documentElement.style.zoom) || 1;
      dot.style.cssText = `position:fixed;left:${e.clientX / z - 22}px;top:${e.clientY / z - 22}px;width:44px;height:44px;border-radius:50%;`
        + 'background:rgba(198,255,61,.45);border:2px solid #c6ff3d;pointer-events:none;z-index:99999;transition:transform .5s ease,opacity .5s ease';
      document.documentElement.append(dot);
      requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.transform = 'scale(1.7)'; dot.style.opacity = '0'; }));
      setTimeout(() => dot.remove(), 700);
    }, true);
  }, { l: lang, th: theme, d: delay, touches: video });
  const page = await context.newPage();
  return { context, page };
}

const idle = (page) => page.waitForFunction(() => !document.body.classList.contains('busy'));
const ready = async (page) => {
  await page.locator('#demo-bar').waitFor();
  await idle(page);
};
const pickPlaylist = (page, panel, name) => page.locator(`#panel-${panel} label.row`)
  .filter({ has: page.locator('.row-name', { hasText: new RegExp(`^${name}$`) }) }).click();
async function openPanel(page, tab, key) {
  await page.locator(`#tab-${tab}`).click();
  await page.locator(`#card-${key}`).click();
  await page.locator(`#panel-${key}`).waitFor();
}
/** Espera a que terminen las animaciones finitas (en headless el fundido de entrada solo avanza mientras se pintan frames). */
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations()
  .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
  .map((a) => a.finished.catch(() => {}))));
const setDelay = (page, ms) => page.evaluate((d) => { globalThis.__shufflDemoDelay = d; }, ms);
const smoothScroll = (page, y) => page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);

// ---------- Capturas ----------

async function screens(browser, base, lang, theme) {
  const dir = join(OUT, 'screens', `${lang}-${theme}`);
  mkdirSync(dir, { recursive: true });
  const { context, page } = await newPage(browser, base, { lang, theme });
  const shot = async (name, wait = 900) => {
    await page.waitForTimeout(wait);
    await settle(page);
    await page.screenshot({ path: join(dir, `${name}.png`) });
  };
  const fresh = async () => {
    await page.goto(`${base}/?demo=1`);
    await ready(page);
  };

  await fresh();
  await shot('01-home');

  await page.locator('#tab-shuffle').click();
  await pickPlaylist(page, 'shuffle', TEXT[lang].playlist);
  await shot('02-pick');

  // Barajando: más latencia para pillar la animación a medias.
  await setDelay(page, 500);
  await page.locator('#shuffle-go').click();
  await shot('03-shuffling', 900);
  await setDelay(page, 70);
  await page.locator('#panel-shuffle #result-meta').waitFor();
  await idle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('04-result', 1400);

  await fresh();
  await page.locator('#tab-shuffle').click();
  await pickPlaylist(page, 'shuffle', TEXT[lang].playlist);
  await page.locator('label[for="sh-kind-time"]').click();
  await page.locator('#sh-preset-gym').click();
  await page.locator('#sh-preset-gym').scrollIntoViewIfNeeded();
  await shot('05-time');

  await openPanel(page, 'discover', 'new');
  await page.locator('#new-go').click();
  await page.locator('#panel-new #result-meta').waitFor();
  await idle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('06-new', 1400);

  await openPanel(page, 'discover', 'summary');
  await page.locator('#summary-go').click();
  await page.locator('#summary-out').waitFor();
  await idle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('07-summary', 1200);

  await openPanel(page, 'more', 'proof');
  await page.locator('#proof-fair .bar').first().waitFor();
  await shot('08-proof', 1200);
  await context.close();
}

// ---------- Vídeos ----------

/** Graba `scenario` y devuelve el webm y el segundo en el que la app ya estaba lista (para recortar la carga). */
async function record(browser, base, lang, scenario, zoom = 1, delay = 220) {
  const { context, page } = await newPage(browser, base, { lang, video: zoom, delay });
  const t0 = Date.now();
  await page.goto(`${base}/?demo=1`);
  await ready(page);
  const start = (Date.now() - t0) / 1000;
  await scenario(page, lang);
  await context.close();
  return { file: await page.video().path(), start };
}

const SCENARIOS = {
  async shuffle(page, lang) {
    await page.waitForTimeout(700);
    await page.locator('#tab-shuffle').click();
    await page.waitForTimeout(700);
    await pickPlaylist(page, 'shuffle', TEXT[lang].playlist);
    await page.waitForTimeout(800);
    await page.locator('#shuffle-go').click();
    await page.locator('#panel-shuffle #result-meta').waitFor();
    await idle(page);
    await page.waitForTimeout(1600);
    await page.locator('#panel-shuffle #play-now').click();
    await page.locator('#play-msg').waitFor();
    await idle(page);
    await page.waitForTimeout(1800);
  },
  async time(page, lang) {
    await page.waitForTimeout(600);
    await page.locator('#tab-shuffle').click();
    await page.waitForTimeout(600);
    await pickPlaylist(page, 'shuffle', TEXT[lang].playlist);
    await page.waitForTimeout(600);
    await page.locator('label[for="sh-kind-time"]').click();
    await page.waitForTimeout(900);
    await page.locator('#sh-preset-gym').click();
    await page.waitForTimeout(1000);
    await page.locator('#shuffle-go').click();
    await page.locator('#panel-shuffle #result-meta').waitFor();
    await idle(page);
    await page.waitForTimeout(2200);
  },
  async proof(page) {
    await page.waitForTimeout(600);
    await page.locator('#tab-more').click();
    await page.waitForTimeout(700);
    await page.locator('#card-proof').click();
    await page.locator('#proof-fair .bar').first().waitFor();
    await page.waitForTimeout(2200);
    await page.locator('#proof-again').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.locator('#proof-again').click();
    await page.waitForTimeout(2200);
  },
  async tour(page, lang) {
    await page.waitForTimeout(700);
    await page.locator('#tab-shuffle').click();
    await page.waitForTimeout(500);
    await pickPlaylist(page, 'shuffle', TEXT[lang].playlist);
    await page.waitForTimeout(500);
    await page.locator('#shuffle-go').click();
    await page.locator('#panel-shuffle #result-meta').waitFor();
    await idle(page);
    await page.waitForTimeout(1100);
    await page.locator('#panel-shuffle #play-now').click();
    await page.locator('#play-msg').waitFor();
    await idle(page);
    await page.waitForTimeout(1100);
    await page.locator('#tab-discover').click();
    await page.waitForTimeout(400);
    await page.locator('#card-new').click();
    await page.waitForTimeout(400);
    await page.locator('#new-go').click();
    await page.locator('#panel-new #result-meta').waitFor();
    await idle(page);
    await smoothScroll(page, 0);
    await page.waitForTimeout(1300);
    await page.locator('#tab-more').click();
    await page.waitForTimeout(400);
    await page.locator('#card-proof').click();
    await page.locator('#proof-fair .bar').first().waitFor();
    await page.waitForTimeout(2300);
  },
};

function toGif(src, start, out) {
  for (const [fps, width] of [[12, 360], [10, 320], [8, 300]]) {
    ffmpeg(['-ss', String(start), '-i', src, '-vf',
      `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      out]);
    if (statSync(out).size <= MAX_GIF_BYTES) return;
  }
  throw new Error(`${out} pasa de 5 MB`);
}

// ---------- Imágenes compuestas (HTML renderizado) ----------

const PHONE_CSS = `
  .phone { position: relative; aspect-ratio: 390 / 844; border-radius: 46px; background: #000; padding: 11px;
    box-shadow: 0 0 0 2px #2e2e2e, 0 30px 80px rgba(0,0,0,.55); }
  .phone img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 36px; }`;
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { background: #0b0b0b; color: #f5f5f5; font-family: system-ui, "Segoe UI", sans-serif; overflow: hidden; }
  .name { font: 900 96px/1 "Arial Black", "Helvetica Neue", sans-serif; letter-spacing: -.03em; display: flex; align-items: center; gap: 22px; }
  .name img { width: 92px; height: 92px; border-radius: 18%; }
  .slogan { font: 900 44px/1.08 "Arial Black", "Helvetica Neue", sans-serif; letter-spacing: -.02em; }
  .slogan b { color: #c6ff3d; }
  .sub { color: #a3a3a3; font-size: 24px; line-height: 1.35; }
  .pill { display: inline-block; background: #c6ff3d; color: #0b0b0b; font: 800 22px/1 ui-monospace, Consolas, monospace; padding: 12px 18px; border-radius: 999px; }
  .url { font: 700 22px/1 ui-monospace, Consolas, monospace; color: #a3a3a3; }
  ${PHONE_CSS}`;

/** «…por fin aleatorio de verdad»: el final del eslogan en lima. */
function sloganHtml(lang) {
  const s = TEXT[lang].slogan;
  const cut = lang === 'es' ? s.indexOf('por fin') : s.indexOf('finally');
  return `${s.slice(0, cut)}<b>${s.slice(cut)}</b>`;
}

async function render(browser, base, { width, height, html, out, transparent = false, scale = 1 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><base href="${base}/"><style>${BASE_CSS}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: out, omitBackground: transparent });
  await context.close();
}

const shotUrl = (lang, theme, name) => `docs/media/screens/${lang}-${theme}/${name}.png`;

async function images(browser, base, lang) {
  // Social preview de GitHub: 1280x640.
  await render(browser, base, {
    width: 1280, height: 640, out: join(OUT, `social-preview-${lang}.png`),
    html: `<div style="display:flex;height:640px;padding:0 70px;align-items:center;gap:50px;background:radial-gradient(circle at 80% 20%, #1d2a06 0, #0b0b0b 60%)">
      <div style="flex:1;display:grid;gap:26px">
        <div class="name"><img src="icons/icon.svg" alt="">Shuffl</div>
        <div class="slogan">${sloganHtml(lang)}</div>
        <div class="sub">${TEXT[lang].sub}</div>
        <div class="url">${SITE}</div>
      </div>
      <div style="width:300px;height:650px;margin-top:180px;transform:rotate(4deg)"><div class="phone" style="width:300px"><img src="${shotUrl(lang, 'dark', '04-result')}" alt=""></div></div>
    </div>`,
  });
  // Cabecera del README: nombre y eslogan a la izquierda, tres móviles a la derecha.
  await render(browser, base, {
    width: 1280, height: 560, scale: 2, out: join(OUT, `header-${lang}.png`),
    html: `<div style="position:relative;height:560px;padding:0 64px;display:flex;align-items:center;background:radial-gradient(circle at 75% 30%, #1d2a06 0, #0b0b0b 62%)">
      <div style="width:600px;position:relative;z-index:2">
        <div class="name" style="font-size:84px"><img src="icons/icon.svg" alt="" style="width:80px;height:80px">Shuffl</div>
        <div class="slogan" style="font-size:38px;width:600px;margin:26px 0 30px">${sloganHtml(lang)}</div>
        <div><span class="pill">▶ ${TEXT[lang].cta}</span></div>
      </div>
      <div style="position:absolute;right:50px;top:50px;display:flex;gap:30px;align-items:flex-start">
        <div class="phone" style="width:240px;transform:rotate(-4deg)"><img src="${shotUrl(lang, 'dark', '04-result')}" alt=""></div>
        <div class="phone" style="width:240px;margin-top:60px;transform:rotate(4deg)"><img src="${shotUrl(lang, 'light', '08-proof')}" alt=""></div>
      </div>
    </div>`,
  });
}

/** Fondo y marco del vídeo vertical (1080x1920): el móvil va en (193, 290) con 693x1500. */
const SCREEN = { x: 193, y: 290, w: 693, h: 1500 };
async function videoFrames(browser, base, lang) {
  const bg = join(TMP, `bg-${lang}.png`);
  const frame = join(TMP, 'frame.png');
  await render(browser, base, {
    width: 1080, height: 1920, out: bg,
    html: `<div style="height:1920px;background:radial-gradient(circle at 50% 35%, #1d2a06 0, #0b0b0b 65%);display:grid;justify-items:center;align-content:start;padding-top:60px;gap:22px;text-align:center">
      <div class="name" style="font-size:80px"><img src="icons/icon.svg" alt="" style="width:76px;height:76px">Shuffl</div>
      <div class="slogan" style="font-size:40px;max-width:900px">${sloganHtml(lang)}</div>
      <div class="url" style="position:absolute;bottom:52px;left:0;right:0;font-size:30px;color:#c6ff3d">${SITE}</div>
    </div>`,
  });
  await render(browser, base, {
    width: 1080, height: 1920, out: frame, transparent: true,
    html: `<style>body{background:transparent}</style><div style="position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:60px;box-shadow:0 0 0 22px #000, 0 0 0 25px #2e2e2e"></div>`,
  });
  return { bg, frame };
}

function toMp4({ bg, frame }, src, start, out) {
  ffmpeg(['-loop', '1', '-framerate', '30', '-i', bg, '-ss', String(start), '-i', src, '-loop', '1', '-framerate', '30', '-i', frame,
    '-filter_complex', `[1:v]fps=30,scale=${SCREEN.w}:${SCREEN.h}:flags=lanczos[v];[0:v][v]overlay=${SCREEN.x}:${SCREEN.y}:shortest=1[b];[b][2:v]overlay=0:0:shortest=1,format=yuv420p[out]`,
    '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-r', '30', '-movflags', '+faststart', out]);
}

// ---------- Principal ----------

const server = createAppServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
try {
  if (want('screens')) {
    for (const lang of LANGS) for (const theme of THEMES) {
      await screens(browser, base, lang, theme);
      console.log(`capturas ${lang}-${theme}`);
    }
  }
  if (want('images')) {
    for (const lang of LANGS) await images(browser, base, lang);
    console.log('social preview y cabeceras');
  }
  const ff = hasFfmpeg();
  if (!ff && (want('gifs') || want('video'))) console.warn('Sin ffmpeg: no se generan GIF ni MP4 (instálalo o pon su ruta en FFMPEG).');
  if (ff && want('gifs')) {
    for (const lang of LANGS) for (const name of ['shuffle', 'time', 'proof']) {
      const { file, start } = await record(browser, base, lang, SCENARIOS[name]);
      const out = join(OUT, `${name}-${lang}.gif`);
      toGif(file, start, out);
      console.log(`${out} (${mb(out)} MB)`);
    }
  }
  if (ff && want('video')) {
    for (const lang of LANGS) {
      const { file, start } = await record(browser, base, lang, SCENARIOS.tour, 2, 110);
      const out = join(OUT, `shuffl-${lang}.mp4`);
      toMp4(await videoFrames(browser, base, lang), file, start, out);
      copyFileSync(file, join(TMP, `tour-${lang}.webm`));
      console.log(`${out} (${mb(out)} MB)`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
