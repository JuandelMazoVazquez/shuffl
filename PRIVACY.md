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
| `baraja.playlistId` | Id de la antigua «🔀 Baraja» (de antes del cambio de nombre), solo para el aviso de migración |
| `baraja.targets` | Qué playlist «· Shuffle» corresponde a cada origen (ids de playlists o de mezcla → id de la playlist generada) |
| `baraja.lastTarget` | Id de la última playlist «· Shuffle» escrita, para «Tenerla siempre a mano» |
| `baraja.mixes`, `baraja.lastMix` | Mezclas guardadas y la última mezcla: ids y nombres de playlists, filtros y destino |
| `baraja.snapshots` | Ids de las playlists de instantáneas |
| `baraja.linkKey` | Clave aleatoria que llevan los atajos de Siri creados en este navegador |
| `baraja.theme`, `baraja.cover`, `baraja.shake` | Tema, si se sube portada y si agitar para barajar está activado |
| `baraja.logoNotice.v12`, `baraja.migrationNotice` | Si ya viste los avisos de icono nuevo y de la antigua «🔀 Baraja» |
| `baraja.autoClean` | Si las copias repetidas de las «· Shuffle» se quitan sin preguntar |
| `baraja.metaCache` | Caché de 24 h de datos públicos de Spotify: ids y nombres de tus artistas top y seguidos, lanzamientos de esos artistas y canciones de álbumes |
| `baraja.recent` | Las últimas funciones de Descubrir usadas, para «Lo último» de Inicio |
| `baraja.discoverDays` | Días de Novedades (7, 30 o 90) |

En la descripción de cada playlist «· Shuffle» de tu cuenta de Spotify se guarda una etiqueta (` · shuffl:src=` y 10 caracteres). Es un resumen (SHA-256 recortado) del origen: no contiene ids, nombres ni datos tuyos, y solo sirve para encontrar esa playlist desde otro dispositivo.

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
| `ugc-image-upload` | Subir la portada de las playlists «· Shuffle» |
| `user-top-read` | Instantáneas de tus canciones más escuchadas |
| `user-read-recently-played` | Instantánea de tus últimas escuchas |
| `user-follow-read` | Incluir los artistas que sigues en la copia de seguridad |

Shuffl no modifica Tus me gusta. Tu historial, tus tops y tus artistas solo se leen cuando usas la función que los necesita, y nada sale de tu dispositivo.

## Borrar tus datos

- Cerrar sesión en Ajustes borra los tokens. Mantiene Client ID, idioma, Deshacer, mezclas y la correspondencia de playlists «· Shuffle».
- Para borrar todo, elimina los datos del sitio en tu navegador.
- Para revocar el acceso, entra en [spotify.com/account/apps](https://www.spotify.com/account/apps/) y quita Shuffl.

Shuffl no está afiliada a Spotify.
