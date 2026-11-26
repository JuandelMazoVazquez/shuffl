# Shuffl

[English](README.en.md)

Shuffl es una PWA estática (HTML, CSS y JavaScript vanilla, sin build ni dependencias de runtime) que baraja de verdad tus playlists de Spotify.

Proyecto independiente, no afiliado ni respaldado por Spotify. Spotify es una marca de Spotify AB; su logo (`icons/spotify/`) se incluye sin modificar según sus normas de marca para desarrolladores.

## Por qué existe

El aleatorio de Spotify no es uniforme: hay usuarios con 1.500 canciones que oyen siempre las mismas 30, y Spotify ha añadido "Fewer Repeats" precisamente para que repita menos. Shuffl no toca el reproductor. Reescribe el orden guardado de la playlist:

- Fisher-Yates con `crypto.getRandomValues` y muestreo por rechazo (sin sesgo de módulo), en `js/core.js`.
- Todas las canciones tienen la misma probabilidad de quedar en cualquier posición. Sin pesos, sin reglas de artista, sin excluir escuchas recientes.
- El resultado es una playlist que se reproduce **en orden**, con el aleatorio de Spotify desactivado.

Las funciones salen de quejas reales de usuarios (hilos de Spotify Community, prensa, reseñas). Las fuentes, con lo que se pudo y no se pudo verificar, están en [INVESTIGACION.md](INVESTIGACION.md).

## Funciones

### Inicio y aspecto

![Inicio](docs/capturas/08-inicio.png)

- Cuatro pestañas: **Inicio · Shuffle · Descubrir · Más**. En Más están Ordenar, Duplicados, Copia, Instantáneas, Me gusta sin playlist, Dividir, «Tenerla siempre a mano», «¿Es aleatorio de verdad?» y Ajustes.
- Inicio tiene una tarjeta con tu última baraja (carátula, nombre y fecha) y «Volver a barajar»; la primera vez, «Empezar». Debajo, «Lo último» y tus mezclas guardadas.
- Negro y verde lima. Tema oscuro por defecto, claro (blanco con verde oscuro) o como el sistema, en Ajustes. El fondo toma un degradado sutil del color de la portada seleccionada.
- Cambio de pantalla inmediato con un fundido corto y sin saltos (cada pestaña recuerda dónde la dejaste), pantalla «Barajando…» con naipes que se mezclan y el paso real, resultado en cascada con una celebración discreta, esqueletos de carga, deslizar a los lados para cambiar de pestaña y tirar hacia abajo para refrescar. Con «reducir movimiento» no hay animaciones.
- **Agitar para barajar**: en Inicio, agitar el móvil vuelve a barajar la última mezcla, siempre tras confirmar. En iPhone hay que activarlo con un toque (permiso del acelerómetro); se desactiva en Ajustes.

![Tema claro](docs/capturas/09-tema-claro.png)

![Más](docs/capturas/22-mas.png)

### Shuffle

![Barajar](docs/capturas/02-barajar.png)

- Un solo modo, por canciones. En «Más opciones» está **Por tiempo**: 15, 30, 45, 60 min o los que quieras; se baraja de forma uniforme y se llena el tiempo con ±2 min («35 min · Shuffle»), para el trayecto, el gym o correr.
- Quitar repetidas, filtros, destino, pegar enlace y guardar como mezcla también están en «Más opciones»; sin tocarlos funciona bien.

![Shuffle por tiempo](docs/capturas/24-shuffle-tiempo.png)

- Elige una o varias playlists y Tus me gusta: se combinan y se barajan juntas. Por defecto quita las canciones repetidas (misma URI) al combinar. Hay filtros previos (año, fecha de añadida, duración, explícitas): se aplican antes y luego se baraja de forma uniforme lo que queda.
- Destino:
  - Una playlist nueva de Shuffl (por defecto): «Reggaeton · Shuffle», «Tus me gusta · Shuffle», «Mix · Shuffle» (varias playlists; la descripción las lista), «Coche · Shuffle» (mezcla guardada) o «Toda mi música · Shuffle». Sustituye a la anterior de Shuffl (ver abajo).
  - La propia playlist, solo con una playlist tuya y con confirmación.
- La portada de la playlist generada lleva el icono de Shuffl, el nombre del origen y la fecha (se desactiva en Ajustes).
- El resultado enseña el nombre, las canciones y la duración, con «▶ Reproducir ahora» (Premium) y «Abrir en Spotify», y la lista de canciones con la carátula de su álbum. También puedes volver a barajar, compartirla o pulsar Deshacer.

![Resultado de barajar](docs/capturas/03-resultado-barajar.png)

### Solo una playlist de Shuffl en tu cuenta

![Borrar las antiguas](docs/capturas/23-borrar-antiguas.png)

- Cada vez que Shuffl va a crear una playlist (shuffle, Descubrir, Olvidadas, Instantáneas, Mi top), primero lee las canciones, después quita de tu biblioteca todas las playlists que creó antes y por último crea la nueva. Así solo existe una, la última.
- Son de Shuffl las tuyas con su etiqueta en la descripción (` · shuffl:src=<hash>`, sin ids ni nombres) o, las de versiones anteriores, con un nombre «… · Shuffle», «📸 …» o «🔀 Baraja» y una descripción de las que ponía la app. Nunca se tocan las que renombraste, las de otras personas, las colaborativas ni las que no tienen esa descripción, y no se ofrecen como origen.
- La primera vez se enseña la lista con «Borrar y no volver a preguntar»; después es automático, con un aviso. Se desactiva en Ajustes. Lo quitado se recupera durante 90 días en spotify.com → Cuenta → Recuperar playlists.
- Si quitar o crear falla, se ve el error real de Spotify con «Reintentar» (las canciones siguen en memoria). «Comprobar conexión», en Ajustes, prueba que Shuffl puede quitar playlists.
- Como cada shuffle crea una playlist nueva, el pin de Tu biblioteca no se conserva: ordena Tu biblioteca por «Recientes» para tenerla arriba.

### Descubrir

Spotify ya no ofrece recomendaciones a apps como esta, así que Shuffl las busca a partir de lo que escuchas y sigues. Cada opción crea una playlist de Shuffl con portada y «Reproducir ahora».

- **Novedades**: lanzamientos de los últimos 7, 30 o 90 días.
- **Descubre**: canciones de los álbumes que escuchas y de tus artistas.
- En las dos: unas 30 canciones y «Buscar más» para añadir otras 30 a la misma playlist; en «Más opciones», número (15-100) o duración (30-90 min). Se basan en tus artistas, en una playlist tuya («Como mi playlist…») o en un género (si Spotify da géneros para tus artistas). Nunca salen canciones que ya tienes en tus playlists o en Tus me gusta.
- **Olvidadas**: Me gusta de hace más de 1, 2, 3 o 5 años.
- **Tu resumen**: tus 5 artistas y canciones top (4 semanas, 6 meses o siempre) en una tarjeta vertical para historias (1080×1920) y otra cuadrada, para compartir o descargar. Las carátulas van enteras y sin nada encima, junto al logo de Spotify. Puedes crear «Mi top · Shuffle».

Lo que se lee de Spotify (artistas, lanzamientos, canciones de cada álbum y qué canciones tienes) se guarda en el dispositivo hasta 24 h para gastar menos peticiones.

![Descubrir](docs/capturas/21-descubrir.png)

![Novedades](docs/capturas/25-novedades.png)

![Tu resumen](docs/capturas/26-tu-resumen.png)

### Elige por mí y «¿Es aleatorio de verdad?»

- **Elige por mí**: una ruleta elige una de tus playlists, todas con la misma probabilidad (la elección se hace antes de animar), y la baraja en una playlist nueva de Shuffl.
- **¿Es aleatorio de verdad?**: simula 10.000 barajas de 10 canciones en tu dispositivo y enseña, con un gráfico de barras animado y una tabla, cuántas veces suena primero cada canción con el barajado de Shuffl (todas cerca del 10 %) y con un barajado sesgado (el error clásico de intercambiar cada canción con cualquier posición).

![Prueba de aleatoriedad](docs/capturas/19-prueba-aleatorio.png)

### Siri, atajos y coche

- Enlaces profundos: `?mezcla=<id>&play=1` rebaraja una mezcla guardada y la reproduce con el aleatorio de Spotify apagado; `?origen=<id de playlist>&play=1` hace lo mismo con una playlist. Solo se ejecutan con la sesión iniciada y si la mezcla o la playlist existen en ese navegador, siempre crean una playlist nueva de Shuffl (nunca escriben en el origen) y se quitan de la dirección al leerlos. Los atajos llevan una clave de ese navegador (`k`); un enlace sin ella, por ejemplo desde otra web, pide confirmación.
- Cada mezcla guardada tiene el botón «Crear atajo de Siri», con el enlace para copiar y los pasos en la app Atajos (acción «Abrir URL» y un nombre como «Shuffl coche»). En iPhone, Atajos abre el enlace en Safari, que no comparte datos con la app de la pantalla de inicio: hay que iniciar sesión, tener la mezcla y crear el atajo también desde Safari.
- CarPlay no admite apps web. Tu playlist de Shuffl sí aparece en Spotify dentro de CarPlay; la ayuda de «Tenerla siempre a mano» lo explica.

![Atajo de Siri](docs/capturas/18-atajo-siri.png)

### Ordenar

![Ordenar](docs/capturas/04-ordenar.png)

- Criterios: fecha de lanzamiento (ascendente y descendente), artista, álbum, título, duración (ascendente y descendente), fecha de añadida (ascendente y descendente), invertir.
- Atajo para copiar Tus me gusta a una playlist normal, que sí se puede reordenar.
- Filtro por fecha de añadida (desde y hasta, ambos opcionales).
- Destino: playlist nueva, o sobrescribir la propia (no disponible con Tus me gusta ni con el filtro de fechas).

### Duplicados

![Duplicados](docs/capturas/05-duplicados.png)

- Exacto: misma URI.
- Inteligente: mismo ISRC, o mismo título y artista aunque sea otra edición (remaster, radio edit). Live y Acoustic cuentan como versiones distintas.
- Se conserva la primera aparición. Eliges qué repetidas quitar y si lo haces en la playlist original (con Deshacer) o en una copia limpia.

### Copia y restaurar

![Copia](docs/capturas/06-copia.png)

- Exporta las playlists elegidas (y Tus me gusta) a JSON o CSV. En móviles con soporte usa el menú de compartir; si no, descarga el archivo.
- Restaurar lee un JSON de Shuffl y crea una playlist nueva por cada una, con el sufijo «(restaurada)».

### Deshacer

Antes de sobrescribir una playlist, Shuffl guarda en el navegador las canciones y el orden anteriores. Ajustes tiene el botón Deshacer, y cada resultado lo ofrece para su playlist. Solo se guarda una copia: la última operación que sobrescribe.

![Ajustes](docs/capturas/07-ajustes.png)

## Primer uso: crear tu Client ID

No hay servidor, así que cada persona usa su propio Client ID de Spotify.

![Bienvenida](docs/capturas/01-bienvenida.png)

1. Entra en [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) con tu cuenta.
2. Pulsa Create app y marca «Web API».
3. En Redirect URIs añade la dirección que muestra Shuffl (ver abajo) y guarda.
4. Abre Settings, copia el Client ID y pégalo en Shuffl.
5. En User Management añade por email a quien vaya a usar la app (máximo 5).

Requisitos de Spotify para apps en Development Mode: el dueño de la app necesita Premium y la app admite hasta 5 usuarios.

### Redirect URI

Shuffl usa `new URL('./', location.href)`, así que la URI es la dirección de la app con barra final:

- Local: `http://127.0.0.1:5173/` (`localhost` no vale).
- GitHub Pages: `https://USUARIO.github.io/new-spoti/`.

Ajustes y la pantalla inicial muestran la URI exacta con un botón para copiarla.

## Instalar en iPhone

Abre la dirección HTTPS de la app en Safari, pulsa Compartir y elige Añadir a pantalla de inicio. Necesita HTTPS, no funciona con la versión local.

## Fork y despliegue en GitHub Pages

1. Haz un fork del repositorio.
2. En Settings, Pages, elige como origen «GitHub Actions».
3. El workflow `.github/workflows/pages.yml` publica la app en cada push a `main` (solo si el repo es público) o a mano con «Run workflow».
4. Opcional: pon tu Client ID en `DEFAULT_CLIENT_ID` de `js/config.js`. El Client ID no es secreto (PKCE no usa client secret), pero cada app admite como máximo 5 usuarios.
5. Añade en tu app de Spotify la Redirect URI `https://USUARIO.github.io/new-spoti/`.

## Limitaciones

- Spotify solo permite leer playlists propias o colaborativas con la API usada: las demás aparecen deshabilitadas.
- Los archivos locales se omiten (Shuffl avisa de cuántos). Sobrescribir una playlist con archivos locales los pierde, por eso pide confirmación.
- Máximo 10.000 canciones por playlist: el resto se corta tras barajar.
- Tus me gusta puede no estar disponible (se prueba al abrir la app y se marca como no disponible si falla).
- Deshacer guarda una sola operación.
- Con Development Mode: Premium para el dueño y 5 usuarios.

## Desarrollo

Requiere Node.js.

```
npm run dev        # servidor estático en http://127.0.0.1:5173
npm test           # tests unitarios (node --test)
npm run test:e2e   # tests de extremo a extremo con Playwright
npm run icons      # regenera los iconos de icons/
```

`npm install` solo instala Playwright (devDependency). Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacidad

Todo ocurre en tu navegador. Shuffl solo habla con `accounts.spotify.com` y `api.spotify.com`, sin servidor propio, analítica ni cookies. Detalle en [PRIVACY.md](PRIVACY.md).

## Licencia

MIT, ver [LICENSE](LICENSE).
