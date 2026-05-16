import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "zh" | "en";

type Messages = Record<string, string>;

const ZH: Messages = {
  "app.title": "MadeFont",
  "app.subtitle": "造字趣",
  "app.description": "用網頁打造你的自訂字型圖片。MadeFont！",
  "mode.pure": "純文字",
  "mode.image": "圖片合成",
  "mode.image.wip": "圖片合成功能還在開發中…",
  "theme.system": "跟隨系統",
  "theme.light": "淺色",
  "theme.dark": "深色",
  "locale.switch": "切換語言",
  "splash.subtitle": "造字趣",

  "panel.text.label": "文字",
  "panel.text.placeholder": "輸入文字…",
  "panel.text.charCount": "{n} 字",
  "panel.color": "顏色",
  "panel.bg": "底色",
  "panel.style": "字型樣式",
  "panel.family": "字型",
  "style.bold": "粗體",
  "style.italic": "斜體",
  "panel.align": "對齊",
  "panel.line": "行距",
  "panel.size": "字級",
  "panel.rotation": "旋轉",
  "gesture.pinch": "雙指縮放",
  "gesture.pinchRotate": "雙指縮放 / 旋轉",
  "gesture.rotate": "雙指旋轉",
  "unit.px": "{n} px",
  "unit.deg": "{n}°",
  "action.resetRotation": "重設旋轉",

  "bg.transparent": "透明",
  "bg.complement-bg": "補色底",
  "bg.complement-text": "補色字",
  "line.S": "緊",
  "line.M": "中",
  "line.L": "寬",
  "align.left": "靠左",
  "align.center": "置中",
  "align.right": "靠右",

  "action.downloadSvg": "下載 SVG",
  "action.copy": "複製圖片",
  "action.download": "下載圖片",
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

  "help.button": "說明與條款",
  "help.close": "關閉",
  "help.tab.usage": "使用說明",
  "help.tab.terms": "字型與條款",

  "help.usage.title": "怎麼用",
  "help.usage.pure.title": "純文字模式",
  "help.usage.pure.body":
    "在下方輸入文字會即時渲染到上方畫布。展開樣式面板可以調整字型、字重、顏色、底色、對齊與行距。在手機上以雙指縮放即可調整字級；桌機則使用「字級」滑桿。完成後點「複製圖片」會把透明背景 PNG 放到剪貼簿，「下載 PNG」會存到本機。",
  "help.usage.image.title": "圖片合成模式",
  "help.usage.image.body":
    "先匯入一張圖片（支援 PNG / JPG / WebP），再按「新增文字」加入文字 layer。用單指拖曳移動位置；手機上以雙指縮放並旋轉，桌機則使用「字級」與「旋轉」滑桿。重複新增可疊多層。輸出方式同上。",
  "help.usage.tips.title": "小撇步",
  "help.usage.tips.body":
    "右上角的 ☉ / ◐ / ▢ 切換主題（跟隨系統 / 淺色 / 深色）；ZH/EN 切換顯示語言；偏好會記在本機。複製圖片需要使用 HTTPS 或 localhost，部分舊瀏覽器不支援，則改用「下載 PNG」。",

  "help.terms.title": "字型來源與授權",
  "help.terms.intro":
    "made-font 內附的字型檔皆採用以下開源字型，所有權與授權條款屬原作者。匯出的圖片可自由使用，但散布或再嵌入字型檔需遵守對應字型授權。",
  "help.terms.font.GenYoMin2TW.title": "源樣明朝 GenYoMin2TW",
  "help.terms.font.GenYoMin2TW.desc":
    "由 ButTaiwan 製作，衍生自 Adobe Source Han Serif（思源宋體），追求古籍活字風格。",
  "help.terms.font.IBMPlexSans.title": "IBM Plex Sans",
  "help.terms.font.IBMPlexSans.desc":
    "IBM 設計團隊所製作的開源無襯線字型，支援多種權重與斜體。",
  "help.terms.label.repo": "原始 Repo",
  "help.terms.label.license": "授權",
  "help.terms.label.basedOn": "衍生自",
  "help.terms.license.ofl": "SIL Open Font License 1.1",
  "help.terms.sourceHan": "Adobe Source Han Serif",
  "help.terms.disclaimer.title": "免責",
  "help.terms.disclaimer.body":
    "本服務由社群維護，不對輸出結果負責。請確認你輸入的內容與輸出的圖片不侵犯第三方權益。",
};

const EN: Messages = {
  "app.title": "MadeFont",
  "app.subtitle": "Font → Image",
  "app.description": "A website to make your custom font. MadeFont!",
  "mode.pure": "Text only",
  "mode.image": "Image overlay",
  "mode.image.wip": "Image overlay is still in development…",
  "theme.system": "Follow system",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "locale.switch": "Switch language",
  "splash.subtitle": "Font → Image",

  "panel.text.label": "Text",
  "panel.text.placeholder": "Type something…",
  "panel.text.charCount": "{n} chars",
  "panel.color": "Color",
  "panel.bg": "Background",
  "panel.style": "Style",
  "panel.family": "Family",
  "style.bold": "Bold",
  "style.italic": "Italic",
  "panel.align": "Align",
  "panel.line": "Line",
  "panel.size": "Size",
  "panel.rotation": "Rotation",
  "gesture.pinch": "pinch to resize",
  "gesture.pinchRotate": "pinch / rotate",
  "gesture.rotate": "rotate with 2 fingers",
  "unit.px": "{n} px",
  "unit.deg": "{n}°",
  "action.resetRotation": "Reset rotation",

  "bg.transparent": "Transparent",
  "bg.complement-bg": "Tinted bg",
  "bg.complement-text": "Tinted text",
  "line.S": "Tight",
  "line.M": "Normal",
  "line.L": "Wide",
  "align.left": "Left",
  "align.center": "Center",
  "align.right": "Right",

  "action.downloadSvg": "Download SVG",
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
  "error.clipboardUnsupported":
    "This browser cannot copy images to the clipboard",

  "image.dropzone.title": "Tap to import an image",
  "image.dropzone.hint": "PNG / JPG / WebP",
  "image.empty": 'Tap a text on the canvas, or press "Add text".',
  "image.needImage": "Import an image first.",

  "font.loading": "Loading font…",
  "font.newText": "New text",
  "pure.placeholderText": "Type here\nlive preview",

  "help.button": "Help & licenses",
  "help.close": "Close",
  "help.tab.usage": "Usage",
  "help.tab.terms": "Fonts & licenses",

  "help.usage.title": "How to use",
  "help.usage.pure.title": "Text-only mode",
  "help.usage.pure.body":
    "Type below to render onto the canvas in real time. The style panel lets you change family, weight, color, background, alignment and line height. On touch devices, pinch to resize the text; on desktop, use the Size slider. Copy puts a transparent-background PNG onto the clipboard; Download saves it.",
  "help.usage.image.title": "Image-overlay mode",
  "help.usage.image.body":
    "Import an image (PNG / JPG / WebP), then press Add text to drop a text layer. Drag with one finger to move; pinch with two fingers to resize and rotate. On desktop, use the Size and Rotation sliders. Stack as many layers as you need. Copy / Download work the same way.",
  "help.usage.tips.title": "Tips",
  "help.usage.tips.body":
    "Top-right icons switch theme (system / light / dark) and language; both are remembered locally. Clipboard copy needs HTTPS or localhost; if your browser blocks it, use Download instead.",

  "help.terms.title": "Font credits & licenses",
  "help.terms.intro":
    "made-font bundles the following open-source fonts. Ownership and license terms belong to their original authors. Exported images are yours to use, but redistributing or re-embedding the font files must comply with each font's license.",
  "help.terms.font.GenYoMin2TW.title": "GenYoMin2TW (源樣明朝)",
  "help.terms.font.GenYoMin2TW.desc":
    "By ButTaiwan; derived from Adobe Source Han Serif, aiming at the classic letterpress feel.",
  "help.terms.font.IBMPlexSans.title": "IBM Plex Sans",
  "help.terms.font.IBMPlexSans.desc":
    "An open-source sans-serif typeface by IBM with multiple weights and italics.",
  "help.terms.label.repo": "Source repo",
  "help.terms.label.license": "License",
  "help.terms.label.basedOn": "Based on",
  "help.terms.license.ofl": "SIL Open Font License 1.1",
  "help.terms.sourceHan": "Adobe Source Han Serif",
  "help.terms.disclaimer.title": "Disclaimer",
  "help.terms.disclaimer.body":
    "This service is community-maintained and ships as-is. You're responsible for ensuring that anything you type and anything you export does not infringe on third-party rights.",
};

const MESSAGES: Record<Locale, Messages> = { zh: ZH, en: EN };

export type TFn = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "made-font.locale";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === "zh" || stored === "en") return stored;
  return window.navigator.language?.toLowerCase().startsWith("zh")
    ? "zh"
    : "en";
}

export function useI18nProvider() {
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectInitialLocale(),
  );

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hant" : "en";
  }, [locale]);

  const t: TFn = (key, vars) => {
    const msg = MESSAGES[locale][key] ?? MESSAGES.zh[key] ?? key;
    if (!vars) return msg;
    return msg.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
    );
  };

  return { locale, setLocale, t };
}

export const I18nProvider = I18nContext.Provider;

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
