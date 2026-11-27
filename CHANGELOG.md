# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

Shuffl se llamó Baraja hasta la v1.2.0, y hasta la v1.4.0 el repositorio y la dirección eran `new-spoti`. Las entradas anteriores se dejan como se escribieron.

## [1.4.1] - 2026-11-27

Todo se llama Shuffl y usa la misma paleta: el repo, la dirección, la app, las playlists que crea y los medios.

### Cambiado

- **Dirección nueva: https://juandelmazovazquez.github.io/shuffl/** (el repo pasa a llamarse `shuffl`). La antigua redirige a la nueva con la misma ruta, la query (`?demo=1`, `?mezcla=`, `?origen=`) y el hash; si la redirección no funciona, avisa «Shuffl se ha mudado → nueva dirección» con el enlace.
  - **Hay que añadir la Redirect URI nueva** `https://juandelmazovazquez.github.io/shuffl/` en tu app del dashboard de Spotify (puedes dejar la antigua). Mientras no esté, la app lo detecta y enseña la URI para copiarla y los pasos.
  - Un inicio de sesión que vuelve de Spotify a la dirección antigua no se reenvía (el código va ligado a esa Redirect URI): la página avisa de que hay que conectar desde la nueva.
  - En iPhone, para tener la app instalada con la dirección nueva, quítala de la pantalla de inicio y vuelve a añadirla desde la dirección nueva.
- **Las playlists nuevas terminan en «· Shuffl»** (antes «· Shuffle»). Las que creó una versión anterior se siguen reconociendo y quitando como hasta ahora.
- **El almacenamiento pasa a `shuffl.*`**: al abrir la app, sesión, Client ID, mezclas, Deshacer y ajustes se copian solos de las claves antiguas y se borran las de antes. No hay que volver a iniciar sesión.
- **Una sola paleta** en `js/brand.js` (negro `#0B0B0B`, lima `#C6FF3D`, verde oscuro `#3D6B00` en claro), que usan el CSS, las portadas, «Tu resumen», la demo, los iconos y los medios del README. Guía de marca en `docs/BRAND.md`. Un test falla si aparece un color fuera de ella o un nombre antiguo fuera del historial.
- La página tiene metadatos Open Graph con la imagen de social preview.

## [1.4.0] - 2026-11-27

Lanzamiento como proyecto open source: se puede probar sin cuenta y el repositorio explica qué es, cómo empezar y cómo contribuir.

### Añadido

- **Modo demo**: «Probar la demo» en la bienvenida, o directamente `?demo=1`. Toda la app funciona con playlists, canciones y artistas inventados y carátulas generadas con formas y colores de Shuffl.
  - Una franja fija avisa «Modo demo · los cambios no se guardan en Spotify», con el botón «Conectar mi Spotify».
  - No hace ninguna petición a Spotify y no toca tu sesión, tus mezclas, tu Deshacer ni la caché de la app de verdad.
- **`npm run media`**: genera con el modo demo las capturas (oscuro y claro, español e inglés), 3 GIFs, el vídeo vertical para redes, la imagen de social preview y la cabecera del README, en `docs/media/`.
- **Archivos de comunidad**: CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1), SECURITY (avisos privados en GitHub) y plantillas de issues (fallo con el informe de Diagnóstico, idea) y de pull request.

### Cambiado

- **README nuevo** en español e inglés: qué problema resuelve, funciones con capturas, empezar en 5 minutos, requisitos y limitaciones, privacidad, cómo funciona por dentro (diagramas), preguntas frecuentes y cómo contribuir. El detalle de cada función pasa a `docs/FUNCIONES.md` y `docs/FEATURES.md`.
- Inicio pone la carátula de tu última baraja nada más cargar las playlists (antes salía el icono genérico hasta cambiar de pantalla).

## [1.3.2] - 2026-11-27

Que no falle nada con una cuenta real, mucha menos cuota de Spotify, el shuffle por tiempo a la vista y carátulas en todas las listas.

### Cambiado

- **Mucha menos cuota de Spotify**. Novedades pasa de unas 200 peticiones a 32, y ninguna acción normal pasa de 40 (tabla en `DECISIONES.md`).
  - Lo leído se guarda en el dispositivo (IndexedDB). Una playlist que no ha cambiado no se vuelve a leer, y Tus me gusta se comprueba con una sola petición.
  - Para no proponerte lo que ya tienes en Me gusta, solo se pregunta por las canciones candidatas.
  - Cada búsqueda de Novedades o Descubre se para tras unas 30 lecturas; «Buscar más» sigue donde se quedó. En «Más opciones» eliges cuántos artistas mira cada vez.
- **Si Spotify agota la cuota**, no se reintenta. Novedades y Descubre guardan lo conseguido si llega a 10 canciones, y el mensaje es claro: «Spotify limita cuántas búsquedas puede hacer la app. Vuelve a intentarlo en un rato.».
- **Shuffle por tiempo, a la vista**: «Toda la playlist / Por tiempo» bajo las playlists.
  - Accesos rápidos: 🚗 Trayecto 20 min, 🏋️ Gym 45, 🏃 Correr 30, ✈️ Viaje 90 y 😴 Dormir 30, o «A medida» de 5 a 180 min.
  - Nombres: «Gym 45 min · Shuffle» o «Rock · 45 min · Shuffle».
  - Las mezclas guardadas y los atajos de Siri lo recuerdan.
- **Reproducir ahora**:
  - Pone la playlist desde la primera canción, apaga el aleatorio y **comprueba** que suena así; si no, lo intenta otra vez y explica qué pasa.
  - Si el móvil no está activo: «Abre Spotify un momento y vuelve a pulsar», con «Abrir en Spotify».
  - Explica también: sin Premium, dispositivo que no se deja controlar, dormido, aleatorio que no se apaga u orden que Spotify no cumple.
- **Errores en palabras normales**: ningún código ni texto técnico, siempre con una acción («Reintentar», «Volver a conectar», «Abrir en Spotify»). Un fallo inesperado sale en un aviso, nunca una pantalla en blanco.
- **Olvidadas**: 100 al azar entre las olvidadas; «Volver a barajar» elige otras.
- «Comprobar conexión» pasa a Más → Diagnóstico.

### Añadido

- **Más → Diagnóstico**:
  - Peticiones de la sesión, del día y de cada acción.
  - **Prueba completa** con tu cuenta, paso a paso: sesión, leer, crear, sobrescribir y quitar una playlist de prueba, dispositivos y reproducción.
  - Registro de los últimos errores con «Copiar informe», sin nombres ni tokens.
- **Carátulas en todas las listas**: resultados, Novedades, Descubre, Olvidadas, Instantáneas, Tu resumen, Duplicados, Ordenar, Me gusta sin playlist y Dividir.
  - Enteras, a 48 px y en diferido, con un hueco del mismo tamaño mientras cargan.
- **Quitar canciones** del resultado deslizando a la izquierda (o con ×), y **tirar hacia abajo para volver a barajar**.
- Las carátulas del resultado se reparten como naipes, el fondo toma el color de la portada y los estados vacíos llevan una ilustración.

### Corregido

- En Descubre faltaban carátulas: los álbumes de lo que escuchas se pedían sin imagen.
- La carátula de Inicio ya no se recorta.

## [1.3.1] - 2026-11-27

Correcciones tras probar con Spotify real en el iPhone. **Hay que volver a conectar con Spotify una vez**: quitar playlists necesita dos permisos nuevos.

### Cambiado

- **Solo una playlist de Shuffl en tu cuenta.** Cada shuffle, Descubrir, Olvidadas, Instantánea o «Mi top» primero lee las canciones, después quita todas las playlists anteriores de Shuffl y por último crea la nueva.
  - Se reconocen por su etiqueta o, las antiguas, por su nombre y una descripción de una versión anterior.
  - Nunca se tocan las renombradas, las de otras personas, las colaborativas ni las que no tienen esa descripción.
  - Las playlists de Shuffl ya no se ofrecen como origen.
  - La primera vez se enseña la lista con «Borrar y no volver a preguntar»; después es automático, con un aviso. Se desactiva en Ajustes.
  - Lo quitado se recupera durante 90 días en spotify.com.
- **Cambio de pestaña limpio en iPhone**: sin View Transitions ni desplazamientos (solo un fundido de 120 ms), sin saltos de layout, y cada pestaña recuerda su scroll.
- **Inicio**: tarjeta con la carátula, el nombre y la fecha de la última baraja, con «Volver a barajar» y «Barajar otra cosa» (o «Empezar» la primera vez). El aviso de icono nuevo sale solo en Inicio y una vez.
- **Shuffle**: un solo modo; «Por tiempo» pasa a «Más opciones».
- **Novedades y Descubre**:
  - 30 canciones por defecto y «Buscar más» para añadir otras 30.
  - En «Más opciones», número (15-100) o duración (30-90 min).
  - Estilo: tus artistas, «Como mi playlist…» o un género (si Spotify da géneros).
  - Nunca salen canciones que ya tienes en tus playlists o en Tus me gusta.
- «Tenerla siempre a mano» explica que el pin no pasa a la playlist nueva.

### Añadido

- Pantalla «Barajando…» al instante, con los naipes y el paso real (leyendo, barajando, quitando las antiguas, creando, guardando).
- Resultado rediseñado:
  - Arriba, nombre de la playlist, canciones y duración, con «▶ Reproducir ahora» y «Abrir en Spotify».
  - La lista de canciones con la carátula del álbum, entera y a 48 px.
- Si quitar o crear falla, se ve el error real con «Reintentar» (las canciones siguen en memoria).
- «Comprobar conexión» prueba también que Shuffl puede quitar playlists.

### Corregido

- No se borraban las playlists antiguas: `DELETE /me/library` exige los permisos `user-library-modify` y `user-follow-modify`, que la app no pedía.

### Quitado

- «Tal día como hoy»: la API solo da las últimas 50 escuchas. En el ROADMAP queda hacerlo con el archivo de datos de Spotify.
- «Barajar por álbumes».

## [1.3.0] - 2026-11-26

### Cambiado

- **Navegación en 4 pestañas**: Inicio · Shuffle · Descubrir · Más.
  - Ordenar, Duplicados, Copia, Instantáneas, Me gusta sin playlist, Dividir, «¿Es aleatorio de verdad?», «Tenerla siempre a mano» y Ajustes están en Más.
  - Cada pantalla secundaria tiene «‹ Volver» arriba.
  - El engranaje de la cabecera desaparece.
- **Inicio**: un botón enorme «SHUFFLE», que vuelve a barajar tu última mezcla o te lleva a elegir qué barajar. Debajo, «Lo último» y tus mezclas guardadas.
- **Shuffle**: tipo de shuffle, origen y botón principal. Quitar repetidas, filtros, destino, pegar enlace y guardar mezcla están plegados en «Más opciones». «Elige por mí» está al final.
- **Una sola «· Shuffle» por origen en cualquier dispositivo**: cada playlist generada lleva al final de la descripción una etiqueta (` · shuffl:src=<hash>`).
  - Antes de crear o sobrescribir, Shuffl la busca entre tus playlists, así que cambiar de móvil, reinstalar o usar Safari y la app instalada ya no crea duplicadas.
  - El hash no contiene ids ni nombres.
  - Las «· Shuffle» de la v1.2 se reconocen por su nombre y su descripción y se etiquetan al reutilizarlas.

### Añadido

- **Limpieza de copias repetidas**: si hay varias «· Shuffle» del mismo origen, se queda la que se barajó más tarde y las demás se quitan de tu biblioteca (`DELETE /me/library`).
  - La primera vez pregunta («Hemos encontrado 3 copias de «Reggaeton · Shuffle». ¿Dejamos solo una?») y explica que se pueden recuperar durante 90 días en spotify.com.
  - Hay opción de hacerlo siempre sin preguntar, también en Ajustes.
  - Las renombradas no se tocan nunca. La antigua «🔀 Baraja» se ofrece quitar, siempre con confirmación.
  - Si quitar falla no se pierde nada y se avisa.
- **Shuffle por tiempo**: 15, 30, 45, 60 min o los que quieras (de 5 a 600). Se baraja de forma uniforme y se llena el tiempo con un margen de ±2 min («35 min · Shuffle»).
- **Shuffle por álbumes**: de tus playlists o de tus álbumes guardados. El orden de los álbumes es aleatorio y cada álbum suena entero y en su orden («Rock · Álbumes · Shuffle»).
- **Descubrir**:
  - **Novedades**: lanzamientos de los últimos 7, 30 o 90 días de tus artistas más escuchados y de los que sigues, sin lo que ya tienes guardado.
  - **Descubre**: canciones nunca guardadas de los álbumes que escuchas últimamente.
  - **Tal día como hoy**: lo que guardaste este mes en años anteriores, por año y con un recuerdo («En noviembre de 2024 te enganchaste a…»).
  - **Olvidadas**: Me gusta de hace más de 1, 2, 3 o 5 años.
  - **Tu resumen**: tus 5 artistas y canciones top (4 semanas, 6 meses o siempre) en una tarjeta vertical (1080×1920) y otra cuadrada para compartir, con las carátulas sin tocar y el logo de Spotify. Puedes crear «Mi top · Shuffle».
  - Cada opción crea su propia «· Shuffle» reutilizable, con portada y «Reproducir ahora». Lo que se lee de Spotify se guarda 24 h en el dispositivo para gastar menos peticiones.
- Las mezclas guardadas recuerdan el tipo de shuffle (también para Siri y agitar).

### No incluido

- «Similares» (artistas parecidos con MusicBrainz y ListenBrainz): no se puede hacer bien desde el navegador. Ver [ROADMAP.md](ROADMAP.md).

## [1.2.0] - 2026-11-26

**Baraja pasa a llamarse Shuffl.** El repositorio y la dirección de GitHub Pages no cambian, así que la Redirect URI sigue siendo la misma. En iPhone, para ver el icono nuevo hay que quitar la app de la pantalla de inicio y volver a añadirla (la app lo avisa una vez).

### Cambiado

- **Nombre, icono y aspecto**: icono de tres naipes en abanico, lima sobre negro, en todos los tamaños. Paleta negro y verde lima (#C6FF3D) en el tema oscuro y blanco con verde oscuro (#3D6B00, AA) en el claro, con la lima solo en superficies grandes. Componentes propios: esquinas rectas, botón principal con sombra dura y brillo, etiquetas en monoespaciada. El color dinámico de la portada es más sutil.
- **Playlists generadas**: ya no se usa «🔀 Baraja». Cada origen tiene su propia playlist, que se reutiliza y se sobrescribe: «Reggaeton · Shuffle», «Tus me gusta · Shuffle», «Mix · Shuffle» (varias playlists; la descripción las lista), «Coche · Shuffle» (mezcla guardada) y «Toda mi música · Shuffle». La correspondencia origen → playlist se guarda en el dispositivo; si el origen cambia de nombre, la generada se renombra en la siguiente baraja (`PUT /playlists/{id}`), y si desaparece se crea otra.
- **Portada** de las playlists generadas: icono de Shuffl, nombre del origen y fecha.
- Las copias de seguridad se guardan como `shuffl-…json`; las de Baraja se siguen pudiendo restaurar.

### Añadido

- **Migración**: la antigua «🔀 Baraja» no se borra ni se vuelve a escribir; un aviso único explica que se puede borrar a mano.
- **Siri y atajos**: enlaces `?mezcla=<id>&play=1` y `?origen=<id de playlist>&play=1` que rebarajan y reproducen. Solo con sesión válida, si la mezcla o la playlist existen en ese navegador, y siempre en la playlist «· Shuffle»; sin la clave del navegador que llevan los atajos, piden confirmación. Cada mezcla guardada tiene «Crear atajo de Siri» con el enlace y los pasos para la app Atajos.
- **Coche**: la ayuda explica que CarPlay no admite apps web y que las playlists «· Shuffle» aparecen en Spotify dentro de CarPlay.
- **Agitar para barajar** en Inicio (siempre con confirmación; permiso del acelerómetro con un toque en iOS; se desactiva en Ajustes).
- **Elige por mí**: una ruleta elige de forma uniforme una de tus playlists y la baraja.
- **¿Es aleatorio de verdad?**: simulación de 10.000 barajas en el dispositivo con gráfico de barras animado y tabla, comparando el barajado de Shuffl con uno sesgado.
- **Animaciones**: transiciones entre pantallas con View Transitions, celebración discreta al terminar; nada de ello con «reducir movimiento».
- Test que exige que todos los módulos de `js/` estén en la caché del service worker.

## [1.1.1] - 2026-11-24

### Añadido

- **Logo oficial de Spotify** junto a carátulas y metadatos: en los selectores de playlists, la pantalla de resultado, la lista de duplicados y la hoja de playlists de otras personas. Se usa el logo completo sin modificar del kit de marca de Spotify (blanco en tema oscuro, negro en claro) a 88 px de ancho, con zona de seguridad de 12 px y enlazado a Spotify.

### Corregido

- El botón «Actualizar» del banner de versión nueva no se podía pulsar durante una tarea (quedaba desactivado como el resto); ahora responde y avisa de que hay que terminar la tarea antes de actualizar.

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

[1.1.0]: https://github.com/JuandelMazoVazquez/shuffl/releases/tag/v1.1.0
[1.0.0]: https://github.com/JuandelMazoVazquez/shuffl/releases/tag/v1.0.0
