export type FontFamilyId = "GenKiMin2TW" | "GenYoMin2TW"

export type WeightId = "EL" | "L" | "R" | "M" | "SB" | "B" | "H"

export const FONT_FAMILIES: { id: FontFamilyId; label: string; description: string }[] = [
  { id: "GenKiMin2TW", label: "源樣明體 假名", description: "GenKiMin2TW（日系假名強化）" },
  { id: "GenYoMin2TW", label: "源樣明體 漢字", description: "GenYoMin2TW（漢字優化）" },
]

export const WEIGHTS: { id: WeightId; label: string; cssWeight: number }[] = [
  { id: "EL", label: "極細 EL", cssWeight: 200 },
  { id: "L", label: "細 L", cssWeight: 300 },
  { id: "R", label: "標準 R", cssWeight: 400 },
  { id: "M", label: "中 M", cssWeight: 500 },
  { id: "SB", label: "中粗 SB", cssWeight: 600 },
  { id: "B", label: "粗 B", cssWeight: 700 },
  { id: "H", label: "特粗 H", cssWeight: 900 },
]

export function fontFileUrl(family: FontFamilyId, weight: WeightId): string {
  return `${import.meta.env.BASE_URL}fonts/${family}-${weight}.otf`
}

export function fontCssFamily(family: FontFamilyId, weight: WeightId): string {
  return `${family}-${weight}`
}

const loadingPromises = new Map<string, Promise<void>>()
const loadedKeys = new Set<string>()

export function isFontLoaded(family: FontFamilyId, weight: WeightId): boolean {
  return loadedKeys.has(fontCssFamily(family, weight))
}

export async function ensureFontLoaded(
  family: FontFamilyId,
  weight: WeightId,
): Promise<void> {
  const key = fontCssFamily(family, weight)
  if (loadedKeys.has(key)) return
  const existing = loadingPromises.get(key)
  if (existing) return existing

  const promise = (async () => {
    const url = fontFileUrl(family, weight)
    const ff = new FontFace(key, `url(${url}) format("opentype")`, {
      style: "normal",
      weight: "400",
      display: "swap",
    })
    const loaded = await ff.load()
    document.fonts.add(loaded)
    loadedKeys.add(key)
  })()

  loadingPromises.set(key, promise)
  try {
    await promise
  } finally {
    loadingPromises.delete(key)
  }
}
