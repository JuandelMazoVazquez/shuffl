# Investigación: quejas y sugerencias de usuarios de Spotify (2025-2026) para Baraja

Fecha de la investigación: 2026-11-23.

## Cómo leer este documento

- [literal]: texto o dato copiado de la fuente tal cual lo devolvió la herramienta.
- [resumen]: lo devolvió WebSearch o WebFetch, que es un resumen hecho por un modelo, no el texto original. Si un dato [resumen] es crítico, hay que contrastarlo descargando el original antes de usarlo. Todas las cifras de votos son [resumen].
- Clases: (A) resoluble con la API de Development Mode y encaja; (B) posible pero grande, versión posterior; (C) imposible o fuera de control.
- "Cubierta" = ya está en las funciones base decididas.

## Limitaciones de la investigación (no verificado)

- Reddit r/spotify: WebFetch está bloqueado para reddit.com ("Claude Code is unable to fetch from www.reddit.com"). No hay hilos de Reddit leídos directamente. Solo hay citas de Reddit de segunda mano, en prensa (BGR, Android Authority vía WebSearch).
- App Store y Google Play: no consultados. Trustpilot: solo a través de un resumen de búsqueda, sin abrir reseñas.
- Páginas de listado de Spotify Community "más votadas" (`/tab/most-kudoed`): WebFetch devolvió 404. No hay ranking oficial de votos. El orden de abajo se basa en cifras de votos que aparecieron en resúmenes de búsqueda, en el tamaño de los hilos y en cuántas fuentes independientes repiten la queja. Es orden aproximado, no un ranking medido.
- androidauthority.com: WebFetch devolvió 403. Sus datos son solo [resumen] de WebSearch.
- Cifras de votos en Community: los resúmenes mostraron valores distintos para la misma idea en capturas distintas. Son [resumen] y no contrastadas.

## Restricciones de la API usada (fuente primaria)

Fuente: [Guía de migración febrero 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) ([resumen] de WebFetch; contrastar con el original) y [Changelog febrero 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) (solo aparece como resultado de búsqueda, no abierto).

- Eliminados [resumen]: GET /tracks, /albums, /artists (lotes); GET /browse/new-releases, /browse/categories; GET /artists/{id}/top-tracks; GET /users/{id}, /users/{id}/playlists; POST /users/{user_id}/playlists; GET /markets; los endpoints de guardar/seguir específicos como PUT /me/tracks.
- Sustitutos [resumen]: PUT/DELETE /me/library, GET /me/library/contains, POST/GET/DELETE/PUT /playlists/{id}/items, GET/POST /me/playlists.
- "Playlist contents (`items`) are only returned for playlists the user owns or collaborates on." [literal, vía resumen de WebFetch]
- Límites Development Mode [resumen]: el dueño de la app necesita Premium activo; 5 usuarios por app nueva; 1 Client ID por desarrollador (el resumen dice que una actualización de julio 2026 lo subió a 25).
- Cronología dudosa [resumen de WebSearch]: el blog oficial fija el 11 de febrero (apps nuevas) y el 9 de marzo (existentes); un hilo posterior de Community dice que se pospone el cambio de endpoints para integraciones existentes. Fuentes: [blog oficial](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), [hilo de actualización](https://community.spotify.com/t5/Spotify-for-Developers/February-2026-Spotify-for-Developers-update-thread/m-p/7331973/highlight/true). No verificado cuál es el estado actual.
- Nota de diseño: el producto necesita Premium del dueño de la app y máximo 5 usuarios. Esto limita cualquier idea de distribución abierta (no verificado qué implica para una PWA pública).

## Quejas y sugerencias, ordenadas por volumen aproximado

### 1. Shuffle no es aleatorio / repite siempre las mismas canciones
- Hilo "[All Platforms] Option to have a true shuffle": la idea de shuffle más larga que apareció; las URLs de Implemented Ideas llegan a la página 199 [resumen]. Fuentes: [hilo (Implemented Ideas)](https://community.spotify.com/t5/Implemented-Ideas/All-Platforms-Option-to-have-a-true-shuffle/idi-p/4880594/page/199), [respuesta en Live Ideas](https://community.spotify.com/t5/Live-Ideas/All-Platforms-Option-to-have-a-true-shuffle/idc-p/7142068/highlight/true). Estado: aparece en las dos secciones (Live e Implemented); no verificado cuál es el estado actual.
- "Implement an actual shuffle function": más de 850 votos, [resumen]. [Enlace](https://community.spotify.com/t5/Implemented-Ideas/Implement-an-actual-shuffle-function/idc-p/1567457/highlight/true).
- Prensa, 2025-2026:
  - Vice, 13 nov 2025, [resumen de WebFetch]: Spotify dice que su shuffle era aleatorio (Mersenne Twister) y añade "Fewer Repeats" para que "feel more fair" y "more fresh". [Artículo](https://www.vice.com/en/article/spotify-shuffle-fewer-repeats).
  - BGR, 20 jul 2026, [resumen de WebFetch]: un usuario de Reddit con 1.500 canciones dice "hear the same 30 songs five days a week"; el autor no notó mejora con Fewer Repeats tras meses. [Artículo](https://www.bgr.com/2216137/most-common-customer-complaints-about-spotify/).
  - Android Authority, [resumen de WebSearch]: un usuario de Reddit vio una secuencia exacta de 72 canciones repetida dos días seguidos en una playlist de 2.000. [Artículo](https://androidauthority.com/spotify-shuffle-repeating-song-queue-3708815).
- Clase: (A). Cubierta (barajado uniforme que reescribe el orden guardado de la playlist).

### 2. Smart Shuffle: quejas de que mete canciones y no se puede quitar
- Hilo "Introducing Smart Shuffle" con más de mil respuestas, la mayoría pidiendo un interruptor para desactivarlo [resumen de WebSearch]. [Enlace](https://community.spotify.com/t5/Your-Library/Introducing-Smart-Shuffle/td-p/5516566/page/47).
- Idea implementada: interruptor de Smart Shuffle en ajustes, [Implemented Ideas](https://community.spotify.com/t5/Implemented-Ideas/Mobile-Other-Smart-Shuffle-toggle-setting-in-settings-menu/idc-p/6688170/highlight/true).
- Clase: (C), es comportamiento del reproductor, fuera del control de Baraja. El valor indirecto es que una playlist reordenada de verdad evita depender del shuffle del cliente (cubierto por el punto 1).

### 3. Ordenar playlists por fecha de lanzamiento y más criterios
- "[Playlists] Sort by Release Date": unos 1.550 votos (capturas con 1561 y 1554), [resumen]. Sin respuesta oficial encontrada. [Enlace](https://community.spotify.com/t5/Live-Ideas/Playlists-Sort-by-Release-Date/idi-p/757687).
- "More Playlist Sorting Options/Columns": 843 votos [resumen; el propio resumen avisa de que la asignación de cifras es incierta]. [Enlace](https://community.spotify.com/t5/Live-Ideas/Playlists-More-Playlist-Sorting-Options-Columns/idc-p/4865466).
- Trustpilot 2026, [resumen de WebSearch]: una reseña de 1 estrella señala que no hay orden por fecha de lanzamiento en playlists. [Listado](https://www.trustpilot.com/review/www.spotify.com?page=9). No abierta la reseña concreta.
- Clase: (A). Cubierta (fecha lanzamiento, artista, álbum, título, duración, fecha añadida).

### 4. Ordenar / ordenar a mano Tus me gusta
- "Custom Sort option for Liked Songs": muchos hilos pidiendo orden personalizado [resumen]. [Enlace](https://community.spotify.com/t5/Live-Ideas/Custom-Sort-option-for-Liked-Songs/idc-p/6833737/highlight/true).
- "Sort liked songs by release year": [enlace](https://community.spotify.com/t5/Live-Ideas/Sort-liked-songs-by-release-year/idc-p/6949317/highlight/true).
- Clase: (A) mediante "copiar Tus me gusta a playlist reordenable". Cubierta.
- Idea relacionada ya implementada en 2025 [resumen]: conservar orden y filtros con Smart Shuffle activo ([enlace](https://community.spotify.com/t5/Implemented-Ideas/Keep-the-sort-and-filter-options-when-Smart-Shuffle-Enhance-is/idc-p/5587580)), implementada el 2025-05-16 según el resumen.

### 5. Detectar y eliminar duplicados
- "[All Platforms] Consolidate duplicates": abierta desde 2014 según un usuario citado; 26+ páginas de comentarios; Spotify la cerró una vez "to keep the Ideas Exchange clearer" sin rechazarla [resumen de WebSearch, con citas entre comillas del resumen]. [Enlace](https://community.spotify.com/t5/Live-Ideas/All-Platforms-Consolidate-duplicates/idi-p/4829023/highlight/true/page/26).
- Otras ideas vivas: [Please Add Duplicate Detection](https://community.spotify.com/t5/Live-Ideas/Please-Add-Duplicate-Detection/idi-p/7344101), [Enable Auto-Removal of Duplicate Songs](https://community.spotify.com/t5/Live-Ideas/Enable-Auto-Removal-of-Duplicate-Songs/idi-p/6756866).
- Matiz [resumen]: unos piden tratar como duplicados single/álbum/remaster; otros quieren mantener live/remix. El aviso nativo solo detecta duplicados exactos del mismo álbum.
- Herramientas open source que lo ofrecen: [spotimy](https://github.com/court-jus/spotimy) ("Remove duplicates: keeps one copy", [resumen]); Spotify Toolkit con "Smart Duplicate Finder" ([DEV](https://dev.to/darksaces/show-dev-spotify-toolkit-a-python-customtkinter-app-to-manage-playlists-and-clean-duplicates-1bg7), [resumen de búsqueda]).
- Clase: (A). Cubierta (exacto/inteligente).

### 6. Copia de seguridad / exportar playlists
- "[Music] Import & Export Music": petición larga (formatos PDF, TXT, JSON), última actualización marzo 2023 [resumen]. [Enlace](https://community.spotify.com/t5/Live-Ideas/Music-Import-amp-Export-Music/idi-p/37543/page/14). Mismo hilo aparece también en [Closed Ideas](https://community.spotify.com/t5/Closed-Ideas/Music-Import-amp-Export-Music/idi-p/37543); no verificado su estado actual.
- Hilo de foro "Export Playlist Backup": [enlace](https://community.spotify.com/t5/Desktop-Windows/Export-Playlist-Backup/td-p/369752).
- Herramientas: Exportify (CSV, [resumen de búsqueda]); [khrj/music-backup](https://github.com/khrj/music-backup) (README, [resumen de WebFetch]: respalda Tus me gusta conservando el orden, álbumes, playlists, artistas; nota "Quick restore causes liked songs to lose order. Playlists are always ordered correctly."); [harisekhon/spotify](https://github.com/harisekhon/spotify) (backup con URIs para restaurar, [resumen de búsqueda]).
- Lagunas citadas por usuarios [resumen]: no incluyen carpetas, a veces faltan playlists colaborativas.
- Clase: (A) para playlists propias/colaborativas y Tus me gusta. Cubierta. Nota de diseño derivada de music-backup: al restaurar Tus me gusta hay que insertar en orden cronológico inverso, uno a uno, para preservar "fecha añadida"; no verificado si PUT /me/library respeta ese orden en la práctica.
- Parte (C): backup de playlists ajenas (la API solo devuelve items de propias/colaborativas) y de carpetas (no hay endpoint de carpetas en la lista).

### 7. Deshacer cambios en playlists / volver a una versión anterior
- Live Idea para revertir playlists a una versión anterior, citada por un moderador en el hilo [How do I undo AI updates to playlist](https://community.spotify.com/t5/Content-Questions/How-do-I-undo-ai-updates-to-playlist/m-p/7430429) [resumen]. Sugerencia aparte de un botón de deshacer siempre disponible; no hay constancia de que se haya lanzado.
- Clase: (A) para lo que Baraja modifique (copia previa + deshacer). Cubierta. Deshacer cambios hechos por otras apps o por Spotify: (C).

### 8. "Add a Shuffle Playlist Order button" (reordenar el orden guardado)
- Idea viva que pide "shuffle playlist order, save new order, undo shuffle, and shuffle again" para playlists grandes [resumen de WebFetch; votos y fecha no visibles]. [Enlace](https://community.spotify.com/t5/Live-Ideas/Add-a-Shuffle-Playlist-Order-button/idi-p/7465416).
- Un comentario pide una "classic elimination shuffle" para no oír solo las primeras ~30 de 200.
- Open source equivalente: [Shufflify](https://github.com/asdwerte1/Shufflify) (reordena aleatoriamente, Docker, sin issues listados [resumen]); [Spoofy](https://github.com/noahc3/Spoofy) (0 issues abiertas [resumen]); [spotify-playlist-utility](https://github.com/ryanwarrick/spotify-playlist-utility/) (archivar, restaurar y barajar, [resumen de búsqueda]).
- Clase: (A). Cubierta (barajado + deshacer).

### 9. Fusionar playlists
- "Merge playlists": [idea viva](https://community.spotify.com/t5/Live-Ideas/Merge-playlists/idi-p/7555035) y [Temporary Playlist Merging](https://community.spotify.com/t5/Live-Ideas/Temporary-Playlist-Merging/idi-p/7534946). Una idea antigua ya implementada permite "Add to other playlist" [resumen de WebSearch; no abierto el hilo], pero copia sin deduplicar ni ordenar.
- Clase: (A). No cubierta.

### 10. Tus me gusta enorme: shuffle roto, listas grandes, dividir
- Hilos de foro [resumen de WebSearch]: 1.500 canciones que producían una lista condensada de menos de 50; Smart Shuffle con 3.000 canciones sin responder; el personal del foro sugiere dividir listas grandes en playlists más pequeñas, y un usuario dijo que copiar Tus me gusta a una playlist normal le arregló el problema. Enlaces: [Shuffle function Liked Songs](https://community.spotify.com/t5/Android/Shuffle-function-Liked-Songs/m-p/5359831), [Songs repeated too often in Liked Songs](https://community.spotify.com/t5/Your-Library/Songs-repeated-too-often-in-Liked-Songs/td-p/5378714), [Smart shuffle breaks...](https://community.spotify.com/t5/Android/Smart-Shuffle-breaks-the-ability-to-select-certain-songs-in/m-p/7107612/highlight/true).
- Clase: (A). Cubierta por "copiar Tus me gusta a playlist" + barajado. El troceo en varias playlists no está cubierto (ver extras).

### 11. Reproducir / filtrar Tus me gusta por rango de fechas añadidas
- Idea viva "Play songs within a specific date range when they were added to...": [enlace](https://community.spotify.com/t5/Live-Ideas/Play-songs-within-a-specific-date-range-when-they-were-added-to/idi-p/6713576) (solo título leído en búsqueda; contenido y votos no verificados).
- Clase: (A) como "crear playlist desde Tus me gusta filtrando por fecha añadida". No cubierta.

### 12. Reglas de ordenación en carpetas / carpetas y portadas
- Trustpilot [resumen]: una reseña dice que no se pueden añadir álbumes a carpetas ni poner imagen a carpetas. Ongoing Issues de abril 2026: "Custom Order sorting inside folders" arreglado ([literal del resumen de WebFetch]). [Abril 2026](https://community.spotify.com/t5/Community-Blog/Ongoing-Issues-Review-April-2026/ba-p/7423811).
- Clase: (C). No hay endpoints de carpetas en la lista permitida.

### 13. Ordenar por reproducciones, género, BPM/energía, popularidad
- "New Sort for Playlist: MOST PLAYED" y "Sort Playlist by Most/Least played by user": ideas vivas, estado "New Suggestion" (2023-10-04) [resumen]. [Enlace](https://community.spotify.com/t5/Live-Ideas/New-Sort-for-Playlist-MOST-PLAYED/idc-p/6854424/highlight/true), [enlace](https://community.spotify.com/t5/Live-Ideas/Sort-Playlist-by-Most-Least-played-by-user/idi-p/5646553).
- Herramienta [brenordv/spotify-playlist-sorter](https://awesome.ecosyste.ms/projects/github.com%2Fbrenordv%2Fspotify-playlist-sorter) ordena por popularidad, tempo, energía y tono [resumen de búsqueda].
- Clase: (C). Sin audio-features, popularidad ni historial de escuchas en la API permitida. Género: el endpoint de artistas por lotes está eliminado; no verificado si GET /artists/{id} sigue disponible, y en cualquier caso no está en la lista permitida.

### 14. Recomendaciones repetitivas / Discover Weekly con canciones ya guardadas
- BGR, 20 jul 2026 [resumen]: [artículo](https://www.bgr.com/2216137/most-common-customer-complaints-about-spotify/).
- Clase: (C). Sin recomendaciones en la API.

### 15. Fallos del cliente (Tus me gusta vacío, "Make this a playlist" duplica Tus me gusta, etc.)
- Ongoing Issues Review, abril 2026 [resumen de WebFetch]: "Make this a playlist" copia todos los Tus me gusta en lugar de lo seleccionado (en investigación); Tus me gusta vacío en varios dispositivos (arreglado); ordenar la biblioteca por año de lanzamiento rompía la biblioteca (arreglado). [Enlace](https://community.spotify.com/t5/Community-Blog/Ongoing-Issues-Review-April-2026/ba-p/7423811). Revisiones de [enero](https://community.spotify.com/t5/Community-Blog/Ongoing-Issues-Review-January-2026/ba-p/7321393/highlight/true), [febrero](https://community.spotify.com/t5/Community-Blog/Ongoing-Issues-Review-February-2026/ba-p/7358392/highlight/true), [marzo](https://community.spotify.com/t5/Community-Blog/Ongoing-Issues-Review-March-2026/ba-p/7390649/highlight/true) y [mayo](https://community.spotify.com/t5/Community-Blog/Ongoing-Issues-Review-May-2026/ba-p/7443262) no abiertas.
- Clase: (C), bugs del cliente. Dato útil: el shuffle nativo excluye duplicados a propósito ("Shuffle removes duplicate tracks to avoid accidental repetition", [resumen]).

### 16. Playlists curadas que pierden canciones por licencias
- Reseña de 1-3 estrellas 2026 [resumen de WebSearch; fuente comercial, método poco claro]: [artículo](https://unstar.app/th/blog/spotify-apple-music-youtube-music-amazon-tidal-music-streaming-apps-ranked-2026).
- Clase: (C) para playlists de Spotify. Para las propias, la copia de seguridad cubre la parte útil.

## Qué ofrecen y qué echan de menos en proyectos open source parecidos

- Ninguna herramienta encontrada hace ordenar, barajar, duplicados y backup a la vez [resumen de WebSearch]. Esa es la propuesta de Baraja.
- Casi todas son CLI/Docker/Python y exigen registrar una app de desarrollador y credenciales [resumen]. Baraja como PWA sin servidor reduce esa fricción, aunque el modo Development Mode (Premium, 5 usuarios) sigue imponiendo límites.
- [spotimy](https://github.com/court-jus/spotimy) [resumen de WebFetch]: "Sort library" (pistas de Tus me gusta que no están en ninguna playlist), "Save Discover", barajar, quitar duplicados. Limitación declarada: "probably full of bugs and missing features", sin GUI.
- [itzTerra/SpotifyTools](https://www.github.com/itzTerra/SpotifyTools): encontrar pistas comunes entre dos playlists y backup JSON [resumen de búsqueda].
- [Festune](https://github.com/Martiusweb/festune): ordenar, duplicados en un subconjunto de playlists y "rotating playlist" con pistas recientes [resumen de búsqueda].
- [Spoofy](https://github.com/noahc3/Spoofy): barajado permanente con espaciado por artista (propuesta prohibida para Baraja).
- No encontré issues de usuarios (feature requests) en los repos revisados: Shufflify y Spoofy mostraron 0 issues; spotimy muestra 3 sin contenido leído; music-backup no se revisó en issues. Por tanto, "lo que echa de menos la gente" en GitHub: no verificado. Lo que sí documentan los README son sus propias limitaciones (restauración de orden de Tus me gusta, carpetas y colaborativas ausentes en backups).

## (A) NO cubiertas por las funciones base, con más valor (máximo 5, sencillas)

1. Fusionar playlists (varias propias en una nueva), con deduplicado y orden elegible. Apoyo: idea viva de fusión (punto 9). Endpoints: GET items, POST /me/playlists, POST items.
2. Crear playlist desde Tus me gusta filtrando por rango de fecha añadida (y opcionalmente por año de lanzamiento). Apoyo: punto 11. Endpoints: GET /me/tracks, crear playlist, añadir items.
3. Dividir una playlist o Tus me gusta en varias de N canciones (o por año de lanzamiento). Apoyo: punto 10, el personal del foro lo recomienda como solución para listas grandes. Endpoints: los mismos.
4. "Tus me gusta que no están en ninguna de mis playlists": generar una playlist con ellas. Apoyo: función "Sort library" de spotimy (punto de proyectos open source). Solo ve playlists propias/colaborativas; avisar de que las ajenas no cuentan.
5. Operaciones de conjunto entre dos playlists propias (comunes, solo en A) para crear una nueva. Apoyo: itzTerra/SpotifyTools (comunes entre playlists). Evidencia de demanda más débil que las otras cuatro: es solo [resumen de búsqueda] de un repo sin issues leídos.

## (B) para ROADMAP (posibles pero grandes)

- Biblioteca de "instantáneas" con historial de versiones por playlist y comparación entre versiones (apoyo: idea de revertir versión, punto 7; cubierto solo en parte por backup y deshacer).
- Reglas guardadas y reutilizables (p. ej., "ordenar por artista y luego álbum" con varios criterios encadenados, plantillas de fusión/troceo). Sin cita directa de usuarios; es una extensión de los puntos 3, 9 y 10. No verificado como demanda real.
- Modo sin conexión (PWA con caché de snapshots) para consultar backups. Sin cita de usuarios; no verificado como demanda.

## Descartado por (C) o por prohibido

- Shuffle del reproductor (Smart Shuffle, Fewer Repeats): comportamiento del cliente.
- Carpetas, ordenar por reproducciones, popularidad, BPM, género, recomendaciones, Discover: sin endpoint permitido.
- Reprogramar barajado automático periódico: requiere servidor.
- Prohibidos por el encargo: excluir escuchas recientes, separar artistas.
