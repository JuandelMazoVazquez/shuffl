# Redirección de la dirección antigua

Fuente del repo `JuandelMazoVazquez/new-spoti`, que solo existe para que la dirección antigua de la app
(`https://juandelmazovazquez.github.io/new-spoti/`) lleve a la nueva (`https://juandelmazovazquez.github.io/shuffl/`).

- `index.html` (y una copia idéntica como `404.html`, para cualquier subruta): redirige conservando ruta, query y hash.
  Un callback de OAuth (`?code`, `?error`, `?state`) no se reenvía: muestra un aviso para volver a conectar desde la
  dirección nueva.
- `sw.js`: sustituye al service worker de la app antigua y se da de baja.

Lo prueba `tests/e2e/redirect.spec.mjs`. Para publicar un cambio, copia estos archivos al repo `new-spoti`
(con `index.html` también como `404.html`).
