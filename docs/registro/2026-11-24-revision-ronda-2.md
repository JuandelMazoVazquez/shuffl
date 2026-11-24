# 2026-11-24 Revisión de seguridad, ronda 2

Sin hallazgos en tokens, PKCE (state de un solo uso), XSS (sin innerHTML) ni service worker.

Corregido:
- Crítico: reintentar tras una escritura a medias pisaba el Deshacer del original. Ahora el Deshacer se marca `pending` hasta que termina la escritura y un nuevo guardado sobre esa playlist se rechaza.
- Importante: si localStorage no puede guardar el Deshacer, la operación se aborta (antes seguía solo con memoria).
- Deshacer comprueba que la playlist no cambió desde la operación (`after`).
- `assertUnchanged` compara también la primera página, no solo el total.
- Importación: tope de 20 MB antes de leer, URIs de 22 caracteres, máximo 200 playlists.
- Restaurar: las casillas de las playlists ya creadas se desmarcan, así un reintento no las duplica.
- Refresh: si otra pestaña ya rotó el token, no se muestra error de sesión caducada.

Tests: 42 unitarios y 16 e2e. Caché del service worker subida a `baraja-v2`.
