// ── TEMATIZACIÓN POR GIMNASIO ──────────────────────────────
// Genera la paleta completa (50–900) a partir del primary_color
// del gimnasio y la aplica como variables CSS. Toda la app usa
// estas variables vía Tailwind (ver tailwind.config.js), así que
// cada gimnasio ve la app en SUS colores.

const DEFAULT_HEX = '#f97316' // naranja de marca (fallback)

const hexToRgb = (hex) => {
  const h = String(hex || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const mix = (rgb, target, p) =>
  rgb.map(c => Math.round(c * (1 - p) + target * p))

// Genera los 10 tonos mezclando con blanco (claros) y negro (oscuros)
const generateShades = (baseRgb) => ({
  50:  mix(baseRgb, 255, 0.92),
  100: mix(baseRgb, 255, 0.84),
  200: mix(baseRgb, 255, 0.68),
  300: mix(baseRgb, 255, 0.50),
  400: mix(baseRgb, 255, 0.26),
  500: baseRgb,
  600: mix(baseRgb, 0, 0.12),
  700: mix(baseRgb, 0, 0.28),
  800: mix(baseRgb, 0, 0.42),
  900: mix(baseRgb, 0, 0.54),
})

// Aplica el color del gimnasio a toda la app. Si el hex es inválido
// o no viene, no hace nada (se quedan los defaults naranjas del CSS).
export const applyGymTheme = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return
  const shades = generateShades(rgb)
  const root = document.documentElement
  for (const [tone, [r, g, b]] of Object.entries(shades)) {
    root.style.setProperty(`--brand-${tone}`, `${r} ${g} ${b}`)
  }
  root.style.setProperty('--brand-hex', `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`)
}

// Color actual como hex — para canvas, SVG y gradientes con sufijo alpha
export const getBrandHex = () => {
  if (typeof document === 'undefined') return DEFAULT_HEX
  const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-hex').trim()
  return v || DEFAULT_HEX
}

// Color actual como [r, g, b] — para jsPDF (setFillColor) y autotable
export const getBrandRGB = () => {
  const rgb = hexToRgb(getBrandHex())
  return rgb || hexToRgb(DEFAULT_HEX)
}
