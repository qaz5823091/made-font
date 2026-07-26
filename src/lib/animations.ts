import {
  canvasPadding,
  cssFontShorthand,
  drawStyledLine,
  layoutCurvedText,
  measureStyledLine,
  measureText,
  resolveColors,
} from "./canvas"
import { segmentGraphemes } from "./emojiFonts"
import { stylePx, styleLineHeight, type TextStyle } from "./types"

export const ANIMATION_KINDS = ["pulse", "marquee", "bounce", "rotate", "fade", "wave"] as const
export type AnimationKind = (typeof ANIMATION_KINDS)[number]

export type AnimationConfig = {
  kind: AnimationKind
  /** 0..1 — slows or speeds up the animation loop (0 = slow, 1 = fast). */
  speed: number
}

/** Maps speed (0..1) to loop duration in ms. */
export function durationMs(speed: number): number {
  // 0 -> 3000ms (slow), 1 -> 800ms (fast)
  return Math.round(3000 - 2200 * Math.max(0, Math.min(1, speed)))
}

/**
 * Returns a uniform scale factor to apply before drawing, chosen so the
 * worst-case extent of the chosen animation still fits inside the canvas
 * with a small safety margin. Returns 1 when the natural size already fits.
 *
 * Marquee is intentionally unrestricted: the slide-in/slide-out effect needs
 * the text to overflow the visible window.
 */
function fitScaleForAnimation(
  kind: AnimationKind,
  textW: number,
  textH: number,
  canvasSize: number,
  fontPx: number,
): number {
  let needW = textW
  let needH = textH
  switch (kind) {
    case "pulse":
      needW = textW * 1.15
      needH = textH * 1.15
      break
    case "bounce":
      needH = textH + 2 * fontPx * 0.18
      break
    case "wave":
      needH = textH + 2 * fontPx * 0.15
      break
    case "rotate": {
      // Worst case during full rotation: the diagonal of the original bbox.
      const diag = Math.hypot(textW, textH)
      needW = diag
      needH = diag
      break
    }
    case "fade":
    case "marquee":
      return 1
  }
  // 90% target leaves ~5% padding on each side after the scale.
  const target = canvasSize * 0.9
  return Math.min(1, target / Math.max(1, needW), target / Math.max(1, needH))
}

/**
 * Renders a single animation frame to the supplied ctx.
 * `t` is the normalized loop position in [0, 1).
 *
 * The canvas is expected to be pre-sized to `width` x `height`; we clear it,
 * fill the background (if the style has one), and apply the animation's
 * per-kind transform around the canvas center before drawing the text.
 */
export function drawAnimationFrame(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
  width: number,
  height: number,
  kind: AnimationKind,
  t: number,
): void {
  const { fg, bg } = resolveColors(style)
  // Background fill (or clear for transparent).
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)
  } else {
    ctx.clearRect(0, 0, width, height)
  }

  // Measure text up-front so layout-dependent animations (marquee) can use it.
  ctx.font = cssFontShorthand(style)
  const metrics = measureText(ctx, text || " ", style)
  const fontPx = stylePx(style)
  // Decide how much to shrink the text so its animation-extended bbox stays
  // inside the canvas with a small visual margin on every side. We base this
  // on the shorter canvas side so rectangular-but-square-ish canvases still
  // bound rotation correctly.
  const minSide = Math.min(width, height)
  const fitScale = fitScaleForAnimation(
    kind,
    metrics.inkWidth,
    metrics.height,
    minSide,
    fontPx,
  )

  ctx.save()
  ctx.translate(width / 2, height / 2)
  // Apply the fit-scale up front; the per-kind transforms below act in the
  // scaled coordinate space (which is what we want — pulse/rotate already
  // multiply on top).
  if (fitScale !== 1) ctx.scale(fitScale, fitScale)

  switch (kind) {
    case "pulse": {
      // Breathe between 0.85 and 1.15.
      const phase = Math.sin(t * Math.PI * 2)
      const scale = 1 + 0.15 * phase
      ctx.scale(scale, scale)
      break
    }
    case "bounce": {
      const dy = Math.sin(t * Math.PI * 2) * fontPx * 0.18
      ctx.translate(0, dy)
      break
    }
    case "rotate": {
      ctx.rotate(t * Math.PI * 2)
      break
    }
    case "fade": {
      // Fade out then in across the loop so the GIF has clear start/end frames.
      ctx.globalAlpha = 0.15 + 0.85 * (Math.sin(t * Math.PI * 2) + 1) / 2
      break
    }
    case "marquee": {
      // Slide horizontally across the canvas + text width so the text fully
      // exits one side and re-enters the other. Width here is in pre-scale
      // canvas units; since fitScale is 1 for marquee, no conversion needed.
      const reach = width / 2 + metrics.inkWidth / 2 + fontPx * 0.5
      const dx = reach - t * reach * 2
      ctx.translate(dx, 0)
      break
    }
    case "wave": {
      // Wave is per-character; handled below. The transform here is identity.
      break
    }
  }

  ctx.fillStyle = fg
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"
  // Animation frames always center the text around the canvas origin, ignoring
  // style.align. drawStyledLine derives its anchor from style.align, so hand it
  // a centered variant instead of mutating ctx.textAlign behind its back.
  const centered: TextStyle =
    style.align === "center" ? style : { ...style, align: "center" }

  if (style.curve !== 0) {
    // Reuse the curved-text layout so the slider keeps working in animation
    // mode. The layout's `draw` paints around its own origin (top-left of
    // the layout bbox), so we shift to the bbox's center.
    const layout = layoutCurvedText(ctx, text || " ", style, style.curve)
    layout.draw(ctx, -layout.width / 2, -layout.height / 2)
  } else if (kind === "wave") {
    // Per-character vertical sine. Each glyph wobbles based on its index so
    // the wave actually propagates across the text rather than translating
    // the whole block.
    const flat = (text || " ").replace(/\n+/g, " ")
    // Grapheme clusters so a ZWJ emoji wobbles as one glyph instead of coming
    // apart into its component code points.
    const chars = segmentGraphemes(flat)
    const widths = chars.map((c) =>
      Math.max(measureStyledLine(ctx, c, centered).width, 1),
    )
    const totalW = widths.reduce((a, b) => a + b, 0)
    let cursor = -totalW / 2
    const amp = fontPx * 0.15
    for (let i = 0; i < chars.length; i++) {
      const phase = t * Math.PI * 2 - (i / Math.max(1, chars.length - 1)) * Math.PI * 2
      const dy = Math.sin(phase) * amp
      drawStyledLine(ctx, chars[i], centered, cursor + widths[i] / 2, dy)
      cursor += widths[i]
    }
  } else {
    let cursorY = -metrics.height / 2 + metrics.lineHeightPx / 2
    for (const line of metrics.lines) {
      drawStyledLine(ctx, line, centered, 0, cursorY)
      cursorY += metrics.lineHeightPx
    }
  }

  ctx.restore()
}

/**
 * Picks a square canvas size that comfortably fits the text + animation
 * margins. Used by both the live preview and the GIF export.
 */
export function animationCanvasSize(text: string, style: TextStyle): number {
  const probe = document.createElement("canvas").getContext("2d")
  if (!probe) return 540
  probe.font = cssFontShorthand(style)
  const metrics = measureText(probe, text || " ", style)
  // Leave room for translate/scale animations to push the text around without
  // clipping. canvasPadding already grows with font size, so reuse it.
  const pad = canvasPadding(style, 64) * 2
  const ascent = stylePx(style) * styleLineHeight(style)
  const side = Math.max(metrics.inkWidth, metrics.height, ascent) + pad
  return Math.min(1080, Math.max(360, Math.ceil(side * 1.4)))
}
