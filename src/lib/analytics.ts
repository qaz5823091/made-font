import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported, logEvent } from "firebase/analytics"
import type { Analytics } from "firebase/analytics"
import type { TextStyle } from "./types"

/**
 * Snapshot of the text-style configuration captured at export time, sent
 * alongside copy/download events so we can see *what users actually keep*.
 * Per-tweak events already exist via track.changeStyle — this is the final
 * "committed" state.
 */
export type ExportConfig = {
  source: "desktop" | "mobile"
  font_id: string
  font_size: number
  bold: boolean
  italic: boolean
  align: string
  line_preset: string
  bg_mode: string
  color: string
  /** -1..1 — bi-directional curve. 0 = straight. */
  curve: number
}

/** Adds animation parameters to the base export config. */
export type GifExportConfig = ExportConfig & {
  animation_kind: string
  animation_speed: number
}

export function buildExportConfig(
  source: "desktop" | "mobile",
  style: TextStyle,
): ExportConfig {
  return {
    source,
    font_id: style.family,
    font_size: style.size,
    bold: style.bold,
    italic: style.italic,
    align: style.align,
    line_preset: style.linePreset,
    bg_mode: style.bgMode,
    color: style.color,
    curve: style.curve,
  }
}

export function buildGifExportConfig(
  source: "desktop" | "mobile",
  style: TextStyle,
  animationKind: string,
  animationSpeed: number,
): GifExportConfig {
  return {
    ...buildExportConfig(source, style),
    animation_kind: animationKind,
    animation_speed: animationSpeed,
  }
}

function flattenExportConfig(c: ExportConfig) {
  return {
    source: c.source,
    font_id: c.font_id,
    font_size: c.font_size,
    bold: String(c.bold),
    italic: String(c.italic),
    align: c.align,
    line_preset: c.line_preset,
    bg_mode: c.bg_mode,
    color: c.color,
    // Round to 0.05 buckets so GA's dimension cardinality stays manageable.
    curve: (Math.round(c.curve * 20) / 20).toFixed(2),
  }
}

function flattenGifExportConfig(c: GifExportConfig) {
  return {
    ...flattenExportConfig(c),
    animation_kind: c.animation_kind,
    // One-decimal buckets for the same cardinality reason.
    animation_speed: Math.round(c.animation_speed * 10) / 10,
  }
}

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

  // Carries the entire TextStyle so we can see the committed configuration
  // a user actually exported (vs. transient pre-export tweaks).
  copyImage: (config: ExportConfig) =>
    log("copy_image", flattenExportConfig(config)),

  downloadImage: (config: ExportConfig) =>
    log("download_image", flattenExportConfig(config)),

  // Fired once per pinch gesture, not per frame.
  pinchResize: () => log("pinch_resize"),

  // Curve direction "committed" — fired on pointer-up of the slider, so it
  // captures intent without firing per drag frame. Bucketed to 0.05.
  changeCurve: (value: number) =>
    log("change_curve", {
      value: (Math.round(value * 20) / 20).toFixed(2),
      direction: value > 0 ? "smile" : value < 0 ? "frown" : "none",
    }),

  openAnimation: () => log("open_animation"),

  // Distinguishes user-driven selection (tap an icon) from swipe-cycled
  // selection so we can see which discovery affordance gets used.
  changeAnimation: (kind: string, via: "tap" | "swipe") =>
    log("change_animation", { kind, via }),

  // Mirrors copyImage / downloadImage: separate events for each action,
  // both carry the full style snapshot + animation kind + speed so reports
  // can break exports down by which effect users actually kept.
  copyGif: (config: GifExportConfig) =>
    log("copy_gif", flattenGifExportConfig(config)),

  downloadGif: (config: GifExportConfig) =>
    log("download_gif", flattenGifExportConfig(config)),
}
