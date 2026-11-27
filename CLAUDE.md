# Shuffl

PWA estática (HTML + CSS + JS vanilla con ES modules, sin build ni dependencias de runtime) que baraja de verdad playlists de Spotify, las ordena, quita duplicados y hace copias. Cada usuario usa su propio Client ID (Development Mode de Spotify). Nombre visible: Shuffl (antes Baraja); repo: new-spoti. Las claves de localStorage siguen siendo `baraja.*` a propósito (no se renombran).

## Comandos
- `npm run dev`: servidor en http://127.0.0.1:5173
- `npm test`: unitarios (core y api)
- `npm run test:e2e`: Playwright con Spotify simulado (390x844)
- `npm run icons`: regenera los iconos

## Reglas propias
- El barajado es uniforme y puro: sin pesos, sin evitar lo escuchado, sin reglas de artista.
- Solo endpoints de Development Mode (feb 2026): /me, /me/playlists (GET y POST), /playlists/{id} (GET de metadatos y PUT de nombre y descripción de playlists propias), /playlists/{id}/items, /playlists/{id}/images, /me/tracks, /me/albums, /me/following, /me/top/tracks, /me/top/artists, /me/player (GET del estado para comprobar qué suena, devices, play, shuffle, recently-played), /me/library/contains (máx. 40), DELETE /me/library (solo URIs `spotify:playlist:` de playlists de Shuffl propias, máx. 40; exige user-library-modify y user-follow-modify), /artists/{id}/albums (limit ≤ 10), /albums/{id}/tracks, /search (solo type=artist con genre:, limit ≤ 10). Nada de browse, recomendaciones, audio-features, `popularity`, `/users/{id}/...`, `/tracks` en lotes ni `/playlists/{id}/tracks`. Cualquier endpoint nuevo hay que comprobarlo contra esa lista.
- Nunca `innerHTML` con datos de Spotify; sin tokens en logs; el service worker no toca otros orígenes.
- Cuota (v1.3.2): ninguna acción normal debe pasar de unas 40 peticiones (lo mide `tests/e2e/quota.spec.mjs`). La caché vive en IndexedDB (`js/idb.js`) con el id de la cuenta en la clave; las playlists valen mientras no cambie su `snapshot_id`. Lo que escribe en su propio origen (Ordenar, Duplicados, «la misma playlist») lee siempre de Spotify, nunca de la caché. Con QUOTA_EXCEEDED no se reintenta.
- Errores: nunca un código ni un texto técnico de Spotify en pantalla; cada error pasa por `errorInfo` (mensaje y acción) y queda en el registro local sin nombres ni tokens (`js/diag.js`). Un `UserError` lleva como código su clave de texto.
- Antes de sobrescribir una playlist: guardar Deshacer (`saveUndo`) y no escribir si la lectura fue incompleta.
- La versión de la caché la inyecta el despliegue (`__BUILD__` en `sw.js`, hash del commit): no se sube a mano. Si añades un archivo JS a la app, inclúyelo en `SHELL` de `sw.js` (un test lo exige; los de `js/` ya se copian con la carpeta en `pages.yml`).
- Las playlists que escribe la app sin pedir confirmación son siempre las generadas «· Shuffle» (`js/targets.js`); los enlaces profundos y agitar nunca escriben en el origen.
- En la cuenta solo hay una playlist de Shuffl a la vez: antes de crear una (shuffle, Descubrir, Olvidadas, Instantáneas, Mi top) se quitan todas las de Shuffl (`isAppPlaylist` en `js/targets.js`), con la biblioteca recién leída dentro del candado de escritura, y se comprueba con /me/library/contains que se han quitado. De Shuffl = propia, no colaborativa y:
  - con etiqueta `shuffl:src=<origen>.<nombre>`: el nombre actual tiene que dar el mismo resumen (si la renombraste, es tuya);
  - con etiqueta de la v1.3 (sin resumen del nombre) o sin etiqueta: una descripción de versiones anteriores (`LEGACY_DESCRIPTIONS`) y exactamente el nombre que le correspondía. La playlist de prueba del diagnóstico lleva etiqueta y cuenta como de Shuffl.
  - Nunca una renombrada, ajena, sin descripción ni un origen de la baraja. Las herramientas (Ordenar, Dividir, Restaurar…) crean playlists que no se borran.
- La primera vez se enseña la lista y solo se borra lo que estaba en ella; el «no volver a preguntar» se guarda con el id de la cuenta y solo tras borrar bien.
- Pages despliega solo desde main y solo si el CI pasa.
- No se usa "Spotify" en el nombre ni el logo de la app.
- Los logos de `icons/spotify/` son los oficiales sin modificar (un test fija su hash): no se editan ni se recolorean. Donde se muestren carátulas o metadatos de Spotify, añadir `spotifyAttribution()`.
- Push y merge a main sin pedir OK, siempre que el CI esté en verde y el cambio haya pasado la revisión de seguridad.
- Siguen necesitando confirmación del usuario (ver docs/bandeja.md): hacer público algo nuevo, borrar ramas con trabajo sin mergear y cualquier acción irreversible fuera del repo.
