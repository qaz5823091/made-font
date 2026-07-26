import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, Loader2, SlidersHorizontal } from "lucide-react"
import { ensureFontLoaded } from "@/lib/fonts"
import { ensureEmojiFontLoaded, textHasEmoji } from "@/lib/emojiFonts"
import { renderTextToCanvas } from "@/lib/renderText"
import { canvasToPngBlob, copyBlobToClipboard } from "@/lib/export"
import { saveShareModePref } from "@/lib/prefs"
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
  /** Try the clipboard write as soon as the first render lands. */
  autoCopy: boolean
  /** Offer the "remember my choice" checkbox (only when nothing is stored). */
  showRemember: boolean
  /** Quick mode came from storage, so offer a way back out of it. */
  rememberedQuick: boolean
  /** Hand the text to the editor and dismiss the landing. */
  onCustom: () => void
}

/**
 * The share-target landing: a focused sheet showing what the shared text looks
 * like in the user's last style, with one tap to copy it as a PNG and one tap
 * to open the full editor instead.
 */
export function ShareLanding({
  text,
  style,
  autoCopy,
  showRemember,
  rememberedQuick,
  onCustom,
}: Props) {
  const { t } = useI18n()
  const { toast, flash } = useFlashToast()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [fontReady, setFontReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const [remember, setRemember] = useState(false)
  // Local-only: flipped when the user cancels a remembered quick mode, which
  // swaps the "remembered" line back for the checkbox.
  const [cleared, setCleared] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const autoCopyTried = useRef(false)
  const shownLogged = useRef(false)

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
        setCopied(true)
        track.shareQuickCopy(buildExportConfig(source, style), auto)
      })
    },
    [source, style, t],
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
    if (remember) {
      saveShareModePref("quick")
      track.shareRemember("quick")
    }
    attemptCopy(false)
      .then(() => flash(t("toast.copied")))
      .catch((err) =>
        flash(err instanceof Error ? err.message : t("toast.copyFailed")),
      )
  }

  const handleCustom = () => {
    if (remember) {
      saveShareModePref("custom")
      track.shareRemember("custom")
    }
    track.shareCustom()
    onCustom()
  }

  const handleClearRemember = () => {
    saveShareModePref(null)
    track.shareRemember("cleared")
    setCleared(true)
    flash(t("share.rememberCleared"))
  }

  const askRemember = showRemember || cleared

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-center gap-2 border-b bg-card px-3 py-2">
        <img
          src={`${import.meta.env.BASE_URL}icon.png`}
          alt=""
          className="h-6 w-6 rounded-md"
        />
        <span className="text-sm font-semibold leading-none">
          {t("app.title")}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {t("share.title")}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("share.subtitle")}
            </p>
          </div>

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

          {copied ? (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
              <div className="inline-flex items-center justify-center gap-2 text-sm font-medium text-primary">
                <Check className="h-4 w-4" />
                {t("share.copied")}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("share.copiedHint")}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleQuick}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm active:scale-[0.98]"
            >
              <Copy className="h-4 w-4" />
              {copied ? t("share.quickAgain") : t("share.quick")}
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

          {askRemember ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input accent-primary"
              />
              {t("share.remember")}
            </label>
          ) : rememberedQuick ? (
            <button
              type="button"
              onClick={handleClearRemember}
              className="self-start text-xs text-muted-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
            >
              {t("share.rememberedQuick")}
            </button>
          ) : null}
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
