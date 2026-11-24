# Decisiones tomadas

Trabajo hecho sin supervisión el 2026-11-23. Todo lo reversible lo decidí yo; lo demás está en [docs/bandeja.md](docs/bandeja.md).

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
- **v1.1, filtros**: el contador en vivo lee las playlists elegidas al abrir «Filtros» (con caché por playlist y número de canciones) y no al abrir la pantalla, para no gastar peticiones; al barajar siempre se vuelve a leer. Los filtros que dependen de un dato ausente (sin fecha de lanzamiento, sin fecha de añadida) excluyen la canción cuando ese filtro está activo. Con filtros activos «la propia playlist» queda desactivada porque sobrescribiría con un subconjunto.
- **v1.1, biblioteca y mezclas**: «toda mi biblioteca» excluye «🔀 Baraja» (si no, se leería y sobrescribiría a la vez). Las mezclas se guardan en localStorage (tope 50) y se validan al leerlas y al restaurarlas (`sanitizeMix`), porque el almacenamiento y los archivos son entradas no confiables. La última mezcla usa el mismo formato que las guardadas.
- **v1.1, interfaz**: se sigue la paleta pedida, no la de Spotify (su verde y su imagen están protegidos). «Oscuro por defecto» se interpreta como tema `dark` hasta que el usuario elija otro; las opciones son oscuro, claro y como el sistema. El color dinámico usa el degradado del color dominante calculado en canvas con `crossOrigin=anonymous`; si el CDN de imágenes no permite leer la portada, simplemente no hay degradado. Se añade una pestaña Inicio (5 pestañas). Los gestos (deslizar, tirar para refrescar) ignoran la lista de playlists y los campos para no estorbar al desplazarse. La animación de naipes se ve solo en el barajado, que es donde hay una espera visible.
- **v1.1, scopes**: se piden todos los de la v1.1 a la vez para que los usuarios reconecten una sola vez. La sesión guarda el `scope` devuelto por Spotify y, si falta alguno, se muestra la pantalla de reconexión.
- **v1.1, Reproducir ahora**: con dispositivo activo se usa ese; si no hay ninguno activo pero sí dispositivos, hoja inferior para elegir (incluso con uno solo, para no despertar un dispositivo sin querer); sin dispositivos, ayuda y enlace. Un 404 al reproducir se trata como «sin dispositivo».
- **v1.1, logo**: icono único para any/favicon/apple-touch (fondo índigo a sangre); el maskable es el mismo dibujo al 92 % y desplazado 11 px para centrarlo en la zona segura. No se incluye el logo oficial de Spotify (no se puede recrear ni modificar y no se puede descargar de forma fiable): queda como pendiente manual en SIGUIENTES_PASOS.md; mientras tanto las referencias a Spotify son enlaces de texto «LISTEN ON SPOTIFY» / «Abrir en Spotify».
- **Despliegue**: Pages se lanza con `workflow_run` cuando el CI de `main` termina en verde, para no desplegar con tests rotos; `workflow_dispatch` sigue disponible.
- **Test intermitente de barajar**: era una carrera del propio test (comprobaba con el texto «Listo» del resultado anterior, aún visible, mientras la escritura iba por el primer bloque de 100). Ahora espera a que `body.busy` se quite.
- **Tests e2e con el service worker bloqueado** para que no interfiera con `page.route`.
- **Licencia MIT a nombre de "Juan del Mazo"** (nombre del perfil de GitHub).
- **Iconos** generados con `scripts/make-icons.mjs` (Chromium de Playwright renderiza el SVG a PNG).
