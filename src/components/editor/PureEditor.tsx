import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Download, Film, Loader2 } from "lucide-react"
import { ensureFontLoaded } from "@/lib/fonts"
import { ensureEmojiFontLoaded, textHasEmoji } from "@/lib/emojiFonts"
import { renderTextToCanvas } from "@/lib/renderText"
import { checkerBackgroundStyle } from "@/lib/color"
import {
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
import { useFlashToast } from "@/lib/useFlashToast"
import { buildExportConfig, track } from "@/lib/analytics"
import { StyleControls } from "./StyleControls"

type Props = {
  text: string
  setText: (v: string) => void
  style: TextStyle
  setStyle: (v: TextStyle | ((s: TextStyle) => TextStyle)) => void
  onOpenAnimation?: () => void
}

export function PureEditor({ text, setText, style, setStyle, onOpenAnimation }: Props) {
  const { t } = useI18n()
  const { toast, flash } = useFlashToast()
  const [fontReady, setFontReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeAtPinchStart = useRef<number>(style.size)

  // Only pay for the emoji webfont download when the text actually has emoji.
  const hasEmoji = useMemo(() => textHasEmoji(text), [text])

  useEffect(() => {
    let cancelled = false
    setFontReady(false)
    const jobs: Promise<unknown>[] = [
      ensureFontLoaded(style.family, style.bold, style.italic),
    ]
    if (style.emojiFamily !== "system" && hasEmoji) {
      jobs.push(ensureEmojiFontLoaded(style.emojiFamily))
    }
    // A failed download must never brick the editor — we still mark ready and
    // let the browser fall back to whatever it can render.
    Promise.all(jobs)
      .then(() => {
        if (!cancelled) setFontReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [style.family, style.bold, style.italic, style.emojiFamily, hasEmoji])

  const pinch = usePinchGesture<HTMLCanvasElement>({
    onPinchStart: () => {
      sizeAtPinchStart.current = style.size
      track.pinchResize()
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
    renderTextToCanvas(canvas, text, style)
  }, [style, text])

  useEffect(() => {
    if (!fontReady) return
    draw()
  }, [draw, fontReady])

  const exportBlob = useCallback(async () => {
    if (!canvasRef.current) return null
    return canvasToPngBlob(canvasRef.current)
  }, [])

  const handleCopy = () => {
    // Build the blob promise synchronously so Safari keeps the user-gesture
    // context required for clipboard writes.
    const blobPromise = (async () => {
      const blob = await exportBlob()
      if (!blob) throw new Error(t("error.exportFailed"))
      return blob
    })()
    copyBlobToClipboard(blobPromise)
      .then(() => {
        flash(t("toast.copied"))
        track.copyImage(buildExportConfig("desktop", style))
      })
      .catch((err) =>
        flash(err instanceof Error ? err.message : t("toast.copyFailed")),
      )
  }

  const handleDownload = async () => {
    try {
      const blob = await exportBlob()
      if (!blob) return
      downloadBlob(blob, timestampedName())
      flash(t("toast.downloading"))
      track.downloadImage(buildExportConfig("desktop", style))
    } catch (err) {
      flash(err instanceof Error ? err.message : t("toast.downloadFailed"))
    }
  }

  const charCount = useMemo(() => [...text].length, [text])

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 min-h-0">
        <div
          className="absolute inset-0 overflow-auto"
          style={checkerBackgroundStyle(style.color)}
        >
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
        <div className="pointer-events-none absolute bottom-2 right-3 select-none text-[11px] font-medium text-muted-foreground/70">
          @cppdesigns
        </div>
      </div>

      <div className="border-t bg-card">
        <div className="space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("panel.text.label")}
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

          <StyleControls style={style} onChange={setStyle} onToast={flash} />

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
          {onOpenAnimation && (
            <button
              type="button"
              onClick={onOpenAnimation}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm font-medium text-foreground active:scale-[0.98]"
            >
              <Film className="h-4 w-4" />
              {t("action.animate")}
            </button>
          )}
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
