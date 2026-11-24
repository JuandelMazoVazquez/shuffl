# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Corregido

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

[1.0.0]: https://github.com/JuandelMazoVazquez/new-spoti/releases/tag/v1.0.0
