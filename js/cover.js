// Portada de «🔀 Baraja»: logo sobre un color de la paleta y la fecha de la baraja, en JPEG de 640x640.
const SIZE = 640;
const INK = '#2E2A6B';
const BACKGROUNDS = ['#FF5A4E', '#FFB627', '#FFF3E3'];
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

/** Color de fondo: cambia cada día, de forma determinista. */
export const coverColor = (date) => BACKGROUNDS[Math.floor(date.getTime() / 86400000) % BACKGROUNDS.length];

export async function makeCover({ label, date = new Date(), iconUrl = 'icons/icon.svg' }) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = coverColor(date);
  ctx.fillRect(0, 0, SIZE, SIZE);

  const img = new Image();
  img.src = iconUrl;
  await img.decode();
  const logo = 400;
  const x = (SIZE - logo) / 2;
  const y = 70;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, logo, logo, 72);
  ctx.clip();
  ctx.drawImage(img, x, y, logo, logo);
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 48;
  ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  while (ctx.measureText(label).width > SIZE - 80 && size > 20) {
    size -= 2;
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  }
  ctx.fillText(label, SIZE / 2, 560);

  return encodeUnderLimit((q) => canvas.toDataURL('image/jpeg', q).split(',')[1]);
}
