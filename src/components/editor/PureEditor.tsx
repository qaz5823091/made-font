import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Download, Loader2 } from "lucide-react"
import { ensureFontLoaded } from "@/lib/fonts"
import {
  cssFontShorthand,
  measureText,
  resolveColors,
} from "@/lib/canvas"
import {
  DEFAULT_STYLE,
  SIZE_MAX,
  SIZE_MIN,
  type TextStyle,
} from "@/lib/types"
import {
  canvasToPngBlob,
  copyBlobToClipboard,
  downloadBlob,
  timestampedName,
} from "@/lib/export"
import { usePinchGesture } from "@/lib/gestures"
import { useI18n } from "@/lib/i18n"
import { StyleControls } from "./StyleControls"

const PADDING = 48

export function PureEditor() {
  const { t } = useI18n()
  const [text, setText] = useState(() => t("pure.placeholderText"))
  const [style, setStyle] = useState<TextStyle>(DEFAULT_STYLE)
  const [fontReady, setFontReady] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeAtPinchStart = useRef<number>(style.size)

  useEffect(() => {
    let cancelled = false
    setFontReady(false)
    ensureFontLoaded(style.family, style.weight)
      .then(() => {
        if (!cancelled) setFontReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [style.family, style.weight])

  const pinch = usePinchGesture<HTMLCanvasElement>({
    onPinchStart: () => {
      sizeAtPinchStart.current = style.size
    },
    onPinchMove: ({ scale }) => {
      const next = Math.round(sizeAtPinchStart.current * scale)
      setStyle((s) => ({
        ...s,
        size: Math.min(SIZE_MAX, Math.max(SIZE_MIN, next)),
      }))
    },
  })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const measureCanvas = document.createElement("canvas")
    const mctx = measureCanvas.getContext("2d")
    if (!mctx) return
    mctx.font = cssFontShorthand(style)
    const metrics = measureText(mctx, text, style)
    const cssWidth = Math.max(Math.ceil(metrics.width + PADDING * 2), 64)
    const cssHeight = Math.max(Math.ceil(metrics.height + PADDING * 2), 64)
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    const { fg, bg } = resolveColors(style)

    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, cssWidth, cssHeight)
    }

    ctx.font = cssFontShorthand(style)
    ctx.fillStyle = fg
    ctx.textBaseline = "middle"
    ctx.textAlign = style.align

    const anchorX =
      style.align === "left"
        ? PADDING
        : style.align === "right"
          ? cssWidth - PADDING
          : cssWidth / 2

    let cursorY = PADDING + metrics.lineHeightPx / 2
    for (const line of metrics.lines) {
      ctx.fillText(line, anchorX, cursorY)
      cursorY += metrics.lineHeightPx
    }
  }, [style, text])

  useEffect(() => {
    if (!fontReady) return
    draw()
  }, [draw, fontReady])

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
      flash(t("toast.copied"))
    } catch (err) {
      flash(err instanceof Error ? err.message : t("toast.copyFailed"))
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await exportBlob()
      if (!blob) return
      downloadBlob(blob, timestampedName())
      flash(t("toast.downloading"))
    } catch (err) {
      flash(err instanceof Error ? err.message : t("toast.downloadFailed"))
    }
  }

  const charCount = useMemo(() => [...text].length, [text])

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 overflow-auto bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] dark:bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)]">
        <div className="flex min-h-full items-center justify-center p-3">
          <div className="relative">
            {!fontReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm dark:bg-black/40">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("font.loading")}
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={pinch.onPointerDown}
              onPointerMove={pinch.onPointerMove}
              onPointerUp={pinch.onPointerUp}
              onPointerCancel={pinch.onPointerCancel}
              className="max-w-full rounded-lg shadow-sm ring-1 ring-black/5 [touch-action:pan-x_pan-y]"
            />
          </div>
        </div>
      </div>

      <div className="border-t bg-card">
        <div className="space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("panel.size.hint", { n: style.size })}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {t("panel.text.charCount", { n: charCount })}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={t("panel.text.placeholder")}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <StyleControls style={style} onChange={setStyle} />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm active:scale-[0.98]"
            >
              <Copy className="h-4 w-4" />
              {t("action.copy")}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              {t("action.download")}
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
