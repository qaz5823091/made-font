import { useEffect } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Loader2,
} from "lucide-react"
import {
  FONT_FAMILIES,
  WEIGHTS,
  ensureFontLoaded,
  isFontLoaded,
} from "@/lib/fonts"
import {
  LINE_PRESETS,
  SIZE_PRESETS,
  type BgMode,
  type LinePreset,
  type SizePreset,
  type TextStyle,
} from "@/lib/types"
import { complementColor } from "@/lib/color"

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

const BG_MODES: { v: BgMode; label: string }[] = [
  { v: "transparent", label: "透明" },
  { v: "complement-bg", label: "補色底" },
  { v: "complement-text", label: "補色字" },
]

export function StyleControls({ style, onChange }: Props) {
  const fontLoaded = isFontLoaded(style.family, style.weight)
  const complement = complementColor(style.color)

  useEffect(() => {
    ensureFontLoaded(style.family, style.weight).catch(() => {})
  }, [style.family, style.weight])

  const set = <K extends keyof TextStyle>(key: K, value: TextStyle[K]) =>
    onChange({ ...style, [key]: value })

  return (
    <div className="space-y-2">
      {/* Row 1: font + weight selects */}
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="字型"
          value={style.family}
          onChange={(v) => set("family", v as TextStyle["family"])}
          options={FONT_FAMILIES.map((f) => ({ value: f.id, label: f.label }))}
        />
        <SelectField
          label={
            <span className="inline-flex items-center gap-1">
              字重
              {!fontLoaded && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </span>
          }
          value={style.weight}
          onChange={(v) => set("weight", v as TextStyle["weight"])}
          options={WEIGHTS.map((w) => ({ value: w.id, label: w.label }))}
        />
      </div>

      {/* Row 2: size + align */}
      <div className="grid grid-cols-2 gap-2">
        <Segmented
          label="字級"
          value={style.sizePreset}
          onChange={(v) => set("sizePreset", v as SizePreset)}
          options={(Object.keys(SIZE_PRESETS) as SizePreset[]).map((k) => ({
            value: k,
            node: (
              <span
                className="font-semibold"
                style={{
                  fontSize:
                    k === "S" ? 11 : k === "M" ? 14 : 18,
                  lineHeight: 1,
                }}
              >
                A
              </span>
            ),
            aria: SIZE_PRESETS[k].label,
          }))}
        />
        <Segmented
          label="對齊"
          value={style.align}
          onChange={(v) => set("align", v as TextStyle["align"])}
          options={ALIGN_OPTS.map(({ v, Icon }) => ({
            value: v,
            node: <Icon className="h-4 w-4" />,
            aria: v,
          }))}
        />
      </div>

      {/* Row 3: line-height + bg-mode */}
      <div className="grid grid-cols-2 gap-2">
        <Segmented
          label="行距"
          value={style.linePreset}
          onChange={(v) => set("linePreset", v as LinePreset)}
          options={(Object.keys(LINE_PRESETS) as LinePreset[]).map((k) => ({
            value: k,
            node: <LineIcon variant={k} />,
            aria: LINE_PRESETS[k].label,
          }))}
        />
        <div>
          <Label>底色</Label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {BG_MODES.map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => set("bgMode", v)}
                aria-label={label}
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

      {/* Row 4: color picker */}
      <div>
        <Label>顏色</Label>
        <div className="mt-1 flex items-center gap-1.5">
          <label className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input">
            <input
              type="color"
              value={style.color}
              onChange={(e) => set("color", e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="自訂顏色"
            />
            <div
              className="h-full w-full"
              style={{
                background: `conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)`,
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
      <span
        className="inline-flex h-full w-full items-center justify-center bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0]"
      >
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
