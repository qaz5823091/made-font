import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Download, ImagePlus, Plus, Trash2, Type } from "lucide-react"
import { ensureFontLoaded } from "@/lib/fonts"
import { cssFontShorthand, drawLayer, pointInLayer } from "@/lib/canvas"
import {
  DEFAULT_STYLE,
  newLayerId,
  type TextLayer,
  type TextStyle,
} from "@/lib/types"
import {
  canvasToPngBlob,
  copyBlobToClipboard,
  downloadBlob,
  timestampedName,
} from "@/lib/export"
import { StyleControls } from "./StyleControls"

type Image = {
  el: HTMLImageElement
  width: number
  height: number
}

export function ImageEditor() {
  const [image, setImage] = useState<Image | null>(null)
  const [layers, setLayers] = useState<TextLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{
    id: string
    offsetX: number
    offsetY: number
    pointerId: number
  } | null>(null)

  // Preload fonts used by layers
  useEffect(() => {
    const seen = new Set<string>()
    for (const l of layers) {
      const key = `${l.style.family}|${l.style.weight}`
      if (seen.has(key)) continue
      seen.add(key)
      ensureFontLoaded(l.style.family, l.style.weight).then(() => draw())
    }
  }, [layers])

  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === selectedId) ?? null,
    [layers, selectedId],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const w = image?.width ?? 1080
    const h = image?.height ?? 1080
    canvas.width = w * dpr
    canvas.height = h * dpr
    // Let CSS `max-width: 100%` + intrinsic aspect ratio handle scaling on mobile.
    canvas.style.width = `${w}px`
    canvas.style.height = "auto"

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (image) {
      ctx.drawImage(image.el, 0, 0, w * dpr, h * dpr)
    } else {
      ctx.fillStyle = "#0f172a"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    for (const layer of layers) {
      drawLayer(ctx, layer, dpr)
    }

    if (selectedLayer) {
      const layer = selectedLayer
      const measureCtx = document.createElement("canvas").getContext("2d")!
      measureCtx.font = cssFontShorthand(layer.style)
      const lines = layer.text.length === 0 ? [""] : layer.text.split("\n")
      let maxW = 0
      for (const line of lines) {
        const lw = measureCtx.measureText(line).width
        if (lw > maxW) maxW = lw
      }
      const lhPx = layer.style.size * layer.style.lineHeight
      const bw = Math.max(maxW, 12)
      const bh = Math.max(lines.length * lhPx, layer.style.size)
      const pad = 12
      ctx.save()
      ctx.translate(layer.x * dpr, layer.y * dpr)
      ctx.rotate((layer.rotation * Math.PI) / 180)
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(-bw / 2 - pad, -bh / 2 - pad, bw + pad * 2, bh + pad * 2)
      ctx.restore()
    }
  }, [image, layers, selectedLayer])

  useEffect(() => {
    draw()
  }, [draw])

  const handleImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const el = new window.Image()
      el.onload = () => {
        setImage({ el, width: el.naturalWidth, height: el.naturalHeight })
        setLayers([])
        setSelectedId(null)
      }
      el.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
    e.target.value = ""
  }

  const addTextLayer = () => {
    const cx = (image?.width ?? 1080) / 2
    const cy = (image?.height ?? 1080) / 2
    const layer: TextLayer = {
      id: newLayerId(),
      text: "新文字",
      x: cx,
      y: cy,
      rotation: 0,
      style: { ...DEFAULT_STYLE, color: "#ffffff", size: image ? Math.round((image.width / 1080) * 96) : 96 },
    }
    setLayers((prev) => [...prev, layer])
    setSelectedId(layer.id)
  }

  // Convert pointer position to canvas (image) coordinates
  const pointerToCanvas = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = (image?.width ?? canvas.width) / rect.width
    const scaleY = (image?.height ?? canvas.height) / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointerToCanvas(e)
    const ctx = canvasRef.current!.getContext("2d")!
    // Hit-test top-most first
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (pointInLayer(ctx, layer, x, y)) {
        setSelectedId(layer.id)
        canvasRef.current!.setPointerCapture(e.pointerId)
        dragRef.current = {
          id: layer.id,
          offsetX: x - layer.x,
          offsetY: y - layer.y,
          pointerId: e.pointerId,
        }
        return
      }
    }
    setSelectedId(null)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const { x, y } = pointerToCanvas(e)
    const { id, offsetX, offsetY } = dragRef.current
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, x: x - offsetX, y: y - offsetY } : l)),
    )
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setLayers((prev) => prev.filter((l) => l.id !== selectedId))
    setSelectedId(null)
  }

  const updateSelectedStyle = (next: TextStyle) => {
    if (!selectedId) return
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedId ? { ...l, style: next } : l)),
    )
  }

  const updateSelectedText = (next: string) => {
    if (!selectedId) return
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedId ? { ...l, text: next } : l)),
    )
  }

  const exportBlob = useCallback(async () => {
    if (!canvasRef.current) return null
    return canvasToPngBlob(canvasRef.current)
  }, [])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const handleCopy = async () => {
    try {
      const blob = await exportBlob()
      if (!blob) return
      await copyBlobToClipboard(blob)
      flash("已複製到剪貼簿")
    } catch (err) {
      flash(err instanceof Error ? err.message : "複製失敗")
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await exportBlob()
      if (!blob) return
      downloadBlob(blob, timestampedName("made-font-image"))
      flash("已開始下載")
    } catch (err) {
      flash(err instanceof Error ? err.message : "下載失敗")
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto bg-slate-900">
        <div className="flex min-h-full items-center justify-center p-4">
          {image ? (
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="max-w-full touch-none rounded-lg shadow-xl"
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-72 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/30 bg-white/5 text-white/90 transition hover:border-white/50 hover:bg-white/10"
            >
              <ImagePlus className="h-10 w-10" />
              <span className="text-sm">點此匯入圖片</span>
              <span className="text-[11px] text-white/60">支援 PNG / JPG / WebP</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />

      <div className="border-t bg-card">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {image ? "更換圖片" : "匯入圖片"}
            </button>
            <button
              type="button"
              onClick={addTextLayer}
              disabled={!image}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              新增文字
            </button>
            {selectedLayer && (
              <button
                type="button"
                onClick={deleteSelected}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                刪除
              </button>
            )}
          </div>

          {selectedLayer ? (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    文字內容
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingText((v) => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {editingText ? "收合" : "展開編輯"}
                  </button>
                </div>
                {editingText ? (
                  <textarea
                    value={selectedLayer.text}
                    onChange={(e) => updateSelectedText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : (
                  <input
                    type="text"
                    value={selectedLayer.text}
                    onChange={(e) => updateSelectedText(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                )}
              </div>

              <details className="group rounded-lg border bg-background" open>
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1">
                    <Type className="h-3.5 w-3.5" />
                    樣式
                  </span>
                </summary>
                <div className="border-t px-3 py-3">
                  <StyleControls
                    style={selectedLayer.style}
                    onChange={updateSelectedStyle}
                  />
                </div>
              </details>
            </>
          ) : (
            <div className="rounded-lg bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
              {image
                ? "點選畫布上的文字以編輯，或按「新增文字」開始。"
                : "請先匯入一張圖片。"}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!image}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              複製圖片
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!image}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              下載 PNG
            </button>
          </div>
        </div>
        {toast && (
          <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
