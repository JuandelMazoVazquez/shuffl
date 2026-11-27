# Privacidad

Shuffl no tiene servidor. Todo ocurre en tu navegador.

## Con quién habla

Solo con `accounts.spotify.com` (inicio de sesión y renovación del token), `api.spotify.com` (leer y escribir tus playlists) y el servidor de imágenes de Spotify (`i.scdn.co`, carátulas). Agitar para barajar usa el acelerómetro del móvil solo mientras estás en Inicio y no envía nada. No hay analítica, publicidad, cookies ni servicios de terceros. El service worker solo guarda en caché los archivos de la propia app.

## Modo demo

Con `?demo=1` («Probar la demo»), Shuffl funciona con un Spotify inventado que vive en la memoria de la pestaña (`js/demo.js`): no hace ninguna petición a Spotify ni a ningún otro sitio, no lee tu sesión ni tus mezclas y no escribe nada en localStorage ni en IndexedDB, salvo el idioma y el tema si los cambias. Al cerrar o recargar sin `?demo=1`, no queda nada.

## Qué se guarda en localStorage

| Clave | Contenido |
| --- | --- |
| `shuffl.clientId` | Tu Client ID de Spotify |
| `shuffl.tokens` | Token de acceso, token de renovación y caducidad |
| `shuffl.pkce` | Verificador y estado temporales del inicio de sesión; se borran al volver de Spotify |
| `shuffl.lang` | Idioma |
| `shuffl.undo` | Copia para Deshacer: id y nombre de la playlist, URIs de sus canciones y fecha |
| `shuffl.lastTarget` | Id de la última playlist de Shuffl creada, para «Tenerla siempre a mano» |
| `shuffl.mixes`, `shuffl.lastMix` | Mezclas guardadas y la última mezcla: ids y nombres de playlists, filtros, destino y fecha de la última baraja |
| `shuffl.linkKey` | Clave aleatoria que llevan los atajos de Siri creados en este navegador |
| `shuffl.theme`, `shuffl.cover`, `shuffl.shake` | Tema, si se sube portada y si agitar para barajar está activado |
| `shuffl.logoNotice.v12` | Si ya viste el aviso de icono nuevo |
| `shuffl.purge`, `shuffl.purgeOk` | Si se quitan las playlists anteriores de Shuffl al crear una nueva y si ya aceptaste la lista la primera vez |
| `shuffl.reqDay` | Cuántas peticiones a Spotify se han hecho hoy (para Diagnóstico) |
| `shuffl.errors` | Los últimos 50 errores: fecha, pantalla, tipo, código de Spotify y ruta de la API sin ids. Nunca nombres, mensajes con datos tuyos ni tokens. Se borra con «Borrar registro» |
| `shuffl.artistsPerSearch` | Artistas por búsqueda en Novedades y Descubre |
| `shuffl.recent` | Las últimas funciones de Descubrir usadas, para «Lo último» de Inicio |
| `shuffl.discoverDays` | Días de Novedades (7, 30 o 90) |

En la descripción de la playlist de Shuffl de tu cuenta de Spotify se guarda una etiqueta (` · shuffl:src=` y 10 caracteres). Es un resumen (SHA-256 recortado) del origen: no contiene ids, nombres ni datos tuyos, y sirve para reconocer las playlists de Shuffl y quitarlas antes de crear la siguiente.

La tarjeta de «Tu resumen» se dibuja en tu navegador y solo sale de él si tú la compartes o la descargas.

Desde la v1.4.1 las claves empiezan por `shuffl.`. Las de versiones anteriores se copian solas a las nuevas al abrir la app y después se borran, sin cerrar la sesión.

Si el navegador bloquea localStorage, Shuffl guarda esos datos en memoria hasta que cierres la pestaña.

## Qué se guarda en IndexedDB (caché para gastar menos cuota)

En la base `shuffl-cache` de tu navegador, con el id de tu cuenta delante de cada clave:

- las canciones de tus playlists y de Tus me gusta que Shuffl ya ha leído (título, artistas, álbum, duración, fecha en que la añadiste y miniatura), con el `snapshot_id` de cada playlist para saber si ha cambiado;
- tus artistas top y seguidos, sus lanzamientos y las canciones de esos álbumes.

Las canciones valen mientras la playlist no cambie (como mucho 30 días); artistas y lanzamientos, 24 horas. Todo se borra al cerrar sesión, y lo que tiene más de 30 días se borra al abrir la app.

«Copiar informe» (Más → Diagnóstico) copia al portapapeles la versión, el navegador, el contador de peticiones, el resultado de la prueba completa y el registro de errores. No lleva nombres de playlists, de canciones ni de dispositivos, ni tokens, y solo sale de tu dispositivo si tú lo pegas en algún sitio.

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

- Cerrar sesión en Ajustes borra los tokens y la caché de IndexedDB. Mantiene Client ID, idioma, Deshacer y mezclas.
- Para borrar todo, elimina los datos del sitio en tu navegador.
- Para revocar el acceso, entra en [spotify.com/account/apps](https://www.spotify.com/account/apps/) y quita Shuffl.

Shuffl no está afiliada a Spotify.
