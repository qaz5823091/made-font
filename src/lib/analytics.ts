import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported, logEvent } from "firebase/analytics"
import type { Analytics } from "firebase/analytics"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Only initialize in production builds. import.meta.env.PROD is true for
// `vite build` and false for `vite dev`, so events never fire during development.
const ready: Promise<Analytics | null> = import.meta.env.PROD
  ? isSupported()
      .then((ok) => {
        if (!ok) return null
        const app = initializeApp(firebaseConfig)
        return getAnalytics(app)
      })
      .catch(() => null)
  : Promise.resolve(null)

function log(name: string, params?: Record<string, string | number | boolean>) {
  ready.then((a) => {
    if (a) logEvent(a, name, params)
  })
}

export const track = {
  appOpen: () => log("app_open"),

  switchMode: (mode: string) => log("switch_mode", { mode }),

  changeTheme: (theme: string) => log("change_theme", { theme }),

  changeLocale: (locale: string) => log("change_locale", { locale }),

  openHelp: () => log("open_help"),

  // font_id is stored as a dimension so we can see per-font usage breakdown.
  // Adding new fonts to FONT_FAMILIES requires no change here — values are
  // passed through directly and appear as new dimension values in GA.
  changeFont: (fontId: string) => log("change_font", { font_id: fontId }),

  // property: "bold" | "italic" | "align" | "line_preset" | "bg_mode"
  changeStyle: (property: string, value: string | number | boolean) =>
    log("change_style", { property, value: String(value) }),

  // method: "swatch" (color picker drags are too noisy to track)
  changeColor: (method: "swatch") => log("change_color", { method }),

  copyImage: (source: "desktop" | "mobile") => log("copy_image", { source }),

  downloadImage: (source: "desktop" | "mobile") => log("download_image", { source }),

  // Fired once per pinch gesture, not per frame.
  pinchResize: () => log("pinch_resize"),
}
