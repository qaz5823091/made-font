import { useState, useEffect, useRef } from "react"
import { HelpCircle, ImageIcon, Monitor, Moon, Sun, Type } from "lucide-react"
import { PureEditor } from "@/components/editor/PureEditor"
import { MobileEditor } from "@/components/editor/MobileEditor"
import { ImageEditor } from "@/components/editor/ImageEditor"
import { AnimationStudio } from "@/components/editor/AnimationStudio"
import { useMediaQuery } from "@/lib/useMediaQuery"
import { Splash } from "@/components/Splash"
import { ShareLanding } from "@/components/ShareLanding"
import { HelpModal } from "@/components/HelpModal"
import {
  I18nProvider,
  useI18n,
  useI18nProvider,
  type Locale,
} from "@/lib/i18n"
import { DEFAULT_STYLE, type TextStyle } from "@/lib/types"
import {
  ThemeProvider,
  useTheme,
  useThemeProvider,
  type Theme,
} from "@/lib/theme"
import { track } from "@/lib/analytics"
import { initCustomFonts } from "@/lib/customFonts"
import { CUSTOM_FONTS, FONT_FAMILY_IDS } from "@/lib/fonts"
import { loadPrefs, saveStylePref, type SharePrefMode } from "@/lib/prefs"
import { useFlashToast } from "@/lib/useFlashToast"

type Mode = "pure" | "image"

const SAVE_DEBOUNCE_MS = 300

/**
 * Last session's text style, applied before first paint. A stored custom font
 * cannot be applied yet — custom families re-register from OPFS asynchronously
 * — so start on the default family and hand the wanted id to the restore below.
 */
function initialPrefs(): { style: TextStyle; pendingFamily: string | null } {
  const stored = loadPrefs()?.style
  if (!stored) return { style: DEFAULT_STYLE, pendingFamily: null }
  if (FONT_FAMILY_IDS.includes(stored.family)) {
    return { style: stored, pendingFamily: null }
  }
  return {
    style: { ...stored, family: DEFAULT_STYLE.family },
    pendingFamily: stored.family,
  }
}

const INITIAL_PREFS = initialPrefs()

type ShareLaunch = {
  text: string
  /** Resolved mode: URL override wins, then the remembered preference. */
  mode: SharePrefMode | null
  /** True when `mode` came from storage rather than the URL. */
  remembered: boolean
}

/**
 * Reads the Web Share Target hand-off (manifest share_target is GET + action
 * "/", so the payload arrives as query params) and the iOS Shortcut deep link.
 * Resolved once at module scope: the URL is wiped on mount, so re-parsing later
 * would come up empty.
 */
function initialShare(): ShareLaunch | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const text = (["text", "url", "title"] as const)
    .map((key) => params.get(key)?.trim() ?? "")
    .find((value) => value !== "")
  if (!text) return null
  const raw = params.get("mode")
  const override: SharePrefMode | null =
    raw === "quick" || raw === "custom" ? raw : null
  const stored = loadPrefs()?.shareMode ?? null
  return {
    text,
    mode: override ?? stored,
    remembered: !override && stored !== null,
  }
}

const SHARE = initialShare()

const NEXT_THEME: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
}

const NEXT_LOCALE: Record<Locale, Locale> = {
  zh: "en",
  en: "zh",
}

const IMAGE_MODE_ENABLED = false

function Shell() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [mode, setMode] = useState<Mode>("pure")
  // A share hand-off is already an intentional launch — the splash would just
  // stand between the user and their text.
  const [splashed, setSplashed] = useState(!!SHARE)
  const [helpOpen, setHelpOpen] = useState(false)
  const { toast, flash } = useFlashToast()
  // Shared editor state — keeps content consistent across mobile/desktop layouts.
  const [pureText, setPureText] = useState(() =>
    SHARE?.mode === "custom" ? SHARE.text : t("pure.placeholderText"),
  )
  const [pureStyle, setPureStyle] = useState<TextStyle>(INITIAL_PREFS.style)
  const [mobileEditing, setMobileEditing] = useState(false)
  const [animationOpen, setAnimationOpen] = useState(false)
  // "custom" was already applied to pureText above, so it never sees a landing.
  const [landingOpen, setLandingOpen] = useState(
    () => !!SHARE && SHARE.mode !== "custom",
  )
  const pendingFamilyRef = useRef(INITIAL_PREFS.pendingFamily)
  const prefsSettledRef = useRef(false)

  useEffect(() => {
    if (!SHARE) return
    // Drop the shared payload from the address bar so a reload (or an
    // "add to home screen") doesn't replay the share. replaceState to the same
    // pathname is idempotent, so StrictMode's double-invoke is harmless.
    window.history.replaceState(null, "", window.location.pathname)
    // The splash is skipped on this path, and it's what normally fires this.
    track.appOpen()
  }, [])

  useEffect(() => {
    // Runs once the OPFS fonts are back (or failed to come back): finish
    // restoring the stored style, then unpark persistence. Saving earlier would
    // write the temporary built-in fallback over the stored custom family.
    const settle = () => {
      const pending = pendingFamilyRef.current
      pendingFamilyRef.current = null
      if (pending && CUSTOM_FONTS.some((f) => f.id === pending)) {
        setPureStyle((s) =>
          // Bail out if the user already picked a family while fonts loaded.
          s.family === DEFAULT_STYLE.family ? { ...s, family: pending } : s,
        )
      }
      prefsSettledRef.current = true
    }
    initCustomFonts().then(settle, settle)
  }, [])

  // Persist style choices only (never the text) so a return visit starts from
  // the same look. Debounced: sliders and pinch gestures fire continuously.
  useEffect(() => {
    if (!prefsSettledRef.current) return
    const id = setTimeout(() => saveStylePref(pureStyle), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [pureStyle])

  const handleSelectImageMode = () => {
    if (IMAGE_MODE_ENABLED) {
      setMode("image")
      track.switchMode("image")
    } else {
      flash(t("mode.image.wip"))
    }
  }

  if (!splashed) {
    return (
      <main className="h-[100dvh] bg-background text-foreground">
        <Splash onDone={() => { setSplashed(true); track.appOpen() }} />
      </main>
    )
  }

  if (SHARE && landingOpen) {
    return (
      <main className="h-[100dvh] bg-background text-foreground">
        <ShareLanding
          text={SHARE.text}
          style={pureStyle}
          autoCopy={SHARE.mode === "quick"}
          showRemember={SHARE.mode === null}
          rememberedQuick={SHARE.mode === "quick" && SHARE.remembered}
          onCustom={() => {
            setPureText(SHARE.text)
            setLandingOpen(false)
          }}
        />
      </main>
    )
  }

  if (animationOpen) {
    return (
      <main className="h-[100dvh] bg-background text-foreground">
        <AnimationStudio
          text={pureText}
          style={pureStyle}
          onClose={() => setAnimationOpen(false)}
        />
      </main>
    )
  }

  const openAnimation = () => {
    setAnimationOpen(true)
    track.openAnimation()
  }

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor

  return (
    <main className="flex h-[100dvh] flex-col bg-background text-foreground">
      {!(mobileEditing && !isDesktop) && (
      <header className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={`${import.meta.env.BASE_URL}icon.png`}
            alt=""
            className="h-7 w-7 shrink-0 rounded-md"
          />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <div className="truncate text-sm font-semibold leading-none">
              {t("app.title")}
            </div>
            <span className="text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
              v{__APP_VERSION__}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => { setMode("pure"); track.switchMode("pure") }}
              aria-label={t("mode.pure")}
              title={t("mode.pure")}
              className={`inline-flex h-6 w-7 items-center justify-center rounded-full transition ${
                mode === "pure"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Type className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleSelectImageMode}
              aria-label={t("mode.image")}
              title={t("mode.image")}
              aria-disabled={!IMAGE_MODE_ENABLED}
              className={`inline-flex h-6 w-7 items-center justify-center rounded-full transition ${
                !IMAGE_MODE_ENABLED
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : mode === "image"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { const next = NEXT_LOCALE[locale]; setLocale(next); track.changeLocale(next) }}
            aria-label={t("locale.switch")}
            title={t("locale.switch")}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border bg-background px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
          >
            {locale}
          </button>
          <button
            type="button"
            onClick={() => { const next = NEXT_THEME[theme]; setTheme(next); track.changeTheme(next) }}
            aria-label={t(`theme.${theme}`)}
            title={t(`theme.${theme}`)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground"
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setHelpOpen(true); track.openHelp() }}
            aria-label={t("help.button")}
            title={t("help.button")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "pure" || !IMAGE_MODE_ENABLED ? (
          isDesktop ? (
            <PureEditor
              text={pureText}
              setText={setPureText}
              style={pureStyle}
              setStyle={setPureStyle}
              onOpenAnimation={openAnimation}
            />
          ) : (
            <MobileEditor
              text={pureText}
              setText={setPureText}
              style={pureStyle}
              setStyle={setPureStyle}
              editing={mobileEditing}
              setEditing={setMobileEditing}
              onOpenAnimation={openAnimation}
            />
          )
        ) : (
          <ImageEditor />
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </main>
  )
}

function App() {
  const i18n = useI18nProvider()
  const themeCtx = useThemeProvider()
  return (
    <I18nProvider value={i18n}>
      <ThemeProvider value={themeCtx}>
        <Shell />
      </ThemeProvider>
    </I18nProvider>
  )
}

export default App
