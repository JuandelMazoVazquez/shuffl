# Contribuir a Baraja

## Preparar el entorno

```
npm install        # solo instala Playwright
npm run dev        # http://127.0.0.1:5173
```

## Tests

- `npm test`: tests unitarios con `node --test` (`tests/unit/core.test.js`, `tests/unit/api.test.js`). La lógica pura vive en `js/core.js` y el cliente de API en `js/api.js`, ambos probables sin navegador.
- `npm run test:e2e`: Playwright con un mock de Spotify (`tests/e2e/mock.mjs`). Arranca solo el servidor local.

Toda lógica nueva lleva test unitario.

## Estilo

- Sin build: lo que está en el repositorio es lo que se sirve.
- ES modules nativos, JavaScript vanilla.
- Sin dependencias de runtime. Las devDependencies se limitan a las herramientas de test.
- Sin `innerHTML` con datos de Spotify (nombres de canciones, playlists, artistas). `js/app.js` construye el DOM con `createElement` y `textContent` a través de `h()`.
- Sin comentarios que repiten el código.
- Los textos de la interfaz van en `js/i18n.js`, en español e inglés.

## Service worker

Si cambias cualquier archivo de la app, sube la versión de `CACHE` en `sw.js` (`baraja-v1` pasa a `baraja-v2`). Sin eso, los clientes con la versión anterior en caché no reciben los cambios. Si añades un archivo a la app, inclúyelo también en `SHELL`.

## Ramas y commits

- Una rama por tarea: `feat/nombre` o `fix/nombre`.
- Commits pequeños, en español, con el porqué en el cuerpo del mensaje.
- Antes de abrir un pull request, `npm test` y `npm run test:e2e` en verde.
