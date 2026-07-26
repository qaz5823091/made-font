import { useState, useEffect } from "react"
import {
  FontFamily,
  CUSTOM_FONTS,
  customFontUrls,
  FONT_FAMILY_IDS,
} from "./fonts"
import { track } from "./analytics"

const fontEventTarget = new EventTarget()
function notifyFontsChanged() {
  fontEventTarget.dispatchEvent(new Event("changed"))
}

async function getFontsDir() {
  const root = await navigator.storage.getDirectory()
  return await root.getDirectoryHandle("fonts", { create: true })
}

export async function initCustomFonts() {
  try {
    const dir = await getFontsDir()
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== "file") continue
      const file = await (handle as FileSystemFileHandle).getFile()
      registerCustomFont(file, name)
    }
    notifyFontsChanged()
  } catch (err) {
    console.error("Failed to init custom fonts from OPFS:", err)
  }
}

/**
 * Derive a stable family id from the stored filename. The id doubles as the
 * display label and the FontFace family name, so it must be a pure function of
 * the filename (OPFS is re-read on every reload) and must not shadow a bundled
 * font: getFamily() checks FONT_FAMILIES first, so a custom "IBMPlexSans"
 * would otherwise silently resolve to the bundled file instead.
 */
function customFontId(filename: string): string {
  const base = filename.substring(0, filename.lastIndexOf("."))
  return FONT_FAMILY_IDS.includes(base) ? `${base} (custom)` : base
}

function registerCustomFont(file: File, filename: string): FontFamily | null {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext !== "ttf" && ext !== "otf") return null

  const id = customFontId(filename)
  const format = ext === "otf" ? "opentype" : "truetype"

  // Refresh the object URL, revoking any previous one for this id so
  // re-importing the same font doesn't leak the stale blob URL.
  const stale = customFontUrls.get(id)
  if (stale) URL.revokeObjectURL(stale)
  customFontUrls.set(id, URL.createObjectURL(file))

  // Already registered (re-import, or OPFS init after a prior import in this
  // session): reuse the entry so the family list gains no duplicate option.
  const existing = CUSTOM_FONTS.find((f) => f.id === id)
  if (existing) return existing

  const family: FontFamily = {
    id,
    format,
    ext,
    variants: { regular: "Regular" },
    isCustom: true,
  }
  CUSTOM_FONTS.push(family)
  notifyFontsChanged()
  return family
}

export function useCustomFonts() {
  const [fonts, setFonts] = useState(CUSTOM_FONTS)
  useEffect(() => {
    const handle = () => setFonts([...CUSTOM_FONTS])
    fontEventTarget.addEventListener("changed", handle)
    return () => fontEventTarget.removeEventListener("changed", handle)
  }, [])
  return fonts
}

export type ImportResult =
  | { ok: true; family: FontFamily }
  | { ok: false; reason: "cancelled" | "quota" | "failed" }

/**
 * Open the file picker, persist the chosen font to OPFS, and register it.
 * UI-agnostic: callers decide how to surface the outcome (each editor owns its
 * own toast), so no i18n or setToast is threaded in here. A "cancelled" result
 * means the user dismissed the picker — callers should stay silent for it.
 */
export function importCustomFont(): Promise<ImportResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".ttf,.otf"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve({ ok: false, reason: "cancelled" })
        return
      }

      try {
        const dir = await getFontsDir()
        const fileHandle = await dir.getFileHandle(file.name, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(file)
        await writable.close()

        const family = registerCustomFont(file, file.name)
        if (!family) {
          resolve({ ok: false, reason: "failed" })
          return
        }
        track.importFont(family.ext)
        resolve({ ok: true, family })
      } catch (err) {
        console.error("Failed to import font:", err)
        const quota =
          err instanceof DOMException && err.name === "QuotaExceededError"
        resolve({ ok: false, reason: quota ? "quota" : "failed" })
      }
    }
    input.click()
  })
}
