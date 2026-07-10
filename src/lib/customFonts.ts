import { useState, useEffect } from "react"
import { FontFamily, CUSTOM_FONTS, customFontUrls, fontCssFamily } from "./fonts"

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
    // @ts-ignore
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file") {
        const file = await handle.getFile()
        await registerCustomFont(file, name)
      }
    }
    notifyFontsChanged()
  } catch (err) {
    console.error("Failed to init custom fonts from OPFS:", err)
  }
}

async function registerCustomFont(file: File, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() as "ttf" | "otf"
  if (ext !== "ttf" && ext !== "otf") return null

  const id = filename.substring(0, filename.lastIndexOf('.'))
  const format = ext === "otf" ? "opentype" : "truetype"

  const family: FontFamily = {
    id,
    format,
    ext,
    variants: { regular: "Regular" },
    isCustom: true,
  }

  const url = URL.createObjectURL(file)
  customFontUrls.set(id, url)

  // Wait, if it already exists, just return it.
  const existing = CUSTOM_FONTS.find(f => f.id === id)
  if (existing) {
    return existing
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

export function importCustomFont(t: (key: string) => string): Promise<FontFamily | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".ttf,.otf"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const dir = await getFontsDir()
        const fileHandle = await dir.getFileHandle(file.name, { create: true })
        // @ts-ignore
        const writable = await fileHandle.createWritable()
        await writable.write(file)
        await writable.close()

        const family = await registerCustomFont(file, file.name)
        if (family) {
          resolve(family)
        } else {
          alert(t("font.importFailed"))
          resolve(null)
        }
      } catch (err: any) {
        console.error("Failed to import font:", err)
        if (err.name === 'QuotaExceededError') {
          alert(t("font.quotaExceeded"))
        } else {
          alert(t("font.importFailed"))
        }
        resolve(null)
      }
    }
    input.click()
  })
}
