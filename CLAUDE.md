# Baraja

PWA estática (HTML + CSS + JS vanilla con ES modules, sin build ni dependencias de runtime) que baraja de verdad playlists de Spotify, las ordena, quita duplicados y hace copias. Cada usuario usa su propio Client ID (Development Mode de Spotify). Nombre visible: Baraja; repo: new-spoti.

## Comandos
- `npm run dev`: servidor en http://127.0.0.1:5173
- `npm test`: unitarios (core y api)
- `npm run test:e2e`: Playwright con Spotify simulado (390x844)
- `npm run icons`: regenera los iconos

## Reglas propias
- El barajado es uniforme y puro: sin pesos, sin evitar lo escuchado, sin reglas de artista.
- Solo endpoints de Development Mode (feb 2026): /me, /me/playlists (GET y POST), /playlists/{id} (metadatos), /playlists/{id}/items, /playlists/{id}/images, /me/tracks, /me/albums, /me/following, /me/top/tracks, /me/player (devices, play, shuffle, recently-played). Nada de browse, recomendaciones, audio-features, `popularity`, `/users/{id}/...`, `/tracks` en lotes ni `/playlists/{id}/tracks`. Cualquier endpoint nuevo hay que comprobarlo contra esa lista.
- Nunca `innerHTML` con datos de Spotify; sin tokens en logs; el service worker no toca otros orígenes.
- Antes de sobrescribir una playlist: guardar Deshacer (`saveUndo`) y no escribir si la lectura fue incompleta.
- La versión de la caché la inyecta el despliegue (`__BUILD__` en `sw.js`, hash del commit): no se sube a mano. Si añades un archivo JS a la app, inclúyelo en `SHELL` de `sw.js` (los de `js/` ya se copian con la carpeta en `pages.yml`).
- Pages despliega solo desde main y solo si el CI pasa.
- No se usa "Spotify" en el nombre ni el logo de la app.
- Los logos de `icons/spotify/` son los oficiales sin modificar (un test fija su hash): no se editan ni se recolorean. Donde se muestren carátulas o metadatos de Spotify, añadir `spotifyAttribution()`.
- Push, merge y hacer público el repo: solo con OK del usuario (ver docs/bandeja.md).
