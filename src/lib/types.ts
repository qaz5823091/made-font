import type { FontFamilyId, WeightId } from "./fonts"

export type TextStyle = {
  family: FontFamilyId
  weight: WeightId
  size: number
  color: string
  lineHeight: number
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

export const DEFAULT_STYLE: TextStyle = {
  family: "GenYoMin2TW",
  weight: "R",
  size: 96,
  color: "#111827",
  lineHeight: 1.35,
  align: "center",
}

export function newLayerId(): string {
  return `l_${Math.random().toString(36).slice(2, 10)}`
}
