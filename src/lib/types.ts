export type BgMode = "transparent" | "complement-bg" | "complement-text"

export type LinePreset = "S" | "M" | "L"

export const LINE_PRESETS: Record<LinePreset, { value: number }> = {
  S: { value: 1.05 },
  M: { value: 1.4 },
  L: { value: 1.9 },
}

export const SIZE_MIN = 24
export const SIZE_MAX = 600
export const SIZE_DEFAULT = 112

export type TextStyle = {
  /** Font family id — matches FONT_FAMILIES[].id (also display label). */
  family: string
  bold: boolean
  italic: boolean
  /** Continuous font size (CSS pixels). Adjusted via pinch gesture. */
  size: number
  linePreset: LinePreset
  color: string
  bgMode: BgMode
  align: "left" | "center" | "right"
}

export type TextLayer = {
  id: string
  text: string
  x: number
  y: number
  rotation: number
  style: TextStyle
}

export function styleLineHeight(style: TextStyle): number {
  return LINE_PRESETS[style.linePreset].value
}

export function stylePx(style: TextStyle): number {
  return style.size
}

export function clampSize(n: number): number {
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, n))
}

export const DEFAULT_STYLE: TextStyle = {
  family: "GenYoMin2TW",
  bold: false,
  italic: false,
  size: SIZE_DEFAULT,
  linePreset: "M",
  color: "#111827",
  bgMode: "transparent",
  align: "center",
}

export function newLayerId(): string {
  return `l_${Math.random().toString(36).slice(2, 10)}`
}
