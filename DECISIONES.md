# Decisiones tomadas

Trabajo hecho sin supervisión el 2026-11-23. Todo lo reversible lo decidí yo; lo demás está en [docs/bandeja.md](docs/bandeja.md).

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
