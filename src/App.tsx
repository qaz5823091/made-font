import { useState } from "react"
import { HelpCircle, ImageIcon, Monitor, Moon, Sun, Type } from "lucide-react"
import { PureEditor } from "@/components/editor/PureEditor"
import { ImageEditor } from "@/components/editor/ImageEditor"
import { Splash } from "@/components/Splash"
import { HelpModal } from "@/components/HelpModal"
import {
  I18nProvider,
  useI18n,
  useI18nProvider,
  type Locale,
} from "@/lib/i18n"
import {
  ThemeProvider,
  useTheme,
  useThemeProvider,
  type Theme,
} from "@/lib/theme"

type Mode = "pure" | "image"

const NEXT_THEME: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
}

const NEXT_LOCALE: Record<Locale, Locale> = {
  zh: "en",
  en: "zh",
}

function Shell() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const [mode, setMode] = useState<Mode>("pure")
  const [splashed, setSplashed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  if (!splashed) {
    return (
      <main className="h-[100dvh] bg-background text-foreground">
        <Splash onDone={() => setSplashed(true)} />
      </main>
    )
  }

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor

  return (
    <main className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background text-sm font-bold">
            字
          </div>
          <div className="truncate text-sm font-semibold leading-none">
            {t("app.title")}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("pure")}
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
              onClick={() => setMode("image")}
              aria-label={t("mode.image")}
              title={t("mode.image")}
              className={`inline-flex h-6 w-7 items-center justify-center rounded-full transition ${
                mode === "image"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLocale(NEXT_LOCALE[locale])}
            aria-label={t("locale.switch")}
            title={t("locale.switch")}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border bg-background px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
          >
            {locale}
          </button>
          <button
            type="button"
            onClick={() => setTheme(NEXT_THEME[theme])}
            aria-label={t(`theme.${theme}`)}
            title={t(`theme.${theme}`)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground"
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label={t("help.button")}
            title={t("help.button")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "pure" ? <PureEditor /> : <ImageEditor />}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
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
