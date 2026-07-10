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
  "panel.curve": "圓弧",
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
  "action.done": "完成編輯",
  "action.back": "返回",
  "action.exportGif": "匯出 GIF",
  "action.animate": "動畫模式",

  "anim.title": "動畫工作室",
  "anim.effect": "效果",
  "anim.speed": "速度",
  "anim.exporting": "編碼中… {done}/{total}",
  "anim.kind.pulse": "脈動",
  "anim.kind.bounce": "彈跳",
  "anim.kind.rotate": "旋轉",
  "anim.kind.fade": "淡入淡出",
  "anim.kind.marquee": "跑馬燈",
  "anim.kind.wave": "波浪",

  "toast.copied": "已複製到剪貼簿",
  "toast.copyFailed": "複製失敗",
  "toast.copyGifUnsupported": "此裝置不支援複製 GIF，請改用「下載 GIF」",
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
  "pure.placeholderText": "我愛 MadeFont",

  "help.button": "說明與條款",
  "help.close": "關閉",
  "help.tab.usage": "使用說明",
  "help.tab.terms": "字型與條款",

  "help.usage.title": "怎麼用",
  "help.usage.pure.title": "純文字模式",
  "help.usage.pure.body":
    "打字就會即時出現在畫布上。可以換字型、調顏色、底色、對齊跟行距。完成後按「複製圖片」或「下載圖片」就行。手機點畫布開始打字，桌機直接在下方輸入。",
  "help.usage.image.title": "圖片合成模式",
  "help.usage.image.body":
    "之後會開放：放一張圖、把文字疊在上面，可以一直疊。複製跟下載的方式跟純文字模式一樣。",
  "help.usage.animation.title": "動畫模式",
  "help.usage.animation.body":
    "在純文字模式下面點「動畫模式」（手機版是膠片圖示）進入動畫工作室。底部一排是 6 種效果：脈動、彈跳、旋轉、淡入淡出、跑馬燈、波浪——點圖示或左右滑都可以切換。烏龜跟兔子之間的滑桿調速度。沒選底色時匯出會是透明背景 GIF；有選底色就是不透明的。手機如果不支援複製 GIF，會跳提示請改用下載。",
  "help.usage.tips.title": "小撇步",
  "help.usage.tips.body":
    "右上角可以切主題（跟隨系統／淺色／深色）跟語言，設定會留在這台裝置上。如果「複製圖片」用不了，改用「下載圖片」就好。圓弧的滑桿往中間 0 拖會自動 snap 回直線。",

  "help.terms.title": "字型來源與授權",
  "help.terms.intro":
    "MadeFont 造字趣 內附的字型檔皆採用以下開源字型，所有權與授權條款屬原作者。匯出的圖片可自由使用，但散布或再嵌入字型檔需遵守對應字型授權。",
  "help.terms.font.GenYoMin2TW.title": "源樣明朝 GenYoMin2TW",
  "help.terms.font.GenYoMin2TW.desc":
    "由 ButTaiwan 製作，衍生自 Adobe Source Han Serif（思源宋體），追求古籍活字風格。",
  "help.terms.font.IBMPlexSans.title": "IBM Plex Sans",
  "help.terms.font.IBMPlexSans.desc":
    "IBM 設計團隊所製作的開源無襯線字型，支援多種權重與斜體。",
  "help.terms.font.DelaGothicOne.title": "Dela Gothic One",
  "help.terms.font.DelaGothicOne.desc":
    "由 Yuki Nakajima 與 artakana 設計的日系超粗黑體，造形飽滿厚實，適合做標題與海報主視覺。透過 Google Fonts 開源釋出。",
  "help.terms.font.ChenYuluoyanThin.title": "辰宇落雁體 Thin",
  "help.terms.font.ChenYuluoyanThin.desc":
    "由王立宇與劉韋辰於高中自主學習計畫中合作完成的繁體中文手寫字型，纖細而富有溫度，適合書信與抒情排版。",
  "help.terms.font.BpmfZihiKaiStd.title": "字嗨注音標楷 BpmfZihiKaiStd",
  "help.terms.font.BpmfZihiKaiStd.desc":
    "ButTaiwan「注音IVS字型規格」的注音標楷體，每個漢字旁自動標上注音。漢字取自全字庫正楷體（政府開放資料），注音符號衍生自思源宋體。",
  "help.terms.label.repo": "原始 Repo",
  "help.terms.label.license": "授權",
  "help.terms.label.basedOn": "衍生自",
  "help.terms.license.ofl": "SIL Open Font License 1.1",
  "help.terms.license.bpmfZihiKai": "CC BY 4.0＋SIL OFL 1.1",
  "help.terms.sourceHan": "Adobe Source Han Serif",
  "help.terms.twKai": "全字庫正楷體 TW-Kai",
  "help.terms.disclaimer.title": "免責",
  "help.terms.disclaimer.body":
    "本服務由 @cppdesigns 維護，不對輸出結果負責。請確認你輸入的內容與輸出的圖片不侵犯第三方權益。",
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
  "panel.curve": "Curve",
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
  "action.done": "Done editing",
  "action.back": "Back",
  "action.exportGif": "Export GIF",
  "action.animate": "Animation mode",

  "anim.title": "Animation Studio",
  "anim.effect": "Effect",
  "anim.speed": "Speed",
  "anim.exporting": "Encoding… {done}/{total}",
  "anim.kind.pulse": "Pulse",
  "anim.kind.bounce": "Bounce",
  "anim.kind.rotate": "Rotate",
  "anim.kind.fade": "Fade",
  "anim.kind.marquee": "Marquee",
  "anim.kind.wave": "Wave",

  "toast.copied": "Copied to clipboard",
  "toast.copyFailed": "Copy failed",
  "toast.copyGifUnsupported":
    "This device can't copy GIFs to the clipboard — use Download instead",
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
  "pure.placeholderText": "I love MadeFont",

  "help.button": "Help & Licenses",
  "help.close": "Close",
  "help.tab.usage": "Usage",
  "help.tab.terms": "Fonts & Licenses",

  "help.usage.title": "How to use",
  "help.usage.pure.title": "Text-only mode",
  "help.usage.pure.body":
    "Type and you'll see it on the canvas right away. Pick a font, change colors, background, alignment and line spacing. When you're done, hit Copy or Download. On phone, tap the canvas to start typing; on desktop, type in the panel below.",
  "help.usage.image.title": "Image-overlay mode",
  "help.usage.image.body":
    "Coming soon — drop in an image and stack text on top. Copy and Download work the same as text-only mode.",
  "help.usage.animation.title": "Animation mode",
  "help.usage.animation.body":
    "From text-only mode, tap “Animation mode” (the film icon on mobile) to enter the studio. The bottom row holds six effects — pulse, bounce, rotate, fade, marquee, wave — tap an icon or swipe sideways to switch. The slider between the turtle and rabbit controls speed. With no background color picked, the exported GIF has a transparent background; pick one and it becomes opaque. If your device can't copy GIFs to the clipboard, a toast will tell you to download instead.",
  "help.usage.tips.title": "Tips",
  "help.usage.tips.body":
    "Top-right switches theme (follow system / light / dark) and language. Both stay on this device. If Copy doesn't work in your browser, Download still does. The curve slider snaps back to 0 when dragged near the center.",

  "help.terms.title": "Font credits & licenses",
  "help.terms.intro":
    "MadeFont bundles the following open-source fonts. Ownership and license terms belong to their original authors. Exported images are yours to use, but redistributing or re-embedding the font files must comply with each font's license.",
  "help.terms.font.GenYoMin2TW.title": "GenYoMin2TW (源樣明朝)",
  "help.terms.font.GenYoMin2TW.desc":
    "By ButTaiwan; derived from Adobe Source Han Serif, aiming at the classic letterpress feel.",
  "help.terms.font.IBMPlexSans.title": "IBM Plex Sans",
  "help.terms.font.IBMPlexSans.desc":
    "An open-source sans-serif typeface by IBM with multiple weights and italics.",
  "help.terms.font.DelaGothicOne.title": "Dela Gothic One",
  "help.terms.font.DelaGothicOne.desc":
    "An ultra-bold Japanese display face by Yuki Nakajima and artakana, distributed via Google Fonts — great for headlines and poster-style art.",
  "help.terms.font.ChenYuluoyanThin.title": "ChenYuluoyan Thin (辰宇落雁體)",
  "help.terms.font.ChenYuluoyanThin.desc":
    "A handwritten Traditional Chinese typeface by Wang Li-Yu and Liu Wei-Chen — delicate strokes with a warm, personal feel for letters and lyrical layouts.",
  "help.terms.font.BpmfZihiKaiStd.title": "BpmfZihiKaiStd (字嗨注音標楷)",
  "help.terms.font.BpmfZihiKaiStd.desc":
    "A kai-script font from ButTaiwan's Bopomofo IVS spec — every hanzi carries zhuyin (bopomofo) annotations. Hanzi glyphs come from Taiwan's open-government TW-Kai; the bopomofo derives from Source Han Serif.",
  "help.terms.label.repo": "Source repo",
  "help.terms.label.license": "License",
  "help.terms.label.basedOn": "Based on",
  "help.terms.license.ofl": "SIL Open Font License 1.1",
  "help.terms.license.bpmfZihiKai": "CC BY 4.0 + SIL OFL 1.1",
  "help.terms.sourceHan": "Adobe Source Han Serif",
  "help.terms.twKai": "TW-Kai (全字庫正楷體)",
  "help.terms.disclaimer.title": "Disclaimer",
  "help.terms.disclaimer.body":
    "This service is maintained and ships as-is by @cppdesigns. You're responsible for ensuring that anything you type and anything you export does not infringe on third-party rights.",
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
