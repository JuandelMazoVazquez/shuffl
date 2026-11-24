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
- **Despliegue**: Pages se lanza con `workflow_run` cuando el CI de `main` termina en verde, para no desplegar con tests rotos; `workflow_dispatch` sigue disponible.
- **Test intermitente de barajar**: era una carrera del propio test (comprobaba con el texto «Listo» del resultado anterior, aún visible, mientras la escritura iba por el primer bloque de 100). Ahora espera a que `body.busy` se quite.
- **Tests e2e con el service worker bloqueado** para que no interfiera con `page.route`.
- **Licencia MIT a nombre de "Juan del Mazo"** (nombre del perfil de GitHub).
- **Iconos** generados con `scripts/make-icons.mjs` (Chromium de Playwright renderiza el SVG a PNG).
