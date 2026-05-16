function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function normalizeHex(hex: string): string {
  const h = hex.replace("#", "")
  if (h.length === 3) {
    return "#" + h.split("").map((c) => c + c).join("")
  }
  return "#" + h.padEnd(6, "0").slice(0, 6)
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  )
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb(h: number, s: number, l: number) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

/**
 * Returns a high-contrast "shade complement":
 * black → near-white, white → near-black, blues → light/dark blue.
 * Hue and saturation are preserved; only lightness is flipped toward
 * the opposite end of the scale for guaranteed legibility.
 */
export function complementColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  const newL = l < 50 ? Math.max(88, 100 - l) : Math.min(12, 100 - l)
  const { r: nr, g: ng, b: nb } = hslToRgb(h, s, newL)
  return rgbToHex(nr, ng, nb)
}

/**
 * Perceived brightness (luma) on a 0–1 scale. Used to pick a contrasting
 * preview backdrop so the user's chosen text color is always legible.
 */
export function perceivedLuma(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Returns CSS for a checker-pattern background that contrasts with the
 * given text color (light text → dark surface; dark text → light surface).
 * Both the checker squares AND the base fill are flipped, so transparent
 * gaps never expose the page's theme color underneath. This decouples the
 * preview backdrop from the UI theme so white-on-light and black-on-dark
 * never disappear into the surface.
 */
export function checkerBackgroundStyle(textColor: string): {
  backgroundImage: string
  backgroundSize: string
  backgroundPosition: string
  backgroundColor: string
} {
  const lightText = perceivedLuma(textColor) > 0.55
  const base = lightText ? "#0b1220" : "#ffffff"
  const square = lightText ? "#1e293b" : "#e2e8f0"
  return {
    backgroundColor: base,
    backgroundImage: `linear-gradient(45deg, ${square} 25%, transparent 25%), linear-gradient(-45deg, ${square} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${square} 75%), linear-gradient(-45deg, transparent 75%, ${square} 75%)`,
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
  }
}
