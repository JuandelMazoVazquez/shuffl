# Siguientes pasos

## 1. Qué hay hecho (v1.3.1)
- Solo una playlist de Shuffl a la vez: antes de crear una se quitan todas las anteriores. La app pide dos permisos nuevos para poder quitarlas.
- Cambio de pestaña limpio, Inicio con la tarjeta de la última baraja, pantalla «Barajando…» y resultado con carátulas.
- Novedades y Descubre: 30 canciones, «Buscar más», número o duración, estilo, y sin lo que ya tienes. Se quitan «Tal día como hoy» y «Por álbumes».
- Detalle en `CHANGELOG.md` y decisiones en `DECISIONES.md`.

## 2. Qué probar con Spotify real (en el iPhone)
1. **Volver a conectar**: al abrir saldrá «vuelve a conectar con Spotify». Acepta los permisos nuevos.
2. **Que borre**: en Más → Ajustes → «Comprobar conexión», la fila «Quitar playlists» debe salir con ✓. Si sale ✗, apunta el mensaje y avísame.
3. **Solo una playlist de Shuffl**:
   - Baraja algo. La primera vez saldrá la lista de lo que se va a quitar («12 years ago · Shuffle», «Spanish Rap · Shuffle», «📸 Recently played»…); comprueba que no aparece ninguna playlist tuya y pulsa «Borrar y no volver a preguntar».
   - En Spotify debe quedar solo la nueva.
   - Baraja otra vez y otra cosa: siempre una sola.
   - Comprueba que tus playlists (las renombradas incluidas) siguen ahí.
4. **Transiciones**: cambia rápido entre Inicio, Shuffle, Descubrir y Más en la app instalada. No debe vibrar ni saltar, y cada pestaña debe volver a donde la dejaste.
5. **Novedades y Descubre**: que salgan unas 30 canciones que no tienes, que «Buscar más» añada otras 30 a la misma playlist y que «Como mi playlist…» tenga sentido. Si no ves la opción «Un género», Spotify no está dando géneros para tus artistas (es normal; está documentado).
6. **Carátulas del resultado**: que se vean nítidas y enteras.

## 3. Pendiente
- «Tal día como hoy» real con el archivo de datos de Spotify, y «Similares» con MetaBrainz: ideas en `ROADMAP.md`.
- Pendiente de la v1.2: Siri en el iPhone depende de Safari.
