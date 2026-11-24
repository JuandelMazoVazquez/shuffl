# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.1.0] - 2026-11-24

### Seguridad

- Pages solo despliega el CI verde de un push a `main` de este repo (no de forks ni de PR) y nunca un commit más viejo que `main`.
- Las mezclas guardadas se validan al leerlas y al restaurarlas (ids sin caracteres que alteren la ruta de la API, tope de 50). Restaurar no pisa mezclas locales con el mismo id.
- Actualizar una instantánea no pisa el Deshacer de otra playlist. El botón «Actualizar» espera si hay una tarea en curso.
- Reglas de endpoints del proyecto actualizadas a los de Development Mode que usa la app.

### Añadido

- **Compartir** el enlace de la playlist creada: hoja de compartir del sistema (Web Share) o, si no existe, copiar el enlace.
- **Orden combinado**: hasta 3 criterios encadenados (por ejemplo artista → álbum cronológico → nº de pista), con orden estable; nuevos criterios «Álbum (cronológico)» y «Nº de pista».
- **Copia ampliada**: álbumes guardados (con UPC) y artistas seguidos en el JSON, y un CSV propio de biblioteca. Baraja no los restaura en tu biblioteca (solo respaldo).
- **Asistente de alta del Client ID**: pasos guiados con «Hecho», enlace al dashboard, Redirect URI copiable dentro del paso 3 y ayuda para errores típicos (Invalid redirect URI, 403 por User Management o Premium, QUOTA_EXCEEDED, Client ID erróneo). En Ajustes, «Comprobar conexión» diagnostica sesión, lectura de playlists y permisos.
- **Instantáneas**: «📸 Top 4 semanas», «📸 Top 6 meses», «📸 Top siempre» (`GET /me/top/tracks`, 50) y «📸 Últimas escuchas» (`GET /me/player/recently-played`, 50, sin repetidas), creando la playlist o actualizando la misma (con Deshacer), con opción de barajar.
- **Me gusta sin playlist**: canciones de Tus me gusta que no están en ninguna de tus playlists (sin contar las que genera Baraja); crea una playlist con ellas, barajada si se quiere.
- **Dividir playlist**: en N partes, por década de lanzamiento, por artista principal (con mínimo configurable) o por año de añadida, con vista previa y nombres editables. La original no se toca.
- **Playlists de otras personas**: sección «Playlists que sigues» en los selectores, con portada y marcadas «No se puede leer»; al tocarlas se explica por qué y cómo hacerse una copia propia en Spotify (móvil y ordenador) con botón «Abrir en Spotify». Una playlist propia con el mismo nombre se marca «Tu copia de…» y se puede barajar. Las colaborativas se barajan como propias. Se puede pegar un enlace, URI o id: solo se leen nombre y autor, nunca las canciones.
- **Filtros antes de barajar**: años de lanzamiento, fecha de añadida, duración y explícitas, con contador en vivo («N de M canciones pasan los filtros»). Se filtra primero y luego se baraja de forma uniforme lo que queda. Con filtros activos no se permite sobrescribir la propia playlist (perdería las canciones filtradas).
- **Barajar toda mi biblioteca**: todas las playlists propias y colaborativas más Tus me gusta, con resumen «N playlists · M canciones». Las de otras personas se saltan y se avisa; «🔀 Baraja» no se incluye a sí misma.
- **Mezclas guardadas**: fuentes, filtros y destino con nombre, desde Inicio con un toque; se pueden editar y borrar. Una mezcla de biblioteca incluye las playlists nuevas. Viajan en la copia de seguridad (JSON) y se restauran.
- Los tests estadísticos del barajado usan semilla fija: ya no pueden fallar al azar.
- Rediseño con la paleta Baraja (fondo `#0F0E17`, superficies `#1A1927`, coral, ámbar, índigo y crema) en oscuro por defecto, claro y «como el sistema» (contraste AA comprobado por test).
- Inicio con tarjetas: «Volver a barajar mi última mezcla» y atajos. Degradado de fondo con el color dominante de la portada seleccionada.
- Animación de naipes mezclándose durante el barajado (la barra sigue el progreso real), resultado en cascada con contador animado, esqueletos de carga, microinteracciones, deslizar para cambiar de pestaña y tirar para refrescar. Respeta `prefers-reduced-motion`.
- Botón «▶ Reproducir ahora» en los resultados: apaga el aleatorio de Spotify y reproduce la playlist desde la primera canción en el dispositivo activo (hoja para elegir dispositivo; ayuda y enlace «LISTEN ON SPOTIFY» si no hay ninguno). Requiere Premium.
- Nuevos permisos de Spotify (reproducción, portada, tops, últimas escuchas y artistas seguidos). Quien ya tenía sesión verá «Baraja tiene funciones nuevas: vuelve a conectar con Spotify».
- Portada propia para «🔀 Baraja» y para las playlists nuevas que crea el barajado: logo sobre un color de la paleta y la fecha y hora de la baraja, JPEG de 640×640 por debajo de 256 KB. Si falla, la baraja no falla (aviso discreto). Se puede desactivar en Ajustes. No se sube al barajar la propia playlist de otro modo.
- Descripción fija de «🔀 Baraja» en español e inglés.
- Pantalla «Tenerla siempre a mano»: cómo fijar la playlist (hasta 20 pines), por qué conviene sobrescribir siempre la misma y qué decide Spotify en Inicio.
- `QUOTA_EXCEEDED` de Spotify: se explica y no se reintenta.
- Logo nuevo («abanico de tres naipes», índigo, ámbar, coral y crema) y todos los iconos (SVG, favicon.ico, apple-touch-icon, 192, 512 y maskable). **En iPhone, para ver el icono nuevo hay que quitar la app de la pantalla de inicio y volver a añadirla.**
- Aviso de no afiliación ampliado («Spotify es una marca de Spotify AB») y apartado «Acerca de» en Ajustes.
- Auto-actualización: banner «Nueva versión disponible · Actualizar». La caché usa el hash del commit; sin `skipWaiting` automático; se busca versión nueva al volver a primer plano y cada hora; las cachés viejas se borran.
- Pages despliega solo desde `main` y solo si el CI pasa.

### Corregido

- Test e2e intermitente «barajar dos playlists combinadas»: la causa era una carrera del test, que daba por terminado el nuevo barajado al ver el texto «Listo» del resultado anterior mientras solo había llegado el primer bloque de 100 canciones. Ahora espera a que termine la tarea (`body.busy`). 100 repeticiones seguidas en verde con 4 workers.
- En la pestaña Copia aparecía el texto «null» bajo «Copia lista» cuando no había elementos omitidos. Las pantallas de resultado ya no pueden mostrar «null» ni «false».

## [1.0.0] - 2026-11-23

### Añadido

- PWA estática instalable (HTML, CSS y JavaScript vanilla, sin build ni dependencias de runtime) con service worker cache-first para los archivos de la app.
- Inicio de sesión con Spotify mediante Authorization Code con PKCE, sin client secret. Cada persona usa su propio Client ID. Guía en pantalla y Redirect URI copiable.
- Barajar una o varias playlists y Tus me gusta con Fisher-Yates, `crypto.getRandomValues` y muestreo por rechazo. Opción de quitar repetidas al combinar. Destino: playlist «🔀 Baraja», playlist nueva o la propia. Volver a barajar.
- Ordenar por fecha de lanzamiento, artista, álbum, título, duración, fecha de añadida o invertir. Atajo para copiar Tus me gusta a una playlist. Filtro por fecha de añadida. Destino: playlist nueva o sobrescribir la propia.
- Detección de duplicados en modo exacto (URI) e inteligente (ISRC, o título y artista). Quitar de la original o crear una copia limpia.
- Copia de seguridad en JSON y CSV, y restauración desde JSON a playlists nuevas.
- Deshacer la última operación que sobrescribe una playlist.
- Interfaz en español e inglés.
- Tests unitarios (`npm test`) y de extremo a extremo (`npm run test:e2e`).
- Documentación: README en español e inglés, CONTRIBUTING, PRIVACY e INVESTIGACION.

### Limitaciones conocidas

- Solo se leen playlists propias o colaborativas.
- Los archivos locales se omiten.
- Máximo 10.000 canciones por playlist.
- Spotify limita las apps en Development Mode a 5 usuarios y exige Premium al dueño.

[1.1.0]: https://github.com/JuandelMazoVazquez/new-spoti/releases/tag/v1.1.0
[1.0.0]: https://github.com/JuandelMazoVazquez/new-spoti/releases/tag/v1.0.0
