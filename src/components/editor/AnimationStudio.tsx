import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Copy,
  Download,
  Film,
  Loader2,
  Rabbit,
  RotateCw,
  Sparkles,
  Turtle,
  Type as TypeIcon,
  Waves,
  Wind,
} from "lucide-react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { ensureFontLoaded } from "@/lib/fonts"
import {
  ANIMATION_KINDS,
  animationCanvasSize,
  drawAnimationFrame,
  durationMs,
  type AnimationKind,
} from "@/lib/animations"
import {
  copyBlobToClipboard,
  downloadBlob,
  timestampedName,
} from "@/lib/export"
import { renderGif } from "@/lib/gifExport"
import { solidBackdropColor } from "@/lib/color"
import { useI18n } from "@/lib/i18n"
import { buildGifExportConfig, track } from "@/lib/analytics"
import type { TextStyle } from "@/lib/types"

type Props = {
  text: string
  style: TextStyle
  onClose: () => void
}

const KIND_ICONS: Record<AnimationKind, React.ComponentType<{ className?: string }>> = {
  pulse: Sparkles,
  bounce: TypeIcon,
  rotate: RotateCw,
  fade: Film,
  marquee: Wind,
  wave: Waves,
}

// Swipe horizontally on the effect row needs at least this much travel before
// we treat it as a navigation gesture (vs. a stray finger drag).
const SWIPE_THRESHOLD_PX = 40

export function AnimationStudio({ text, style, onClose }: Props) {
  const { t } = useI18n()
  const [kind, setKind] = useState<AnimationKind>("pulse")
  const [speed, setSpeed] = useState(0.5)
  const [fontReady, setFontReady] = useState(false)
  // Which action (if any) is currently encoding. Tracking the action — not
  // just a boolean — lets us spin only the clicked button while the other
  // sits disabled, which reads more clearly than spinning both.
  const [exporting, setExporting] = useState<"copy" | "download" | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const swipeRef = useRef<{ x: number; y: number; pid: number } | null>(null)

  const cssSize = useMemo(() => animationCanvasSize(text, style), [text, style])

  useEffect(() => {
    let cancelled = false
    setFontReady(false)
    ensureFontLoaded(style.family, style.bold, style.italic)
      .then(() => {
        if (!cancelled) setFontReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [style.family, style.bold, style.italic])

  // Animation loop drives the preview canvas. We pause it while exporting
  // because GIF rendering also wants the offscreen canvas + main-thread time;
  // letting both run simultaneously stutters the preview anyway.
  useEffect(() => {
    if (!fontReady) return
    if (exporting) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = cssSize * dpr
    canvas.height = cssSize * dpr
    // CSS sizing is handled by the className (max-w-full + aspect-square)
    // so the canvas shrinks to fit narrow viewports without distorting.
    // We deliberately don't set canvas.style.width here — letting the CSS
    // class win is what lets the preview adapt to the device width.

    const loop = (now: number) => {
      if (!startRef.current) startRef.current = now
      const dur = durationMs(speed)
      const t = ((now - startRef.current) % dur) / dur
      ctx.save()
      ctx.scale(dpr, dpr)
      drawAnimationFrame(ctx, text, style, cssSize, cssSize, kind, t)
      ctx.restore()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startRef.current = 0
    }
  }, [fontReady, exporting, cssSize, kind, speed, style, text])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  // Renders the GIF once, then returns the blob. Sharing the encode step
  // between copy and download means the user only waits once per export and
  // both actions reuse the same encoder. When the user hasn't picked a
  // background color we ship a transparent-background GIF so it composes
  // over whatever surface it's pasted onto.
  //
  // `action` flows through to the exporting state so the UI can spotlight the
  // clicked button with a spinner while the other one stays disabled.
  const buildGif = useCallback(
    async (action: "copy" | "download"): Promise<Blob> => {
      const FRAMES = 30
      const totalDur = durationMs(speed)
      const frameDelayMs = Math.max(20, Math.round(totalDur / FRAMES))
      setExporting(action)
      try {
        return await renderGif({
          width: cssSize,
          height: cssSize,
          frameCount: FRAMES,
          frameDelayMs,
          transparent: style.bgMode === "transparent",
          renderFrame: (ctx, tt) =>
            drawAnimationFrame(ctx, text, style, cssSize, cssSize, kind, tt),
        })
      } finally {
        setExporting(null)
      }
    },
    [cssSize, kind, speed, style, text],
  )

  const handleDownload = useCallback(async () => {
    if (exporting) return
    try {
      const blob = await buildGif("download")
      downloadBlob(blob, timestampedName("made-font-anim", "gif"))
      flash(t("toast.downloading"))
      track.downloadGif(buildGifExportConfig("mobile", style, kind, speed))
    } catch (err) {
      flash(err instanceof Error ? err.message : t("toast.downloadFailed"))
    }
  }, [buildGif, exporting, kind, speed, style, t])

  // Feature-detect clipboard image/gif support once. Chromium 121+ exposes
  // ClipboardItem.supports; older browsers either silently succeed or reject
  // at write time (Safari, mostly). When the API tells us up front we can
  // skip straight to the share fallback below.
  const canCopyGif = useMemo(() => {
    if (typeof ClipboardItem === "undefined") return false
    const supports = (ClipboardItem as unknown as {
      supports?: (type: string) => boolean
    }).supports
    if (typeof supports === "function") {
      try {
        return supports("image/gif")
      } catch {
        return false
      }
    }
    // Unknown — let the user try; we'll catch the rejection at write time.
    return true
  }, [])

  // Web Share API — iOS Safari + modern Android Chrome ship this even when
  // they refuse clipboard image/gif. Probing with a real image/gif file
  // ensures we only claim support when the OS actually accepts the MIME.
  const canShareGif = useMemo(() => {
    if (typeof navigator === "undefined") return false
    if (typeof navigator.canShare !== "function") return false
    try {
      const probe = new File([new Blob([], { type: "image/gif" })], "probe.gif", {
        type: "image/gif",
      })
      return navigator.canShare({ files: [probe] })
    } catch {
      return false
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (exporting) return

    let blob: Blob
    try {
      blob = await buildGif("copy")
    } catch (err) {
      flash(err instanceof Error ? err.message : t("toast.copyFailed"))
      return
    }

    // Path 1 — Web Clipboard with image/gif. Best UX (single tap, animation
    // preserved) but limited browser support.
    if (canCopyGif) {
      try {
        await copyBlobToClipboard(blob, "image/gif")
        flash(t("toast.copied"))
        track.copyGif(buildGifExportConfig("mobile", style, kind, speed))
        return
      } catch {
        // Detect lied (Chrome on some platforms) — fall through.
      }
    }

    // Path 2 — Web Share Sheet. Two taps (the OS sheet has its own "Copy"
    // tile, plus other targets like Save / Send). Animation usually survives.
    if (canShareGif) {
      const file = new File([blob], timestampedName("made-font-anim", "gif"), {
        type: "image/gif",
      })
      try {
        await navigator.share({ files: [file] })
        track.shareGif(buildGifExportConfig("mobile", style, kind, speed))
        return
      } catch (err) {
        // User dismissed the sheet — that's not a failure, just no-op.
        if (err instanceof DOMException && err.name === "AbortError") return
        // Any other error → drop to the unsupported toast below.
      }
    }

    // Neither path is available — point the user at Download.
    flash(t("toast.copyGifUnsupported"))
  }, [
    buildGif,
    canCopyGif,
    canShareGif,
    exporting,
    kind,
    speed,
    style,
    t,
  ])

  // Centralized "user picked an effect" path. Click + swipe both funnel here
  // so they share: state update, animation reset (so the new effect starts
  // from t=0), GA tracking (with via=tap/swipe), and a toast confirming the
  // current effect name.
  const selectKind = useCallback(
    (next: AnimationKind, via: "tap" | "swipe") => {
      if (next === kind) return
      setKind(next)
      startRef.current = 0
      track.changeAnimation(next, via)
      flash(t(`anim.kind.${next}`))
    },
    [kind, t],
  )

  // Cycle the selected effect by direction (+1 advances, -1 retreats).
  const cycleKind = useCallback(
    (direction: 1 | -1) => {
      const idx = ANIMATION_KINDS.indexOf(kind)
      const next =
        (idx + direction + ANIMATION_KINDS.length) % ANIMATION_KINDS.length
      selectKind(ANIMATION_KINDS[next], "swipe")
    },
    [kind, selectKind],
  )

  const onSwipeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipeRef.current = { x: e.clientX, y: e.clientY, pid: e.pointerId }
  }
  const onSwipeEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current
    if (!s || s.pid !== e.pointerId) return
    swipeRef.current = null
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    // Only treat as horizontal swipe when X dominates Y — avoids hijacking
    // vertical scrolls inside the controls panel.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    cycleKind(dx > 0 ? 1 : -1)
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Floating back button — the only chrome on the preview. The studio
          context is established by the layout itself (effect picker + slider
          + export buttons), so a title pill would just be redundant text. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("action.back")}
        title={t("action.back")}
        className="absolute left-2 top-2 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-black/10"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Preview — capped at cssSize on wide screens, shrinks to container on
          narrow viewports (aspect-square keeps it from going lopsided). Solid
          contrast backdrop so a transparent canvas stays readable. */}
      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{ backgroundColor: solidBackdropColor(style.color) }}
      >
        <div className="flex min-h-full items-center justify-center p-4 pt-14">
          <div
            className="relative aspect-square w-full"
            style={{ maxWidth: `${cssSize}px` }}
          >
            {!fontReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm dark:bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="block h-full w-full rounded-lg shadow-sm ring-1 ring-black/5"
              style={{ background: "transparent" }}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-t bg-card">
        <div className="space-y-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Effect picker: single-row circular icons, no labels. The active
              one is enlarged + filled with primary so it visually anchors the
              center of the row. Swipe across the strip to cycle. */}
          <div
            onPointerDown={onSwipeStart}
            onPointerUp={onSwipeEnd}
            onPointerCancel={() => (swipeRef.current = null)}
            className="flex items-center justify-around gap-1 px-1 touch-pan-y"
          >
            {ANIMATION_KINDS.map((k) => {
              const Icon = KIND_ICONS[k]
              const active = kind === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => selectKind(k, "tap")}
                  aria-pressed={active}
                  aria-label={t(`anim.kind.${k}`)}
                  title={t(`anim.kind.${k}`)}
                  className={`inline-flex shrink-0 items-center justify-center rounded-full transition ${
                    active
                      ? "h-12 w-12 bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                      : "h-9 w-9 bg-background text-muted-foreground ring-1 ring-input"
                  }`}
                >
                  <Icon className={active ? "h-5 w-5" : "h-4 w-4"} />
                </button>
              )
            })}
          </div>

          {/* Speed slider — flanked by turtle/rabbit icons instead of text.
              Slow on the left, fast on the right; the slider's own position
              communicates the current value, no numeric readout needed. */}
          <div
            className="flex items-center gap-2"
            aria-label={t("anim.speed")}
          >
            <Turtle
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(speed * 100)}
              onChange={(e) => setSpeed(Number(e.target.value) / 100)}
              aria-label={t("anim.speed")}
              className="h-7 flex-1 accent-primary"
            />
            <Rabbit
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          {/* Icon-only actions. While either is encoding, both lock and the
              clicked one swaps its icon for a spinner — clearer than spinning
              both, and the user can't kick off a second encode anyway because
              gifenc is single-threaded. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!fontReady || exporting !== null}
              aria-label={t("action.copy")}
              title={t("action.copy")}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-primary-foreground shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting === "copy" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!fontReady || exporting !== null}
              aria-label={t("action.exportGif")}
              title={t("action.exportGif")}
              className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2.5 shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting === "download" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}
