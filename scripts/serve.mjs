// Servidor estático mínimo sin dependencias: http://127.0.0.1:5173
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

/** `getBuild` da la versión que se inyecta en sw.js (en el despliegue la pone el workflow con el hash del commit). */
export function createAppServer({ getBuild = () => 'dev' } = {}) {
  return createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = join(root, normalize(path));
      const rel = relative(root, file);
      if (rel.startsWith('..') || isAbsolute(rel)) throw Object.assign(new Error('fuera de la raíz'), { code: 'ENOENT' });
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      let body = await readFile(file);
      if (rel === 'sw.js') body = body.toString('utf8').replaceAll('__BUILD__', getBuild());
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch (e) {
      res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(e.code === 'ENOENT' ? 'No encontrado' : 'Error');
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 5173;
  createAppServer().listen(port, '127.0.0.1', () => console.log(`Shuffl en http://127.0.0.1:${port}`));
}
