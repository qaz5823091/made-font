import { createContext, useContext, useEffect, useState } from "react"

export type Locale = "zh" | "en"

type Messages = Record<string, string>

const ZH: Messages = {
  "app.title": "made-font",
  "app.subtitle": "字型 → 圖片",
  "mode.pure": "純文字",
  "mode.image": "圖片合成",
  "theme.system": "跟隨系統",
  "theme.light": "淺色",
  "theme.dark": "深色",
  "locale.switch": "切換語言",
  "splash.subtitle": "字型 → 圖片",

  "panel.text.label": "文字",
  "panel.text.placeholder": "輸入文字…",
  "panel.text.charCount": "{n} 字",
  "panel.color": "顏色",
  "panel.bg": "底色",
  "panel.weight": "字重",
  "panel.family": "字型",
  "panel.align": "對齊",
  "panel.line": "行距",
  "panel.size.hint": "雙指縮放調整 · {n}px",
  "panel.size.hint.rotate": "雙指縮放 / 旋轉 · {n}px",

  "bg.transparent": "透明",
  "bg.complement-bg": "補色底",
  "bg.complement-text": "補色字",
  "line.S": "緊",
  "line.M": "中",
  "line.L": "寬",
  "align.left": "靠左",
  "align.center": "置中",
  "align.right": "靠右",

  "weight.EL": "極細 EL",
  "weight.L": "細 L",
  "weight.R": "標準 R",
  "weight.M": "中 M",
  "weight.SB": "中粗 SB",
  "weight.B": "粗 B",
  "weight.H": "特粗 H",
  "family.GenKiMin2TW": "源樣 假名",
  "family.GenYoMin2TW": "源樣 漢字",

  "action.copy": "複製圖片",
  "action.download": "下載 PNG",
  "action.import": "匯入",
  "action.change": "更換",
  "action.addText": "新增文字",
  "action.delete": "刪除",

  "toast.copied": "已複製到剪貼簿",
  "toast.copyFailed": "複製失敗",
  "toast.downloading": "已開始下載",
  "toast.downloadFailed": "下載失敗",
  "error.exportFailed": "匯出 PNG 失敗",
  "error.clipboardUnsupported": "此瀏覽器不支援直接複製圖片到剪貼簿",

  "image.dropzone.title": "點此匯入圖片",
  "image.dropzone.hint": "支援 PNG / JPG / WebP",
  "image.empty": "點選畫布文字以編輯，或按「新增文字」。",
  "image.needImage": "請先匯入一張圖片。",

  "font.loading": "載入字型中…",
  "font.newText": "新文字",
  "pure.placeholderText": "輸入文字\n即時預覽",
}

const EN: Messages = {
  "app.title": "made-font",
  "app.subtitle": "Font → Image",
  "mode.pure": "Text only",
  "mode.image": "Image overlay",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "locale.switch": "Switch language",
  "splash.subtitle": "Font → Image",

  "panel.text.label": "Text",
  "panel.text.placeholder": "Type something…",
  "panel.text.charCount": "{n} chars",
  "panel.color": "Color",
  "panel.bg": "Background",
  "panel.weight": "Weight",
  "panel.family": "Family",
  "panel.align": "Align",
  "panel.line": "Line",
  "panel.size.hint": "Pinch to resize · {n}px",
  "panel.size.hint.rotate": "Pinch / rotate · {n}px",

  "bg.transparent": "Transparent",
  "bg.complement-bg": "Tinted bg",
  "bg.complement-text": "Tinted text",
  "line.S": "Tight",
  "line.M": "Normal",
  "line.L": "Wide",
  "align.left": "Left",
  "align.center": "Center",
  "align.right": "Right",

  "weight.EL": "ExtraLight",
  "weight.L": "Light",
  "weight.R": "Regular",
  "weight.M": "Medium",
  "weight.SB": "SemiBold",
  "weight.B": "Bold",
  "weight.H": "Heavy",
  "family.GenKiMin2TW": "GenKi (Kana)",
  "family.GenYoMin2TW": "GenYo (Hanzi)",

  "action.copy": "Copy",
  "action.download": "Download",
  "action.import": "Import",
  "action.change": "Replace",
  "action.addText": "Add text",
  "action.delete": "Delete",

  "toast.copied": "Copied to clipboard",
  "toast.copyFailed": "Copy failed",
  "toast.downloading": "Download started",
  "toast.downloadFailed": "Download failed",
  "error.exportFailed": "Failed to export PNG",
  "error.clipboardUnsupported": "This browser cannot copy images to the clipboard",

  "image.dropzone.title": "Tap to import an image",
  "image.dropzone.hint": "PNG / JPG / WebP",
  "image.empty": "Tap a text on the canvas, or press \"Add text\".",
  "image.needImage": "Import an image first.",

  "font.loading": "Loading font…",
  "font.newText": "New text",
  "pure.placeholderText": "Type here\nlive preview",
}

const MESSAGES: Record<Locale, Messages> = { zh: ZH, en: EN }

export type TFn = (key: string, vars?: Record<string, string | number>) => string

type Ctx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TFn
}

const I18nContext = createContext<Ctx | null>(null)

const STORAGE_KEY = "made-font.locale"

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh"
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored === "zh" || stored === "en") return stored
  return window.navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function useI18nProvider() {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale())

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hant" : "en"
  }, [locale])

  const t: TFn = (key, vars) => {
    const msg = MESSAGES[locale][key] ?? MESSAGES.zh[key] ?? key
    if (!vars) return msg
    return msg.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
    )
  }

  return { locale, setLocale, t }
}

export const I18nProvider = I18nContext.Provider

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
  return ctx
}
