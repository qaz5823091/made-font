import type { TextLayer, TextStyle } from "./types"
import { styleLineHeight, stylePx } from "./types"
import { fontCssFamily, getFamily, resolveVariant } from "./fonts"
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

export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
): LineMetrics {
  ctx.font = cssFontShorthand(style)
  const prevAlign = ctx.textAlign
  ctx.textAlign = "start"
  const lines = text.length === 0 ? [""] : text.split("\n")
  let maxWidth = 0
  let maxInk = 0
  for (const line of lines) {
    const m = ctx.measureText(line)
    if (m.width > maxWidth) maxWidth = m.width
    // Italics, wide left-bearings (e.g. Dela Gothic) and decorative fonts can
    // paint glyphs outside the advance box. actualBoundingBox{Left,Right} are
    // measured from the alignment point (start = origin), so their sum is the
    // total ink extent regardless of advance.
    const ink =
      (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? m.width)
    if (ink > maxInk) maxInk = ink
  }
  ctx.textAlign = prevAlign
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
 * Canvas-edge padding around the text. When a background color is on, we add
 * breathing room proportional to font size so wide-bearing fonts don't sit
 * flush against the bg edges in the exported image.
 */
export function canvasPadding(style: TextStyle, basePadding: number): number {
  if (style.bgMode === "transparent") return basePadding
  const sized = Math.round(stylePx(style) * 0.55)
  return Math.max(basePadding, sized)
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
    for (const ch of seg) {
      const candidate = current + ch
      if (ctx.measureText(candidate).width <= maxWidth || current === "") {
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
    const m = ctx.measureText(line)
    if (m.width > widest) widest = m.width
    const ink =
      (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? m.width)
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
  measureCtx.font = cssFontShorthand(style)
  const prevAlign = measureCtx.textAlign
  const prevBaseline = measureCtx.textBaseline
  measureCtx.textAlign = "center"
  measureCtx.textBaseline = "middle"

  // Treat the whole string as one ring; newlines become spaces.
  const flat = text.replace(/\n+/g, " ")
  const chars = [...flat]
  const safeChars = chars.length > 0 ? chars : [" "]
  const widths = safeChars.map((c) => Math.max(measureCtx.measureText(c).width, 1))
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
  const positions: { ch: string; angle: number; width: number }[] = []
  let cursor = 0
  for (let i = 0; i < safeChars.length; i++) {
    const center = cursor + widths[i] / 2
    const angle = center / radius - arcAngle / 2
    positions.push({ ch: safeChars[i], angle, width: widths[i] })
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
    ctx.font = cssFontShorthand(style)
    ctx.textBaseline = "middle"
    ctx.textAlign = "center"
    for (const { ch, angle } of positions) {
      ctx.save()
      ctx.translate(originX + centerX, originY + centerY)
      // For frown we rotate the opposite way and walk *down* by the radius;
      // this places chars on the bottom arc with their baselines tangent to
      // the circle, while keeping the glyphs themselves right-side-up.
      ctx.rotate(sign * angle)
      ctx.translate(0, -sign * radius)
      ctx.fillText(ch, 0, 0)
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

  ctx.font = cssFontShorthand(style)
  ctx.fillStyle = fg
  ctx.textBaseline = "middle"
  ctx.textAlign = style.align

  const totalHeight = metrics.height
  let cursorY = -totalHeight / 2 + metrics.lineHeightPx / 2
  const anchorX =
    style.align === "left"
      ? -metrics.width / 2
      : style.align === "right"
        ? metrics.width / 2
        : 0

  for (const line of metrics.lines) {
    ctx.fillText(line, anchorX, cursorY)
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
