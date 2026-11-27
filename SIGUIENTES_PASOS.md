# Siguientes pasos

## 1. Qué hay hecho (v1.4.0)
- **Modo demo**: «Probar la demo» en la bienvenida o https://juandelmazovazquez.github.io/new-spoti/?demo=1. Datos inventados, ninguna petición a Spotify.
- **README nuevo** en español e inglés, con capturas, GIFs, guía de 5 minutos, limitaciones, diagramas y preguntas frecuentes.
- **Comunidad**: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, plantillas de issues y de PR, 5 issues para contribuidores y Discussions con la categoría Ideas.
- **`npm run media`** regenera todos los medios de `docs/media/` (los GIF y el MP4 necesitan ffmpeg).

## 2. Lo que tienes que hacer tú a mano
1. **Social preview** (la API de GitHub no permite subirla):
   1. Abre https://github.com/JuandelMazoVazquez/new-spoti/settings → General → **Social preview** → **Edit** → **Upload an image…**
   2. Sube `docs/media/social-preview-es.png` o `docs/media/social-preview-en.png` (1280×640). Recomiendo la inglesa si quieres llegar fuera de España; la española si el lanzamiento en X es en español.
2. **Para X**:
   - Vídeo vertical (1080×1920, unos 16 s, H.264): `docs/media/shuffl-es.mp4` (y `shuffl-en.mp4`).
   - GIFs (todos por debajo de 2,5 MB): `docs/media/shuffle-es.gif` (barajar → resultado → Reproducir ahora), `docs/media/time-es.gif` (shuffle por tiempo) y `docs/media/proof-es.gif` (prueba de aleatoriedad). Cada uno tiene su versión `-en`.
   - Imagen: `docs/media/header-es.png`.
   - Enlace para el tuit: https://juandelmazovazquez.github.io/new-spoti/?demo=1 (se prueba sin cuenta) y el repo https://github.com/JuandelMazoVazquez/new-spoti
3. **Mira el README en el móvil** (la app de GitHub o el navegador): yo lo he revisado en escritorio y con un viewport de móvil, pero no en un móvil real.
4. **Opcional**: si quieres un email de contacto para el código de conducta, añádelo en `CODE_OF_CONDUCT.md`, en el apartado *Enforcement*. Ahora mismo remite al aviso privado de GitHub, porque no he querido publicar tu email.

## 3. Pendiente de versiones anteriores
- La «Prueba completa» con tu cuenta real en el iPhone (Más → Diagnóstico) sigue pendiente desde la v1.3.2: abre Spotify un momento, haz la prueba y, si algún paso sale con ✗, pulsa «Copiar informe» y pégamelo.
- «Tal día como hoy» real con el archivo de datos de Spotify y «Similares» con MetaBrainz: ideas en `ROADMAP.md`.
