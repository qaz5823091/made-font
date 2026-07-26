import type { TextLayer, TextStyle } from "./types"
import { styleLineHeight, stylePx } from "./types"
import { fontCssFamily, getFamily, resolveVariant } from "./fonts"
import {
  emojiCssFamily,
  emojiFontMetrics,
  isEmojiGrapheme,
  segmentGraphemes,
  splitEmojiRuns,
  type TextRun,
} from "./emojiFonts"
import { complementColor } from "./color"

export type LineMetrics = {
  lines: string[]
  /** Max advance width across lines (for cursor positioning). */
  width: number
  /** Max ink width across lines (advance + glyph overhang). Used for canvas sizing. */
  inkWidth: number
  height: number
  lineHeightPx: number
}

/** Advance + ink extents of one line, relative to the glyph origin. */
export type StyledLineMetrics = {
  /** Total advance width (sum over runs). */
  width: number
  /** Ink reaching left of the origin (mirrors actualBoundingBoxLeft). */
  inkLeft: number
  /** Ink reaching right of the origin (mirrors actualBoundingBoxRight). */
  inkRight: number
}

/**
 * Returns the emoji/main runs of a line, or null when the whole line can be
 * painted with a single font. Null is the signal to take the fast path, which
 * must stay byte-for-byte identical to the pre-emoji renderer — so we bail out
 * before touching the segmenter whenever the user is on the system emoji font.
 */
function styledRuns(line: string, style: TextStyle): TextRun[] | null {
  if (style.emojiFamily === "system") return null
  if (line.length === 0) return null
  const runs = splitEmojiRuns(line)
  if (!runs.some((r) => r.emoji)) return null
  return runs
}

/**
 * Measures one line, switching fonts per emoji run when needed.
 *
 * Measurement always happens with textAlign forced to "start" so the
 * actualBoundingBox* values are reported relative to the glyph origin rather
 * than the caller's alignment point; both are restored before returning.
 */
export function measureStyledLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  style: TextStyle,
): StyledLineMetrics {
  const prevAlign = ctx.textAlign
  ctx.textAlign = "start"
  const mainFont = cssFontShorthand(style)
  const runs = styledRuns(line, style)

  if (!runs) {
    ctx.font = mainFont
    const m = ctx.measureText(line)
    ctx.textAlign = prevAlign
    return {
      width: m.width,
      inkLeft: m.actualBoundingBoxLeft ?? 0,
      inkRight: m.actualBoundingBoxRight ?? m.width,
    }
  }

  // Run path: walk the advance cursor, tracking the union of every run's ink
  // box expressed in line-origin coordinates.
  const emojiFont = emojiFontShorthand(style)
  let x = 0
  let minX = Infinity
  let maxX = -Infinity
  for (const run of runs) {
    ctx.font = run.emoji ? emojiFont : mainFont
    const m = ctx.measureText(run.text)
    const left = x - (m.actualBoundingBoxLeft ?? 0)
    const right = x + (m.actualBoundingBoxRight ?? m.width)
    if (left < minX) minX = left
    if (right > maxX) maxX = right
    x += m.width
  }
  ctx.font = mainFont
  ctx.textAlign = prevAlign
  if (minX === Infinity) return { width: x, inkLeft: 0, inkRight: x }
  // inkLeft + inkRight stays the total ink extent, matching the fast path.
  return { width: x, inkLeft: -minX, inkRight: maxX }
}

/** Left-to-right placement of a line's emoji/main runs, relative to its start. */
export type StyledRunLayout = {
  runs: TextRun[]
  /** Advance offset of each run from the start of the line. */
  offsets: number[]
  /** Total advance of the line. */
  total: number
}

/**
 * Resolves the run layout of a line, or null when one font covers it. Exposed
 * so exporters that place glyphs themselves (SVG tspans) share the exact
 * geometry the canvas renderer uses.
 *
 * Leaves ctx.font on the main font; textAlign is untouched because advance
 * widths don't depend on it.
 */
export function styledRunLayout(
  ctx: CanvasRenderingContext2D,
  line: string,
  style: TextStyle,
): StyledRunLayout | null {
  const runs = styledRuns(line, style)
  if (!runs) return null
  const mainFont = cssFontShorthand(style)
  const emojiFont = emojiFontShorthand(style)
  const offsets: number[] = []
  let x = 0
  for (const run of runs) {
    ctx.font = run.emoji ? emojiFont : mainFont
    offsets.push(x)
    x += ctx.measureText(run.text).width
  }
  ctx.font = mainFont
  return { runs, offsets, total: x }
}

/** Where a line's leftmost glyph starts, given its anchor and total advance. */
export function alignStartX(
  style: TextStyle,
  anchorX: number,
  total: number,
): number {
  const shift = style.align === "center" ? 0.5 : style.align === "right" ? 1 : 0
  return anchorX - total * shift
}

/**
 * Draws one line at `anchorX` honouring style.align, switching fonts per emoji
 * run when needed. `textBaseline` is the caller's business (all call sites use
 * "middle"); font and textAlign are owned by this function.
 */
export function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  style: TextStyle,
  anchorX: number,
  y: number,
): void {
  const mainFont = cssFontShorthand(style)
  const layout = styledRunLayout(ctx, line, style)

  if (!layout) {
    ctx.font = mainFont
    ctx.textAlign = style.align
    ctx.fillText(line, anchorX, y)
    return
  }

  // ctx.textAlign can't align a sequence of differently-fonted runs, so we
  // resolve the anchor ourselves and lay the runs out left-to-right.
  const prevAlign = ctx.textAlign
  const emojiFont = emojiFontShorthand(style)
  const emojiDy = emojiBaselineOffset(style)
  const startX = alignStartX(style, anchorX, layout.total)
  ctx.textAlign = "left"
  for (let i = 0; i < layout.runs.length; i++) {
    const isEmoji = layout.runs[i].emoji
    ctx.font = isEmoji ? emojiFont : mainFont
    ctx.fillText(
      layout.runs[i].text,
      startX + layout.offsets[i],
      isEmoji ? y + emojiDy : y,
    )
  }
  ctx.font = mainFont
  ctx.textAlign = prevAlign
}

export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
): LineMetrics {
  ctx.font = cssFontShorthand(style)
  const lines = text.length === 0 ? [""] : text.split("\n")
  let maxWidth = 0
  let maxInk = 0
  for (const line of lines) {
    const m = measureStyledLine(ctx, line, style)
    if (m.width > maxWidth) maxWidth = m.width
    // Italics, wide left-bearings (e.g. Dela Gothic) and decorative fonts can
    // paint glyphs outside the advance box. actualBoundingBox{Left,Right} are
    // measured from the alignment point (start = origin), so their sum is the
    // total ink extent regardless of advance.
    const ink = m.inkLeft + m.inkRight
    if (ink > maxInk) maxInk = ink
  }
  const lineHeightPx = stylePx(style) * styleLineHeight(style)
  const height = lines.length * lineHeightPx
  return {
    lines,
    width: maxWidth,
    inkWidth: Math.max(maxWidth, maxInk),
    height,
    lineHeightPx,
  }
}

/**
 * Gap between the text and the canvas edge when a background color is on.
 * User-chosen fixed value: the padding used to scale with font size, which
 * pushed the text far away from the bg edges at large sizes. It deliberately
 * ignores basePadding — the whole point is that the bg gap stays small even
 * where the transparent-mode base padding is much larger (48 on desktop).
 */
const BG_PADDING = 16

/**
 * Canvas-edge padding around the text. Transparent stays on the caller's base
 * padding; with a background on, the visible frame is the bg itself, so the
 * text only needs a small constant gap from its edge.
 */
export function canvasPadding(style: TextStyle, basePadding: number): number {
  if (style.bgMode === "transparent") return basePadding
  return BG_PADDING
}

/**
 * Same as measureText but wraps each newline-separated segment so that no
 * line exceeds maxWidth (matches the textarea's break-word behavior so the
 * canvas and the textarea render the same line breaks).
 */
export function measureTextWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
  maxWidth: number,
): LineMetrics {
  ctx.font = cssFontShorthand(style)
  const segments = text.length === 0 ? [""] : text.split("\n")
  const lines: string[] = []
  for (const seg of segments) {
    if (seg.length === 0) {
      lines.push("")
      continue
    }
    let current = ""
    // Grapheme-wise, not code-point-wise: breaking inside a ZWJ family, a flag,
    // a keycap or a bopomofo IVS pair would render two broken halves.
    for (const ch of segmentGraphemes(seg)) {
      const candidate = current + ch
      if (
        measureStyledLine(ctx, candidate, style).width <= maxWidth ||
        current === ""
      ) {
        current = candidate
      } else {
        lines.push(current)
        current = ch
      }
    }
    if (current !== "") lines.push(current)
  }
  let widest = 0
  let widestInk = 0
  for (const line of lines) {
    const m = measureStyledLine(ctx, line, style)
    if (m.width > widest) widest = m.width
    const ink = m.inkLeft + m.inkRight
    if (ink > widestInk) widestInk = ink
  }
  const lineHeightPx = stylePx(style) * styleLineHeight(style)
  const height = lines.length * lineHeightPx
  return {
    lines,
    width: widest,
    inkWidth: Math.max(widest, widestInk),
    height,
    lineHeightPx,
  }
}

/**
 * Lays out characters along a circular arc. `curveT` is in [-1, 1]:
 *   curveT > 0 → smile arc (circle center below the text — text curves down)
 *   curveT = 0 → straight (caller should skip the curve path entirely)
 *   curveT < 0 → frown arc (circle center above the text — text curves up)
 * |curveT| controls how much of the full circle the text wraps (1 = full).
 *
 * Returns the bbox of the laid-out text plus a `draw` closure that paints
 * each glyph onto the caller's ctx, translated into the supplied canvas frame.
 *
 * Short-text edge case: when the user has only typed a few characters and
 * |curveT| is high, the natural radius `totalAdvance / arcAngle` collapses to
 * a tiny circle. We floor the radius at ~1.2 × font size so the circle stays
 * readable, and let the text occupy only the portion of the arc it earns
 * (the remainder shows as a gap) instead of forcibly repeating the string.
 */
export type CurvedLayout = {
  width: number
  height: number
  draw: (
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
  ) => void
}

export function layoutCurvedText(
  measureCtx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
  curveT: number,
): CurvedLayout {
  const mainFont = cssFontShorthand(style)
  measureCtx.font = mainFont
  const prevAlign = measureCtx.textAlign
  const prevBaseline = measureCtx.textBaseline
  measureCtx.textAlign = "center"
  measureCtx.textBaseline = "middle"

  // Treat the whole string as one ring; newlines become spaces.
  const flat = text.replace(/\n+/g, " ")
  // Grapheme clusters, not code points — otherwise a ZWJ emoji or a bopomofo
  // IVS sequence gets torn into separate glyphs spread around the arc.
  const chars = segmentGraphemes(flat)
  const safeChars = chars.length > 0 ? chars : [" "]
  // "system" keeps every glyph on the main font, so we never even classify.
  const emojiFont =
    style.emojiFamily === "system" ? null : emojiFontShorthand(style)
  const emojiDy = emojiFont ? emojiBaselineOffset(style) : 0
  const fonts = safeChars.map((c) =>
    emojiFont && isEmojiGrapheme(c) ? emojiFont : mainFont,
  )
  // Only touch ctx.font when the run actually changes; single-font text keeps
  // the original one-assignment behaviour.
  let measuringFont = mainFont
  const widths = safeChars.map((c, i) => {
    if (fonts[i] !== measuringFont) {
      measureCtx.font = fonts[i]
      measuringFont = fonts[i]
    }
    return Math.max(measureCtx.measureText(c).width, 1)
  })
  const totalAdvance = widths.reduce((a, b) => a + b, 0)

  // Split sign + magnitude so the geometry stays one branch and we flip at
  // draw time. sign=+1 → smile (center below), sign=-1 → frown (center above).
  const sign: 1 | -1 = curveT >= 0 ? 1 : -1
  const t = Math.max(0.0001, Math.min(1, Math.abs(curveT)))
  const fontPx = stylePx(style)
  const charH = fontPx * styleLineHeight(style)

  // Map the slider to arc-length on a minimum-sized circle. This is the edge
  // case: if `totalAdvance / arcAngle` would shrink the circle below readable
  // size, freeze the radius and just use less of the arc.
  const minRadius = Math.max(fontPx * 1.2, charH * 0.9)
  const rawAngle = 2 * Math.PI * t
  let radius = totalAdvance / rawAngle
  let arcAngle = rawAngle
  if (radius < minRadius) {
    radius = minRadius
    arcAngle = totalAdvance / radius
  }

  // Per-char angular positions, centered so the arc midpoint sits at the
  // smile/frown apex.
  const positions: {
    ch: string
    angle: number
    width: number
    font: string
  }[] = []
  let cursor = 0
  for (let i = 0; i < safeChars.length; i++) {
    const center = cursor + widths[i] / 2
    const angle = center / radius - arcAngle / 2
    positions.push({ ch: safeChars[i], angle, width: widths[i], font: fonts[i] })
    cursor += widths[i]
  }

  // Bbox of the arc: sample endpoints + apex, expand for char body. For frown
  // we mirror y so the apex is at the bottom of the bbox instead of the top.
  const half = arcAngle / 2
  const inkPoints: { x: number; y: number }[] = []
  for (const a of [-half, 0, half]) {
    inkPoints.push({ x: radius * Math.sin(a), y: -sign * radius * Math.cos(a) })
  }
  for (const a of [-Math.PI, -Math.PI / 2, Math.PI / 2, Math.PI]) {
    if (a >= -half && a <= half) {
      inkPoints.push({ x: radius * Math.sin(a), y: -sign * radius * Math.cos(a) })
    }
  }
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  const halfBody = Math.max(charH, ...widths) / 2
  for (const p of inkPoints) {
    if (p.x - halfBody < xMin) xMin = p.x - halfBody
    if (p.x + halfBody > xMax) xMax = p.x + halfBody
    if (p.y - halfBody < yMin) yMin = p.y - halfBody
    if (p.y + halfBody > yMax) yMax = p.y + halfBody
  }

  const width = Math.ceil(xMax - xMin)
  const height = Math.ceil(yMax - yMin)
  const centerX = -xMin
  const centerY = -yMin

  measureCtx.textAlign = prevAlign
  measureCtx.textBaseline = prevBaseline

  const draw = (
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
  ) => {
    ctx.font = mainFont
    ctx.textBaseline = "middle"
    ctx.textAlign = "center"
    let drawingFont = mainFont
    for (const { ch, angle, font } of positions) {
      if (font !== drawingFont) {
        ctx.font = font
        drawingFont = font
      }
      ctx.save()
      ctx.translate(originX + centerX, originY + centerY)
      // For frown we rotate the opposite way and walk *down* by the radius;
      // this places chars on the bottom arc with their baselines tangent to
      // the circle, while keeping the glyphs themselves right-side-up.
      ctx.rotate(sign * angle)
      ctx.translate(0, -sign * radius)
      // The frame is rotated with the glyph, so +y is "lower relative to this
      // character" on both the smile and the frown arc.
      ctx.fillText(ch, 0, font === emojiFont ? emojiDy : 0)
      ctx.restore()
    }
  }

  return { width, height, draw }
}

export function cssFontShorthand(style: TextStyle): string {
  const family = getFamily(style.family)
  const key = resolveVariant(family, style.bold, style.italic)
  return `${stylePx(style)}px "${fontCssFamily(style.family, key)}"`
}

/**
 * Font shorthand for emoji runs: the chosen emoji family FIRST so it wins over
 * any monochrome emoji glyphs the main font happens to ship, with the main font
 * kept as fallback for anything the emoji font can't cover.
 *
 * With emojiFamily === "system" there is no emoji font, so this degrades to the
 * main shorthand — callers on the fast path never reach here anyway.
 */
export function emojiFontShorthand(style: TextStyle): string {
  if (style.emojiFamily === "system") return cssFontShorthand(style)
  const family = getFamily(style.family)
  const key = resolveVariant(family, style.bold, style.italic)
  const main = fontCssFamily(style.family, key)
  // sizeAdjust compensates fonts whose glyphs are drawn smaller than the rest
  // at the same px. Fonts without a correction multiply by exactly 1, so the
  // shorthand string is unchanged for them.
  const px = stylePx(style) * (emojiFontMetrics(style.emojiFamily)?.sizeAdjust ?? 1)
  return `${px}px "${emojiCssFamily(style.emojiFamily)}", "${main}"`
}

/**
 * Vertical nudge (in px) for emoji runs, counteracting emoji fonts whose own
 * ascent/descent place textBaseline "middle" off the text's centre line.
 * 0 for "system" and for any font without a metric correction.
 */
export function emojiBaselineOffset(style: TextStyle): number {
  const m = emojiFontMetrics(style.emojiFamily)
  return m ? m.baselineShift * stylePx(style) : 0
}

export function resolveColors(style: TextStyle): { fg: string; bg: string | null } {
  switch (style.bgMode) {
    case "transparent":
      return { fg: style.color, bg: null }
    case "complement-bg":
      return { fg: style.color, bg: complementColor(style.color) }
    case "complement-text":
      return { fg: complementColor(style.color), bg: style.color }
  }
}

/**
 * Draws a single text layer in image-mode coordinates (origin top-left of canvas).
 * Background (if any) is drawn as a padded rectangle behind the text bounding box.
 */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  dpr: number,
): void {
  const { style, text, x, y, rotation } = layer
  const metrics = measureText(ctx, text, style)
  const { fg, bg } = resolveColors(style)

  ctx.save()
  ctx.translate(x * dpr, y * dpr)
  if (rotation) ctx.rotate((rotation * Math.PI) / 180)
  ctx.scale(dpr, dpr)

  if (bg) {
    const pad = stylePx(style) * 0.2
    const bw = Math.max(metrics.width, 12) + pad * 2
    const bh = Math.max(metrics.height, stylePx(style)) + pad * 2
    const radius = pad * 0.6
    ctx.fillStyle = bg
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, radius)
    ctx.fill()
  }

  // font + textAlign are owned by drawStyledLine (they vary per emoji run).
  ctx.fillStyle = fg
  ctx.textBaseline = "middle"

  const totalHeight = metrics.height
  let cursorY = -totalHeight / 2 + metrics.lineHeightPx / 2
  const anchorX =
    style.align === "left"
      ? -metrics.width / 2
      : style.align === "right"
        ? metrics.width / 2
        : 0

  for (const line of metrics.lines) {
    drawStyledLine(ctx, line, style, anchorX, cursorY)
    cursorY += metrics.lineHeightPx
  }

  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export function layerBoundingBox(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
): { x: number; y: number; w: number; h: number } {
  const m = measureText(ctx, layer.text, layer.style)
  const pad = layer.style.bgMode === "transparent" ? 0 : stylePx(layer.style) * 0.2
  const w = Math.max(m.width, 12) + pad * 2
  const h = Math.max(m.height, stylePx(layer.style)) + pad * 2
  return { x: layer.x - w / 2, y: layer.y - h / 2, w, h }
}

export function pointInLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  px: number,
  py: number,
): boolean {
  const b = layerBoundingBox(ctx, layer)
  const pad = 8
  return (
    px >= b.x - pad &&
    px <= b.x + b.w + pad &&
    py >= b.y - pad &&
    py <= b.y + b.h + pad
  )
}
