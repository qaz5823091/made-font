import { useEffect, useState } from "react"
import { ensureFontLoaded } from "@/lib/fonts"
import { useI18n } from "@/lib/i18n"

type FrameStyle = React.CSSProperties

const FRAMES: FrameStyle[] = [
  { fontFamily: "serif", fontWeight: 200, letterSpacing: "0.18em" },
  { fontFamily: "serif", fontWeight: 900, letterSpacing: "-0.04em" },
  { fontFamily: "sans-serif", fontWeight: 100, letterSpacing: "0.32em", fontStyle: "italic" },
  { fontFamily: "sans-serif", fontWeight: 800, letterSpacing: "-0.02em" },
  { fontFamily: "ui-monospace, monospace", fontWeight: 500, letterSpacing: "0.04em" },
  { fontFamily: "serif", fontWeight: 600, fontStyle: "italic", letterSpacing: "0" },
  { fontFamily: "sans-serif", fontWeight: 300, letterSpacing: "0.16em" },
  { fontFamily: "serif", fontWeight: 700, letterSpacing: "0.02em" },
]

const FRAME_MS = 280
const MIN_DURATION_MS = 1800
const MAX_DURATION_MS = 5000
const FADE_MS = 320

export function Splash({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const [idx, setIdx] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const start = performance.now()
    let cancelled = false

    const interval = window.setInterval(
      () => setIdx((i) => (i + 1) % FRAMES.length),
      FRAME_MS,
    )

    const finish = () => {
      if (cancelled) return
      setFading(true)
      window.setTimeout(onDone, FADE_MS)
    }

    const fontPromise = ensureFontLoaded("GenYoMin2TW", "R").catch(() => {})
    const minWait = new Promise<void>((r) => window.setTimeout(r, MIN_DURATION_MS))
    const hardCap = new Promise<void>((r) => window.setTimeout(r, MAX_DURATION_MS))

    Promise.race([
      // Done as soon as font loaded AND minimum duration elapsed
      Promise.all([fontPromise, minWait]).then(() => undefined),
      // …or when hard cap is reached
      hardCap,
    ]).then(() => {
      const elapsed = performance.now() - start
      const remaining = Math.max(0, MIN_DURATION_MS - elapsed)
      window.setTimeout(finish, remaining)
    })

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [onDone])

  const frame = FRAMES[idx]

  return (
    <div
      className="flex h-full flex-col items-center justify-center bg-background transition-opacity"
      style={{
        opacity: fading ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      <div className="relative flex items-baseline gap-1 px-6">
        <span
          className="text-5xl text-foreground transition-[font-weight,letter-spacing,font-family] sm:text-6xl"
          style={{
            ...frame,
            transitionDuration: `${FRAME_MS}ms`,
          }}
        >
          Made
        </span>
        <span
          className="text-5xl text-foreground transition-[font-weight,letter-spacing,font-family] sm:text-6xl"
          style={{
            ...frame,
            transitionDuration: `${FRAME_MS}ms`,
          }}
        >
          Font
        </span>
      </div>
      <div className="mt-6 flex gap-1">
        {FRAMES.map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === idx ? 18 : 6,
              background:
                i === idx ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.3)",
              transitionDuration: `${FRAME_MS}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{t("splash.subtitle")}</div>
    </div>
  )
}
