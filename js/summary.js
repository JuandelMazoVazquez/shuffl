// «Tu resumen»: tarjeta para compartir (vertical 1080×1920 para historias y cuadrada 1080×1080).
// Normas de marca de Spotify: las carátulas se dibujan enteras (sin recortar ni deformar) y sin nada encima,
// junto al logo oficial de Spotify sin modificar. El texto va siempre al lado, nunca sobre una imagen.
import { fitText } from './cover.js';

export const FORMATS = { story: { w: 1080, h: 1920 }, square: { w: 1080, h: 1080 } };
export const SUMMARY_COLORS = { bg: '#0B0B0B', title: '#C6FF3D', text: '#F5F5F5', muted: '#A3A3A3', slot: '#1F1F1F' };
const FONT = '"Arial Black", "Helvetica Neue", system-ui, -apple-system, "Segoe UI", sans-serif';
const BODY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
/** Proporción del logo completo de Spotify (viewBox del SVG oficial) y su zona de seguridad (media altura del icono). */
export const SPOTIFY_LOGO_RATIO = 88 / 24;

/**
 * Posiciones de todo lo que se dibuja. Pura, para poder comprobar en tests que ningún texto pisa una carátula
 * y que el logo de Spotify respeta su tamaño mínimo y su zona de seguridad.
 */
export function summaryLayout(format) {
  const { w, h } = FORMATS[format];
  const pad = 72;
  if (format === 'story') {
    const img = 100;
    const rowH = 120;
    const rows = [];
    const section = (top, kind) => {
      for (let i = 0; i < 5; i++) {
        const y = top + 60 + i * rowH;
        rows.push({ kind, i, img: { x: pad, y, s: img }, text: { x: pad + img + 32, y, w: w - pad * 2 - img - 32, h: img } });
      }
      return { kind, x: pad, y: top, size: 34 };
    };
    const heads = [section(380, 'artists'), section(380 + 60 + 5 * rowH + 20, 'tracks')];
    const logoW = 300;
    return {
      w, h, pad,
      brand: { x: pad, y: 64, s: 110 },
      title: { x: pad, y: 290, w: w - pad * 2, size: 96 },
      range: { x: pad, y: 350, size: 36 },
      heads, rows,
      logo: { x: w - pad - logoW, y: h - 72 - logoW / SPOTIFY_LOGO_RATIO, w: logoW, h: logoW / SPOTIFY_LOGO_RATIO },
      footer: { x: pad, y: h - 72 - logoW / SPOTIFY_LOGO_RATIO / 2, size: 30 },
    };
  }
  const img = 92;
  const rowH = 112;
  const colW = (w - pad * 2 - 48) / 2;
  const rows = [];
  const heads = ['artists', 'tracks'].map((kind, c) => {
    const x = pad + c * (colW + 48);
    for (let i = 0; i < 5; i++) {
      const y = 330 + i * rowH;
      rows.push({ kind, i, img: { x, y, s: img }, text: { x: x + img + 20, y, w: colW - img - 20, h: img } });
    }
    return { kind, x, y: 270, size: 28 };
  });
  const logoW = 240;
  return {
    w, h, pad,
    brand: { x: pad, y: 64, s: 80 },
    title: { x: pad + 100, y: 120, w: w - pad * 2 - 100, size: 64 },
    range: { x: pad + 100, y: 180, size: 30 },
    heads, rows,
    logo: { x: w - pad - logoW, y: h - 56 - logoW / SPOTIFY_LOGO_RATIO, w: logoW, h: logoW / SPOTIFY_LOGO_RATIO },
    footer: { x: pad, y: h - 56 - logoW / SPOTIFY_LOGO_RATIO / 2, size: 26 },
  };
}

/** Rectángulo donde cabe la imagen entera centrada en el hueco cuadrado (sin recortar ni deformar). */
export function containRect(slot, iw, ih) {
  if (!(iw > 0 && ih > 0)) return null;
  const k = Math.min(slot.s / iw, slot.s / ih);
  const w = iw * k;
  const h = ih * k;
  return { x: slot.x + (slot.s - w) / 2, y: slot.y + (slot.s - h) / 2, w, h };
}

function loadImage(src, cors) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Dibuja la tarjeta y devuelve { blob, missingImages }. Si una carátula no se puede leer (CORS), su hueco queda vacío:
 * nunca se sustituye por otra imagen ni se dibuja texto encima.
 */
export async function renderSummary(data, format) {
  const L = summaryLayout(format);
  const canvas = document.createElement('canvas');
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = SUMMARY_COLORS.bg;
  ctx.fillRect(0, 0, L.w, L.h);

  const [brand, logo] = await Promise.all([loadImage('icons/icon.svg'), loadImage('icons/spotify/full-logo-white.svg')]);
  if (brand) ctx.drawImage(brand, L.brand.x, L.brand.y, L.brand.s, L.brand.s);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const measure = (font) => (text, size) => { ctx.font = font(size); return ctx.measureText(text).width; };
  const display = (size) => `900 ${size}px ${FONT}`;
  const body = (size) => `700 ${size}px ${BODY}`;

  const title = fitText(measure(display), data.title, L.title.w, { start: L.title.size, min: 40 });
  ctx.font = display(title.size);
  ctx.fillStyle = SUMMARY_COLORS.title;
  ctx.fillText(title.text, L.title.x, L.title.y);
  ctx.font = `700 ${L.range.size}px ${MONO}`;
  ctx.fillStyle = SUMMARY_COLORS.muted;
  ctx.fillText(`// ${data.range}`.toUpperCase(), L.range.x, L.range.y);

  for (const head of L.heads) {
    ctx.font = `700 ${head.size}px ${MONO}`;
    ctx.fillStyle = SUMMARY_COLORS.muted;
    ctx.fillText((head.kind === 'artists' ? data.artistsLabel : data.tracksLabel).toUpperCase(), head.x, head.y + head.size);
  }

  const items = { artists: data.artists, tracks: data.tracks };
  const images = await Promise.all(L.rows.map((r) => loadImage(items[r.kind][r.i]?.image, true)));
  let missingImages = 0;
  L.rows.forEach((r, k) => {
    const item = items[r.kind][r.i];
    if (!item) return;
    const img = images[k];
    const rect = img && containRect(r.img, img.naturalWidth, img.naturalHeight);
    if (rect) {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    } else {
      missingImages++;
      ctx.fillStyle = SUMMARY_COLORS.slot;
      ctx.fillRect(r.img.x, r.img.y, r.img.s, r.img.s);
    }
    const nameSize = format === 'story' ? 44 : 30;
    const subSize = format === 'story' ? 32 : 22;
    const name = fitText(measure(body), `${r.i + 1}. ${item.name}`, r.text.w, { start: nameSize, min: Math.round(nameSize * 0.7) });
    ctx.font = body(name.size);
    ctx.fillStyle = SUMMARY_COLORS.text;
    ctx.fillText(name.text, r.text.x, r.text.y + r.text.h / 2 - (item.sub ? 4 : -name.size / 3));
    if (item.sub) {
      const sub = fitText(measure((s) => `400 ${s}px ${BODY}`), item.sub, r.text.w, { start: subSize, min: Math.round(subSize * 0.8) });
      ctx.font = `400 ${sub.size}px ${BODY}`;
      ctx.fillStyle = SUMMARY_COLORS.muted;
      ctx.fillText(sub.text, r.text.x, r.text.y + r.text.h / 2 + sub.size + 4);
    }
  });

  if (logo) ctx.drawImage(logo, L.logo.x, L.logo.y, L.logo.w, L.logo.h);
  ctx.font = `700 ${L.footer.size}px ${MONO}`;
  ctx.fillStyle = SUMMARY_COLORS.muted;
  ctx.textBaseline = 'middle';
  ctx.fillText(data.footer, L.footer.x, L.footer.y);

  let blob;
  try {
    blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
  } catch {
    // Una carátula sin CORS «contamina» el lienzo: se repite sin carátulas antes que no dar tarjeta.
    return renderSummary({ ...data, artists: data.artists.map((a) => ({ ...a, image: '' })), tracks: data.tracks.map((x) => ({ ...x, image: '' })) }, format);
  }
  return { blob, missingImages };
}
