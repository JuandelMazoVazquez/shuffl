# Seguridad / Security

**Español** · [English](#reporting-a-vulnerability)

## Informar de una vulnerabilidad

Por favor, **no abras un issue público**. Usa el aviso privado de GitHub:

1. Ve a la pestaña [Security → Report a vulnerability](https://github.com/JuandelMazoVazquez/shuffl/security/advisories/new).
2. Cuenta qué has encontrado, cómo reproducirlo y qué impacto tiene.

Solo lo verá quien mantiene el proyecto. Intentaré responder en una semana y, si se confirma, publicar el arreglo y darte las gracias en las notas de la versión (si quieres).

## Qué entra

- La app de `https://juandelmazovazquez.github.io/shuffl/` y el código de este repositorio.
- En especial: el login con PKCE y los tokens, la inyección de datos de Spotify en la página, los enlaces profundos (`?mezcla=`, `?origen=`), lo que la app borra o sobrescribe en tu cuenta y el service worker.

Fuera: fallos de Spotify o de GitHub Pages, y los límites de Spotify (cuota, 5 usuarios), que se explican en el README.

## Versiones

Solo se mantiene la última versión publicada. La app instalada se actualiza sola (sale el aviso «Nueva versión disponible»).

---

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting:

1. Go to [Security → Report a vulnerability](https://github.com/JuandelMazoVazquez/shuffl/security/advisories/new).
2. Describe what you found, how to reproduce it and its impact.

Only the maintainer will see it. I will try to reply within a week and, once confirmed, release a fix and credit you in the release notes (if you wish).

**In scope:** the app at `https://juandelmazovazquez.github.io/shuffl/` and the code in this repository, especially PKCE sign-in and tokens, injection of Spotify data into the page, deep links (`?mezcla=`, `?origen=`), what the app deletes or overwrites in your account, and the service worker. **Out of scope:** bugs in Spotify or GitHub Pages, and Spotify's own limits (quota, 5 users).

Only the latest release is supported. The installed app updates itself ("New version available" banner).
