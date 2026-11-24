# Siguientes pasos

## 1. Qué hay hecho
- Baraja v1.0.0 completa: barajar (varias playlists + Tus me gusta, destino «🔀 Baraja», nueva o la propia con Deshacer), ordenar (con atajo para copiar Tus me gusta y filtro por fecha), duplicados (exacto/inteligente), copia JSON/CSV y restaurar, Deshacer, es/en, PWA.
- Investigación en `INVESTIGACION.md`; decisiones en `DECISIONES.md`; ideas futuras en `ROADMAP.md`.
- 42 tests unitarios y 17 e2e en verde. Capturas en `docs/capturas/`.
- Repo privado `new-spoti` con la rama `feat/v1-baraja` (sin merge: ver `docs/bandeja.md`).

**Pendiente / no verificado**
- Probado a mano por el dueño contra la API real: barajar una y varias playlists, Tus me gusta, ordenar y duplicados. Copia de seguridad y restaurar no se han probado contra la API real.
- Tres rondas de revisión de seguridad hechas (la tercera el 2026-11-24).
- Conocido y menor: si falla a mitad una restauración, queda una playlist «(restaurada)» incompleta; el refresh del token entre pestañas simultáneas puede mostrar sesión caducada hasta recargar.
- Las cifras de votos de `INVESTIGACION.md` son de resúmenes de búsqueda; Reddit, App Store y Google Play no se pudieron leer.

## 2. Probar en el PC hoy
1. developer.spotify.com/dashboard → Create app → marca «Web API» → Redirect URI `http://127.0.0.1:5173/` → guarda.
2. En Settings copia el Client ID; en User Management añade tu email (hace falta Premium en la cuenta dueña).
3. `npm run dev` y abre `http://127.0.0.1:5173` (no `localhost`). Pega el Client ID y conecta.
4. Prueba primero con una playlist pequeña tuya.

## 3. Probar en el iPhone (necesita HTTPS)
1. `gh repo edit JuandelMazoVazquez/new-spoti --visibility public --accept-visibility-change-consequences`
2. Ajustes del repo → Pages → origen «GitHub Actions» (el workflow `pages.yml` despliega).
3. En Spotify añade la Redirect URI `https://juandelmazovazquez.github.io/new-spoti/`.
4. En Safari abre esa URL → Compartir → Añadir a pantalla de inicio.

## 4. Antes de hacerlo público
- Revisar README y capturas (las de Playwright usan datos falsos).
- Comprobar que no hay Client ID ni datos personales en el código (`js/config.js` está vacío).
- El nombre en `LICENSE` es "Juan del Mazo"; cámbialo si prefieres otro.
- Mergear `feat/v1-baraja` a `main`.

## 5. Ideas para la v2
Ver `ROADMAP.md`: dividir playlists, Tus me gusta sin playlist, intersección/diferencia, instantáneas con historial, plantillas de ordenación.
