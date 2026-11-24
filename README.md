# Baraja

[English](README.en.md)

Baraja es una PWA estática (HTML, CSS y JavaScript vanilla, sin build ni dependencias de runtime) que baraja de verdad tus playlists de Spotify.

Proyecto independiente, no afiliado ni respaldado por Spotify. Spotify es una marca de Spotify AB; su logo (`icons/spotify/`) se incluye sin modificar según sus normas de marca para desarrolladores.

## Por qué existe

El aleatorio de Spotify no es uniforme: hay usuarios con 1.500 canciones que oyen siempre las mismas 30, y Spotify ha añadido "Fewer Repeats" precisamente para que repita menos. Baraja no toca el reproductor. Reescribe el orden guardado de la playlist:

- Fisher-Yates con `crypto.getRandomValues` y muestreo por rechazo (sin sesgo de módulo), en `js/core.js`.
- Todas las canciones tienen la misma probabilidad de quedar en cualquier posición. Sin pesos, sin reglas de artista, sin excluir escuchas recientes.
- El resultado es una playlist que se reproduce **en orden**, con el aleatorio de Spotify desactivado.

Las funciones salen de quejas reales de usuarios (hilos de Spotify Community, prensa, reseñas). Las fuentes, con lo que se pudo y no se pudo verificar, están en [INVESTIGACION.md](INVESTIGACION.md).

## Funciones

### Inicio y aspecto

![Inicio](docs/capturas/08-inicio.png)

- Inicio con tarjetas grandes: «Volver a barajar mi última mezcla» y atajos a cada función.
- Tema oscuro por defecto, claro o como el sistema (Ajustes). El fondo toma un degradado del color de la portada seleccionada.
- Naipes que se mezclan mientras se leen las canciones, resultado en cascada, esqueletos de carga, deslizar a los lados para cambiar de pestaña y tirar hacia abajo para refrescar. Respeta «reducir movimiento».

![Tema claro](docs/capturas/09-tema-claro.png)

### Barajar

![Barajar](docs/capturas/02-barajar.png)

- Elige una o varias playlists y Tus me gusta: se combinan y se barajan juntas. Por defecto quita las canciones repetidas (misma URI) al combinar.
- Destino:
  - Playlist «🔀 Baraja»: se crea una vez y se sobrescribe en cada barajado.
  - Playlist nueva en cada barajado (`Baraja · fecha`).
  - La propia playlist, solo con una playlist tuya y con confirmación.
- Tras barajar puedes volver a barajar, abrir la playlist en Spotify o pulsar Deshacer.

![Resultado de barajar](docs/capturas/03-resultado-barajar.png)

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
- Restaurar lee un JSON de Baraja y crea una playlist nueva por cada una, con el sufijo «(restaurada)».

### Deshacer

Antes de sobrescribir una playlist, Baraja guarda en el navegador las canciones y el orden anteriores. Ajustes tiene el botón Deshacer, y cada resultado lo ofrece para su playlist. Solo se guarda una copia: la última operación que sobrescribe.

![Ajustes](docs/capturas/07-ajustes.png)

## Primer uso: crear tu Client ID

No hay servidor, así que cada persona usa su propio Client ID de Spotify.

![Bienvenida](docs/capturas/01-bienvenida.png)

1. Entra en [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) con tu cuenta.
2. Pulsa Create app y marca «Web API».
3. En Redirect URIs añade la dirección que muestra Baraja (ver abajo) y guarda.
4. Abre Settings, copia el Client ID y pégalo en Baraja.
5. En User Management añade por email a quien vaya a usar la app (máximo 5).

Requisitos de Spotify para apps en Development Mode: el dueño de la app necesita Premium y la app admite hasta 5 usuarios.

### Redirect URI

Baraja usa `new URL('./', location.href)`, así que la URI es la dirección de la app con barra final:

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
- Los archivos locales se omiten (Baraja avisa de cuántos). Sobrescribir una playlist con archivos locales los pierde, por eso pide confirmación.
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

Todo ocurre en tu navegador. Baraja solo habla con `accounts.spotify.com` y `api.spotify.com`, sin servidor propio, analítica ni cookies. Detalle en [PRIVACY.md](PRIVACY.md).

## Licencia

MIT, ver [LICENSE](LICENSE).
