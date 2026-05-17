import { GIFEncoder, applyPalette, quantize } from "gifenc"

export type GifExportProgress = {
  frame: number
  total: number
}

export type GifFrameRenderer = (
  ctx: CanvasRenderingContext2D,
  t: number,
) => void

/**
 * Renders an animation into a GIF. `renderFrame(ctx, t)` is invoked once per
 * frame with `t` in [0, 1) — same convention as the live preview, so the same
 * draw function powers both.
 *
 * gifenc's quantizer is fast enough to run in the main thread for small
 * frames, but we still yield to the event loop between frames so the UI
 * stays responsive and the progress callback can paint.
 *
 * `transparent`: when true, fully-transparent canvas pixels (alpha 0) map to
 * GIF's transparent color so the output composes correctly over any
 * background. Anti-aliased edges with partial alpha snap to fully opaque
 * thanks to `oneBitAlpha: 1` — GIF can't store partial alpha at all, so
 * either we keep the edge or we lose it. We also set dispose=2 per frame so
 * each frame's transparent pixels truly clear the previous frame instead of
 * accumulating into a smear.
 */
export async function renderGif(opts: {
  width: number
  height: number
  frameCount: number
  frameDelayMs: number
  renderFrame: GifFrameRenderer
  onProgress?: (p: GifExportProgress) => void
  transparent?: boolean
}): Promise<Blob> {
  const {
    width,
    height,
    frameCount,
    frameDelayMs,
    renderFrame,
    onProgress,
    transparent = false,
  } = opts

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas 2D context unavailable")

  const gif = GIFEncoder()
  const format = transparent ? "rgba4444" : "rgb444"

  for (let i = 0; i < frameCount; i++) {
    const t = i / frameCount
    // Reset the buffer between frames so transparent regions don't pick up
    // whatever the previous frame drew there.
    ctx.clearRect(0, 0, width, height)
    renderFrame(ctx, t)
    const imageData = ctx.getImageData(0, 0, width, height)
    const palette = quantize(imageData.data, 256, {
      format,
      oneBitAlpha: transparent ? 1 : false,
    })
    const index = applyPalette(imageData.data, palette, format)
    gif.writeFrame(index, width, height, {
      palette,
      delay: frameDelayMs,
      transparent,
      transparentIndex: transparent ? 0 : undefined,
      dispose: transparent ? 2 : undefined,
    })
    onProgress?.({ frame: i + 1, total: frameCount })
    // Yield to the event loop so progress updates render and the browser
    // doesn't show a "page unresponsive" warning on slower machines.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  gif.finish()
  // The Blob constructor's lib.dom types reject Uint8Array<ArrayBufferLike>
  // even though it's a perfectly valid BlobPart at runtime. Re-wrap into a
  // fresh Uint8Array<ArrayBuffer> to satisfy the typechecker.
  const bytes = gif.bytes()
  const buffer = new Uint8Array(bytes.length)
  buffer.set(bytes)
  return new Blob([buffer], { type: "image/gif" })
}
