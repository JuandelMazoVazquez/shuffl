# Hoja de ruta

Ideas posibles con la API actual pero grandes o con demanda por verificar. Lo ya hecho está en [CHANGELOG.md](CHANGELOG.md).

- **Intersección y diferencia** entre dos playlists.
- **Instantáneas con historial**: varias versiones restaurables en vez de un solo Deshacer.
- **Plantillas de ordenación** guardadas (la v1.1 ya permite el orden combinado, pero no guardarlo con nombre).
- **Dividir Tus me gusta** sin pasar por una playlist.
- **Restaurar álbumes y artistas** de la copia ampliada con `PUT /me/library`.
- **Restaurar Tus me gusta** conservando la fecha de añadida (la API no lo permite hoy; revisar si cambia).
- **Más idiomas** además de español e inglés.
- **Similares · Shuffle** (artistas parecidos a tus artistas top con MusicBrainz y ListenBrainz). No entra en la v1.3: MusicBrainz exige un User-Agent identificativo que el navegador no puede poner, responde 503 por su límite global y el endpoint de similares está en «labs». Requisitos para retomarlo: un endpoint estable con CORS que no exija User-Agent propio, o el visto bueno de MetaBrainz para una PWA. Detalle en [docs/specs/metabrainz-similares.md](docs/specs/metabrainz-similares.md).
