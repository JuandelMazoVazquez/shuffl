// Genera los iconos de icons/ (SVG, favicon.ico y PNG con Chromium de Playwright). Uso: npm run icons
// Logo «abanico de tres naipes»: índigo a sangre, naipes ámbar, coral y crema, y dos flechas cruzadas.
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const out = fileURLToPath(new URL('../icons/', import.meta.url));
const INDIGO = '#2E2A6B';
const CARDS = [['-14', '#FFB627'], ['14', '#FF5A4E'], ['0', '#FFF3E3']];
const PIVOT = [256, 400];

/** Flecha recta de a a b: cuerpo con extremos cuadrados y punta triangular. */
function arrow([ax, ay], [bx, by]) {
  const len = Math.hypot(bx - ax, by - ay);
  const u = [(bx - ax) / len, (by - ay) / len];
  const n = [-u[1], u[0]];
  const headLen = 34;
  const half = 24;
  const base = [bx - u[0] * headLen, by - u[1] * headLen];
  const pt = (p) => p.map((v) => +v.toFixed(2)).join(' ');
  return `<path d="M${pt([ax, ay])} L${pt([base[0] + u[0] * 2, base[1] + u[1] * 2])}" stroke="${INDIGO}" stroke-width="18" stroke-linecap="butt" fill="none"/>`
    + `<path d="M${pt([bx, by])} L${pt([base[0] + n[0] * half, base[1] + n[1] * half])} L${pt([base[0] - n[0] * half, base[1] - n[1] * half])} Z" fill="${INDIGO}"/>`;
}

const artwork = () => `
  ${CARDS.map(([angle, fill]) => `<rect x="166" y="130" width="180" height="250" rx="22" fill="${fill}" transform="rotate(${angle} ${PIVOT.join(' ')})"/>`).join('\n  ')}
  ${arrow([208, 199], [304, 311])}
  ${arrow([208, 311], [304, 199])}`;

/** `shift`/`scale` solo para la variante maskable (dibujo dentro del 80 % central). */
const svg = ({ shift = 0, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${INDIGO}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 ${-256 + shift})">${artwork()}
  </g>
</svg>
`;

/** ICO con PNG incrustados (válido desde Vista). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dirs = images.map(({ size, data }) => {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0);
    d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += data.length;
    return d;
  });
  return Buffer.concat([head, ...dirs, ...images.map((i) => i.data)]);
}

await mkdir(out, { recursive: true });
const main = svg();
await writeFile(`${out}icon.svg`, main);
await writeFile(`${out}favicon.svg`, main);

const browser = await chromium.launch();
const render = async (markup, size) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${markup}`);
  const data = await page.screenshot({ omitBackground: false });
  await page.close();
  return data;
};
await writeFile(`${out}icon-192.png`, await render(main, 192));
await writeFile(`${out}icon-512.png`, await render(main, 512));
await writeFile(`${out}apple-touch-icon.png`, await render(main, 180));
await writeFile(`${out}icon-maskable-512.png`, await render(svg({ shift: -11, scale: 0.92 }), 512));
const sizes = [16, 32, 48];
await writeFile(`${out}favicon.ico`, ico(await Promise.all(sizes.map(async (size) => ({ size, data: await render(main, size) })))));
await browser.close();
console.log('Iconos generados');
