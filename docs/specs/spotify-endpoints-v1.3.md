# Endpoints de Spotify para la v1.3 (Development Mode)

Consulta: 2026-11-26. Todas las fuentes son de developer.spotify.com.

Marcas:
- [resumen]: dato devuelto por WebFetch, que pasa la página por un modelo. Las frases entre comillas son las que devolvió ese modelo como citas; no se han contrastado byte a byte con el HTML original.
- [no verificado]: no se ha encontrado en la fuente.
- No hay ningún dato [literal]: en esta sesión no se descargó el HTML original. Los datos marcados como **crítico** hay que contrastarlos con la página original (o con una llamada real) antes de programar.

Fuentes generales:
- Changelog feb. 2026: https://developer.spotify.com/documentation/web-api/references/changes/february-2026
- Guía de migración: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- Changelogs posteriores revisados: [marzo](https://developer.spotify.com/documentation/web-api/references/changes/march-2026) (solo revierte `external_ids` en Album y Track), [mayo](https://developer.spotify.com/documentation/web-api/references/changes/may-2026) (añade `account_id` a User), [julio](https://developer.spotify.com/documentation/web-api/references/changes/july-2026) (25 Client ID por cuenta; cuota de Dev Mode contada por cuenta de desarrollador; 429 con `"reason": "QUOTA_EXCEEDED"`). [resumen]

Contexto [resumen, guía de migración]: los cambios se aplican a apps en Development Mode (nuevas desde el 11 de febrero de 2026; las existentes migradas el 9 de marzo de 2026); "Apps in extended quota mode are not affected".

El changelog de febrero tiene una sección "Still Available" que incluye `GET /me/top/{type}`, `GET /me/player/recently-played`, `GET /albums/{id}`, `GET /artists/{id}/albums`, `GET /me/albums` y `GET /playlists/{id}`. [resumen]

---

## 1. GET /me/top/artists

- **Disponible: sí.** El changelog de febrero lo pone en "Still Available"; solo se eliminó `GET /artists/{id}/top-tracks`. [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
- Ruta `GET /me/top/{type}`, con `type` = `artists` o `tracks`. [resumen]
- `time_range`: `short_term` ("approximately last 4 weeks"), `medium_term` ("approximately last 6 months", valor por defecto), `long_term` (~1 año). [resumen]
- `limit`: "Default: 20. Minimum: 1. Maximum: 50." (la tabla de parámetros dice rango 0-50). `offset` por defecto 0. [resumen]
- Campos eliminados del objeto Artist en Dev Mode: `followers` y `popularity` (changelog). La referencia marca también `genres` como "Deprecated". [resumen]
- Scope: [no verificado] (se supone `user-top-read`, sin comprobar en esta sesión).

## 2. GET /artists/{id}/albums

- **Disponible: sí.** Está en "Still Available" del changelog de febrero. [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums
- `include_groups`: lista separada por comas; valores `album`, `single`, `appears_on`, `compilation`; ejemplo `include_groups=album,single`. Si se omite, devuelve todos los tipos. [resumen]
- **`limit`: "Default: 5. Minimum: 1. Maximum: 10."** (la tabla dice rango 0-10). [resumen] **Crítico:** ni el changelog ni la guía de migración mencionan este cambio. Un hilo de la comunidad (no es de Spotify) describe errores 400 inesperados por `limit` en este endpoint y dice que el cambio "was not explicitly mentioned in the change log or migration guide": https://community.spotify.com/t5/Spotify-for-Developers/Unannounced-endpoint-request-limit-change/td-p/7476680 [resumen]. Hay que contrastarlo con la página original. Mientras tanto, conviene paginar con `limit<=10`.
- `market`: si no se pasa y el usuario no tiene país, "the content is considered unavailable for the client". [resumen] Como `country` ya no viene en `/me`, que haga falta `market` aquí está [no verificado].
- Campos del álbum: `album_type`, `total_tracks`, `release_date`, `release_date_precision` (obligatorios). **`album_group` está eliminado** (changelog: Album → `album_group`) y la referencia lo marca "Deprecated"; no sirve para distinguir `appears_on`. [resumen]

## 3. GET /albums/{id}/tracks y GET /albums/{id}

- **Disponibles: sí.** `GET /albums/{id}` está en "Still Available". Lo eliminado es el lote `GET /albums` ("Get Several Albums"). [resumen]
- `GET /albums/{id}/tracks` no aparece en el changelog ni como eliminado ni como cambiado. Por eso lo considero disponible, aunque no figura en la lista "Still Available" según el resumen. [resumen]
- Referencia de las pistas: https://developer.spotify.com/documentation/web-api/reference/get-an-albums-tracks
  - `limit`: "Default: 20. Minimum: 1. Maximum: 50." (la tabla dice 0-50); `offset`; `market`. [resumen] Ante el precedente del punto 2, que el máximo real sea 50 está [no verificado] con una llamada real.
  - Campos marcados "Deprecated": `available_markets`, `linked_from`, `preview_url`. [resumen]
- Referencia del álbum: https://developer.spotify.com/documentation/web-api/reference/get-an-album
  - Parámetros: `id` (ruta) y `market`. [resumen]
  - Campos: `album_type`, `total_tracks`, `external_urls`, `href`, `id`, `images` ("widest first"), `name`, `release_date`, `release_date_precision`, `restrictions`, `type`, `uri`, `artists`, `tracks` (paginado), `copyrights`, `external_ids`. [resumen]
  - Eliminados en Dev Mode (changelog): `album_group`, `available_markets`, `label`, `popularity`. `external_ids` se eliminó y luego se restauró en marzo de 2026. `genres` está "Deprecated. The array is always empty." [resumen]

## 4. GET /search

- **Disponible: sí, con el límite reducido.** [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/search
- **`limit`: el máximo pasa de 50 a 10 y el valor por defecto de 20 a 5** (changelog y guía: "The `limit` parameter maximum value has been reduced from 50 to 10"). La referencia da rango 0-10 y valor por defecto 5. [resumen]
- `offset`: rango 0-1000. La guía pide paginar con `offset` si se necesitan más de 10 resultados. [resumen]
- `type`: `album`, `artist`, `playlist`, `track`, `show`, `episode`, `audiobook` (lista separada por comas; el límite se aplica a cada tipo: "The maximum number of results to return in each item type"). [resumen]
- Los objetos Track y Artist pierden `popularity` (y Artist pierde también `followers`). [resumen]

## 5. GET /me/library/contains

- **Disponible: sí.** Es un endpoint nuevo de febrero de 2026 que sustituye a todos los `.../contains` (incluidos `/me/tracks/contains` y `/playlists/{id}/followers/contains`). [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/check-library-contains
- Parámetro de consulta `uris` (obligatorio): "A comma-separated list of Spotify URIs". **Máximo 40 URIs** por llamada. [resumen] **Crítico:** contrastar el 40 con el original.
- URIs admitidas: `spotify:track`, `album`, `episode`, `show`, `audiobook`, `artist`, `user`, `playlist`. Acepta URIs de tracks. [resumen]
- Respuesta: array de booleanos en el mismo orden (ejemplo `[false, true]`). Códigos 200/400/401/403/429. [resumen]
- Scopes listados: `user-library-read`, `user-follow-read`, `playlist-read-private` (según el tipo de URI). [resumen]

## 6. DELETE /me/library con URI de playlist; DELETE /playlists/{id}/followers

- **DELETE /me/library: disponible; admite `spotify:playlist:{id}`.** [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/remove-library-items
- Formato: **parámetro de consulta `uris`** (lista separada por comas), sin cuerpo según la referencia. **Máximo 40 URIs.** [resumen] **Crítico:** contrastar con el original si va en query o en cuerpo y el máximo de 40. La guía de migración no indica ningún máximo.
- URIs admitidas: `track`, `album`, `episode`, `show`, `audiobook`, `user`, `playlist` (en el resumen no aparece `artist`, cosa rara porque sustituye a "Unfollow Artists"; está [no verificado]). [resumen]
- Scopes: `user-library-modify`, `user-follow-modify`, `playlist-modify-public`. [resumen] Si para dejar de seguir una playlist privada hace falta `playlist-modify-private`: [no verificado].
- Respuesta: 200 "Items removed from library", cuerpo vacío. [resumen]
- **DELETE /playlists/{id}/followers: eliminado.** El changelog dice: "Unfollow Playlist" (`DELETE /playlists/{id}/followers`). Use `DELETE /me/library` instead. [resumen] `PUT /playlists/{id}/followers` y `GET .../followers/contains` también se eliminaron.
- Nota: `DELETE /me/tracks` y `DELETE /me/albums` también se eliminaron; para quitar elementos de la biblioteca se usa `DELETE /me/library`. [resumen]

## 7. GET /me/albums

- **Disponible: sí** ("Still Available"). Lo eliminado son `PUT`/`DELETE /me/albums` y `/me/albums/contains`. [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/get-users-saved-albums
- `limit`: "Default: 20. Minimum: 1. Maximum: 50."; `offset`; `market`. [resumen]
- Cada elemento trae `added_at` ("The date and time the album was saved", ISO 8601 UTC) y `album`. [resumen]
- `album.tracks` es obligatorio y paginado (`items`, `total`, `limit`, `next`, `offset`, `previous`, `href`): puede no traer todas las pistas, así que hay que comprobar `total`/`next`. [resumen] Cuántas pistas trae incrustadas: [no verificado].
- Al objeto álbum le faltan los campos eliminados del punto 3 (`album_group`, `label`, `popularity`, `available_markets`). [resumen]

## 8. GET /me/tracks

- **Disponible: sí.** No aparece eliminado ni cambiado (lo eliminado son `PUT`/`DELETE /me/tracks` y `/me/tracks/contains`). [resumen] No figura en la lista "Still Available" del resumen; su disponibilidad se deduce de que no está eliminado.
- Referencia: https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks
- `limit`: "Default: 20. Minimum: 1. Maximum: 50."; `offset`; `market`. [resumen]
- **`added_at` sí está presente**: "The date and time the track was saved". [resumen]
- El objeto Track pierde `available_markets`, `linked_from` y `popularity`. [resumen]

## 9. GET /me/player/recently-played

- **Disponible: sí** ("Still Available"). [resumen]
- Referencia: https://developer.spotify.com/documentation/web-api/reference/get-recently-played
- `limit`: "Default: 20. Minimum: 1. Maximum: 50." (tabla 0-50). `after`/`before` en milisegundos Unix, que no se pueden combinar. [resumen]
- Elementos: `track` (objeto Track completo, con `album`: "The album on which the track appears"), `played_at` y `context`. [resumen] Que `track.album.id` esté presente se deduce de que el álbum simplificado trae `id`; no se citó de forma explícita [no verificado].

---

## Notas relacionadas

- Playlist: en Dev Mode, `tracks` pasa a llamarse `items` y "Will only return an **items** object for the user's playlist"; para las demás playlists solo se devuelven los metadatos. [resumen, changelog]. Afecta a leer playlists seguidas que no son del usuario.
- Para cumplir la regla de CLAUDE.md, la lista de endpoints permitidos tendría que incluir los nuevos que se usen (`/me/top/artists`, `/artists/{id}/albums`, `/albums/{id}`, `/albums/{id}/tracks`, `/search`, `/me/library`, `/me/library/contains`).
