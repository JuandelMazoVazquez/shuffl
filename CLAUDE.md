# Shuffl

PWA estática (HTML + CSS + JS vanilla con ES modules, sin build ni dependencias de runtime) que baraja de verdad playlists de Spotify, las ordena, quita duplicados y hace copias. Cada usuario usa su propio Client ID (Development Mode de Spotify). Todo se llama Shuffl: repo `shuffl`, app en https://juandelmazovazquez.github.io/shuffl/, claves `shuffl.*` (las antiguas se migran solas en `js/storage.js`). La dirección antigua la redirige otro repo, con la fuente en `redirect/`. Nombre, logo y paleta: `docs/BRAND.md`.

## Comandos
- `npm run dev`: servidor en http://127.0.0.1:5173
- `npm test`: unitarios (core y api)
- `npm run test:e2e`: Playwright con Spotify simulado (390x844)
- `npm run icons`: regenera los iconos
- `npm run media`: capturas, GIFs, vídeo y social preview de `docs/media/` con el modo demo (GIF y MP4 necesitan ffmpeg). Regenerar tras cambiar la interfaz.

## Reglas propias
- El barajado es uniforme y puro: sin pesos, sin evitar lo escuchado, sin reglas de artista.
- Solo endpoints de Development Mode (feb 2026): /me, /me/playlists (GET y POST), /playlists/{id} (GET de metadatos y PUT de nombre y descripción de playlists propias), /playlists/{id}/items, /playlists/{id}/images, /me/tracks, /me/albums, /me/following, /me/top/tracks, /me/top/artists, /me/player (GET del estado para comprobar qué suena, devices, play, shuffle, recently-played), /me/library/contains (máx. 40), DELETE /me/library (solo URIs `spotify:playlist:` de playlists de Shuffl propias, máx. 40; exige user-library-modify y user-follow-modify), /artists/{id}/albums (limit ≤ 10), /albums/{id}/tracks, /search (solo type=artist con genre:, limit ≤ 10). Nada de browse, recomendaciones, audio-features, `popularity`, `/users/{id}/...`, `/tracks` en lotes ni `/playlists/{id}/tracks`. Cualquier endpoint nuevo hay que comprobarlo contra esa lista.
- Nunca `innerHTML` con datos de Spotify; sin tokens en logs; el service worker no toca otros orígenes.
- Modo demo (`?demo=1`, `js/demo.js`): un Spotify inventado en memoria inyectado como `fetchImpl`. Cero peticiones a la red (lo comprueba `tests/e2e/demo.spec.mjs`) y almacenamiento volátil: no lee ni escribe la sesión, las mezclas ni la caché de verdad. Un endpoint nuevo de la app hay que añadirlo también a la demo. Nada real en sus datos: nombres inventados y carátulas SVG generadas.
- Cuota (v1.3.2): ninguna acción normal debe pasar de unas 40 peticiones (lo mide `tests/e2e/quota.spec.mjs`). La caché vive en IndexedDB (`js/idb.js`) con el id de la cuenta en la clave; las playlists valen mientras no cambie su `snapshot_id`. Lo que escribe en su propio origen (Ordenar, Duplicados, «la misma playlist») lee siempre de Spotify, nunca de la caché. Con QUOTA_EXCEEDED no se reintenta.
- Errores: nunca un código ni un texto técnico de Spotify en pantalla; cada error pasa por `errorInfo` (mensaje y acción) y queda en el registro local sin nombres ni tokens (`js/diag.js`). Un `UserError` lleva como código su clave de texto.
- Antes de sobrescribir una playlist: guardar Deshacer (`saveUndo`) y no escribir si la lectura fue incompleta.
- Barajar en la playlist original (v1.5.0): solo una playlist propia o colaborativa, entera, sin tiempo ni filtros (`selfBlocker` en `js/core.js`); solo cambia el orden. Si no se puede, la opción sale desactivada con el motivo a la vista, nunca sin explicación.
- Guía de instalación: `guia/` (es) y `guide/` (en), copiadas por `pages.yml`. Sus pasos, los del asistente de alta (`renderSetup`) y los del README (es/en) son los mismos y en el mismo orden: instalar, crear la app en Spotify for Developers, conectar. Todo enlace externo, en la app y en la guía, con `target="_blank" rel="noopener noreferrer"`.
- La versión de la caché la inyecta el despliegue (`__BUILD__` en `sw.js`, hash del commit): no se sube a mano. Si añades un archivo JS a la app, inclúyelo en `SHELL` de `sw.js` (un test lo exige; los de `js/` ya se copian con la carpeta en `pages.yml`).
- Las playlists que escribe la app sin pedir confirmación son siempre las generadas «· Shuffl», salvo «Barajar mi playlist original» desde el formulario después de la primera vez en la cuenta (v1.5.0: con Deshacer y comprobando que no cambió desde la lectura); desde «Barajar otra vez» o una mezcla guardada pregunta siempre (`js/targets.js`; las de antes de la v1.4.1 terminaban en «· Shuffle»); los enlaces profundos y agitar nunca escriben en el origen.
- En la cuenta hay como mucho una playlist de Shuffl por categoría (v1.5.0): shuffle (incluye por tiempo y mezclas), explore (Descubre), new (Novedades), forgotten (Olvidadas) y snap (Instantáneas y Mi top). Antes de crear una se quitan las de Shuffl de su misma categoría (`isAppPlaylist` y `appCategory` en `js/targets.js`; más una prueba del diagnóstico que se quedara), con la biblioteca recién leída dentro del candado de escritura, y se comprueba con /me/library/contains que se han quitado. La categoría va en la etiqueta (`shuffl:cat=<cat> · shuffl:src=…`); las anteriores sin ella se clasifican por su clave de origen (nunca por el nombre) y una categoría desconocida no se borra nunca. «Barajar mi playlist original» no borra nada. De Shuffl = propia, no colaborativa y:
  - con etiqueta `shuffl:src=<origen>.<nombre>`: el nombre actual tiene que dar el mismo resumen (si la renombraste, es tuya);
  - con etiqueta de la v1.3 (sin resumen del nombre) o sin etiqueta: una descripción de versiones anteriores (`LEGACY_DESCRIPTIONS`) y exactamente el nombre que le correspondía. La playlist de prueba del diagnóstico lleva etiqueta y cuenta como de Shuffl.
  - Nunca una renombrada, ajena, sin descripción ni un origen de la baraja. Las herramientas (Ordenar, Dividir, Restaurar…) crean playlists que no se borran.
- La primera vez se enseña la lista y solo se borra lo que estaba en ella; el «no volver a preguntar» se guarda con el id de la cuenta y solo tras borrar bien.
- Pages despliega solo desde main y solo si el CI pasa.
- No se usa "Spotify" en el nombre ni el logo de la app.
- Colores solo de la paleta de `js/brand.js` (fuente única; `css/styles.css` repite sus valores). `tests/unit/palette.test.js` falla con un color fuera de ella o con un nombre antiguo fuera de las excepciones.
- Los logos de `icons/spotify/` son los oficiales sin modificar (un test fija su hash): no se editan ni se recolorean. Donde se muestren carátulas o metadatos de Spotify, añadir `spotifyAttribution()`.
- Push y merge a main sin pedir OK, siempre que el CI esté en verde y el cambio haya pasado la revisión de seguridad.
- Siguen necesitando confirmación del usuario (ver docs/bandeja.md): hacer público algo nuevo, borrar ramas con trabajo sin mergear y cualquier acción irreversible fuera del repo.
