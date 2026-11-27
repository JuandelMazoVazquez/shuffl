// Sustituye al service worker de la app en la dirección antigua (/new-spoti/) y se da de baja él mismo.
// No borra cachés: el origen es el mismo que el de la app nueva (/shuffl/) y las suyas siguen en uso.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister()));
