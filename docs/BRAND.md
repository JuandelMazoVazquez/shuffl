# Marca de Shuffl

## Nombre

- La app se llama **Shuffl**, sin «e» final y con mayúscula inicial. En código, claves y URLs: `shuffl`.
- Repo: `JuandelMazoVazquez/shuffl`. App: https://juandelmazovazquez.github.io/shuffl/
- Las playlists que crea terminan en «· Shuffl» (por ejemplo «Rock · Shuffl»).
- Hasta la v1.2.0 se llamó Baraja, y hasta la v1.4.0 el repo y la dirección eran `new-spoti`. Esos nombres solo
  quedan en el historial (CHANGELOG, DECISIONES, `docs/registro/`), en la migración que reconoce y quita las playlists
  antiguas (`js/targets.js`), en la migración de claves (`js/storage.js`) y en la página de redirección (`redirect/`).
  `tests/unit/palette.test.js` falla si aparecen en otro sitio.
- Nunca «Spotify» en el nombre, en el logo ni en el icono de la app.

## Paleta

Fuente única: [`js/brand.js`](../js/brand.js). `css/styles.css` repite los valores en sus variables (CSS no puede
importar JS) y un test comprueba que coinciden. Ningún archivo de la app, los iconos o los medios usa un color fuera de
esta tabla.

| Token | Oscuro (por defecto) | Claro | Uso |
|---|---|---|---|
| `bg` | `#0B0B0B` negro | `#FFFFFF` | Fondo de la página |
| `surface` | `#161616` | `#F4F6F0` | Tarjetas y paneles |
| `surface2` | `#1F1F1F` | `#E9EDE2` | Campos, filas, huecos sin carátula |
| `border` | `#2E2E2E` | `#D3D9C8` | Bordes |
| `text` | `#F5F5F5` | `#111111` | Texto |
| `muted` | `#A3A3A3` | `#5C5C5C` | Texto secundario |
| `accent` | `#C6FF3D` lima | `#3D6B00` verde oscuro | Enlaces, texto destacado y controles pequeños |
| `accent2` | `#8FBF1F` | `#5A8F0A` | Segundo tono de gráficos |
| `onAccent` | `#0B0B0B` | `#FFFFFF` | Texto sobre `accent` |
| `lime` | `#C6FF3D` | `#C6FF3D` | Superficies grandes: botón principal, tarjeta destacada |
| `onLime` | `#0B0B0B` | `#0B0B0B` | Texto sobre `lime` |
| `edge` | `#F5F5F5` | `#0B0B0B` | Sombra dura de la tarjeta destacada |
| `danger` | `#FF8A80` | `#B42318` | Errores y acciones que borran |
| `focus` | `#C6FF3D` | `#3D6B00` | Anillo de foco |
| `GLOW` | `#1D2A06` | | Halo de los fondos de la cabecera, la social preview y el vídeo |

`manifest.webmanifest` usa `#0B0B0B` como `theme_color` y `background_color`, y `index.html` pone `theme-color` a
`#0B0B0B` en oscuro y `#FFFFFF` en claro.

## Logo

Tres naipes en abanico sobre negro a sangre: dos de contorno lima detrás (−18° y +18°) y uno relleno de lima delante con
una X negra. Solo `#0B0B0B` y `#C6FF3D`. Se genera con `npm run icons` (`scripts/make-icons.mjs`); no se edita a mano.

## Uso correcto

- Lima sobre negro, o negro sobre lima. En tema claro, el texto verde es `#3D6B00`, nunca la lima (no llega a AA sobre blanco).
- La lima en superficies grandes y pocas: un botón principal por pantalla.
- Tipografía de titulares: `"Arial Black"` en peso 900; el texto, la del sistema.

## Uso incorrecto

- Colores fuera de la paleta, incluidos los de la marca antigua (índigo, coral, ámbar, crema).
- Lima sobre blanco para texto, o el logo sobre un fondo que no sea negro.
- Deformar, girar o recolorear el logo.
- Parecerse a Spotify: nada de su verde (`#1DB954`, `#1ED760`), su logo dentro del nuestro ni círculos con ondas. Su
  logo oficial solo aparece sin modificar (`icons/spotify/`, con el hash fijado en un test) como atribución junto a
  carátulas y metadatos suyos, nunca como parte de la marca de Shuffl.
