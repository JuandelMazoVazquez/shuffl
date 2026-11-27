# Siguientes pasos

## 1. Qué hay hecho (v1.3.2)
- Mucha menos cuota de Spotify: caché en el dispositivo y un tope de unas 30 lecturas por búsqueda. Novedades pasa de unas 200 peticiones a 32 (tabla en `DECISIONES.md`).
- Errores en palabras normales y siempre con una acción. «Reproducir ahora» comprueba que de verdad suena la playlist en orden.
- Más → Diagnóstico: contador de peticiones, «Prueba completa» y «Copiar informe».
- Shuffle por tiempo a la vista, con accesos rápidos y «A medida».
- Carátulas en todas las listas. Quitar canciones deslizando y tirar hacia abajo para volver a barajar.
- Detalle en `CHANGELOG.md` y decisiones en `DECISIONES.md`.

## 2. Cómo hacer la «Prueba completa» con tu cuenta (en el iPhone)
1. Abre Spotify en el iPhone y pon cualquier canción unos segundos, para que el móvil cuente como dispositivo activo. Después vuelve a Shuffl.
2. En Shuffl: **Más → Diagnóstico → Hacer la prueba completa**. Deja marcada «Probar también a reproducir»: sonará una canción de tus Me gusta en tu Spotify.
3. Espera a que salgan los 10 pasos. Gasta unas 15 peticiones.
   - Todo con ✓ y «Todo funciona.»: listo.
   - Algún ✗: pulsa **Copiar informe** y pégamelo. No lleva nombres de playlists, canciones ni dispositivos, ni tokens.
4. Comprueba en Spotify que no se ha quedado la playlist «Shuffl · prueba de borrado & limpieza». Si se queda, el paso «Quitarla» habrá salido con ✗ y el informe dirá por qué.

## 3. Qué más probar con Spotify real
1. **Cuota**: haz Novedades y «Buscar más» un par de veces y mira en Diagnóstico «Peticiones a Spotify»: ninguna acción debería pasar de unas 40. Si sale «Spotify limita cuántas búsquedas…», espera un rato. Mientras tanto, barajar tus playlists ya leídas debería seguir funcionando.
2. **Reproducir ahora**: con Spotify abierto debe decir «Sonando en tu iPhone, en este orden». Con Spotify cerrado del todo debe decir «Abre Spotify un momento y vuelve a pulsar».
3. **Por tiempo**: en Shuffle, «Por tiempo» → «Gym». Tiene que crear «Gym 45 min · Shuffle» de unos 43-47 min. Guárdala como mezcla y prueba el atajo de Siri.
4. **Quitar y rebarajar**: en el resultado, desliza una canción a la izquierda y comprueba en Spotify que ya no está. Tira hacia abajo para volver a barajar.
5. **Carátulas**: en Novedades, Descubre, Olvidadas, Tu resumen y Duplicados, todas las filas con su carátula y sin saltos al cargar.
6. **Errores**: activa el modo avión y baraja una playlist nueva: debe salir «No hay conexión» con «Reintentar». Quita el modo avión y pulsa «Reintentar».

## 4. Pendiente
- «Tal día como hoy» real con el archivo de datos de Spotify, y «Similares» con MetaBrainz: ideas en `ROADMAP.md`.
- Pendiente de la v1.2: Siri en el iPhone depende de Safari.
