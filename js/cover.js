// Portada de las playlists «· Shuffl»: icono de Shuffl, nombre del origen y fecha sobre negro, en JPEG de 640x640.
import { DARK } from './brand.js';

const SIZE = 640;
export const COVER_COLORS = { bg: DARK.bg, title: DARK.lime, label: DARK.muted };
const FONT = '"Arial Black", "Helvetica Neue", system-ui, -apple-system, "Segoe UI", sans-serif';
/** Spotify admite un JPEG de hasta 256 KB (en base64). */
export const MAX_IMAGE_B64 = 256 * 1024;

/** Baja la calidad hasta que el base64 que devuelve `encode(calidad)` cabe en `maxLen`. */
export function encodeUnderLimit(encode, maxLen = MAX_IMAGE_B64 - 1024, qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]) {
  for (const q of qualities) {
    const b64 = encode(q);
    if (b64.length <= maxLen) return b64;
  }
  throw new Error('imageTooBig');
}

/**
 * Tamaño de letra para que `text` quepa en `maxWidth` (`measure(text, size)` devuelve el ancho).
 * Si ni con `min` cabe, recorta con «…».
 */
export function fitText(measure, text, maxWidth, { start = 64, min = 28, step = 2 } = {}) {
  let size = start;
  while (size > min && measure(text, size) > maxWidth) size -= step;
  if (measure(text, size) <= maxWidth) return { size, text };
  const chars = [...text];
  while (chars.length > 1 && measure(`${chars.join('')}…`, size) > maxWidth) chars.pop();
  return { size, text: `${chars.join('').trimEnd()}…` };
}

export async function makeCover({ title, label, iconUrl = 'icons/icon.svg' }) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COVER_COLORS.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const img = new Image();
  img.src = iconUrl;
  await img.decode();
  const logo = 320;
  ctx.drawImage(img, (SIZE - logo) / 2, 48, logo, logo);

  const measure = (text, size) => { ctx.font = `900 ${size}px ${FONT}`; return ctx.measureText(text).width; };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fitted = fitText(measure, title, SIZE - 80);
  ctx.font = `900 ${fitted.size}px ${FONT}`;
  ctx.fillStyle = COVER_COLORS.title;
  ctx.fillText(fitted.text, SIZE / 2, 450);

  ctx.font = `700 30px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillStyle = COVER_COLORS.label;
  ctx.fillText(label, SIZE / 2, 545);

  return encodeUnderLimit((q) => canvas.toDataURL('image/jpeg', q).split(',')[1]);
}
