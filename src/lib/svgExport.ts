import {
  alignStartX,
  cssFontShorthand,
  emojiBaselineOffset,
  measureText,
  resolveColors,
  styledRunLayout,
} from "./canvas"
import {
  fontCssFamily,
  fontFileUrl,
  getFamily,
  resolveVariant,
} from "./fonts"
import { emojiCssFamily, emojiFontMetrics } from "./emojiFonts"
import type { TextStyle } from "./types"

const fontDataUrlCache = new Map<string, Promise<string>>()

async function fetchFontAsDataUrl(
  url: string,
  format: "opentype" | "truetype",
): Promise<string> {
  const cached = fontDataUrlCache.get(url)
  if (cached) return cached
  const promise = (async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch font: ${url}`)
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ""
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
      )
    }
    const b64 = btoa(bin)
    const mime = format === "opentype" ? "font/otf" : "font/ttf"
    return `data:${mime};base64,${b64}`
  })()
  fontDataUrlCache.set(url, promise)
  return promise
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Trims float noise out of coordinate attributes. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/**
 * `padding` is caller-supplied so the SVG can match whatever raster render it
 * accompanies — pass `canvasPadding(style, basePadding)` (never a hardcoded
 * number) or a bg-on export will not have the same edge gap as the PNG.
 */
export async function buildPureSvg(
  text: string,
  style: TextStyle,
  padding: number,
): Promise<string> {
  const measureCanvas = document.createElement("canvas")
  const mctx = measureCanvas.getContext("2d")
  if (!mctx) throw new Error("Canvas measure context unavailable")
  mctx.font = cssFontShorthand(style)
  const metrics = measureText(mctx, text, style)
  const w = Math.max(Math.ceil(metrics.inkWidth + padding * 2), 64)
  const h = Math.max(Math.ceil(metrics.height + padding * 2), 64)

  const family = getFamily(style.family)
  const key = resolveVariant(family, style.bold, style.italic)
  const cssName = fontCssFamily(style.family, key)
  const url = fontFileUrl(family, key)
  const dataUrl = await fetchFontAsDataUrl(url, family.format)
  const { fg, bg } = resolveColors(style)

  const anchorX =
    style.align === "left"
      ? padding
      : style.align === "right"
        ? w - padding
        : w / 2
  const textAnchor =
    style.align === "left"
      ? "start"
      : style.align === "right"
        ? "end"
        : "middle"

  const lineHeight = metrics.lineHeightPx
  const startY = padding + lineHeight / 2

  // Emoji fonts are 1.5–66 MB, so unlike the main font they are never inlined
  // here. We still name the family first in font-family so a viewer that has it
  // installed (or renders inside this app) picks it up; everywhere else the
  // emoji simply fall back to the viewer's system emoji font.
  const emojiFamilyList =
    style.emojiFamily === "system"
      ? null
      : `'${emojiCssFamily(style.emojiFamily)}', '${cssName}'`

  // Same metric correction the canvas renderer applies to emoji runs (see
  // EmojiFontMetrics). Emitted as attributes only when the font actually needs
  // one, so every other font's markup is unchanged.
  const emojiMetrics = emojiFontMetrics(style.emojiFamily)
  const emojiAttrs = emojiMetrics
    ? ` font-size="${num(style.size * emojiMetrics.sizeAdjust)}" dy="${num(emojiBaselineOffset(style))}"`
    : ""

  const tspans = metrics.lines
    .map((line, i) => {
      const y = startY + i * lineHeight
      const layout = emojiFamilyList ? styledRunLayout(mctx, line, style) : null
      if (!layout) {
        return `<tspan x="${anchorX}" y="${y}">${escapeXml(line)}</tspan>`
      }
      // Mixed-font line: text-anchor can't span runs, so each run gets an
      // absolute x from the same layout the canvas renderer uses.
      const startX = alignStartX(style, anchorX, layout.total)
      return layout.runs
        .map((run, r) => {
          const x = num(startX + layout.offsets[r])
          // Every tspan carries an absolute x/y, so the emoji run's dy can't
          // leak into the next one.
          const family = run.emoji
            ? ` font-family="${emojiFamilyList}"${emojiAttrs}`
            : ""
          return `<tspan x="${x}" y="${y}" text-anchor="start"${family}>${escapeXml(run.text)}</tspan>`
        })
        .join("")
    })
    .join("")

  const bgRect = bg
    ? `<rect width="${w}" height="${h}" fill="${bg}"/>`
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <style>
      @font-face {
        font-family: "${cssName}";
        src: url("${dataUrl}") format("${family.format}");
      }
    </style>
  </defs>
  ${bgRect}
  <text font-family="${cssName}" font-size="${style.size}" fill="${fg}" dominant-baseline="middle" text-anchor="${textAnchor}">${tspans}</text>
</svg>`
}

export async function buildPureSvgBlob(
  text: string,
  style: TextStyle,
  padding: number,
): Promise<Blob> {
  const svg = await buildPureSvg(text, style, padding)
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
}
