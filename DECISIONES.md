# Decisiones tomadas

Trabajo hecho sin supervisión el 2026-11-23. Todo lo reversible lo decidí yo; lo demás está en [docs/bandeja.md](docs/bandeja.md).

## v1.4.0 (2026-11-27): repo listo para el lanzamiento open source

### Modo demo

- **Un Spotify inventado dentro de la app** (`js/demo.js`), inyectado en `SpotifyApi` como `fetchImpl`. Responde a las mismas rutas que la Web API (paginación, 403 en playlists ajenas, 404 en lo desconocido), así que la demo ejecuta el código real de barajar, Descubrir, Resumen o Reproducir ahora y no una maqueta. Descartado: datos estáticos por pantalla (habría que mantener dos apps).
- **Ninguna petición a la red**: `demoFetch` nunca llama a `fetch`. Un test e2e corta y cuenta cualquier petición a `spotify.com`, `scdn.co` o `spotifycdn.com` durante la demo: tienen que ser cero.
- **Datos inventados con semilla**: 36 artistas, 108 discos, 160 Me gusta y 8 playlists (una colaborativa y otra ajena, para que se vean los casos reales), siempre iguales para que las capturas sean estables. Los nombres los escribí yo (combinaciones como «Luces lentas»); los géneros son genéricos. En inglés salen los nombres de las playlists y las canciones en inglés.
- **Carátulas generadas**: SVG de 100×100 con 8 patrones (anillos, franjas, puntos, sol, ecualizador, triángulos, luna, naipes) y solo colores de Shuffl, como dirección `data:image/svg+xml`. Para que la app las pinte, las comprobaciones de «solo https» pasan a `isImageUrl` (https o `data:image/svg+xml,`). Un SVG dentro de `<img>` no ejecuta scripts ni carga recursos, así que no abre ningún hueco aunque Spotify devolviera uno; `data:text/html` y `javascript:` siguen rechazados (test).
- **Aislada de la app de verdad**: `setVolatile()` en `storage.js` hace que todo vaya a memoria y que no se lea nada guardado (sesión, mezclas, Deshacer), salvo idioma y tema; `idbVolatile()` deja la caché de IndexedDB solo en memoria. Probado en e2e con una sesión real guardada: la demo no la usa ni la cambia.
- **`?demo=1` se queda en la dirección** para que recargar siga en la demo; «Conectar mi Spotify» va a la dirección sin parámetros. En Ajustes no salen Client ID ni Redirect URI y «Cerrar sesión» pasa a «Conectar mi Spotify».
- **Sin logo de Spotify en la demo**: nada de lo que se ve viene de Spotify, así que la atribución se oculta. «Abrir en Spotify» y compartir explican que las playlists son inventadas, en vez de abrir una página rota.
- **Inicio con contenido**: dos mezclas de ejemplo (una por tiempo, Gym 45) y una «última baraja», para que la primera pantalla enseñe la app y no un estado vacío.
- **Arreglo de paso**: Inicio se pintaba antes de cargar las playlists y la «última baraja» salía con el icono genérico; ahora se vuelve a pintar al terminar la carga (en la app de verdad también).

### Medios (`npm run media`)

- **Un script** (`scripts/media.mjs`) con Playwright y el modo demo, servidor propio en un puerto libre. Así ningún medio lleva datos reales y se regeneran tras cada cambio de interfaz.
- **Capturas** a 390×844 con escala x2 (780×1688), en oscuro y claro y en español e inglés: 32 PNG. Escogí x2 y no x3 por peso (unos 150 KB cada una frente a más del doble).
- **GIFs** grabados a 390×844 y pasados a 360 px, 12 fps y paleta de 96 colores con `palettegen`/`paletteuse` (dither bayer): entre 1,4 y 2,4 MB, por debajo de los 5 MB pedidos. Si uno pasara de 5 MB, el script repite con menos fps y ancho.
- **Vídeo vertical 1080×1920** de unos 16-17 s (H.264, `faststart`, sin audio): el móvil dentro de un marco, con el nombre y el eslogan arriba y la dirección abajo. Playwright graba en píxeles CSS, así que para que sea nítido se graba con el viewport al doble y `zoom: 2` en la página (la app sigue viendo 390 px). Los toques se ven como un círculo lima.
- **ffmpeg** no es una dependencia del repo: el script lo busca en el PATH o en `FFMPEG` y, si no está, genera solo las imágenes. Lo instalé en el equipo con winget (`Gyan.FFmpeg`). Descartado `ffmpeg-static` como devDependency: haría bajar unos 70 MB en cada `npm ci` del CI.
- **Social preview y cabecera** en los dos idiomas, renderizadas desde HTML con las capturas dentro de un móvil dibujado con CSS.
- `docs/capturas/` se queda: la generan los tests e2e con el Spotify simulado y la usa `docs/FUNCIONES.md`.

### README y comunidad

- **README corto y visual**, y el detalle de cada función en `docs/FUNCIONES.md` / `docs/FEATURES.md` (el contenido del README anterior, sin perder nada).
- **Botones grandes** con badges de shields.io (GitHub no permite estilos en el README). «Probar la demo» enlaza a `?demo=1` y «Usar con mi Spotify», a la guía de 5 minutos.
- **«El problema»** sin afirmar lo que no está verificado: que el aleatorio de Spotify no es una baraja comprobable, que «Fewer Repeats» favorece a propósito lo menos escuchado y que Smart Shuffle añade recomendaciones (fuentes en INVESTIGACION.md).
- **Premium**: el README dice lo verificado (Premium para la cuenta dueña del Client ID y para Reproducir ahora). No afirmo que las cuentas añadidas sin Premium puedan barajar porque no lo he probado.
- **Comunidad**: CONTRIBUTING y SECURITY bilingües; CODE_OF_CONDUCT con el texto oficial en inglés del Contributor Covenant 2.1. Para denunciar una conducta, el aviso privado de GitHub (no hay email público del proyecto y no publico el tuyo). Las plantillas de issue son formularios YAML; los issues en blanco se desactivan y las preguntas van a Discussions.
- **Issues para contribuidores**: 5 sacados del ROADMAP, con `good first issue` los que se hacen sin conocer todo el código y `help wanted` los más grandes.

### Revisión de datos personales

- Busqué en el árbol y en el historial tokens, Client IDs de 32 caracteres hexadecimales, emails y rutas locales. El único Client ID es el de mentira de los tests (`0123456789abcdef…`). Las capturas de `docs/capturas` usan el Spotify simulado y las de `docs/media`, la demo. El email de autor de los commits es el de tu cuenta de GitHub y ya era público en el historial.

## v1.3.2 (2026-11-27): cero errores, cuota bajo control, shuffle por tiempo y carátulas en todas partes

### Cuota: peticiones por acción

Lo mide `tests/e2e/quota.spec.mjs` con una cuenta simulada de tamaño realista: 16 playlists (una de 600 canciones), 1500 Me gusta, 50 artistas top por periodo, 120 seguidos y lanzamientos para 120 artistas. Cuenta todas las peticiones a `api.spotify.com`, reintentos incluidos.

| Acción | Antes (v1.3.1) | Ahora (v1.3.2) |
|---|---|---|
| Arranque (login y biblioteca) | 3 | 3 |
| Shuffle de una playlist de 600 (1.ª vez) | 22 | 21 |
| Shuffle de la misma playlist otra vez | 24 | 11 |
| Volver a barajar | 9 | 8 |
| Reproducir ahora | 3 | 4 (con la comprobación) |
| Novedades (1.ª vez) | **202** | 32 |
| Buscar más | 2* | 13 |
| Descubre (después de Novedades) | 18 | 23 |
| Descubre (1.ª vez, sin caché) | — | 25 |
| Instantánea | 7 | 6 |
| Tu resumen | 2 | 2 |
| Tu resumen → playlist | 7 | 6 |
| Olvidadas (1.ª vez, 1500 Me gusta) | 51* | 37 (31 son leer Me gusta) |
| Olvidadas (2.ª vez) | 21* | 7 |
| Comprobar conexión | — | 6 |
| Prueba completa (con reproducción) | — | 14 |

\* Olvidadas antes: medido con esta versión antes del tope de 100 (la v1.3.1 leía igual Me gusta y escribía todas). En la v1.3.1 «Buscar más» salía barato porque la primera búsqueda ya había leído 25 artistas de golpe; ahora cada búsqueda lee como mucho unas 30 peticiones y «Buscar más» sigue con los siguientes artistas.

- **De dónde salían las 202 de Novedades**: el índice de «lo que ya tienes» leía todas tus playlists y Tus me gusta enteras (unas 70), dos peticiones por artista (álbumes y singles) para 25 artistas (50) y una por cada álbum reciente.
- **Qué se ha cambiado**:
  - **Caché persistente en IndexedDB** (`js/idb.js`), con el id de la cuenta en la clave. Las canciones de cada playlist valen mientras no cambie su `snapshot_id` (como mucho 30 días). Tus me gusta se valida con una sola petición: el total y la más reciente. Los álbumes valen 30 días (no cambian) y los artistas, lanzamientos y búsquedas, 24 h. Lo de más de 30 días se borra al abrir la app y todo al cerrar sesión. La caché de localStorage de la v1.3.1 (`metaCache`, `libIndex`) se borra al arrancar.
  - **Lista de playlists reciente antes de fiarse de la caché**: si tiene más de un minuto, se relee (una petición por cada 50 playlists). Si cambiaste una en Spotify y vuelves, su `snapshot_id` ya no coincide y se vuelve a leer.
  - **Lo que escribe en su propio origen no usa la caché**: «la misma playlist», Ordenar, Duplicados y Dividir leen siempre de Spotify, porque de esa lectura sale el Deshacer.
  - **Excluir lo que ya tienes**:
    - Tus me gusta ya no se lee entera: se pregunta a `/me/library/contains` solo por las candidatas, en lotes de 40.
    - Tus playlists salen de la caché; las que cambiaron se leen con un tope de 8 peticiones por búsqueda (las que no caben usan su copia anterior o se leen la próxima vez).
  - **Una petición por artista**: `include_groups=album,single` con `limit=10`. Un artista con más de 10 singles recientes puede dejar fuera un álbum; se acepta por la mitad de peticiones.
  - **Tope por búsqueda**: `READ_BUDGET = 30` peticiones de lectura por búsqueda; la escritura (quitar la anterior, crear, añadir y portada) suma unas 6.
    - «Artistas por búsqueda» (8, 15 o 25; por defecto 15) en «Más opciones», guardado en el dispositivo.
    - «Buscar más» sigue con los artistas donde se quedó y con lo leído en la caché.
    - De los seguidos se leen como mucho 2 páginas (100 artistas, el máximo que se recorre). Descubre empieza por 8 álbumes de lo que escuchas, en vez de 25.
  - **Sin lecturas de más tras escribir**:
    - Después de crear una playlist de Shuffl ya no se relee toda la biblioteca: no aparece en los selectores y las quitadas se descuentan en memoria. Solo se relee al escribir en tu propia playlist.
    - «Buscar más» y «Volver a barajar» comprueban que la playlist sigue siendo de Shuffl con 2 peticiones (sus datos y `/me/library/contains`) en vez de leer toda la biblioteca.
    - «Volver a barajar» no vuelve a subir la portada, que no cambia.
  - **Olvidadas**: como mucho 100 canciones al azar entre las olvidadas. Una playlist de 1500 eran 15 peticiones solo para escribir. «Volver a barajar» elige otras 100.
  - **Reintentos**: un 429 sin cuota se reintenta 2 veces (antes 5) y nunca si `Retry-After` pasa de 30 s. Un 5xx se reintenta 2 veces (antes 3). Las órdenes al reproductor no se repiten en el cliente: «Reproducir ahora» comprueba el resultado y decide.
- **QUOTA_EXCEEDED**:
  - Nunca se reintenta.
  - En Novedades y Descubre, si llega a mitad de búsqueda y hay al menos 10 canciones, se crea la playlist con ellas y una nota; si hay menos, se explica sin crear nada.
  - Mensaje: «Spotify limita cuántas búsquedas puede hacer la app. Vuelve a intentarlo en un rato.», sin «Reintentar» (gastaría más).
  - El shuffle de una playlist ya leída sigue funcionando sin leerla (hay un test).
- **Contador** en Diagnóstico: peticiones de la sesión, del día (en localStorage) y de las últimas 12 acciones. Lo cuenta `SpotifyApi` con `onRequest` antes de cada `fetch`.
- **Lo que no se puede bajar**:
  - Leer por primera vez una playlist o Tus me gusta cuesta una petición por cada 50 canciones.
  - Escribir cuesta una por cada 100.
  - Esa primera lectura de una biblioteca grande (Olvidadas con 3000 Me gusta, un shuffle de una playlist de 2000) pasa de 40 una vez; después sale de la caché.

### Errores: mensaje humano y una acción

- **`errorInfo`** clasifica cada error: sesión caducada, falta un permiso, cuenta no añadida en el dashboard, prohibido, Premium, no encontrado, ritmo, Spotify caído (5xx), sin red, cuota, respuesta incompleta o fallo inesperado.
  - Para cada tipo da un texto en ES/EN y sus acciones: «Reintentar» si es pasajero, «Volver a conectar» con sesión o permisos, y «Abrir en Spotify» al reproducir.
  - Ningún texto lleva códigos («403») ni mensajes de Spotify.
  - Un `UserError` que envuelve otro («No se pudo crear la playlist: …») hereda la acción de su causa.
- **`task`** ofrece «Reintentar» (repetir la acción, como volver a pulsar) en los errores pasajeros.
- **Red de seguridad**: un error que no recoge ninguna pantalla (promesa sin capturar, excepción) se registra y sale en un aviso con «Diagnóstico». Si la sesión falla al arrancar, se ve el motivo con «Reintentar» y, si toca, «Volver a conectar»; nunca una pantalla en blanco.
- **Respuestas raras**: JSON roto, playlist creada sin id, Me gusta sin total y listas sin `items` dan «respuesta incompleta», no un fallo raro.
- **Registro local** (`baraja.errors`, 50 como mucho):
  - Guarda fecha, pantalla, tipo, código de estado, `reason` de Spotify, la ruta de la API sin ids ni consulta (`GET /playlists/:id/items`) y el mensaje de Spotify con los ids tapados.
  - Nunca el texto que ve la persona, que puede llevar nombres de playlists.
  - «Copiar informe» usa el portapapeles; si no hay permiso, enseña el texto para copiarlo a mano.
- **Reproducir ahora** (`js/player.js`, lógica pura con tests):
  1. Lee los dispositivos y descarta los `is_restricted`. Usa el activo, o el único; si hay varios, pregunta.
  2. Sin ninguno: «Abre Spotify un momento y vuelve a pulsar», con «Volver a intentar» y «Abrir en Spotify».
  3. Orden: `play` con `context_uri` y `offset 0` en ese dispositivo y después `shuffle=false`. Así el orden funciona aunque el dispositivo estuviera inactivo, porque `shuffle` antes de `play` da 404.
  4. Espera 1,2 s y lee `GET /me/player`: suena esta playlist, sin aleatorio ni aleatorio inteligente y no en pausa. Si no, repite la orden una vez y lo explica.
  - Casos: `NO_ACTIVE_DEVICE`, dormido (502/503), restringido, sin Premium, prohibido, aleatorio que no se apaga, orden aceptada pero no ejecutada (204 sin efecto) y sin poder comprobar («Enviada a…»). Sin Premium, restringido y prohibido no se reintentan.
  - `GET /me/player` usa el scope `user-read-playback-state`, que ya se pedía; se añade a la lista de CLAUDE.md.
- **Prueba completa** (Más → Diagnóstico, unas 14 peticiones):
  1. Sesión.
  2. Leer playlists.
  3. Permisos.
  4. Una canción (la última de Me gusta o la primera de una playlist tuya).
  5. Crear la playlist de prueba de Shuffl con esa canción.
  6. Sobrescribirla y comprobar el total.
  7. Reconocerla como de Shuffl.
  8. Dispositivos.
  9. Reproducir y comprobar (opcional, marcado por defecto y avisando de que sonará una canción).
  10. Quitarla.
  - La playlist de prueba se quita aunque falle un paso intermedio.
  - El informe lleva el resultado de cada paso sin nombres (ni el de la cuenta ni el del dispositivo).
- **Diagnóstico** pasa de Ajustes a su propia pantalla en Más, con «Comprobar conexión» incluido.
- **Tests e2e** para 401, 403 (dashboard, scope y prohibido), 404, 429 con y sin cuota, 5xx, red caída, respuestas con huecos, sin dispositivo, dormido, restringido, sin Premium, orden ignorada, aleatorio que no se apaga y error inesperado. El mock admite fallos a medida (`state.failures`: ruta, estado, cuerpo, `times` y `skip`) y el estado del reproductor.

### Shuffle por tiempo, a la vista

- Bajo las playlists, «¿Cuánto?»: **Toda la playlist / Por tiempo**. Por tiempo enseña 5 accesos rápidos (Trayecto 20, Gym 45, Correr 30, Viaje 90, Dormir 30) y «A medida», con un deslizador de 5 a 180 min de 5 en 5. El botón dice «Barajar 45 min».
- Correr y Dormir duran lo mismo (30 min), así que se guarda la clave del acceso, no solo los minutos. Si una mezcla trae una clave que no existe o unos minutos que no son los del acceso, se trata como «a medida».
- Nombres: «Gym 45 min · Shuffle» con un acceso rápido y «Rock · 45 min · Shuffle» a medida. Si el origen es largo se recorta él, nunca los minutos. Como llevan la etiqueta con el resumen del nombre, se reconocen como de Shuffl y, si se renombran, no se borran.
- Las mezclas de antes con más de 180 min se cargan con el deslizador a 180.
- El resultado dice «Listo · 45 min ± 2» y la duración real («22 canciones · 44 min»).
- **Siri**: los atajos abren una mezcla guardada, que ahora recuerda el tiempo y el acceso rápido. No se añade un parámetro de tiempo a los enlaces `?origen=`, para no ampliar lo que acepta un enlace de fuera.

### Carátulas en todas partes

- Una fila común (`trackRow` + `coverSlot`) en resultados (Shuffle, Novedades, Descubre, Olvidadas, Instantáneas, Mi top, Ordenar, Me gusta sin playlist), en las listas de Tu resumen (artistas y canciones), en los grupos de Duplicados y en las partes de Dividir (con la carátula de su primera canción).
- El hueco mide siempre 48×48 con ♪ de fondo y la imagen va encima, en diferido (`loading="lazy"`) y con `object-fit: contain`: nada salta, no se recorta ni se pone nada encima. Si la imagen falla, se quita y queda el hueco.
- **Imagen**: la que ya trae la respuesta, sin peticiones extra. `pickThumb` elige la más pequeña que llega a 120 px (48 px en pantallas de 3x); si Spotify no da tamaños, la penúltima (la de 300).
- **Por qué faltaban en Descubre**: los álbumes de «lo que escuchas» se pedían sin sus imágenes. Ahora llevan la miniatura de la canción escuchada, y los lanzamientos guardan todas sus imágenes con tamaño, no solo las dos últimas.
- En la Copia de seguridad se listan playlists de un archivo, que no traen imagen, y se dejan como estaban.
- La carátula de la tarjeta de Inicio pasa de `cover` a `contain` (no se recorta).
- **Test** (`tests/e2e/covers.spec.mjs`): recorre todas esas pantallas y falla si una fila no tiene su carátula https de 48×48 entera.

### Más interactiva

- **Flujo elegido**: guardar con un toque, como antes, y editar después. Una vista previa antes de enviar añadiría un paso a cada shuffle y a Siri.
  - **Quitar**: en el resultado, deslizar una canción a la izquierda (o tocar su ×, accesible con teclado y lector) la quita. Los cambios se guardan de una vez 1,2 s después del último, tras comprobar que la playlist sigue siendo de Shuffl.
  - **Rebarajar**: el botón «Volver a barajar» (con el icono de la app) o tirar hacia abajo rebarajan la misma playlist. Las quitadas no vuelven.
  - Solo en playlists de Shuffl, nunca en la tuya («la misma playlist»).
  - Guardar reescribe la playlist entera (una petición por cada 100 canciones), una vez tras el último gesto. No se usa `DELETE /playlists/{id}/items` porque no está en la lista de endpoints comprobados en Development Mode.
  - «Buscar más» guarda antes lo pendiente.
  - Tirar hacia abajo fuera de un resultado sigue refrescando tus playlists.
- **Animaciones**:
  - Las carátulas se reparten como naipes al aparecer (solo `transform` y `opacity`, 45 ms de desfase entre filas).
  - El fondo toma el color dominante de la portada del origen o, en Descubrir, de la primera carátula.
  - Los botones responden al toque con una pequeña escala.
  - Con «reducir movimiento» no hay animaciones (regla global de la v1.2).
- **Estados vacíos** con una ilustración en SVG (tres naipes con una nota) en Descubrir, Olvidadas, Tu resumen y Me gusta sin playlist.

## v1.3.1 (2026-11-27): correcciones tras probar con Spotify real en el iPhone

- **Por qué no se borraba nada**:
  1. La v1.3 solo quitaba copias repetidas del mismo origen, así que «Spanish Rap · Shuffle», «12 years ago · Shuffle» y «📸 Top 4 weeks» se quedaban por diseño.
  2. `DELETE /me/library` exige los scopes `user-library-modify` y `user-follow-modify` además de `playlist-modify-public` ([docs/specs/spotify-v1.3.1.md](docs/specs/spotify-v1.3.1.md)), y la app no los pedía: el borrado habría fallado con 403.
  - Se añaden los dos scopes. Quien ya tenía sesión ve «vuelve a conectar» una vez, con el mecanismo de scopes que faltan de la v1.1.
  - `DELETE /playlists/{id}/followers` está obsoleto y no existe en Development Mode.
  - Un error al borrar ya no se queda en un aviso: detiene la creación y muestra el mensaje real de Spotify.
  - «Comprobar conexión» crea una playlist vacía de prueba y la quita, así que el fallo se ve sin barajar nada.
- **Solo una playlist de Shuffl a la vez** (lo pide el encargo y sustituye a «una por origen» de la v1.3). Al crear cualquier playlist de Shuffl (shuffle, Descubrir, Olvidadas, Instantáneas y Mi top), se siguen estos pasos:
  1. Se leen y barajan las canciones en memoria.
  2. Dentro del candado de escritura se vuelve a leer la biblioteca y se quitan todas las de Shuffl.
  3. Se crea la nueva.
  - **Quedan fuera** las herramientas que crean playlists que la persona quiere conservar: Ordenar, Copia limpia de Duplicados, Dividir, Restaurar y Me gusta sin playlist. Sus nombres no son de la app y su descripción («Creada con Shuffl») no está en la lista, así que tampoco se reconocen como de Shuffl.
  - **«Volver a barajar»** en el resultado reordena la misma playlist recién creada, porque no crea otra. **«Buscar más»** añade a la playlist en curso.
- **Qué es una playlist de Shuffl** (`isAppPlaylist`): propia, no colaborativa (otras personas pueden escribir en ella) y con un nombre de los que pone la app. Además debe cumplir una de dos cosas:
  - llevar la etiqueta `shuffl:src=` al final de la descripción;
  - o, sin etiqueta, tener una descripción de las que generaron las versiones anteriores, sacadas del historial de git de `js/i18n.js`: exactas (instantáneas Baraja/Shuffl y la de «🔀 Baraja») o, las que acababan con la lista de orígenes, como prefijo con algo detrás.
  - Nombres de la app: termina en « · Shuffle», empieza por «📸 » o es exactamente «🔀 Baraja». Se añade también «… · Shuffle · fecha» (el «una nueva cada vez» de la v1.2), que lleva la misma descripción. Se deja fuera «Baraja · fecha», que no estaba en el encargo.
  - Descripción vacía, propia o con solo el prefijo: no se borra. Una renombrada (otro nombre aunque conserve la etiqueta) es tuya y no se toca.
- **No se ofrecen como origen**: `loadPlaylists` quita las de Shuffl de todos los selectores (también de «toda mi biblioteca», «Elige por mí» y los enlaces `?origen=`). Además, los orígenes de la baraja en curso nunca se borran.
- **Primera vez**: hoja con la lista y un único botón, «Borrar y no volver a preguntar», más «Cancelar», que no borra ni crea nada y explica cómo desactivarlo. Después es automático, con el aviso «Se han quitado N playlists antiguas de Shuffl» en el resultado. Se desactiva en Ajustes; desactivado, se acumulan como antes.
- **Errores**: si falla borrar o crear, error con el motivo real y «Reintentar», que repite solo ese paso con las canciones en memoria (no se vuelve a leer), y «Volver».
- **Pin**: como cada shuffle crea una playlist nueva, el pin de Tu biblioteca no se conserva. «Tenerla siempre a mano» lo explica y propone ordenar Tu biblioteca por «Recientes».
- **Transiciones**:
  - Las causas: `document.startViewTransition` en cada cambio (en iOS, y sobre todo en la app instalada, captura y anima toda la pantalla), la entrada de 280 ms con desplazamiento lateral, el repintado de Inicio en cada cambio y que `main` se movía 3 px porque el margen del primer elemento de cada pantalla «salía» de él (margin collapsing).
  - El arreglo: cambio síncrono sin View Transitions, fundido de opacidad de 120 ms, `main { display: flow-root }`, solo se refresca la pantalla que se muestra y cada pantalla recuerda su scroll.
  - Un e2e comprueba que no se llama a View Transitions, que el cambio tarda menos de 100 ms y que el CLS es menor de 0,01.
- **Inicio**:
  - Con historial, una tarjeta con la carátula del primer origen (entera), su nombre, la fecha de la última baraja (hoy, ayer o la fecha), «Volver a barajar» (botón principal normal) y «Barajar otra cosa».
  - Sin historial, «Empezar».
  - El aviso de icono nuevo sale solo en Inicio y no vuelve tras «Entendido»; es el único aviso de un solo uso que queda.
- **«Barajando…»**: el formulario se oculta y la pantalla de trabajo sale antes de la primera petición. Pasos visibles: leyendo canciones (con progreso), barajando, quitando las antiguas, creando y guardando (con progreso).
- **Resultado**:
  - Arriba: nombre de la playlist, canciones y duración, «▶ Reproducir ahora» y «Abrir en Spotify».
  - Lista de 30 canciones con carátula de 48 px. Se usa la imagen mediana (300 px) para que se vea nítida en pantallas 3x, encajada sin recortar (`object-fit: contain`) y sin nada encima.
  - El logo de Spotify sigue como atribución.
- **Quitados**:
  - «Tal día como hoy»: la API no da historial por fecha. La idea del archivo de datos de Spotify queda en el ROADMAP.
  - «Barajar por álbumes».
  - Las mezclas guardadas de esos tipos o con «una nueva cada vez» se convierten al leerlas.
- **Novedades y Descubre**:
  - Por defecto, 30 canciones. En «Más opciones» se elige número (15/30/50/100) o duración (30/45/60/90 min, ±2 min, como el shuffle por tiempo).
  - Los artistas se leen en lotes de 25, hasta 100, solo cuando hacen falta. «Buscar más» lee el siguiente lote si se acaban y añade otra tanda a la misma playlist.
  - Estilos: tus artistas (tops y seguidos), «Como mi playlist…» (artistas de esa playlist ordenados por apariciones; se añaden ids de artista a la normalización de canciones) y un género.
  - Los géneros salen del objeto Artist, que Spotify marca como obsoleto y en muchas cuentas llega vacío: si ninguno de tus artistas trae géneros, la opción no aparece.
  - Con un género, `/search?type=artist&q=genre:"…"` con `limit=10` y hasta 3 páginas, más tus artistas de ese género.
  - Una línea en la pantalla dice de dónde salen las canciones.
- **Sin lo que ya tienes**: un índice local con los ids de todas tus playlists propias y colaborativas y de Tus me gusta, guardado por playlist con su `snapshot_id`.
  - Solo se vuelve a leer la playlist que cambió o lleva más de 24 h, y Tus me gusta si cambió su total.
  - Se valida al leerlo, es por cuenta y se borra al cerrar sesión, igual que la caché de metadatos. Si Deshacer no cabe en el almacenamiento, también se vacía.
  - Sustituye a `GET /me/library/contains`, que solo miraba lo guardado y gastaba una petición por cada 40 canciones.

## v1.3 (2026-11-26): una sola «· Shuffle», Descubrir y funciones nuevas

- **Navegación en 4 pestañas: Inicio · Shuffle · Descubrir · Más.**
  - Agrupación por lo que se viene a hacer: Shuffle (barajar lo que ya tienes), Descubrir (música nueva y recuerdos) y Más (herramientas que se usan de vez en cuando: Ordenar, Duplicados, Copia, Instantáneas, Me gusta sin playlist, Dividir, «Tenerla siempre a mano», «¿Es aleatorio de verdad?» y Ajustes).
  - Ordenar, Duplicados y Copia dejan de ser pestañas: se usan poco comparadas con barajar y ocupaban la barra.
  - El engranaje de la cabecera desaparece: Ajustes vive en Más, así hay un solo sitio para todo lo secundario.
  - Cada pantalla secundaria tiene arriba «‹ <pestaña>», que vuelve a donde estabas.
  - «Elige por mí» va dentro de Shuffle, porque es una forma de barajar.
- **Inicio**: un botón enorme «SHUFFLE».
  - Con una última mezcla, la vuelve a barajar; sin ella, abre Shuffle. Debajo, «Barajar otra cosa».
  - Luego vienen «Lo último» (las tres últimas funciones de Descubrir usadas) y las mezclas guardadas, con un estado vacío que explica cómo guardar una.
  - Se quitan las tarjetas de atajos y de herramientas.
- **Shuffle**: tipo de shuffle en pastillas (Canciones, Por tiempo, Por álbumes), origen y botón principal.
  - Quitar repetidas, filtros, destino, pegar enlace y guardar mezcla van plegados en «Más opciones».
  - Los valores por defecto (canciones, su «· Shuffle», sin repetidas) funcionan sin tocar nada.
  - La pestaña se llama «Shuffle» también en español porque es el nombre de la función y de las playlists; los botones siguen diciendo «Barajar».
- **Etiqueta de origen**: « · shuffl:src=<10 hex>» al final de la descripción.
  - Los 10 hex son los primeros del SHA-256 de `shuffl:<clave de origen>`; la clave es la de la v1.2 más las nuevas: `time:<min>`, `albums:…`, `new`, `explore`, `ago:<n>`, `forgotten` y `top`.
  - No incluye ids ni nombres. 40 bits bastan para que dos orígenes de una misma cuenta no choquen en la práctica.
  - La descripción se recorta para que la etiqueta quepa siempre en los 300 caracteres.
- **Búsqueda antes de escribir**: con `GET /me/playlists` se buscan las playlists propias, con nombre «… · Shuffle» y esa etiqueta.
  - Una playlist de la v1.2 sin etiqueta solo cuenta si tiene el mismo nombre y la misma descripción que generaría ese origen. Así «Mix · Shuffle» de dos combinaciones distintas no se confunde. Al reutilizarla se le añade la etiqueta.
  - Tras la revisión de seguridad, ni con nombre y descripción iguales basta: dos playlists «Rock» distintas dan lo mismo. Sin etiqueta solo cuenta la que este dispositivo ya usaba para esa clave o, si no, la única coincidencia. Con varias iguales se crea una nueva con etiqueta.
  - Nunca se reutiliza un origen de la propia baraja, aunque lleve la etiqueta (por ejemplo, barajar por tiempo desde «35 min · Shuffle»).
  - La correspondencia local (`baraja.targets`) queda solo como preferencia en empates y para excluir las generadas de «toda mi biblioteca».
- **Cuál se queda con varias copias**: la que se escribió más tarde.
  - Se lee la fecha `added_at` de su primera canción (`GET /playlists/{id}/items?limit=1`); al sobrescribir, todas llevan la fecha de la baraja. Solo cuesta una petición por copia, y solo cuando hay copias.
  - Spotify no da la fecha de creación de una playlist.
- **Quitar = dejar de seguir con `DELETE /me/library?uris=spotify:playlist:…`** (máximo 40 por petición).
  - Según la guía de migración de febrero de 2026, sustituye a `DELETE /playlists/{id}/followers`, que ya no existe. Usa el scope `playlist-modify-public`, que la app ya pedía, así que no hay que reconectar.
  - Verificado solo con la documentación ([docs/specs/spotify-endpoints-v1.3.md](docs/specs/spotify-endpoints-v1.3.md)), no con una cuenta real: queda en SIGUIENTES_PASOS.
- **Limpieza segura**.
  - Se escribe primero y se limpia después, así que un fallo al quitar no pierde nada; sale un aviso.
  - Antes de quitar se vuelve a leer la biblioteca dentro del candado de escritura. Cada grupo se recalcula: misma etiqueta y misma playlist conservada con las fechas nuevas. Si otra pestaña o dispositivo escribió en otra copia, o renombraste alguna, ese grupo se salta.
  - Nunca se quitan los orígenes de esa baraja ni los de las mezclas guardadas y la última mezcla (atajos de Siri, agitar).
  - Las copias de la v1.2 sin etiqueta solo se quitan marcándolas a mano en la hoja (salen sin marcar, con un aviso), nunca en automático. La antigua «🔀 Baraja» solo cuenta si sigue con ese nombre.
  - Si una «· Shuffle» se hizo colaborativa, otra persona puede decidir cuál de las copias se conserva escribiendo en ella. Se acepta: no puede hacer que se quite nada que no sea una copia con la misma etiqueta y propia.
  - La primera vez pregunta, con la opción «Quitar siempre sin preguntar», que también está en Ajustes. «Ahora no» no vuelve a preguntar en esa sesión. La hoja explica la recuperación durante 90 días.
  - Al arrancar se buscan copias repetidas en toda la biblioteca y sale un aviso con «Revisar». En automático se limpian sin preguntar, pero la antigua «🔀 Baraja» siempre se pregunta, porque no es una copia de nada.
- **Shuffle por tiempo**: se baraja todo con Fisher-Yates y se recorre ese orden tomando cada canción que quepa sin pasar de objetivo + 2 min. Se para al llegar a objetivo − 2 min.
  - Así cada canción tiene la misma probabilidad de entrar; lo comprueba un test con 20.000 repeticiones.
  - Si no llega (poca música), se escribe lo que hay y se avisa.
  - Clave `time:<min>`: una playlist por duración («35 min · Shuffle»), sea cual sea el origen. Una mezcla guardada usa la suya («Coche · Shuffle»).
  - No permite «la propia playlist», porque la dejaría corta.
- **Shuffle por álbumes**: los álbumes de las canciones elegidas (después de los filtros) se completan con `GET /albums/{id}/tracks`; con más de 50 se eligen 50 al azar.
  - Se baraja el orden de los álbumes y cada uno suena en orden de disco y pista.
  - Con «Usar tus álbumes guardados» se usa `GET /me/albums` (las canciones vienen incluidas; se piden aparte si el álbum tiene más de 50). Ahí no se aplican filtros: partirían los álbumes.
  - Nombre: «<origen> · Álbumes · Shuffle»; con los guardados, «Tus álbumes · Álbumes · Shuffle».
- **Novedades**: hasta 25 artistas alternando tu top de 4 semanas, el de 6 meses y los que sigues.
  - Por artista, dos peticiones a `GET /artists/{id}/albums` (`album` y `single`), porque en Development Mode `limit` no pasa de 10 y en una sola los singles quedarían fuera.
  - Solo cuentan los lanzamientos con fecha exacta (precisión de día) dentro de los últimos 7, 30 o 90 días (30 por defecto, en «Más opciones»).
  - Lo guardado se quita con `GET /me/library/contains` (40 por petición).
- **Descubre**: álbumes de tus últimas 50 escuchas y de tu top de 4 semanas (hasta 25). Se quitan las canciones guardadas y también las que acabas de escuchar, que no serían un descubrimiento.
- **Caché de 24 h** en el dispositivo para artistas top, seguidos, lanzamientos y canciones de cada álbum. Tiene 400 entradas y 1,5 millones de caracteres como máximo (se quitan primero las más antiguas) y se valida al leerla.
  - Las claves llevan el id de la cuenta y la caché se borra al cerrar sesión.
  - Si Deshacer no cabe en el almacenamiento, se vacía la caché y se reintenta: Deshacer va primero.
  - Novedades con 25 artistas hace unas 50 peticiones la primera vez y ninguna de esas en las siguientes 24 h.
  - Hay progreso visible. `QUOTA_EXCEEDED` ya tenía su mensaje propio.
- **«Similares» (MetaBrainz) no se implementa.**
  - Los dos servicios responden con CORS (`Access-Control-Allow-Origin: *`, comprobado con curl). Pero MusicBrainz exige un User-Agent identificativo que un navegador no puede enviar, y en 2026 ha bloqueado clientes que no lo cumplen.
  - En la prueba, una petición cada 2 s con un User-Agent de Safari devolvió 503 por su límite global a la tercera.
  - El endpoint de artistas similares está en «labs» sin garantía de estabilidad. Hacerlo bien exigiría un servidor propio, que el proyecto no tiene.
  - Detalle en [docs/specs/metabrainz-similares.md](docs/specs/metabrainz-similares.md); queda en el ROADMAP.
- **Tal día como hoy**: Tus me gusta guardadas en el mes actual (hora local) de años anteriores, agrupadas por año.
  - Por defecto el más reciente; en el resultado, botones con los otros años.
  - Clave `ago:<años>`: «Hace 1 año · Shuffle» se sobrescribe cada mes con el mes que toque.
  - El texto nostálgico usa el artista que más se repite en ese grupo y solo se muestra en pantalla, no se guarda en Spotify.
- **Olvidadas**: Tus me gusta guardadas hace más de 1, 2, 3 o 5 años (2 por defecto). Una sola playlist «Olvidadas · Shuffle». La lectura de Tus me gusta se reutiliza en la sesión mientras su total no cambie.
- **Tu resumen**: `GET /me/top/artists?limit=5` y el top de canciones del periodo, dibujados en un canvas de 1080×1920 y otro de 1080×1080.
  - Las carátulas se dibujan enteras (encajadas sin recortar ni deformar), sin nada encima y con el texto al lado. El logo completo de Spotify va en blanco sobre negro, sin modificar, a 300 o 240 px con su zona de seguridad. Un test comprueba la geometría.
  - Si una carátula no se puede leer por CORS, su hueco queda gris y se avisa; nunca se pone otra imagen. Si el lienzo queda «contaminado», se repite sin carátulas.
  - Se comparte con Web Share (archivo) o se descarga.
  - «Mi top · Shuffle» usa las hasta 50 canciones del top barajadas; las instantáneas «📸 Top…» siguen en Más, sin cambios.
- **Mezclas guardadas** guardan también el tipo, los minutos y «álbumes guardados», así que Siri y agitar funcionan con los tres tipos.

## v1.2 (2026-11-26): Shuffl

- **Nombre**: «Shuffl» cumple la regla (no empieza por «Spot», no contiene «Spotify» ni termina en «-ify»/«-fy»). El repo `new-spoti` y la URL de Pages no cambian, para no romper la Redirect URI de nadie. Las claves de localStorage siguen siendo `baraja.*` y las copias `app: 'baraja'` se siguen aceptando: renombrarlas cerraría sesiones y perdería Deshacer, mezclas y correspondencias. Las copias nuevas llevan `app: 'shuffl'`. La caché del SW pasa a `shuffl-<hash>` (el `activate` borra las `baraja-*`). El aviso de icono nuevo usa una clave nueva (`baraja.logoNotice.v12`) para que salga otra vez.
- **Icono B** (naipes): generado desde `scripts/make-icons.mjs`. El naipe delantero lleva un filo negro de 14 px para separarlo de los contornos de detrás. La regla antigua «el logo no puede ser verde» queda sustituida por la de ahora: lima #C6FF3D (matiz 78°), lejos del verde de Spotify (≈141°); un test exige que ningún color de la paleta ni del icono caiga entre 100° y 170°.
- **Paleta y tipografía**: sin fuentes externas (ni Google Fonts, por privacidad y uso sin conexión). Títulos en «Arial Black» con respaldo del sistema, etiquetas en monoespaciada con «//», esquinas de 8–12 px y sombra dura en el botón principal y la tarjeta destacada, para no parecer la interfaz de Spotify (botones píldora, Circular). En el tema claro, `--accent` es #3D6B00 (texto y controles pequeños) y `--lime` solo pinta el botón grande y la tarjeta destacada, con texto negro encima (AA en los dos temas).
- **Playlists «· Shuffle»**: la clave del origen es la mezcla guardada (`mix:<id>`), toda la biblioteca (`library`) o el conjunto de playlists ordenado (`pl:a,b`), así que Rock+Chill y Chill+Rock comparten playlist. Varias playlists sin mezcla se llaman todas «Mix · Shuffle» (como pide el encargo) y se distinguen por la descripción. La correspondencia se valida al leerla (claves e ids con formato seguro, máximo 200, las más antiguas se descartan) y solo se reutiliza un id si `/me/playlists` lo devuelve como propio y con un nombre que sigue terminando en « · Shuffle» (si la renombraste para conservarla, o el almacenamiento apunta a otra playlist, se deja intacta, se olvida y se crea otra). Al reutilizarla, el Deshacer se guarda en modo `soft`, como con la antigua «🔀 Baraja»: una playlist generada no pisa el Deshacer de una playlist real tuya. Las escrituras van dentro de un Web Lock para que dos pestañas (dos órdenes de Siri seguidas) no se intercalen. «Una nueva cada vez» usa «<nombre> · Shuffle · fecha» y no toca la correspondencia.
- **Renombrar** usa `PUT /playlists/{id}` (cambiar detalles de una playlist propia, mismo scope que escribir). Se añade a la lista de endpoints de CLAUDE.md. Si falla, la baraja sigue y sale un aviso. La descripción se compara deshaciendo las entidades HTML que devuelve Spotify para no reescribirla en cada baraja.
- **Toda la biblioteca** excluye ahora todas las playlists generadas (las «· Shuffle», la antigua «🔀 Baraja», «Baraja · …» e instantáneas «📸»), no solo «🔀 Baraja»: si no, se leerían canciones duplicadas y la propia playlist de destino.
- **Migración**: la antigua «🔀 Baraja» no se borra (borrar no se puede deshacer); aviso único si sigue en tu biblioteca.
- **Enlaces profundos**: se leen y se quitan de la barra al arrancar, antes de cualquier otra cosa, para que recargar no repita una baraja ni una reproducción. Sin `play=1` se baraja sin reproducir. Con sesión no válida no se guardan para después: el encargo pide que solo se ejecuten con sesión válida. Siempre se fuerza el destino «· Shuffle», aunque la mezcla diga «la propia playlist» o «una nueva cada vez», porque un enlace lo puede abrir cualquiera. Tras la revisión, el atajo incluye una clave aleatoria de ese navegador (`k`, 128 bits, en `baraja.linkKey`): con ella se ejecuta sin preguntar (lo que pide Siri); sin ella o con otra (un enlace desde otra web, o el atajo abierto en otro navegador) pide confirmación antes de hacer nada. `?origen=` no lo genera la interfaz, así que siempre pregunta.
- **Siri en iPhone**: Atajos abre las URL en Safari, no en la app de la pantalla de inicio, y no comparten almacenamiento. Se explica en la hoja del atajo en vez de prometer algo que iOS no permite.
- **Agitar**: siempre pide confirmación (siempre sobrescribe la «· Shuffle» de la última mezcla), solo en Inicio y solo si hay última mezcla. Umbral: 3 sacudidas de más de 14 m/s² de cambio en 1 s y 3 s de espera tras una. El permiso se intenta en silencio al arrancar (Chrome responde sin preguntar; iOS lo rechaza sin un toque) y, si no se concede, sale el botón «Activar».
- **Elige por mí**: candidatas = playlists legibles no generadas con canciones, más Tus me gusta. La elección se hace con `pickIndex` (crypto) antes de animar; la ruleta da siempre 24 pasos para durar lo mismo con muchas playlists.
- **¿Es aleatorio de verdad?**: se compara Fisher-Yates con el barajado ingenuo (intercambiar cada posición con cualquier otra) midiendo qué canción suena primero, donde su sesgo se ve claro (hasta un 30 %). Medir dónde acaba la primera canción no sirve: con ese algoritmo sale casi plano. No se compara con el aleatorio de Spotify porque no se puede medir desde la API.
- **View Transitions**: cambian el panel de forma asíncrona; el estado (`S.tab`) se actualiza al momento y solo el DOM espera a la transición.

## Producto

- **Ideas de la investigación implementadas** (de [INVESTIGACION.md](INVESTIGACION.md)):
  - Filtro por fecha de añadida al ordenar (crear una playlist solo con lo añadido entre dos fechas). Es barato con `added_at` y lo piden en Community.
  - Fusionar playlists con quitar repetidas: ya es parte de Barajar (varias playlists + dedupe), así que no hay pantalla aparte.
  - Atajo "Copiar Tus me gusta a una playlist que sí puedes reordenar" (la queja más votada sobre ordenar).
- **No implementadas, en [ROADMAP.md](ROADMAP.md)**: dividir playlists en partes, Tus me gusta que no están en ninguna playlist (requiere leer toda la biblioteca), intersección/diferencia, instantáneas con historial, plantillas de ordenación. Motivo: mejor pocas funciones bien hechas, y varias tienen evidencia de demanda débil.
- **Un solo hueco de Deshacer** (el último cambio), como pide el enunciado. El revisor señaló que "Volver a barajar" y reutilizar «🔀 Baraja» podían pisar el Deshacer de una playlist real: ahora esas dos rutas no sobrescriben un Deshacer existente (`soft`) y el botón del resultado solo actúa si el Deshacer es de esa playlist.
- **Deshacer pide confirmación** y las sobrescrituras comprueban antes que la playlist no ha cambiado en Spotify (`total` igual al leído).
- **Lecturas incompletas abortan**: si una paginación devuelve menos de `total`, se lanza error antes de escribir. Perder canciones de forma silenciosa es peor que fallar.
- **Reintentos 5xx solo en GET y PUT**: un POST repetido duplicaría canciones o playlists.
- **Exportar usa un paso intermedio** ("Preparar copia" y después "Guardar JSON/CSV"): `navigator.share` exige un gesto reciente y, tras leer miles de canciones, iOS ya lo habría caducado.
- **CSV**: celdas con `;` entrecomilladas y prefijo `'` ante `= + - @` (inyección de fórmulas en Excel).
- **Selección de playlists persistente** al volver del resultado, para repetir sin volver a marcar.
- **Tus me gusta** se prueba al arrancar con `limit=1`; si falla se muestra deshabilitada con motivo y el resto sigue funcionando.
- **Restaurar Tus me gusta** crea una playlist normal en el orden guardado (más reciente primero); no recupera la "fecha de añadida" original (limitación de la API, anotada en el README).

## Técnica

- **Cero dependencias de runtime**; única devDependency, `@playwright/test` (pedida en el enunciado).
- **`node --test "tests/unit/*.test.js"`**: en Node 24, `node --test carpeta/` no funciona.
- **Playlists leídas con `limit=50`** (el máximo actual de `/items`) y escrituras de 100 en 100.
- **Service worker**: cache-first para recursos propios, network-first para la navegación, caché versionada con el hash del commit inyectado en el despliegue (`baraja-<hash>`), sin `skipWaiting` automático: la versión nueva espera a que el usuario pulse «Actualizar» (mensaje `SKIP_WAITING` y una sola recarga en `controllerchange`). Comprueba actualizaciones al volver a primer plano y cada hora. Nunca toca otros orígenes. En desarrollo (`dev`) no intercepta.
- **v1.1, orden y copia**: el orden combinado usa comparadores «puros» (cada criterio mira solo su dato) para que el segundo y tercero desempaten de verdad; con un solo criterio se mantiene el comportamiento anterior. Los álbumes y artistas de la copia no se restauran porque eso exigiría escribir en la biblioteca (`PUT /me/library`), que queda para el ROADMAP. Los artistas se leen con paginación por cursor y sin `popularity`.
- **v1.1, diagnóstico**: «Comprobar conexión» hace dos peticiones de lectura (`/me`, `/me/playlists?limit=1`) y comprueba los scopes guardados; no envía nada fuera de la API de Spotify.
- **v1.1, herramientas**: instantáneas, Me gusta sin playlist y dividir cuelgan de la pestaña Inicio (sección «Más herramientas») en vez de ocupar pestañas: la barra se queda en 5. Las instantáneas guardan el id de cada playlist para actualizarla y, al sobrescribir, guardan Deshacer. «Me gusta sin playlist» ignora las playlists que genera Baraja (`🔀 Baraja`, `Baraja · …`, `📸 …`), porque contienen canciones de Me gusta y taparían las huérfanas. Dividir limita a 50 playlists por operación y pide subir el mínimo por artista si se supera; con un solo grupo no hace nada.
- **v1.1, playlists de otros**: se ordenan propias/colaborativas primero y seguidas después en todos los selectores. La detección de copia compara el nombre normalizado (NFKC, minúsculas, sin espacios en los extremos). El enlace pegado solo llama a `GET /playlists/{id}` con `fields` de metadatos y valida el origen (`https://open.spotify.com`, URI o id de 22 caracteres) para no enviar peticiones con texto arbitrario.
- **v1.1, filtros**: el contador en vivo lee las playlists elegidas al abrir «Filtros» (con caché por playlist y número de canciones) y no al abrir la pantalla, para no gastar peticiones; al barajar siempre se vuelve a leer. Los filtros que dependen de un dato ausente (sin fecha de lanzamiento, sin fecha de añadida) excluyen la canción cuando ese filtro está activo. Con filtros activos «la propia playlist» queda desactivada porque sobrescribiría con un subconjunto.
- **v1.1, biblioteca y mezclas**: «toda mi biblioteca» excluye «🔀 Baraja» (si no, se leería y sobrescribiría a la vez). Las mezclas se guardan en localStorage (tope 50) y se validan al leerlas y al restaurarlas (`sanitizeMix`), porque el almacenamiento y los archivos son entradas no confiables. La última mezcla usa el mismo formato que las guardadas.
- **v1.1, interfaz**: se sigue la paleta pedida, no la de Spotify (su verde y su imagen están protegidos). «Oscuro por defecto» se interpreta como tema `dark` hasta que el usuario elija otro; las opciones son oscuro, claro y como el sistema. El color dinámico usa el degradado del color dominante calculado en canvas con `crossOrigin=anonymous`; si el CDN de imágenes no permite leer la portada, simplemente no hay degradado. Se añade una pestaña Inicio (5 pestañas). Los gestos (deslizar, tirar para refrescar) ignoran la lista de playlists y los campos para no estorbar al desplazarse. La animación de naipes se ve solo en el barajado, que es donde hay una espera visible.
- **v1.1, scopes**: se piden todos los de la v1.1 a la vez para que los usuarios reconecten una sola vez. La sesión guarda el `scope` devuelto por Spotify y, si falta alguno, se muestra la pantalla de reconexión.
- **v1.1, Reproducir ahora**: con dispositivo activo se usa ese; si no hay ninguno activo pero sí dispositivos, hoja inferior para elegir (incluso con uno solo, para no despertar un dispositivo sin querer); sin dispositivos, ayuda y enlace. Un 404 al reproducir se trata como «sin dispositivo».
- **v1.1, logo**: icono único para any/favicon/apple-touch (fondo índigo a sangre); el maskable es el mismo dibujo al 92 % y desplazado 11 px para centrarlo en la zona segura. No se incluye el logo oficial de Spotify (no se puede recrear ni modificar y no se puede descargar de forma fiable): quedó pendiente y se añadió en la v1.1.1 (ver abajo).
- **v1.1.1, logo de Spotify**: se usa el logo completo (icono y marca), que es lo que piden las normas para integraciones, descargado de `developer.spotify.com/documentation/design` y copiado sin modificar a `icons/spotify/` (un test fija su hash). El fondo de la app no es negro ni blanco puros, así que se usan las versiones monocromas: blanca en oscuro y negra en claro; el verde no se usa. Ancho 88 px (mínimo 70) y padding de 12 px, media altura del icono, como zona de seguridad. Va una vez por bloque de contenido (selector, resultado, duplicados, hoja de playlist ajena), enlazado a Spotify o a la playlist. Las pantallas sin metadatos de Spotify (Ajustes, Tenerla a mano) no lo llevan.
- **v1.1.1, banner de actualización**: el botón «Actualizar» queda fuera del bloqueo de `body.busy` para que el aviso «Termina la tarea en curso» se vea; sigue sin recargar hasta que la tarea termina.
- **Despliegue**: Pages se lanza con `workflow_run` cuando el CI de `main` termina en verde, para no desplegar con tests rotos; `workflow_dispatch` sigue disponible.
- **Test intermitente de barajar**: era una carrera del propio test (comprobaba con el texto «Listo» del resultado anterior, aún visible, mientras la escritura iba por el primer bloque de 100). Ahora espera a que `body.busy` se quite.
- **Tests e2e con el service worker bloqueado** para que no interfiera con `page.route`.
- **Licencia MIT a nombre de "Juan del Mazo"** (nombre del perfil de GitHub).
- **Iconos** generados con `scripts/make-icons.mjs` (Chromium de Playwright renderiza el SVG a PNG).
