/** Color dominante de píxeles RGBA: media ponderada por saturación, sin transparentes, oscuros ni casi blancos. */
export function dominantColor(data) {
  let r = 0, g = 0, b = 0, total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [R, G, B] = [data[i], data[i + 1], data[i + 2]];
    const lum = (R * 299 + G * 587 + B * 114) / 1000;
    if (lum < 28 || lum > 235) continue;
    const max = Math.max(R, G, B);
    const sat = max === 0 ? 0 : (max - Math.min(R, G, B)) / max;
    const w = 0.05 + sat * sat;
    r += R * w; g += G * w; b += B * w; total += w;
  }
  return total === 0 ? null : [Math.round(r / total), Math.round(g / total), Math.round(b / total)];
}

export const rgbCss = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

const cache = new Map();

/** Color dominante de una portada. Devuelve null si el servidor de imágenes no permite leerla (CORS). */
export function imageDominantColor(url) {
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 24);
        return dominantColor(ctx.getImageData(0, 0, 24, 24).data);
      } catch {
        return null;
      }
    })());
  }
  return cache.get(url);
}
