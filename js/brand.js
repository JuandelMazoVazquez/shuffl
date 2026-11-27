// Paleta de Shuffl: la fuente única de sus colores (v1.4.1). Documentada en docs/BRAND.md.
// Las portadas, «Tu resumen», la demo, los iconos y los medios del README la importan de aquí. CSS no puede importar
// JS, así que css/styles.css repite estos valores en sus variables y tests/unit/palette.test.js comprueba que coinciden
// y que no aparece ningún color fuera de la paleta.

/** Tema oscuro (por defecto). Cada clave es una variable de css/styles.css: `surface2` → `--surface-2`. */
export const DARK = Object.freeze({
  bg: '#0B0B0B',
  surface: '#161616',
  surface2: '#1F1F1F',
  border: '#2E2E2E',
  text: '#F5F5F5',
  muted: '#A3A3A3',
  accent: '#C6FF3D',
  accent2: '#8FBF1F',
  onAccent: '#0B0B0B',
  lime: '#C6FF3D',
  onLime: '#0B0B0B',
  edge: '#F5F5F5',
  danger: '#FF8A80',
  focus: '#C6FF3D',
});

/** Tema claro: el verde oscuro sustituye a la lima en textos y controles pequeños (contraste AA sobre blanco). */
export const LIGHT = Object.freeze({
  bg: '#FFFFFF',
  surface: '#F4F6F0',
  surface2: '#E9EDE2',
  border: '#D3D9C8',
  text: '#111111',
  muted: '#5C5C5C',
  accent: '#3D6B00',
  accent2: '#5A8F0A',
  onAccent: '#FFFFFF',
  lime: '#C6FF3D',
  onLime: '#0B0B0B',
  edge: '#0B0B0B',
  danger: '#B42318',
  focus: '#3D6B00',
});

/** Halo lima muy oscuro de los fondos de la cabecera, la social preview y el vídeo. */
export const GLOW = '#1D2A06';

/** Todos los colores de la paleta, en mayúsculas. */
export const PALETTE = Object.freeze([...new Set([...Object.values(DARK), ...Object.values(LIGHT), GLOW])]);

/** `#C6FF3D` → `rgba(198, 255, 61, a)`, para transparencias sin salir de la paleta. */
export function withAlpha(hex, alpha) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
