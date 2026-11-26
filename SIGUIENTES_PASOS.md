# Siguientes pasos

## 1. Qué hay hecho (v1.2.0)
- Baraja pasa a llamarse **Shuffl**: icono de naipes lima sobre negro, paleta negro/lima y componentes propios. Repo, URL de Pages y Redirect URI no cambian.
- Cada origen tiene su playlist «· Shuffle» (se reutiliza, se renombra si cambia el origen y se recrea si desaparece); la antigua «🔀 Baraja» no se toca y hay un aviso para borrarla a mano.
- Enlaces profundos para Siri (`?mezcla=<id>&play=1`, `?origen=<id>&play=1`), botón «Crear atajo de Siri» y ayuda de CarPlay.
- Agitar para barajar, «Elige por mí», «¿Es aleatorio de verdad?», transiciones y celebración.
- Detalle en `CHANGELOG.md`; decisiones en `DECISIONES.md`. Tests unitarios y e2e con Spotify simulado en verde; CI y despliegue automático a Pages.

## 2. Qué probar con Spotify real
1. **Nombres nuevos**: barajar una playlist, Tus me gusta, varias, una mezcla guardada y toda la biblioteca, y comprobar en Spotify «Rock · Shuffle», «Tus me gusta · Shuffle», «Mix · Shuffle» (con los orígenes en la descripción), «<mezcla> · Shuffle» y «Toda mi música · Shuffle». Volver a barajar el mismo origen debe sobrescribir la misma playlist (el pin se mantiene).
2. **Renombrar**: cambia el nombre de una playlist de origen en Spotify, baraja otra vez y comprueba que la «· Shuffle» se renombra. Usa `PUT /playlists/{id}`; si Spotify lo rechazara en Development Mode, la app avisa y las canciones se barajan igual.
3. **Migración**: debe salir una vez el aviso sobre la antigua «🔀 Baraja»; bórrala a mano en Spotify si ya no la quieres.
4. **Portada**: la «· Shuffle» debe mostrar el icono nuevo, el nombre del origen y la fecha (Spotify puede tardar un poco en mostrarla).
5. **Siri en el iPhone**: en Inicio, «Crear atajo de Siri» en una mezcla, crea el atajo en la app Atajos y di «Oye Siri, Shuffl …». El enlace se abre en Safari, que no comparte datos con la app de la pantalla de inicio: abre Shuffl en Safari, inicia sesión, guarda la mezcla y crea el atajo desde ahí (si el atajo se creó en la app de la pantalla de inicio, Safari pedirá confirmación cada vez). Reproducir necesita Premium y Spotify abierto en algún dispositivo.
6. **Agitar en el iPhone**: en Inicio pulsa «Activar agitar para barajar» (pide permiso del acelerómetro), agita y confirma. Ajusta si salta demasiado o demasiado poco.
7. **CarPlay**: comprobar que las «· Shuffle» aparecen en Spotify dentro de CarPlay (fijadas salen arriba).

## 3. iPhone
- Para ver el icono nuevo hay que quitar la app de la pantalla de inicio y volver a añadirla (la app lo avisa una vez).
- Cuando haya versión nueva saldrá el banner «Nueva versión disponible · Actualizar».

## 4. Pendiente
- Siri en iPhone depende de Safari (la app de la pantalla de inicio no recibe enlaces): si molesta, la alternativa es el atajo con `?origen=`, que solo necesita la sesión.
- Menores conocidos: una restauración que falla a mitad deja una playlist «(restaurada)» incompleta; el refresh del token entre pestañas simultáneas puede mostrar sesión caducada hasta recargar.
- Ideas futuras en `ROADMAP.md`.
