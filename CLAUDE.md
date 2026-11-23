# Baraja

PWA estática (HTML + CSS + JS vanilla con ES modules, sin build ni dependencias de runtime) que baraja de verdad playlists de Spotify, las ordena, quita duplicados y hace copias. Cada usuario usa su propio Client ID (Development Mode de Spotify). Nombre visible: Baraja; repo: new-spoti.

## Comandos
- `npm run dev`: servidor en http://127.0.0.1:5173
- `npm test`: unitarios (core y api)
- `npm run test:e2e`: Playwright con Spotify simulado (390x844)
- `npm run icons`: regenera los iconos

## Reglas propias
- El barajado es uniforme y puro: sin pesos, sin evitar lo escuchado, sin reglas de artista.
- Solo estos endpoints: /me, /me/playlists, /playlists/{id}/items, /me/tracks, POST /me/playlists. Nada de browse, recomendaciones, audio-features ni peticiones por lotes.
- Nunca `innerHTML` con datos de Spotify; sin tokens en logs; el service worker no toca otros orígenes.
- Antes de sobrescribir una playlist: guardar Deshacer (`saveUndo`) y no escribir si la lectura fue incompleta.
- Al cambiar archivos de la app, subir `CACHE` en `sw.js`.
- No se usa "Spotify" en el nombre ni el logo de la app.
- Push, merge y hacer público el repo: solo con OK del usuario (ver docs/bandeja.md).
