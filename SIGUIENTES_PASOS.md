# Siguientes pasos

## 1. Qué hay hecho (v1.3.0)
- Navegación en 4 pestañas (Inicio · Shuffle · Descubrir · Más) con un botón «SHUFFLE» enorme en Inicio.
- Una sola «· Shuffle» por origen en cualquier dispositivo (etiqueta en la descripción) y limpieza de copias repetidas.
- Shuffle por tiempo y por álbumes; Novedades, Descubre, Tal día como hoy, Olvidadas y Tu resumen.
- Detalle en `CHANGELOG.md` y decisiones en `DECISIONES.md`. Tests unitarios y e2e con Spotify simulado en verde.

## 2. Qué probar con Spotify real
1. **Limpieza de duplicadas** (lo más delicado):
   - Baraja un origen desde el móvil y desde el ordenador: debe quedar una sola «· Shuffle».
   - Si ya tenías copias de antes, la app pregunta «¿Dejamos solo una?». Comprueba que se queda la última barajada y que las otras desaparecen de tu biblioteca.
   - Spotify debería permitir recuperarlas en spotify.com → Cuenta → Recuperar playlists. Confírmalo con una.
   - Renombra una «· Shuffle» y comprueba que no se toca nunca.
   - Quitar usa `DELETE /me/library`: si Spotify lo rechazara, sale «No se pudieron quitar…» y no se pierde nada.
2. **Novedades**:
   - Que salgan lanzamientos reales de tus artistas en 30 días y sin canciones que ya tienes.
   - Que la segunda vez en 24 h vaya mucho más rápido (caché).
   - Si Spotify devuelve un error con `limit=10` en `/artists/{id}/albums`, avísame.
3. **Tu resumen**:
   - Que la tarjeta incluya las carátulas reales. Si sale «Algunas carátulas no se han podido incluir», el servidor de imágenes no permite leerlas desde el lienzo.
   - Compartir desde el iPhone en una historia de Instagram y revisar la tarjeta cuadrada.
4. **Barajar por álbumes**: con una playlist y con «Usar tus álbumes guardados». Cada álbum debe sonar entero y en orden, con el aleatorio de Spotify apagado.
5. **Por tiempo**: una de 30 min debería durar entre 28 y 32 min en Spotify.
6. **Descubre, Tal día como hoy y Olvidadas**: que tengan sentido con tu historial real.

## 3. Pendiente
- «Similares» (MetaBrainz) no se ha hecho: desde el navegador no se pueden cumplir sus normas. Detalle en `ROADMAP.md`.
- Pendiente de la v1.2: Siri en iPhone depende de Safari, y hay que volver a añadir el icono en la pantalla de inicio.
- Ideas futuras en `ROADMAP.md`.
