import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Loader2, SlidersHorizontal } from "lucide-react"
import { ensureFontLoaded } from "@/lib/fonts"
import { ensureEmojiFontLoaded, textHasEmoji } from "@/lib/emojiFonts"
import { renderTextToCanvas } from "@/lib/renderText"
import { canvasToPngBlob, copyBlobToClipboard } from "@/lib/export"
import { useI18n } from "@/lib/i18n"
import { useMediaQuery } from "@/lib/useMediaQuery"
import { useFlashToast } from "@/lib/useFlashToast"
import { buildExportConfig, track } from "@/lib/analytics"
import type { TextStyle } from "@/lib/types"

type Props = {
  /** Text handed over by the OS share sheet (or the ?text= deep link). */
  text: string
  /** The user's last-used style — the whole point of "quick". */
  style: TextStyle
  /**
   * Try the clipboard write as soon as the first render lands. Set only by an
   * explicit `?mode=quick` deep link (the iOS Shortcut power path) — a plain
   * share always waits for a tap.
   */
  autoCopy: boolean
  /** Hand the text to the editor and dismiss the landing. */
  onCustom: () => void
}

/** Long enough for the "copied" toast to register before the window goes away. */
const CLOSE_DELAY_MS = 1200

/**
 * The share-target landing: a focused sheet showing what the shared text looks
 * like in the user's last style, with one tap to copy it as a PNG and one tap
 * to open the full editor instead.
 */
export function ShareLanding({ text, style, autoCopy, onCustom }: Props) {
  const { t } = useI18n()
  const { toast, flash } = useFlashToast()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [fontReady, setFontReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const autoCopyTried = useRef(false)
  const shownLogged = useRef(false)
  const closeTimer = useRef<number | null>(null)
  const closeBlocked = useRef(false)

  const hasEmoji = useMemo(() => textHasEmoji(text), [text])

  useEffect(() => {
    if (shownLogged.current) return
    shownLogged.current = true
    track.shareLanding(autoCopy ? "quick" : "ask")
  }, [autoCopy])

  useEffect(() => {
    let cancelled = false
    setFontReady(false)
    const jobs: Promise<unknown>[] = [
      ensureFontLoaded(style.family, style.bold, style.italic),
    ]
    if (style.emojiFamily !== "system" && hasEmoji) {
      jobs.push(ensureEmojiFontLoaded(style.emojiFamily))
    }
    // A failed download must never strand the user on a spinner — mark ready
    // and let the browser fall back to whatever it can render.
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

  const source = isDesktop ? "desktop" : "mobile"

  /**
   * Drops a pending auto-close and blocks any later one — a copy still in
   * flight when the user leaves must not close the window out from under the
   * editor it just opened.
   */
  const cancelClose = useCallback(() => {
    closeBlocked.current = true
    if (closeTimer.current === null) return
    window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  /**
   * Progressive enhancement: a window opened by the share target has a session
   * history length of 1, which the HTML spec lets script close — so on Android
   * this drops the user straight back into the app they shared from, right
   * after the toast. Anywhere the browser refuses (a normal tab with real
   * history, most desktop cases) the call is simply a no-op and the landing
   * stays exactly as it is. The ref keeps repeated copies from stacking timers.
   */
  const scheduleClose = useCallback(() => {
    if (closeBlocked.current || closeTimer.current !== null) return
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      try {
        window.close()
      } catch {}
    }, CLOSE_DELAY_MS)
  }, [])

  // Re-arm on mount: StrictMode runs the cleanup once before the real mount,
  // and the ref survives that, so the block must only stick for a true unmount.
  useEffect(() => {
    closeBlocked.current = false
    return cancelClose
  }, [cancelClose])

  /**
   * Copies the preview canvas. The blob promise is built synchronously so the
   * user-gesture context survives (Safari rejects clipboard writes once an
   * await has broken the gesture chain) — see PureEditor.handleCopy.
   */
  const attemptCopy = useCallback(
    (auto: boolean) => {
      const canvas = canvasRef.current
      const blobPromise = (async () => {
        if (!canvas) throw new Error(t("error.exportFailed"))
        return canvasToPngBlob(canvas)
      })()
      return copyBlobToClipboard(blobPromise).then(() => {
        track.shareQuickCopy(buildExportConfig(source, style), auto)
        // Single piece of feedback for both paths — nothing on the button or
        // the sheet changes, so a second tap looks and behaves identically.
        flash(t("share.copiedToast"))
        scheduleClose()
      })
    },
    [source, style, t, flash, scheduleClose],
  )

  useEffect(() => {
    if (!fontReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    renderTextToCanvas(canvas, text, style)

    if (!autoCopy || autoCopyTried.current) return
    autoCopyTried.current = true
    // Gestureless clipboard writes are rejected outright by some browsers (and
    // by Chrome when the document isn't focused). Stay silent when that
    // happens: the 快速複製 button is the fallback and is already on screen.
    try {
      attemptCopy(true).catch(() => {})
    } catch {}
  }, [fontReady, text, style, autoCopy, attemptCopy])

  const handleQuick = () => {
    attemptCopy(false).catch((err) =>
      flash(err instanceof Error ? err.message : t("toast.copyFailed")),
    )
  }

  const handleCustom = () => {
    // They want to keep working — never yank the editor away mid-tweak.
    cancelClose()
    track.shareCustom()
    onCustom()
  }

  return (
    <div className="flex h-full flex-col">
      {/*
        The landing is a single-purpose sheet, so the brand row doubles as its
        heading: a bigger icon (the source PNG carries its own square lavender
        background, which needs a matching radius to not look clipped) beside a
        stacked title + what-this-screen-is subtitle, centered as one group.
      */}
      <header className="flex items-center justify-center gap-3 border-b bg-card px-4 py-3">
        <img
          src={`${import.meta.env.BASE_URL}icon.png`}
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl shadow-sm ring-1 ring-black/5"
        />
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight tracking-tight">
            {t("app.title")}
          </div>
          <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
            {t("share.title")}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-xs text-muted-foreground">{t("share.subtitle")}</p>

          <div className="relative rounded-xl border bg-muted/30 p-3">
            {!fontReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm dark:bg-black/40">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("font.loading")}
                </div>
              </div>
            )}
            <div className="flex max-h-[45vh] items-center justify-center overflow-auto">
              <canvas
                ref={canvasRef}
                className="max-w-full rounded-lg shadow-sm ring-1 ring-black/5"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleQuick}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm active:scale-[0.98]"
            >
              <Copy className="h-4 w-4" />
              {t("share.quick")}
            </button>
            <button
              type="button"
              onClick={handleCustom}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium shadow-sm active:scale-[0.98]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("share.custom")}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}
