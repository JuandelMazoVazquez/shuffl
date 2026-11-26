# Spotify Web API para la v1.3.1 (Development Mode)

Consulta: 2026-11-26. Complementa `docs/specs/spotify-endpoints-v1.3.md`.

Marcas:
- [resumen]: dato devuelto por WebFetch. WebFetch pasa la página por un modelo y no permite copiar más de 125 caracteres seguidos. Las frases entre comillas son las citas que dio ese modelo; no se han contrastado byte a byte con el HTML.
- [literal]: ninguno. En esta sesión no se pudo descargar el HTML original porque no había terminal.
- [no verificado]: no se ha encontrado en la fuente o solo aparece en fuentes no oficiales.
- **Crítico**: hay que contrastarlo con la página original descargada o con una llamada real antes de programar.

Changelogs revisados: [feb. 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026), [mar. 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026), [may. 2026](https://developer.spotify.com/documentation/web-api/references/changes/may-2026) y [jul. 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026). La barra lateral de julio enlaza solo esos cuatro, y `.../changes/august-2026` devuelve 404. No hay changelogs posteriores enlazados. [resumen] Que no exista ninguno con otro nombre de URL está [no verificado].

---

## 1. Dejar de seguir una playlist propia

### DELETE /me/library
Referencia: https://developer.spotify.com/documentation/web-api/reference/remove-library-items (título en la navegación: "Remove Items from Library").
- Ruta: `DELETE https://api.spotify.com/v1/me/library`. [resumen]
- **Contrato: parámetro de consulta `uris`** (string, obligatorio), "comma-separated list of Spotify URIs", **máximo 40**. La página no tiene sección de cuerpo de la petición. No acepta `ids` ni `type`. [resumen] **Crítico**: contrastar con el original que va en la query y el máximo de 40.
- Ejemplo de la página: `uris=spotify%3Atrack%3A7a3LWj5xSFhFRYmztS8wgK,spotify%3Aalbum%3A4aawyAB9vmqN3uQ7FjRGTy`, es decir, URIs codificadas y separadas por comas. [resumen]
- URIs admitidas: `spotify:track`, `album`, `episode`, `show`, `audiobook`, `user`, `playlist`. No aparece `spotify:artist`. [resumen]
- Scopes: `user-library-modify`, `user-follow-modify`, `playlist-modify-public`. **`playlist-modify-private` no aparece.** [resumen] Si una playlist privada se puede quitar sin `playlist-modify-private`: [no verificado]. **Crítico**: la página antigua de Unfollow Playlist sí pedía los dos scopes.
- Respuestas: 200 "Items were removed from the library", con cuerpo vacío. También se listan 400, 401, 403 y 429, sin descripción. No dice 204. [resumen]
- La página no tiene notas sobre Development Mode ni sobre cuotas. [resumen]
- Changelog de febrero: "[ADDED] Remove from Library (`DELETE /me/library`)". [resumen] La guía de migración dice: "Like the save endpoint, `DELETE /me/library` accepts Spotify URIs instead of IDs". No da formato ni máximo. https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide [resumen]

### DELETE /playlists/{playlist_id}/followers
Referencia: https://developer.spotify.com/documentation/web-api/reference/unfollow-playlist
- La página sigue publicada, marcada "Deprecated": "This endpoint is deprecated. Use Remove Items from Library instead." Scopes: `playlist-modify-public` y `playlist-modify-private`. Respuesta 200 "Playlist unfollowed". [resumen]
- El changelog de febrero lo marca "[REMOVED]" para Development Mode: "Use `DELETE /me/library` instead." [resumen] **No está disponible en Development Mode.**

### Motivo documentado que impida quitar playlists propias
- No he encontrado ninguno en la referencia de `DELETE /me/library`, en el changelog de febrero ni en la guía de migración. La guía solo menciona el requisito de Premium del propietario y los límites de la app. [resumen] Todas las lecturas fueron con WebFetch (parciales), así que la ausencia está [no verificado].
- Un resultado de búsqueda (no oficial) afirma que Spotify aplazó los cambios de endpoints para integraciones de Development Mode ya existentes: [no verificado].

## 2. `genres` en el objeto Artist
- En las referencias de [GET /me/top/{type}](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks), [GET /me/following](https://developer.spotify.com/documentation/web-api/reference/get-followed) y [GET /search](https://developer.spotify.com/documentation/web-api/reference/search), `genres` aparece marcado **"Deprecated"**, con la descripción "A list of the genres the artist is associated with. If not yet classified, the array is empty." [resumen]
- Los changelogs de febrero, marzo, mayo y julio **no** mencionan `genres` de Artist. En febrero solo se eliminan `followers` y `popularity`. [resumen] No hay ninguna declaración oficial de que se haya eliminado o venga vacío.
- En el foro hay informes de usuarios con géneros vacíos o reducidos (fuente no oficial): https://community.spotify.com/t5/Spotify-for-Developers/Genres-from-artists-have-been-removed/td-p/6659559 [resumen]
- En contraste, el `genres` de Album sí dice "Deprecated. The array is always empty" (ver spec v1.3). [resumen]
- Qué devuelve de verdad en Dev Mode hoy: [no verificado]. **Crítico**: comprobarlo con una llamada real antes de depender de este campo.

## 3. GET /search con `genre:` y `type=artist`
Referencia: https://developer.spotify.com/documentation/web-api/reference/search
- El filtro `genre` sigue documentado: "`genre` can be used while searching artists and tracks." [resumen]
- `limit`: valor por defecto 5, rango 0-10. `offset`: valor por defecto 0, rango 0-1000. [resumen] El changelog de febrero dice: "The `limit` parameter maximum value has been reduced from 50 to 10", con el valor por defecto cambiado de 20 a 5. [resumen]
- Los changelogs no mencionan el filtro `genre`. [resumen] Si el filtro funciona de verdad en Dev Mode: [no verificado]. Como `genres` está obsoleto, podría devolver pocos resultados; habría que comprobarlo con una llamada real.

## 4. GET /me/playlists: `snapshot_id` y `description`
Referencia: https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists
- Ambos campos siguen en SimplifiedPlaylistObject y ninguno está marcado como obsoleto. [resumen]
  - `snapshot_id`: "The version identifier for the current playlist. Can be supplied in other requests to target a specific playlist version." [resumen]
  - `description`: "The playlist description. Only returned for modified, verified playlists, otherwise null." Puede venir `null`. [resumen]
- `tracks` está "Deprecated" y se sustituye por `items` (`href`, `total`). `limit` llega como máximo a 50; `offset` llega como máximo a 100.000. Scope: `playlist-read-private`. [resumen]
- Ningún changelog menciona `description` ni `snapshot_id`. [resumen]

## 5. Scopes
- `GET /me/library/contains` (https://developer.spotify.com/documentation/web-api/reference/check-library-contains): `user-library-read`, `user-follow-read`, `playlist-read-private`. Admite como máximo 40 URIs en `uris`, separadas por comas. [resumen]
- `DELETE /me/library`: `user-library-modify`, `user-follow-modify`, `playlist-modify-public`. [resumen] La guía de migración solo dice, para guardar: "Appropriate scopes need to be passed depending on the entities being saved." [resumen] Si `playlist-modify-private` hace falta para playlists privadas: [no verificado].
