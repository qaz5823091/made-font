import { useEffect } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Loader2,
  Maximize2,
} from "lucide-react"
import {
  FONT_FAMILIES,
  ensureFontLoaded,
  getFamily,
  hasVariant,
  isFontLoaded,
  resolveVariant,
} from "@/lib/fonts"
import {
  LINE_PRESETS,
  SIZE_MAX,
  SIZE_MIN,
  clampSize,
  type BgMode,
  type LinePreset,
  type TextStyle,
} from "@/lib/types"
import { complementColor } from "@/lib/color"
import { useI18n } from "@/lib/i18n"
import { useHasFinePointer } from "@/lib/usePointer"

type Props = {
  style: TextStyle
  onChange: (next: TextStyle) => void
}

const SWATCHES = [
  "#111827",
  "#ffffff",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

const ALIGN_OPTS = [
  { v: "left" as const, Icon: AlignLeft },
  { v: "center" as const, Icon: AlignCenter },
  { v: "right" as const, Icon: AlignRight },
]

const BG_MODES: BgMode[] = ["transparent", "complement-bg", "complement-text"]

export function StyleControls({ style, onChange }: Props) {
  const { t } = useI18n()
  const family = getFamily(style.family)
  const activeVariant = resolveVariant(family, style.bold, style.italic)
  const fontLoaded = isFontLoaded(style.family, activeVariant)
  const complement = complementColor(style.color)
  const hasFinePointer = useHasFinePointer()

  const canBold = hasVariant(family, true, style.italic)
  const canItalic = hasVariant(family, style.bold, true)

  useEffect(() => {
    ensureFontLoaded(style.family, style.bold, style.italic).catch(() => {})
  }, [style.family, style.bold, style.italic])

  const set = <K extends keyof TextStyle>(key: K, value: TextStyle[K]) =>
    onChange({ ...style, [key]: value })

  return (
    <div className="space-y-2">
      {/* Size: slider on desktop, gesture hint on mobile */}
      <div>
        <div className="flex items-center justify-between">
          <Label>{t("panel.size")}</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {t("unit.px", { n: style.size })}
          </span>
        </div>
        {hasFinePointer ? (
          <input
            type="range"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={2}
            value={style.size}
            onChange={(e) => set("size", clampSize(Number(e.target.value)))}
            className="mt-1 h-7 w-full accent-primary"
          />
        ) : (
          <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-input bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
            <Maximize2 className="h-3 w-3" />
            {t("gesture.pinch")}
          </div>
        )}
      </div>

      {/* Color (full | half on wide) + Background */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>{t("panel.color")}</Label>
          <div className="mt-1 flex items-center gap-1.5">
            <label className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input">
              <input
                type="color"
                value={style.color}
                onChange={(e) => set("color", e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={t("panel.color")}
              />
              <div
                className="h-full w-full"
                style={{
                  background:
                    "conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                }}
              />
            </label>
            <div className="flex flex-1 flex-wrap gap-1">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  aria-label={c}
                  className={`h-7 w-7 rounded-md border transition ${
                    style.color.toLowerCase() === c
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "border-input"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>{t("panel.bg")}</Label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {BG_MODES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set("bgMode", v)}
                aria-label={t(`bg.${v}`)}
                className={`relative flex h-8 items-center justify-center overflow-hidden rounded-md border text-xs font-semibold transition ${
                  style.bgMode === v
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-input"
                }`}
              >
                <BgModePreview
                  mode={v}
                  color={style.color}
                  complement={complement}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Family | Bold/Italic toggles */}
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label={t("panel.family")}
          value={style.family}
          onChange={(v) => set("family", v)}
          options={FONT_FAMILIES.map((f) => ({ value: f.id, label: f.id }))}
        />
        <div>
          <Label>
            <span className="inline-flex items-center gap-1">
              {t("panel.style")}
              {!fontLoaded && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </span>
          </Label>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <StyleToggle
              active={style.bold}
              disabled={!canBold}
              onClick={() => set("bold", !style.bold)}
              aria={t("style.bold")}
              icon={<Bold className="h-3.5 w-3.5" />}
            />
            <StyleToggle
              active={style.italic}
              disabled={!canItalic}
              onClick={() => set("italic", !style.italic)}
              aria={t("style.italic")}
              icon={<Italic className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      </div>

      {/* Align | Line — full on narrow, half on wide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Segmented
          label={t("panel.align")}
          value={style.align}
          onChange={(v) => set("align", v as TextStyle["align"])}
          options={ALIGN_OPTS.map(({ v, Icon }) => ({
            value: v,
            node: <Icon className="h-4 w-4" />,
            aria: t(`align.${v}`),
          }))}
        />
        <Segmented
          label={t("panel.line")}
          value={style.linePreset}
          onChange={(v) => set("linePreset", v as LinePreset)}
          options={(Object.keys(LINE_PRESETS) as LinePreset[]).map((k) => ({
            value: k,
            node: <LineIcon variant={k} />,
            aria: t(`line.${k}`),
          }))}
        />
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function StyleToggle({
  active,
  disabled,
  onClick,
  aria,
  icon,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  aria: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      aria-pressed={active}
      title={aria}
      className={`inline-flex h-8 items-center justify-center rounded-md border text-xs font-medium transition ${
        disabled
          ? "cursor-not-allowed border-input bg-muted/30 text-muted-foreground/40"
          : active
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-input bg-background text-foreground"
      }`}
    >
      {icon}
    </button>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-8 w-full appearance-none rounded-md border border-input bg-background bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:14px_14px] bg-[position:right_8px_center] bg-no-repeat px-2 pr-7 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: React.ReactNode
  value: T
  onChange: (v: T) => void
  options: { value: T; node: React.ReactNode; aria: string }[]
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 grid grid-flow-col auto-cols-fr rounded-md border border-input bg-background p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-label={o.aria}
            className={`flex h-7 items-center justify-center rounded-[5px] text-xs transition ${
              value === o.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {o.node}
          </button>
        ))}
      </div>
    </div>
  )
}

function LineIcon({ variant }: { variant: LinePreset }) {
  const gap = variant === "S" ? 2 : variant === "M" ? 4 : 7
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1={2}
          x2={16}
          y1={3 + i * gap}
          y2={3 + i * gap}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function BgModePreview({
  mode,
  color,
  complement,
}: {
  mode: BgMode
  color: string
  complement: string
}) {
  if (mode === "transparent") {
    return (
      <span className="inline-flex h-full w-full items-center justify-center bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0]">
        <span style={{ color }}>Aa</span>
      </span>
    )
  }
  if (mode === "complement-bg") {
    return (
      <span
        className="inline-flex h-full w-full items-center justify-center"
        style={{ background: complement }}
      >
        <span style={{ color }}>Aa</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-full w-full items-center justify-center"
      style={{ background: color }}
    >
      <span style={{ color: complement }}>Aa</span>
    </span>
  )
}
