// Service worker de Shuffl. `__BUILD__` lo sustituye el despliegue por el hash corto del commit;
// en desarrollo vale 'dev' y el worker no intercepta nada (siempre se ve lo último del disco).
// Nunca toca otros orígenes (api y accounts de Spotify).
const VERSION = '__BUILD__';
const CACHE = `shuffl-${VERSION}`;
const DEV = VERSION === 'dev';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/api.js', 'js/auth.js', 'js/config.js', 'js/core.js', 'js/i18n.js', 'js/storage.js', 'js/update.js', 'js/cover.js', 'js/color.js', 'js/mixes.js',
  'icons/icon.svg', 'icons/favicon.svg', 'icons/favicon.ico', 'icons/icon-maskable-512.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'icons/spotify/full-logo-white.svg', 'icons/spotify/full-logo-black.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (DEV || e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })),
  );
});
