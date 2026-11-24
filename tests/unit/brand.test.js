import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Hashes de Full_Logo_White_RGB.svg y Full_Logo_Black_RGB.svg de 2024-spotify-full-logo.zip
// (developer.spotify.com/documentation/design). Si cambian, el logo ya no es el oficial sin modificar.
const OFFICIAL = {
  'icons/spotify/full-logo-white.svg': '31cdfcdd58d3533a32d287267a1c404f376749b1fc4da99e4baa2233684f053c',
  'icons/spotify/full-logo-black.svg': 'b91219c14405166e3667deb7f250df4b939a8a5dbc8460ee9525a75672ba9ec5',
};

test('los logos de Spotify son los archivos oficiales, byte a byte', () => {
  for (const [path, hash] of Object.entries(OFFICIAL)) assert.equal(sha256(read(path)), hash, path);
});

test('el service worker guarda los logos para usar la app sin conexión', () => {
  const sw = read('sw.js').toString('utf8');
  for (const path of Object.keys(OFFICIAL)) assert.ok(sw.includes(`'${path}'`), path);
});

test('el logo se muestra con la proporción original a 70 px o más de ancho', () => {
  const svg = read('icons/spotify/full-logo-white.svg').toString('utf8');
  const [, , w, hgt] = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
  const app = read('js/app.js').toString('utf8');
  const [, width, height] = /full-logo-white\.svg', alt: '', width: '(\d+)', height: '(\d+)'/.exec(app).map(Number);
  assert.ok(width >= 70);
  assert.ok(Math.abs(width / height - w / hgt) < 0.05, `${width}x${height} frente a ${w}x${hgt}`);
});
