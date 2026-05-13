export type FontFamilyId = "GenKiMin2TW" | "GenYoMin2TW"

export type WeightId = "EL" | "L" | "R" | "M" | "SB" | "B" | "H"

export const FONT_FAMILY_IDS: FontFamilyId[] = ["GenKiMin2TW", "GenYoMin2TW"]

export const WEIGHT_IDS: WeightId[] = ["EL", "L", "R", "M", "SB", "B", "H"]

export const WEIGHT_CSS: Record<WeightId, number> = {
  EL: 200,
  L: 300,
  R: 400,
  M: 500,
  SB: 600,
  B: 700,
  H: 900,
}

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
