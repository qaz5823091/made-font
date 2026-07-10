export type FontFormat = "opentype" | "truetype"

export type FontVariantKey = "regular" | "bold" | "italic" | "boldItalic"

export type FontFamily = {
  /** Folder name under public/fonts/ and display label (filename prefix). */
  id: string
  format: FontFormat
  ext: "otf" | "ttf"
  /** File suffix per variant, joined as `${id}-${suffix}.${ext}`. */
  variants: Partial<Record<FontVariantKey, string>>
}

export const FONT_FAMILIES: FontFamily[] = [
  {
    id: "GenYoMin2TW",
    format: "opentype",
    ext: "otf",
    variants: {
      regular: "Regular",
      bold: "Bold",
    },
  },
  {
    id: "IBMPlexSans",
    format: "truetype",
    ext: "ttf",
    variants: {
      regular: "Regular",
      bold: "Bold",
      italic: "Italic",
      boldItalic: "BoldItalic",
    },
  },
  {
    id: "DelaGothicOne",
    format: "truetype",
    ext: "ttf",
    variants: {
      regular: "Regular",
    },
  },
  {
    id: "ChenYuluoyanThin",
    format: "truetype",
    ext: "ttf",
    variants: {
      regular: "Regular",
    },
  },
  {
    id: "BpmfZihiKaiStd",
    format: "truetype",
    ext: "ttf",
    variants: {
      regular: "Regular",
    },
  },
]

export const FONT_FAMILY_IDS = FONT_FAMILIES.map((f) => f.id)

export function getFamily(id: string): FontFamily {
  const f = FONT_FAMILIES.find((x) => x.id === id)
  if (!f) throw new Error(`Unknown font family: ${id}`)
  return f
}

export function variantKey(bold: boolean, italic: boolean): FontVariantKey {
  if (bold && italic) return "boldItalic"
  if (bold) return "bold"
  if (italic) return "italic"
  return "regular"
}

export function resolveVariant(
  family: FontFamily,
  bold: boolean,
  italic: boolean,
): FontVariantKey {
  const ideal = variantKey(bold, italic)
  if (family.variants[ideal]) return ideal
  // Fall back: drop italic first, then drop bold.
  if (ideal === "boldItalic") {
    if (family.variants.bold) return "bold"
    if (family.variants.italic) return "italic"
  }
  if (ideal === "italic" && family.variants.regular) return "regular"
  if (ideal === "bold" && family.variants.regular) return "regular"
  return "regular"
}

export function hasVariant(
  family: FontFamily,
  bold: boolean,
  italic: boolean,
): boolean {
  return Boolean(family.variants[variantKey(bold, italic)])
}

export function fontFileUrl(family: FontFamily, key: FontVariantKey): string {
  const suffix = family.variants[key]
  if (!suffix) throw new Error(`${family.id} has no variant ${key}`)
  return `${import.meta.env.BASE_URL}fonts/${family.id}/${family.id}-${suffix}.${family.ext}`
}

export function fontCssFamily(familyId: string, key: FontVariantKey): string {
  return `${familyId}-${key}`
}

const loadingPromises = new Map<string, Promise<void>>()
const loadedKeys = new Set<string>()

export function isFontLoaded(familyId: string, key: FontVariantKey): boolean {
  return loadedKeys.has(fontCssFamily(familyId, key))
}

export async function ensureFontLoaded(
  familyId: string,
  bold: boolean,
  italic: boolean,
): Promise<FontVariantKey> {
  const family = getFamily(familyId)
  const key = resolveVariant(family, bold, italic)
  const cssName = fontCssFamily(familyId, key)
  if (loadedKeys.has(cssName)) return key
  const existing = loadingPromises.get(cssName)
  if (existing) {
    await existing
    return key
  }

  const promise = (async () => {
    const url = fontFileUrl(family, key)
    const ff = new FontFace(cssName, `url(${url}) format("${family.format}")`, {
      style: "normal",
      weight: "400",
      display: "swap",
    })
    const loaded = await ff.load()
    document.fonts.add(loaded)
    loadedKeys.add(cssName)
  })()

  loadingPromises.set(cssName, promise)
  try {
    await promise
  } finally {
    loadingPromises.delete(cssName)
  }
  return key
}
