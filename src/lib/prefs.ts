import {
  DEFAULT_STYLE,
  LINE_PRESETS,
  clampSize,
  type BgMode,
  type EmojiFamilyId,
  type TextStyle,
} from "./types"

const STORAGE_KEY = "made-font.prefs"

export type SharePrefMode = "quick" | "custom"

export type Prefs = {
  v: 1
  style: TextStyle
  /**
   * Remembered answer to the share-landing prompt. Undefined = ask every time
   * ("quick" auto-copies, "custom" skips the landing and opens the editor).
   */
  shareMode?: SharePrefMode
}

const BG_MODES: BgMode[] = ["transparent", "complement-bg", "complement-text"]
const ALIGNS: TextStyle["align"][] = ["left", "center", "right"]
const EMOJI_FAMILIES: EmojiFamilyId[] = ["system", "apple", "twemoji", "noto"]
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

function clampCurve(n: number): number {
  return Math.min(1, Math.max(-1, n))
}

/**
 * Rebuild a TextStyle from untrusted storage. Keys are taken from
 * DEFAULT_STYLE, so fields added to the style later survive a round trip
 * without touching this file — but they only get a typeof check. Anything with
 * a narrower domain (enums, ranges) needs an explicit rule in the second pass.
 */
function sanitizeStyle(raw: unknown): TextStyle {
  const style: TextStyle = { ...DEFAULT_STYLE }
  if (!raw || typeof raw !== "object") return style

  const src = raw as Record<string, unknown>
  const out = style as unknown as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_STYLE)) {
    const value = src[key]
    if (value === undefined) continue
    if (typeof value !== typeof out[key]) continue
    out[key] = value
  }

  style.size = Number.isFinite(style.size)
    ? clampSize(style.size)
    : DEFAULT_STYLE.size
  style.curve = Number.isFinite(style.curve)
    ? clampCurve(style.curve)
    : DEFAULT_STYLE.curve
  if (!Object.keys(LINE_PRESETS).includes(style.linePreset)) {
    style.linePreset = DEFAULT_STYLE.linePreset
  }
  if (!BG_MODES.includes(style.bgMode)) style.bgMode = DEFAULT_STYLE.bgMode
  if (!ALIGNS.includes(style.align)) style.align = DEFAULT_STYLE.align
  if (!EMOJI_FAMILIES.includes(style.emojiFamily)) {
    style.emojiFamily = DEFAULT_STYLE.emojiFamily
  }
  if (!COLOR_RE.test(style.color)) style.color = DEFAULT_STYLE.color
  // Custom fonts register asynchronously from OPFS, so any non-empty id is
  // kept here and checked against the registry by the caller.
  if (!style.family) style.family = DEFAULT_STYLE.family
  return style
}

export function loadPrefs(): Prefs | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const obj = parsed as Record<string, unknown>
    if (obj.v !== 1) return null
    const shareMode = obj.shareMode
    return {
      v: 1,
      style: sanitizeStyle(obj.style),
      shareMode:
        shareMode === "quick" || shareMode === "custom" ? shareMode : undefined,
    }
  } catch {
    return null
  }
}

export function saveStylePref(style: TextStyle): void {
  if (typeof window === "undefined") return
  const prefs: Prefs = { v: 1, style, shareMode: loadPrefs()?.shareMode }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {}
}

/**
 * Remembers (or forgets, with `null`) the share-landing choice. The stored
 * style is carried over untouched — the share landing never edits the style,
 * so it must not clobber what the editor last saved.
 */
export function saveShareModePref(mode: SharePrefMode | null): void {
  if (typeof window === "undefined") return
  const prefs: Prefs = {
    v: 1,
    style: loadPrefs()?.style ?? DEFAULT_STYLE,
    shareMode: mode ?? undefined,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {}
}
