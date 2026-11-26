# Shuffl

PWA estática (HTML + CSS + JS vanilla con ES modules, sin build ni dependencias de runtime) que baraja de verdad playlists de Spotify, las ordena, quita duplicados y hace copias. Cada usuario usa su propio Client ID (Development Mode de Spotify). Nombre visible: Shuffl (antes Baraja); repo: new-spoti. Las claves de localStorage siguen siendo `baraja.*` a propósito (no se renombran).

## Comandos
- `npm run dev`: servidor en http://127.0.0.1:5173
- `npm test`: unitarios (core y api)
- `npm run test:e2e`: Playwright con Spotify simulado (390x844)
- `npm run icons`: regenera los iconos

## Reglas propias
- El barajado es uniforme y puro: sin pesos, sin evitar lo escuchado, sin reglas de artista.
- Solo endpoints de Development Mode (feb 2026): /me, /me/playlists (GET y POST), /playlists/{id} (GET de metadatos y PUT de nombre y descripción de playlists propias), /playlists/{id}/items, /playlists/{id}/images, /me/tracks, /me/albums, /me/following, /me/top/tracks, /me/top/artists, /me/player (devices, play, shuffle, recently-played), /me/library/contains (máx. 40), DELETE /me/library (solo URIs `spotify:playlist:` de playlists de Shuffl propias, máx. 40; exige user-library-modify y user-follow-modify), /artists/{id}/albums (limit ≤ 10), /albums/{id}/tracks, /search (solo type=artist con genre:, limit ≤ 10). Nada de browse, recomendaciones, audio-features, `popularity`, `/users/{id}/...`, `/tracks` en lotes ni `/playlists/{id}/tracks`. Cualquier endpoint nuevo hay que comprobarlo contra esa lista.
- Nunca `innerHTML` con datos de Spotify; sin tokens en logs; el service worker no toca otros orígenes.
- Antes de sobrescribir una playlist: guardar Deshacer (`saveUndo`) y no escribir si la lectura fue incompleta.
- La versión de la caché la inyecta el despliegue (`__BUILD__` en `sw.js`, hash del commit): no se sube a mano. Si añades un archivo JS a la app, inclúyelo en `SHELL` de `sw.js` (un test lo exige; los de `js/` ya se copian con la carpeta en `pages.yml`).
- Las playlists que escribe la app sin pedir confirmación son siempre las generadas «· Shuffle» (`js/targets.js`); los enlaces profundos y agitar nunca escriben en el origen.
- En la cuenta solo hay una playlist de Shuffl a la vez: antes de crear una (shuffle, Descubrir, Olvidadas, Instantáneas, Mi top) se quitan todas las de Shuffl (`isAppPlaylist` en `js/targets.js`), con la biblioteca recién leída dentro del candado de escritura. De Shuffl = propia, no colaborativa, con nombre de la app («… · Shuffle», «📸 …», «🔀 Baraja») y con la etiqueta `shuffl:src=` o una descripción de una versión anterior (`LEGACY_DESCRIPTIONS`). Nunca una renombrada, ajena, sin descripción ni un origen de la baraja. Las herramientas (Ordenar, Dividir, Restaurar…) crean playlists que no se borran.
- Pages despliega solo desde main y solo si el CI pasa.
- No se usa "Spotify" en el nombre ni el logo de la app.
- Los logos de `icons/spotify/` son los oficiales sin modificar (un test fija su hash): no se editan ni se recolorean. Donde se muestren carátulas o metadatos de Spotify, añadir `spotifyAttribution()`.
- Push y merge a main sin pedir OK, siempre que el CI esté en verde y el cambio haya pasado la revisión de seguridad.
- Siguen necesitando confirmación del usuario (ver docs/bandeja.md): hacer público algo nuevo, borrar ramas con trabajo sin mergear y cualquier acción irreversible fuera del repo.
