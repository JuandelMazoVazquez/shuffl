# Privacidad

Shuffl no tiene servidor. Todo ocurre en tu navegador.

## Con quién habla

Solo con `accounts.spotify.com` (inicio de sesión y renovación del token), `api.spotify.com` (leer y escribir tus playlists) y el servidor de imágenes de Spotify (`i.scdn.co`, carátulas). Agitar para barajar usa el acelerómetro del móvil solo mientras estás en Inicio y no envía nada. No hay analítica, publicidad, cookies ni servicios de terceros. El service worker solo guarda en caché los archivos de la propia app.

## Qué se guarda en localStorage

| Clave | Contenido |
| --- | --- |
| `baraja.clientId` | Tu Client ID de Spotify |
| `baraja.tokens` | Token de acceso, token de renovación y caducidad |
| `baraja.pkce` | Verificador y estado temporales del inicio de sesión; se borran al volver de Spotify |
| `baraja.lang` | Idioma |
| `baraja.undo` | Copia para Deshacer: id y nombre de la playlist, URIs de sus canciones y fecha |
| `baraja.lastTarget` | Id de la última playlist de Shuffl creada, para «Tenerla siempre a mano» |
| `baraja.mixes`, `baraja.lastMix` | Mezclas guardadas y la última mezcla: ids y nombres de playlists, filtros, destino y fecha de la última baraja |
| `baraja.linkKey` | Clave aleatoria que llevan los atajos de Siri creados en este navegador |
| `baraja.theme`, `baraja.cover`, `baraja.shake` | Tema, si se sube portada y si agitar para barajar está activado |
| `baraja.logoNotice.v12` | Si ya viste el aviso de icono nuevo |
| `baraja.purge`, `baraja.purgeOk` | Si se quitan las playlists anteriores de Shuffl al crear una nueva y si ya aceptaste la lista la primera vez |
| `baraja.libIndex` | Qué canciones tienes (ids de canciones de tus playlists y de Tus me gusta, con el `snapshot_id` de cada playlist), para que Descubrir no te proponga lo que ya tienes. Se renueva a las 24 h y se borra al cerrar sesión |
| `baraja.metaCache` | Caché de 24 h de datos públicos de Spotify: ids y nombres de tus artistas top y seguidos, lanzamientos de esos artistas y canciones de álbumes |
| `baraja.recent` | Las últimas funciones de Descubrir usadas, para «Lo último» de Inicio |
| `baraja.discoverDays` | Días de Novedades (7, 30 o 90) |

En la descripción de la playlist de Shuffl de tu cuenta de Spotify se guarda una etiqueta (` · shuffl:src=` y 10 caracteres). Es un resumen (SHA-256 recortado) del origen: no contiene ids, nombres ni datos tuyos, y sirve para reconocer las playlists de Shuffl y quitarlas antes de crear la siguiente.

La tarjeta de «Tu resumen» se dibuja en tu navegador y solo sale de él si tú la compartes o la descargas.

Las claves siguen empezando por `baraja.` (el nombre anterior de la app) para no cerrar la sesión de nadie con el cambio de nombre.

Si el navegador bloquea localStorage, Shuffl guarda esos datos en memoria hasta que cierres la pestaña.

Las copias JSON y CSV se generan en tu dispositivo y las guardas tú donde quieras.

## Permisos que pide a Spotify

| Scope | Para qué |
| --- | --- |
| `playlist-read-private` | Leer tus playlists |
| `playlist-read-collaborative` | Leer playlists colaborativas |
| `playlist-modify-private` | Crear y modificar playlists privadas (las que crea Shuffl son privadas) |
| `playlist-modify-public` | Modificar tus playlists públicas |
| `user-library-read` | Leer Tus me gusta y álbumes guardados |
| `user-read-playback-state` | Ver tus dispositivos para «Reproducir ahora» |
| `user-modify-playback-state` | Apagar el aleatorio y empezar a reproducir una playlist |
| `ugc-image-upload` | Subir la portada de las playlists de Shuffl |
| `user-top-read` | Instantáneas de tus canciones más escuchadas |
| `user-read-recently-played` | Instantánea de tus últimas escuchas |
| `user-follow-read` | Artistas que sigues, para la copia de seguridad y Novedades |
| `user-library-modify`, `user-follow-modify` | Quitar de tu biblioteca las playlists anteriores de Shuffl (`DELETE /me/library` los exige). Shuffl no los usa para nada más |

Shuffl no modifica Tus me gusta ni deja de seguir artistas: los dos permisos de biblioteca solo se usan para quitar sus propias playlists. Tu historial, tus tops y tus artistas solo se leen cuando usas la función que los necesita, y nada sale de tu dispositivo.

## Borrar tus datos

- Cerrar sesión en Ajustes borra los tokens. Mantiene Client ID, idioma, Deshacer, mezclas y la correspondencia de playlists «· Shuffle».
- Para borrar todo, elimina los datos del sitio en tu navegador.
- Para revocar el acceso, entra en [spotify.com/account/apps](https://www.spotify.com/account/apps/) y quita Shuffl.

Shuffl no está afiliada a Spotify.
