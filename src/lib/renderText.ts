import {
  canvasPadding,
  cssFontShorthand,
  drawStyledLine,
  layoutCurvedText,
  measureText,
  resolveColors,
} from "./canvas"
import type { TextStyle } from "./types"

const BASE_PADDING = 48

/**
 * Paints `text` in `style` onto `canvas`, resizing it (both the backing store
 * and the CSS box) to fit. This is the single source of truth for the pure-text
 * render: the editor preview and the share landing must produce identical
 * pixels, because the share landing's PNG is what the user copies.
 *
 * The caller owns the canvas element; everything else — dpr, padding, colors —
 * is decided here.
 */
export function renderTextToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  style: TextStyle,
): void {
  // Cap the device pixel ratio: 3x already exceeds what any screen resolves,
  // and a 4x+ backing store on a large font size blows past canvas area limits.
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const measureCanvas = document.createElement("canvas")
  const mctx = measureCanvas.getContext("2d")
  if (!mctx) return
  mctx.font = cssFontShorthand(style)
  const pad = canvasPadding(style, BASE_PADDING)
  const { fg, bg } = resolveColors(style)

  if (style.curve !== 0) {
    // Curve mode: lay out characters around a circle. Ignore the multi-line
    // straight layout entirely so the slider acts as a one-shot transform.
    // Negative curve flips the arc to a frown (circle center above text).
    const layout = layoutCurvedText(mctx, text || " ", style, style.curve)
    const cssWidth = Math.max(layout.width + pad * 2, 64)
    const cssHeight = Math.max(layout.height + pad * 2, 64)
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, cssWidth, cssHeight)
    }

    ctx.fillStyle = fg
    layout.draw(ctx, pad, pad)
    return
  }

  const metrics = measureText(mctx, text, style)
  const cssWidth = Math.max(Math.ceil(metrics.inkWidth + pad * 2), 64)
  const cssHeight = Math.max(Math.ceil(metrics.height + pad * 2), 64)
  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(dpr, dpr)

  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, cssWidth, cssHeight)
  }

  // font + textAlign are owned by drawStyledLine (they vary per emoji run).
  ctx.fillStyle = fg
  ctx.textBaseline = "middle"

  const anchorX =
    style.align === "left"
      ? pad
      : style.align === "right"
        ? cssWidth - pad
        : cssWidth / 2

  let cursorY = pad + metrics.lineHeightPx / 2
  for (const line of metrics.lines) {
    drawStyledLine(ctx, line, style, anchorX, cursorY)
    cursorY += metrics.lineHeightPx
  }
}
