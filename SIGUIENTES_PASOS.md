# Siguientes pasos

## 1. Qué hay hecho (v1.4.1)
- **Todo se llama Shuffl**: repo https://github.com/JuandelMazoVazquez/shuffl y app en **https://juandelmazovazquez.github.io/shuffl/**. Las playlists nuevas terminan en «· Shuffl».
- **La dirección antigua** (`…github.io/new-spoti/`) la sirve un repo mínimo `new-spoti` que redirige a la nueva con la misma ruta, query y hash. Si llega un inicio de sesión de Spotify a la antigua, no lo reenvía: avisa de conectar desde la nueva.
- **Tus datos se migran solos** (sesión, Client ID, mezclas, Deshacer, ajustes): no hay que volver a iniciar sesión.
- **Una sola paleta** en `js/brand.js` y guía de marca en `docs/BRAND.md`. Medios de `docs/media/` regenerados.

## 2. Lo que tienes que hacer tú
1. **Añadir la Redirect URI nueva en Spotify** (sin borrar la antigua todavía):
   1. Abre https://developer.spotify.com/dashboard y entra en tu app.
   2. **Settings** → **Edit** → **Redirect URIs**: pega `https://juandelmazovazquez.github.io/shuffl/` (con la barra final) y pulsa **Add**.
   3. Baja hasta el final y pulsa **Save**.
   Si alguien más usa Shuffl con su propio Client ID, tiene que hacer lo mismo; la app se lo explica si falta.
2. **Cambiar el nombre de la app en el dashboard de Spotify a «Shuffl»**: **Settings** → **Edit** → **App name** → **Save**. Es lo que se ve en la pantalla de permisos al conectar.
3. **Volver a subir la social preview** (la API de GitHub no permite subirla): https://github.com/JuandelMazoVazquez/shuffl/settings → General → **Social preview** → **Edit** → **Upload an image…** y sube `docs/media/social-preview-es.png` (o la `-en`).
4. **Reinstalar la app en el iPhone desde la dirección nueva**: mantén pulsado el icono de Shuffl → **Eliminar app** (solo quita el acceso directo, tus datos siguen), abre https://juandelmazovazquez.github.io/shuffl/ en Safari → Compartir → **Añadir a pantalla de inicio**. La sesión sigue iniciada: es el mismo origen.
5. **Renombrar la carpeta local** a `C:\proyectos_personales\shuffl` y volver a abrirla en T3 Code. El remoto ya apunta a `https://github.com/JuandelMazoVazquez/shuffl.git` (GitHub redirige el nombre antiguo igualmente).

## 3. Pendiente de versiones anteriores
- **Mira el README en el móvil** (la app de GitHub o el navegador): lo he revisado en escritorio y con un viewport de móvil, no en un móvil real.
- **Opcional**: un email de contacto para el código de conducta en `CODE_OF_CONDUCT.md` (*Enforcement*). Ahora remite al aviso privado de GitHub.
- La «Prueba completa» con tu cuenta real en el iPhone (Más → Diagnóstico) sigue pendiente desde la v1.3.2: abre Spotify un momento, haz la prueba y, si algún paso sale con ✗, pulsa «Copiar informe» y pégamelo.
- «Tal día como hoy» real con el archivo de datos de Spotify y «Similares» con MetaBrainz: ideas en `ROADMAP.md`.
