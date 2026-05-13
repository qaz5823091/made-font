export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("匯出 PNG 失敗"))
    }, "image/png")
  })
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!("clipboard" in navigator) || typeof ClipboardItem === "undefined") {
    throw new Error("此瀏覽器不支援直接複製圖片到剪貼簿")
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function timestampedName(prefix = "made-font"): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`
}
