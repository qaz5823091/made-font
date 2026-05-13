import type { TextLayer, TextStyle } from "./types"
import { fontCssFamily } from "./fonts"

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
  const lineHeightPx = style.size * style.lineHeight
  const height = lines.length * lineHeightPx
  return { lines, width: maxWidth, height, lineHeightPx }
}

export function cssFontShorthand(style: TextStyle): string {
  return `${style.size}px "${fontCssFamily(style.family, style.weight)}"`
}

export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  dpr: number,
): void {
  const { style, text, x, y, rotation } = layer
  const metrics = measureText(ctx, text, style)

  ctx.save()
  ctx.translate(x * dpr, y * dpr)
  if (rotation) ctx.rotate((rotation * Math.PI) / 180)
  ctx.scale(dpr, dpr)

  ctx.font = cssFontShorthand(style)
  ctx.fillStyle = style.color
  ctx.textBaseline = "middle"
  ctx.textAlign = style.align

  const totalHeight = metrics.height
  let cursorY = -totalHeight / 2 + metrics.lineHeightPx / 2

  for (const line of metrics.lines) {
    ctx.fillText(line, 0, cursorY)
    cursorY += metrics.lineHeightPx
  }

  ctx.restore()
}

export function layerBoundingBox(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
): { x: number; y: number; w: number; h: number } {
  const m = measureText(ctx, layer.text, layer.style)
  const w = Math.max(m.width, 12)
  const h = Math.max(m.height, layer.style.size)
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
