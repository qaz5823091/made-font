import type { TextLayer, TextStyle } from "./types"
import { styleLineHeight, stylePx } from "./types"
import { fontCssFamily, getFamily, resolveVariant } from "./fonts"
import { complementColor } from "./color"

export type LineMetrics = {
  lines: string[]
  width: number
  height: number
  lineHeightPx: number
}

export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
): LineMetrics {
  ctx.font = cssFontShorthand(style)
  const lines = text.length === 0 ? [""] : text.split("\n")
  let maxWidth = 0
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > maxWidth) maxWidth = w
  }
  const lineHeightPx = stylePx(style) * styleLineHeight(style)
  const height = lines.length * lineHeightPx
  return { lines, width: maxWidth, height, lineHeightPx }
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
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > widest) widest = w
  }
  const lineHeightPx = stylePx(style) * styleLineHeight(style)
  const height = lines.length * lineHeightPx
  return { lines, width: widest, height, lineHeightPx }
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
