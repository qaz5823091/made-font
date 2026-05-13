import {
  cssFontShorthand,
  measureText,
  resolveColors,
} from "./canvas"
import {
  fontCssFamily,
  fontFileUrl,
  getFamily,
  resolveVariant,
} from "./fonts"
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
  const w = Math.max(Math.ceil(metrics.width + padding * 2), 64)
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

  const tspans = metrics.lines
    .map(
      (line, i) =>
        `<tspan x="${anchorX}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`,
    )
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
