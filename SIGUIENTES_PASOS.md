# Siguientes pasos

## 1. Qué hay hecho (v1.1.1)
- v1.1.1: logo oficial de Spotify junto a carátulas y metadatos, y botón «Actualizar» usable durante una tarea.
- Todo lo de la v1.0 más: Reproducir ahora, portada propia de «🔀 Baraja», pantalla «Tenerla siempre a mano», logo e iconos nuevos, rediseño con Inicio, mezclas guardadas, filtros, toda la biblioteca, playlists de otras personas con guía, instantáneas, Me gusta sin playlist, dividir, orden combinado, copia ampliada, asistente de alta y compartir. Detalle en `CHANGELOG.md`; decisiones en `DECISIONES.md`.
- Tests: unitarios y e2e con Spotify simulado en verde; CI y despliegue automático a Pages tras el CI de `main`.
- Tres rondas de seguridad en la v1.0 y una más sobre la v1.1.

## 2. Qué probar con Spotify real
1. **Reconexión**: al abrir la app con una sesión antigua debe salir «Baraja tiene funciones nuevas: vuelve a conectar» y, tras pulsar, pedir los permisos nuevos.
2. **▶ Reproducir ahora** (necesita Premium): con Spotify abierto en el móvil, comprobar que apaga el aleatorio y empieza por la primera canción; sin dispositivo activo, la ayuda y el enlace.
3. **Portada**: tras barajar a «🔀 Baraja», mirar si Spotify muestra la portada (puede tardar un poco). Si falla, el aviso lo dirá; se desactiva en Ajustes.
4. **Instantáneas** (`/me/top/tracks`, `/me/player/recently-played`) y **copia ampliada** (`/me/albums`, `/me/following` con paginación por cursor): comprobar que devuelven lo esperado en tu cuenta.
5. **Enlace pegado** de una playlist de otra persona: solo debe mostrar nombre y autor.
6. **Me gusta sin playlist** y **Dividir** con tu biblioteca real (el primero lee todas tus playlists y tarda).
7. Color de fondo según la portada: depende de que el CDN de imágenes de Spotify permita leerla (CORS); si no, simplemente no hay degradado.

## 3. iPhone
- Para ver el icono nuevo hay que quitar la app de la pantalla de inicio y volver a añadirla (la app lo avisa una vez).
- Cuando haya versión nueva saldrá el banner «Nueva versión disponible · Actualizar».

## 4. Pendiente
- Menores conocidos: una restauración que falla a mitad deja una playlist «(restaurada)» incompleta; el refresh del token entre pestañas simultáneas puede mostrar sesión caducada hasta recargar; el test de Escape/animaciones usa esperas cortas solo para las capturas del README.
- Ideas futuras en `ROADMAP.md`.
