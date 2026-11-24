// Genera icons/*.svg y los PNG (con Chromium de Playwright). Uso: npm run icons
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const out = fileURLToPath(new URL('../icons/', import.meta.url));

const cards = (scale) => `
  <g transform="translate(256 270) scale(${scale})">
    <g transform="rotate(-22 0 150)"><rect x="-95" y="-170" width="190" height="270" rx="26" fill="#ffd9c9" stroke="#14110f" stroke-width="8"/></g>
    <g transform="rotate(22 0 150)"><rect x="-95" y="-170" width="190" height="270" rx="26" fill="#ffe9dc" stroke="#14110f" stroke-width="8"/></g>
    <rect x="-95" y="-170" width="190" height="270" rx="26" fill="#fff8f2" stroke="#14110f" stroke-width="8"/>
    <g fill="none" stroke="#e5502c" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -35)">
      <path d="M-45 35 45 -35"/><path d="M45 -35h-28 M45 -35v28"/><path d="M-45 -35 -8 -6 M8 6 45 35"/><path d="M45 35h-28 M45 35v-28"/>
    </g>
  </g>`;

const svg = (scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#ffb347"/></linearGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#g)"/>${cards(scale)}
</svg>`;

await mkdir(out, { recursive: true });
await writeFile(`${out}icon.svg`, svg(0.95, true));

const browser = await chromium.launch();
const render = async (markup, size, file) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${markup}`);
  await page.screenshot({ path: `${out}${file}`, omitBackground: true });
  await page.close();
};
await render(svg(0.95, true), 192, 'icon-192.png');
await render(svg(0.95, true), 512, 'icon-512.png');
await render(svg(1, false), 180, 'apple-touch-icon.png');
await render(svg(0.7, false), 512, 'icon-maskable-512.png');
await browser.close();
console.log('Iconos generados');
