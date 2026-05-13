import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "system" | "light" | "dark"

type Ctx = {
  theme: Theme
  setTheme: (t: Theme) => void
  /** Resolved theme (always light or dark) */
  resolved: "light" | "dark"
}

const ThemeContext = createContext<Ctx | null>(null)

const STORAGE_KEY = "made-font.theme"

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyToDocument(resolved: "light" | "dark") {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0b1220" : "#ffffff")
}

function detectInitial(): Theme {
  if (typeof window === "undefined") return "system"
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === "system" || stored === "light" || stored === "dark") return stored
  return "system"
}

export function useThemeProvider() {
  const [theme, setThemeState] = useState<Theme>(() => detectInitial())
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolveTheme(detectInitial()),
  )

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  useEffect(() => {
    const r = resolveTheme(theme)
    setResolved(r)
    applyToDocument(r)

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => {
        const next: "light" | "dark" = mq.matches ? "dark" : "light"
        setResolved(next)
        applyToDocument(next)
      }
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  return { theme, setTheme, resolved }
}

export const ThemeProvider = ThemeContext.Provider

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}
