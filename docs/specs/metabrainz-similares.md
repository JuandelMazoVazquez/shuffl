# MetaBrainz: artistas similares desde la PWA (investigación, 2026-11-26)

Leyenda: [literal] = texto copiado de la fuente (fragmentos cortos, vía WebFetch); [resumen] = lo que devolvió WebFetch como resumen de modelo; [prueba] = petición GET real hecha con WebFetch (sin acceso a cabeceras); [no verificado] = no confirmado.

Limitación: en esta sesión no había shell, así que **no se pudo ejecutar `curl -I`**. Todas las cabeceras (CORS, X-RateLimit-*) están [no verificado]. Comando pendiente para contrastarlas:
`curl -sI -H "Origin: https://juandelmazovazquez.github.io" "<URL>"` (buscar `Access-Control-Allow-Origin`), y un `OPTIONS` de preflight si se va a mandar alguna cabecera no simple.

## 1. MusicBrainz WS/2: búsqueda de artista por nombre

- URL: `https://musicbrainz.org/ws/2/artist?query=artist:<nombre>&limit=<n>&fmt=json`. Forma general: "search: /<ENTITY_TYPE>?query=<QUERY>&limit=<LIMIT>&offset=<OFFSET>" [literal] — https://musicbrainz.org/doc/MusicBrainz_API
- JSON: "add `fmt=json` to the query string (if both are set, `fmt=` takes precedence)" [literal] — misma fuente.
- Respuesta [prueba] (`/ws/2/artist?query=artist:radiohead&limit=2&fmt=json`): nivel superior `created`, `count`, `offset`, `artists`. Cada artista: `id` (MBID), `type`, `type-id`, `score` (0-100), `name`, `sort-name`, `country`, `area`, `begin-area`, `isnis`, `life-span`, `aliases`, `tags`; `disambiguation` solo si existe. Primer resultado: `id` a74b1b7f-71a5-4011-9441-d0b5e4122711, Radiohead, score 100.
- CORS: la documentación oficial no lo menciona [resumen]. Un hilo del foro (2016) dice que `/ws/2/` responde `Access-Control-Allow-Origin: *` [resumen, fuente no oficial y antigua] — https://community.metabrainz.org/t/does-musicbrainz-api-support-jsonp/26144. **[no verificado] hoy.**
- Límite: "Currently that rate is (on average) 1 request per second." [literal]; por IP, si se supera "all your requests will be declined (http 503)" [literal] — https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting. Límite global 300 req/s [literal: "We allow through 300 requests each second (on average)"].
- User-Agent: "Each request sent to MusicBrainz needs to include a User-Agent header" [literal], con datos de contacto; formato "Application name/<version> ( contact-url )" [literal] — misma fuente. User-Agent «anónimos» (estrangulados a ~50 req/s globales): vacío, Java, Python-urllib, Jakarta Commons-HttpClient, Apache-HttpClient [resumen]; un UA de navegador (`Mozilla/5.0…`) no está en esa lista [resumen].
- Navegador: la documentación **no** da alternativa (ni parámetro ni cabecera) para clientes que no pueden fijar User-Agent [resumen de ambas páginas; lectura completa vía WebFetch, pero es resumen: contrastar con el original]. En Chromium `fetch` ignora un User-Agent personalizado ("chromium based browsers have a decade-old bug" [literal, contribuidor de web-scrobbler, 2026-04-07]) — https://github.com/web-scrobbler/web-scrobbler/issues/5946. Que Firefox sí lo respete: [no verificado].
- Contexto 2026: un desarrollador de MetaBrainz (MonkeyDo, 2026-04-07) dice que "had to start blocking all user agents that do not respect the API rate limit" [literal] y pidió a web-scrobbler (extensión de navegador) un UA propio para ponerlo en lista blanca [resumen] — misma issue.
- Cambios de búsqueda del 2026-11-30 (Solr 10): no listan cambios que rompan la búsqueda de artistas [resumen] — https://blog.metabrainz.org/2026/08/31/search-upgrades-nov-30-2026/
- Uso: "Non-commercial use of this web service is free." [literal] — https://musicbrainz.org/doc/MusicBrainz_API. "Do I need an API key? Currently, no." [literal, citado en una PR de terceros; contrastar en el FAQ original].

## 2. ListenBrainz: artistas similares

### 2a. Labs API (el endpoint que nombra MetaBrainz para esto)
- URL JSON: `https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=<MBID>&algorithm=<algoritmo>` [prueba; la página de la herramienta enlaza "JSON version" a `https://labs.api.listenbrainz.org/similar-artists/json` [resumen]] — https://labs.api.listenbrainz.org/similar-artists
- Algoritmo recomendado por MetaBrainz (2024-11-28): "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30" [literal] — https://blog.metabrainz.org/2024/11/28/pissed-off-by-spotify-enshittifying-more-api-endpoints-we-can-help/. En 2024-02 un miembro del equipo decía que solo había un dataset vivo (`session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30`) [resumen] — https://community.metabrainz.org/t/how-does-similar-artists-work/678642. La página de la herramienta lista hoy seis valores, entre ellos el de 7500/contribution_5 [resumen].
- Respuesta [prueba, Radiohead con el algoritmo de 7500/contribution_5]: array JSON de 100 objetos ordenados por `score` descendente; campos `artist_mbid`, `name`, `comment`, `type`, `gender`, `score` (entero, p. ej. 11156), `reference_mbid` (= MBID consultado). Primeros: Nirvana, Red Hot Chili Peppers, Muse.
- Anomalía [prueba]: con el algoritmo `…9000…limit_50…` devolvió también 100 elementos con los mismos tres primeros, y con `…7500…contribution_3…` el primero fue The Beatles. Cómo trata el servidor el valor de `algorithm` (si ignora o sustituye valores): [no verificado].
- Varios MBID en `artist_mbids` (separador): [no verificado].
- Estabilidad: un usuario preguntó (2025-01-27) si estaba listo para uso externo y no hubo respuesta del equipo [resumen] — hilo anterior. La portada de Labs no habla de términos, estabilidad, límites, tokens ni User-Agent [resumen] — https://labs.api.listenbrainz.org/. En dic. 2025 MetaBrainz retiró varios endpoints de Labs (mbid-mapping*) por los scrapers de IA [resumen] — https://blog.musicbrainz.org/author/ruaok/
- "The similarity datasets are still somewhat limited" [literal] (cobertura escasa para artistas poco conocidos) — post de 2024-11-28.
- Token: no se usó y respondió con datos [prueba]. CORS y límites en Labs: [no verificado].

### 2b. API estable (`api.listenbrainz.org/1/...`)
- No hay endpoint documentado llamado «similar-artists» en `/1/` [resumen de core.html y misc.html; lectura vía WebFetch].
- Equivalente parcial: `GET https://api.listenbrainz.org/1/lb-radio/artist/<seed_artist_mbid>?mode=easy|medium|hard&max_similar_artists=<n>&max_recordings_per_artist=<n>&pop_begin=<0-100>&pop_end=<0-100>` — "Get recordings for use in LB radio with the given seed artist." [literal] — https://listenbrainz.readthedocs.io/en/latest/users/api/core.html. Devuelve un objeto cuyas claves son MBID de artista (incluye el semilla) con listas de `recording_mbid`, `similar_artist_mbid`, `similar_artist_name`, `total_listen_count` [resumen + prueba]. No da `score` de similitud [resumen].
- Token: la documentación no dice si lo exige [resumen]; la prueba sin token devolvió datos [prueba]. MetaBrainz anunció (dic. 2025) que "LB Radio" exige login y cabecera Authorization para usuarios de la API [resumen] — https://blog.musicbrainz.org/author/ruaok/. Si eso afecta a este endpoint: [no verificado] (la prueba sugiere que no, hoy).
- Normas de la API de ListenBrainz: "never make more than ONE call per second" [literal]; cabeceras `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset-In`, `X-RateLimit-Reset`; exceso → `429` [resumen]; "We require that all requests to the ListenBrainz API include a valid User-Agent header" [literal]; sin UA válido pueden bloquear "without further notice" [resumen] — https://listenbrainz.readthedocs.io/en/latest/users/api/index.html. Si estas reglas cubren `labs.api`: la página no lo dice [resumen].
- Bloqueos reales en 2026-08 a servicios sin UA propio (Navidrome, multi-scrobbler) [resumen] — https://blog.metabrainz.org/2026/08/24/blocked-listenbrainz-services-user-agent-strings/

## 3. Licencias y términos

- MusicBrainz: datos centrales CC0; datos suplementarios CC BY-NC-SA 3.0 (atribución, no comercial, compartir igual) [resumen] — https://musicbrainz.org/doc/About/Data_License. Qué campos de la búsqueda de artista son «suplementarios» (p. ej. `tags`): [no verificado].
- ListenBrainz: "All of this data is Creative Commons CC0 licensed (read Public Domain)" [literal] — post de 2024-11-28.
- MetaBrainz: "won't object to commercial use of our content" pero "charging for the content itself is forbidden" [literal] — https://metabrainz.org/social-contract. Shuffl es gratuita, así que encaja como uso no comercial.
- Atribución: no exigida para CC0; recomendable mencionar MusicBrainz/ListenBrainz (y obligatoria si se muestran datos CC BY-NC-SA) [resumen].

## Conclusión

**Técnicamente, probablemente sí; conforme a las normas, no del todo.**
- Funciona sin token y sin servidor: búsqueda en MB por nombre → MBID → Labs `similar-artists/json` (o `/1/lb-radio/artist/`) [prueba]. El límite de 1 req/s es por IP y cada usuario tiene la suya, así que basta con encolar las peticiones de cada cliente.
- Bloqueante normativo: MusicBrainz y ListenBrainz **exigen** un User-Agent identificativo y un navegador no puede ponerlo (Chromium lo ignora); ninguna documentación da alternativa para navegador. Con el UA del navegador, el tráfico no se distingue de los scrapers que MetaBrainz bloquea en 2026, así que hay riesgo de bloqueos sin aviso.
- Pendiente: CORS de las tres URLs (con el `curl` de arriba). Sin `Access-Control-Allow-Origin`, la vía desde cliente queda descartada.
- El endpoint de Labs no tiene garantía de estabilidad ni respuesta oficial sobre uso externo, y su parámetro `algorithm` se comporta de forma rara.
- Opciones a decidir (bandeja): (a) preguntar a MetaBrainz en community.metabrainz.org si aceptan una PWA de navegador con el UA del navegador e identificación alternativa; (b) un proxy mínimo que ponga el UA (rompe «sin servidor»); (c) descartar la función.
