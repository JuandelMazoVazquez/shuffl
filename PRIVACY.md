# Privacidad

Baraja no tiene servidor. Todo ocurre en tu navegador.

## Con quién habla

Solo con `accounts.spotify.com` (inicio de sesión y renovación del token) y `api.spotify.com` (leer y escribir tus playlists). No hay analítica, publicidad, cookies ni servicios de terceros. El service worker solo guarda en caché los archivos de la propia app.

## Qué se guarda en localStorage

| Clave | Contenido |
| --- | --- |
| `baraja.clientId` | Tu Client ID de Spotify |
| `baraja.tokens` | Token de acceso, token de renovación y caducidad |
| `baraja.pkce` | Verificador y estado temporales del inicio de sesión; se borran al volver de Spotify |
| `baraja.lang` | Idioma |
| `baraja.undo` | Copia para Deshacer: id y nombre de la playlist, URIs de sus canciones y fecha |
| `baraja.playlistId` | Id de tu playlist «🔀 Baraja» |

Si el navegador bloquea localStorage, Baraja guarda esos datos en memoria hasta que cierres la pestaña.

Las copias JSON y CSV se generan en tu dispositivo y las guardas tú donde quieras.

## Permisos que pide a Spotify

| Scope | Para qué |
| --- | --- |
| `playlist-read-private` | Leer tus playlists |
| `playlist-read-collaborative` | Leer playlists colaborativas |
| `playlist-modify-private` | Crear y modificar playlists privadas (las que crea Baraja son privadas) |
| `playlist-modify-public` | Modificar tus playlists públicas |
| `user-library-read` | Leer Tus me gusta |

Baraja no modifica Tus me gusta ni lee tu historial de escucha.

## Borrar tus datos

- Cerrar sesión en Ajustes borra los tokens. Mantiene Client ID, idioma, Deshacer e id de «🔀 Baraja».
- Para borrar todo, elimina los datos del sitio en tu navegador.
- Para revocar el acceso, entra en [spotify.com/account/apps](https://www.spotify.com/account/apps/) y quita Baraja.

Baraja no está afiliada a Spotify.
