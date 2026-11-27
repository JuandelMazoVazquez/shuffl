# Hoja de ruta

Ideas posibles con la API actual pero grandes o con demanda por verificar. Lo ya hecho está en [CHANGELOG.md](CHANGELOG.md).

¿Quieres ayudar? Las que están listas para empezar tienen su issue con [`good first issue`](https://github.com/JuandelMazoVazquez/new-spoti/labels/good%20first%20issue) o [`help wanted`](https://github.com/JuandelMazoVazquez/new-spoti/labels/help%20wanted). Las ideas nuevas, en [Discussions → Ideas](https://github.com/JuandelMazoVazquez/new-spoti/discussions/categories/ideas).

- **Intersección y diferencia** entre dos playlists. ([#32](https://github.com/JuandelMazoVazquez/new-spoti/issues/32))
- **Instantáneas con historial**: varias versiones restaurables en vez de un solo Deshacer. ([#33](https://github.com/JuandelMazoVazquez/new-spoti/issues/33))
- **Plantillas de ordenación** guardadas (la v1.1 ya permite el orden combinado, pero no guardarlo con nombre). ([#31](https://github.com/JuandelMazoVazquez/new-spoti/issues/31))
- **Dividir Tus me gusta** sin pasar por una playlist. ([#30](https://github.com/JuandelMazoVazquez/new-spoti/issues/30))
- **Restaurar álbumes y artistas** de la copia ampliada con `PUT /me/library`.
- **Restaurar Tus me gusta** conservando la fecha de añadida (la API no lo permite hoy; revisar si cambia).
- **Más idiomas** además de español e inglés. ([#29](https://github.com/JuandelMazoVazquez/new-spoti/issues/29))
- **«Tal día como hoy» de verdad** con el archivo de datos de Spotify. La API solo da las últimas 50 escuchas, así que no se sabe qué sonaba en una fecha concreta.
  - La persona pide su «Historial de reproducción ampliado» en spotify.com → Cuenta → Privacidad (llega en días, en JSON) y lo carga en Shuffl.
  - Se procesa solo en el dispositivo, sin subirlo a ninguna parte, para crear una playlist con lo que escuchabas ese día en años anteriores.
  - Antes hay que validar el formato real del archivo y su tamaño (puede ser de cientos de MB).
- **Barajar por álbumes** (quitado en la v1.3.1 para simplificar Shuffle). Si se recupera, como herramienta aparte en Más.
- **Similares · Shuffle** (artistas parecidos a tus artistas top con MusicBrainz y ListenBrainz). No entra en la v1.3: MusicBrainz exige un User-Agent identificativo que el navegador no puede poner, responde 503 por su límite global y el endpoint de similares está en «labs». Requisitos para retomarlo: un endpoint estable con CORS que no exija User-Agent propio, o el visto bueno de MetaBrainz para una PWA. Detalle en [docs/specs/metabrainz-similares.md](docs/specs/metabrainz-similares.md).
