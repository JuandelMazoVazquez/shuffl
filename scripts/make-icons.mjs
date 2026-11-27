// Genera los iconos de icons/ (SVG, favicon.ico y PNG con Chromium de Playwright). Uso: npm run icons
// Logo «tres naipes en abanico» (opción B): negro a sangre, dos naipes de contorno lima detrás (−18° y +18°)
// y uno relleno de lima delante con una X negra.
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { DARK } from '../js/brand.js';

const out = fileURLToPath(new URL('../icons/', import.meta.url));
const BLACK = DARK.bg;
const LIME = DARK.lime;
const PIVOT = [256, 420];
const card = (angle, paint) => `<rect x="166" y="126" width="180" height="250" rx="20" transform="rotate(${angle} ${PIVOT.join(' ')})" ${paint}/>`;
const outline = `fill="${BLACK}" stroke="${LIME}" stroke-width="16"`;

const artwork = () => `
  ${card(-18, outline)}
  ${card(18, outline)}
  ${card(0, `fill="${LIME}" stroke="${BLACK}" stroke-width="14"`)}
  <path d="M214 209 L298 293 M298 209 L214 293" stroke="${BLACK}" stroke-width="30" stroke-linecap="square" fill="none"/>`;

/** `shift`/`scale` solo para la variante maskable (dibujo dentro del 80 % central). */
const svg = ({ shift = 0, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${BLACK}"/>
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
