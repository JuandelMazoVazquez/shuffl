# Contribuir a Shuffl

**Español** · [English](#contributing-to-shuffl)

Gracias por querer ayudar. Shuffl es pequeño a propósito: HTML, CSS y JavaScript sin build ni dependencias. Puedes probarlo todo **sin cuenta de Spotify** gracias al modo demo.

## Arrancar en local

Necesitas Node.js 22 o superior.

```
git clone https://github.com/JuandelMazoVazquez/shuffl.git
cd shuffl
npm install          # solo instala Playwright (tests)
npm run dev          # http://127.0.0.1:5173
```

Abre `http://127.0.0.1:5173/?demo=1` para usar la app con datos inventados. Para probar con tu Spotify, crea un Client ID (pasos en el [README](README.md#empezar-en-5-minutos)) con la Redirect URI `http://127.0.0.1:5173/` (`localhost` no vale).

## Tests

```
npm test             # unitarios (node --test, tests/unit)
npx playwright install chromium   # la primera vez
npm run test:e2e     # extremo a extremo con un Spotify simulado (tests/e2e/mock.mjs)
npm run media        # regenera capturas, GIFs y vídeo de docs/media (necesita ffmpeg)
```

- La lógica pura vive en `js/core.js`, `js/generators.js`, `js/targets.js`… y se prueba sin navegador. Toda lógica nueva lleva test unitario.
- Una pantalla o un flujo nuevo lleva un test en `tests/e2e/`.
- El CI ejecuta las dos suites en cada pull request.

## Estilo y reglas del proyecto

- Sin build ni dependencias de runtime: lo que hay en el repo es lo que se sirve. Las devDependencies se limitan a las herramientas de test.
- ES modules nativos y JavaScript vanilla. El DOM se construye con `h()` (`createElement` + `textContent`): **nunca `innerHTML` con datos de Spotify**.
- El barajado es uniforme y puro (Fisher-Yates): sin pesos ni reglas de artista.
- Solo los endpoints de la Web API que Spotify permite en Development Mode (lista en [CLAUDE.md](CLAUDE.md)). Un endpoint nuevo hay que comprobarlo antes.
- Los textos de la interfaz van en `js/i18n.js`, en español e inglés. Un test comprueba que no falta ninguna clave.
- Si añades un archivo JS, inclúyelo en `SHELL` de `sw.js` (un test lo exige).
- Sin comentarios que repiten el código y sin funcionalidad fuera de la tarea.
- Los comentarios del código y los mensajes de commit van en español; en issues y pull requests vale el inglés.

## Proponer cambios

1. Para algo grande, abre antes un issue o una idea en [Discussions](https://github.com/JuandelMazoVazquez/shuffl/discussions/categories/ideas) y lo hablamos.
2. Haz un fork y crea una rama `feat/nombre` o `fix/nombre`.
3. Commits pequeños que expliquen el porqué en el cuerpo del mensaje.
4. Con `npm test` y `npm run test:e2e` en verde, abre el pull request y rellena la plantilla.

Los errores de seguridad no van a issues públicos: mira [SECURITY.md](SECURITY.md). Al participar aceptas el [código de conducta](CODE_OF_CONDUCT.md).

## Tu propia copia en GitHub Pages

1. Haz un fork y, en Settings → Pages, elige «GitHub Actions» como origen.
2. `.github/workflows/pages.yml` publica la app cuando el CI de `main` pasa (o a mano con «Run workflow»).
3. Añade `https://USUARIO.github.io/shuffl/` como Redirect URI en tu app de Spotify.
4. Opcional: pon tu Client ID en `DEFAULT_CLIENT_ID` de `js/config.js`. No es secreto (PKCE no usa client secret), pero cada app admite como máximo 5 usuarios.

---

# Contributing to Shuffl

[Español](#contribuir-a-shuffl) · **English**

Thanks for wanting to help. Shuffl is small on purpose: HTML, CSS and JavaScript with no build step and no dependencies. You can try everything **without a Spotify account** thanks to the demo mode.

## Run it locally

You need Node.js 22 or later.

```
git clone https://github.com/JuandelMazoVazquez/shuffl.git
cd shuffl
npm install          # only installs Playwright (tests)
npm run dev          # http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173/?demo=1` to use the app with made-up data. To try it with your Spotify, create a Client ID (steps in the [README](README.en.md#get-started-in-5-minutes)) with the Redirect URI `http://127.0.0.1:5173/` (`localhost` does not work).

## Tests

```
npm test             # unit tests (node --test, tests/unit)
npx playwright install chromium   # first time only
npm run test:e2e     # end-to-end against a simulated Spotify (tests/e2e/mock.mjs)
npm run media        # regenerates screenshots, GIFs and video in docs/media (needs ffmpeg)
```

- Pure logic lives in `js/core.js`, `js/generators.js`, `js/targets.js`… and is tested without a browser. New logic comes with a unit test.
- A new screen or flow comes with a test in `tests/e2e/`.
- CI runs both suites on every pull request.

## Style and project rules

- No build step and no runtime dependencies: what is in the repo is what gets served. devDependencies are limited to test tools.
- Native ES modules and vanilla JavaScript. The DOM is built with `h()` (`createElement` + `textContent`): **never `innerHTML` with Spotify data**.
- The shuffle is uniform and pure (Fisher-Yates): no weights and no artist rules.
- Only the Web API endpoints Spotify allows in Development Mode (list in [CLAUDE.md](CLAUDE.md)). Any new endpoint has to be checked first.
- UI strings live in `js/i18n.js`, in Spanish and English. A test checks that no key is missing.
- If you add a JS file, add it to `SHELL` in `sw.js` (a test requires it).
- No comments that repeat the code and no features outside the task.
- Code comments and commit messages are in Spanish; English is fine in issues and pull requests.

## Proposing changes

1. For anything big, open an issue or an idea in [Discussions](https://github.com/JuandelMazoVazquez/shuffl/discussions/categories/ideas) first so we can talk about it.
2. Fork and create a `feat/name` or `fix/name` branch.
3. Small commits that explain the why in the message body.
4. With `npm test` and `npm run test:e2e` green, open the pull request and fill in the template.

Security issues do not go in public issues: see [SECURITY.md](SECURITY.md). By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).

## Your own copy on GitHub Pages

1. Fork it and, in Settings → Pages, choose "GitHub Actions" as the source.
2. `.github/workflows/pages.yml` publishes the app when CI on `main` passes (or by hand with "Run workflow").
3. Add `https://USERNAME.github.io/shuffl/` as a Redirect URI in your Spotify app.
4. Optional: put your Client ID in `DEFAULT_CLIENT_ID` in `js/config.js`. It is not secret (PKCE uses no client secret), but each app allows 5 users at most.
