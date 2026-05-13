import type { FontFamilyId, WeightId } from "./fonts"

export type BgMode = "transparent" | "complement-bg" | "complement-text"

export type SizePreset = "S" | "M" | "L"
export type LinePreset = "S" | "M" | "L"

export const SIZE_PRESETS: Record<SizePreset, { label: string; px: number }> = {
  S: { label: "小", px: 56 },
  M: { label: "中", px: 112 },
  L: { label: "大", px: 200 },
}

export const LINE_PRESETS: Record<LinePreset, { label: string; value: number }> = {
  S: { label: "緊", value: 1.05 },
  M: { label: "中", value: 1.4 },
  L: { label: "寬", value: 1.9 },
}

export type TextStyle = {
  family: FontFamilyId
  weight: WeightId
  sizePreset: SizePreset
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

export function stylePx(style: TextStyle): number {
  return SIZE_PRESETS[style.sizePreset].px
}

export function styleLineHeight(style: TextStyle): number {
  return LINE_PRESETS[style.linePreset].value
}

export const DEFAULT_STYLE: TextStyle = {
  family: "GenYoMin2TW",
  weight: "R",
  sizePreset: "M",
  linePreset: "M",
  color: "#111827",
  bgMode: "transparent",
  align: "center",
}

export function newLayerId(): string {
  return `l_${Math.random().toString(36).slice(2, 10)}`
}
