# 2026-11-24 Revisión de seguridad, ronda 3

Sin críticos. Corregido (tres importantes y dos menores):
- Un Deshacer podía quedar "seguro" tras una escritura a medias en «Volver a barajar» o al deshacer, y dejaba la playlist incompleta sin salida. Ahora se vuelve a marcar pendiente antes de cualquier escritura sobre su playlist.
- Una escritura en otra playlist pisaba un Deshacer pendiente. Ahora se rechaza con el nombre de la playlist afectada.
- La importación rechazaba copias que la propia app exportaba (Tus me gusta de más de 10.000 canciones). Ahora se trunca a 10.000 esa playlist y el resto se restaura. Al exportar se avisa si se superan 200 playlists o 20 MB, y el JSON exportado ya no lleva indentación.
- `assertUnchanged` lanza error si la respuesta no trae lista.
- Un error de lectura del archivo ya no muestra una clave de texto en bruto.

No corregido (menor, sin pérdida de datos): playlist «(restaurada)» incompleta si falla a mitad; carrera de refresh entre pestañas; el chequeo solo compara total y primera página.

Tests: 42 unitarios y 17 e2e. Caché del service worker en `baraja-v3`.
