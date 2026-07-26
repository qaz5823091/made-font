import type { EmojiFamilyId } from "./types"

/** The downloadable emoji fonts — everything except the "system" sentinel. */
export type EmojiFontId = Exclude<EmojiFamilyId, "system">

/**
 * Correction applied to an emoji run so its glyphs match the size and vertical
 * position of the neighbouring text. Absent from a font entry = that font needs
 * none, and every renderer stays on its untouched code path.
 */
export type EmojiFontMetrics = {
  /** Multiplier on the run's font size. 1 = unchanged. */
  sizeAdjust: number
  /**
   * Baseline nudge as a fraction of the *base* (unscaled) font size.
   * Positive draws the run lower.
   */
  baselineShift: number
}

export type EmojiFont = {
  id: EmojiFontId
  label: string
  /** Filename under public/fonts/emoji/. */
  file: string
  /** Rough download weight in MB — surfaced so users can judge the cost. */
  approxMB: number
  /** Small raster sample used by the (later phase) picker UI. */
  previewSrc: string
  /** Optional metric correction — see EmojiFontMetrics. */
  metrics?: EmojiFontMetrics
}

const fontUrl = (file: string) => `${import.meta.env.BASE_URL}fonts/emoji/${file}`
const previewUrl = (id: EmojiFontId) =>
  `${import.meta.env.BASE_URL}emoji/previews/${id}.png`

export const EMOJI_FONTS: EmojiFont[] = [
  {
    id: "apple",
    label: "Apple",
    file: "AppleColorEmoji.ttf",
    approxMB: 66,
    previewSrc: previewUrl("apple"),
    // Emoji runs name the emoji font FIRST in ctx.font, so its metrics decide
    // where textBaseline "middle" lands. AppleColorEmoji declares 0.73em/0.21em
    // ascent/descent where Twemoji declares 0.88/0.13, which parks its ink
    // ~0.16em above the line and renders it a few percent short.
    //
    // Ink boxes scanned out of a Chrome canvas at 100px, textBaseline "middle",
    // as (height / centre offset from the draw point):
    //   apple 97 / -16.0   twemoji 101 / 0.0   noto 104 / -6.5
    //   the CJK text it sits beside: 93 / -1.0
    // 1.04x and +0.14em land it at 107 / -1.0 at the 112px default: the same
    // height band as Twemoji and Noto, and level with the text.
    //
    // FontFace descriptors cannot do this. Chrome does honour sizeAdjust on
    // canvas, but ascentOverride/descentOverride only change what
    // measureText().fontBoundingBox* reports -- the painted glyph does not
    // move (an extreme 50%/50% override left the ink centre at -16.0).
    metrics: { sizeAdjust: 1.04, baselineShift: 0.14 },
  },
  {
    id: "twemoji",
    label: "Twemoji",
    file: "TwemojiMozilla.ttf",
    approxMB: 1.5,
    previewSrc: previewUrl("twemoji"),
  },
  {
    id: "noto",
    label: "Noto Emoji",
    file: "NotoColorEmoji.ttf",
    approxMB: 11,
    previewSrc: previewUrl("noto"),
  },
]

export function getEmojiFont(id: EmojiFontId): EmojiFont {
  const f = EMOJI_FONTS.find((x) => x.id === id)
  if (!f) throw new Error(`Unknown emoji font: ${id}`)
  return f
}

/** CSS family name registered with document.fonts for this emoji font. */
export function emojiCssFamily(id: EmojiFontId): string {
  return `emoji-${id}`
}

/**
 * Metric correction for an emoji family, or null when it needs none ("system"
 * and any font without a `metrics` entry). Renderers use null to stay on the
 * exact pre-correction code path.
 */
export function emojiFontMetrics(id: EmojiFamilyId): EmojiFontMetrics | null {
  if (id === "system") return null
  return getEmojiFont(id).metrics ?? null
}

const loadingPromises = new Map<string, Promise<void>>()
const loadedIds = new Set<string>()

export function isEmojiFontLoaded(id: EmojiFontId): boolean {
  return loadedIds.has(id)
}

/**
 * Lazily registers the emoji webfont. Mirrors ensureFontLoaded in fonts.ts:
 * a loaded-set short-circuit plus an in-flight promise map so concurrent
 * callers (preview + export + auto-fit probe) share one download.
 *
 * No format() hint on purpose — these are sbix / CBDT / COLR flavored TTFs and
 * some browsers reject the strict `format("truetype")` claim for them.
 */
export async function ensureEmojiFontLoaded(id: EmojiFontId): Promise<void> {
  if (loadedIds.has(id)) return
  const existing = loadingPromises.get(id)
  if (existing) {
    await existing
    return
  }

  const promise = (async () => {
    const font = getEmojiFont(id)
    const ff = new FontFace(emojiCssFamily(id), `url(${fontUrl(font.file)})`, {
      style: "normal",
      weight: "400",
      display: "swap",
    })
    const loaded = await ff.load()
    document.fonts.add(loaded)
    loadedIds.add(id)
  })()

  loadingPromises.set(id, promise)
  try {
    await promise
  } finally {
    loadingPromises.delete(id)
  }
}

// --- grapheme segmentation ---------------------------------------------------

// Intl.Segmenter is ES2022; the project targets ES2020 so the lib types don't
// declare it. Describe just the slice we use rather than widening the tsconfig.
type GraphemeSegmenter = { segment: (input: string) => Iterable<{ segment: string }> }
type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity: "grapheme" | "word" | "sentence" },
) => GraphemeSegmenter

let segmenter: GraphemeSegmenter | null | undefined

function getSegmenter(): GraphemeSegmenter | null {
  if (segmenter !== undefined) return segmenter
  const ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
  segmenter = ctor ? new ctor(undefined, { granularity: "grapheme" }) : null
  return segmenter
}

/**
 * Splits text into user-perceived characters. Code-point iteration would tear
 * apart ZWJ sequences, flags, keycaps, skin-tone modifiers — and bopomofo IVS
 * sequences, which is a rendering bug independent of emoji.
 */
export function segmentGraphemes(text: string): string[] {
  const seg = getSegmenter()
  if (!seg) return Array.from(text)
  const out: string[] = []
  for (const part of seg.segment(text)) out.push(part.segment)
  return out
}

// --- emoji classification ----------------------------------------------------

const VS16 = "️"
const KEYCAP = "⃣"
const RI_LOW = 0x1f1e6
const RI_HIGH = 0x1f1ff
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u

// undefined = not probed yet, null = the "v" flag isn't supported here.
let rgiRegex: RegExp | null | undefined

function getRgiRegex(): RegExp | null {
  if (rgiRegex !== undefined) return rgiRegex
  try {
    // Built from a string so the ES2020 target doesn't reject the literal, and
    // guarded because the "v" (unicodeSets) flag is a 2023 addition.
    rgiRegex = new RegExp("^\\p{RGI_Emoji}$", "v")
  } catch {
    rgiRegex = null
  }
  return rgiRegex
}

/**
 * Heuristic used only when \p{RGI_Emoji} is unavailable. Deliberately
 * conservative: text-presentation characters that merely live in the Emoji
 * block (digits, "#", "*", ©, ®, ™) must NOT match, or we would swap fonts for
 * ordinary punctuation.
 */
function isEmojiFallback(g: string): boolean {
  if (g.length === 0) return false
  // VS16 is an explicit request for emoji presentation (❤️, ©️, 1️⃣).
  if (g.includes(VS16)) return true
  if (g.includes(KEYCAP)) return true
  const cps = Array.from(g)
  if (EMOJI_PRESENTATION.test(cps[0])) return true
  if (cps.length >= 2) {
    const a = cps[0].codePointAt(0) ?? 0
    const b = cps[1].codePointAt(0) ?? 0
    if (a >= RI_LOW && a <= RI_HIGH && b >= RI_LOW && b <= RI_HIGH) return true
  }
  return false
}

/** True when this grapheme cluster should be painted with the emoji font. */
export function isEmojiGrapheme(g: string): boolean {
  if (g.length === 0) return false
  const re = getRgiRegex()
  if (re) return re.test(g)
  return isEmojiFallback(g)
}

/** Early-exit scan — cheaper than building a run list just to test presence. */
export function textHasEmoji(text: string): boolean {
  if (text.length === 0) return false
  for (const g of segmentGraphemes(text)) {
    if (isEmojiGrapheme(g)) return true
  }
  return false
}

export type TextRun = { text: string; emoji: boolean }

/** Groups consecutive graphemes into alternating emoji / non-emoji runs. */
export function splitEmojiRuns(line: string): TextRun[] {
  const runs: TextRun[] = []
  for (const g of segmentGraphemes(line)) {
    const emoji = isEmojiGrapheme(g)
    const last = runs[runs.length - 1]
    if (last && last.emoji === emoji) last.text += g
    else runs.push({ text: g, emoji })
  }
  return runs
}
