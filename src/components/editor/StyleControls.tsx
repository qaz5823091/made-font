import { useEffect } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Loader2,
  Pipette,
} from "lucide-react"
import { FONT_FAMILIES, WEIGHTS, ensureFontLoaded, isFontLoaded } from "@/lib/fonts"
import type { TextStyle } from "@/lib/types"

type Props = {
  style: TextStyle
  onChange: (next: TextStyle) => void
  /** when true, alignment row is hidden (e.g., for image-mode single-line layers) */
  compact?: boolean
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

export function StyleControls({ style, onChange, compact }: Props) {
  const fontLoaded = isFontLoaded(style.family, style.weight)

  useEffect(() => {
    ensureFontLoaded(style.family, style.weight).catch(() => {})
  }, [style.family, style.weight])

  const set = <K extends keyof TextStyle>(key: K, value: TextStyle[K]) =>
    onChange({ ...style, [key]: value })

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">字型</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set("family", f.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                style.family === f.id
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-input bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              <div className="font-medium text-foreground">{f.label}</div>
              <div className="text-[11px] text-muted-foreground">{f.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          字重
          {!fontLoaded && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              載入中
            </span>
          )}
        </label>
        <div className="mt-1 flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {WEIGHTS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => set("weight", w.id)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-xs whitespace-nowrap transition ${
                style.weight === w.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:border-primary/50"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">字級</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {style.size}px
          </span>
        </div>
        <input
          type="range"
          min={16}
          max={400}
          step={2}
          value={style.size}
          onChange={(e) => set("size", Number(e.target.value))}
          className="mt-1 w-full accent-primary"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">行距</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {style.lineHeight.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0.9}
          max={2.5}
          step={0.05}
          value={style.lineHeight}
          onChange={(e) => set("lineHeight", Number(e.target.value))}
          className="mt-1 w-full accent-primary"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">顏色</label>
        <div className="mt-1 flex items-center gap-2">
          <label className="relative inline-flex items-center">
            <input
              type="color"
              value={style.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-9 w-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
              aria-label="自訂顏色"
            />
            <Pipette className="pointer-events-none absolute right-1 top-1 h-3 w-3 text-white mix-blend-difference" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("color", c)}
                aria-label={c}
                className={`h-7 w-7 rounded-full border transition ${
                  style.color.toLowerCase() === c
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-input"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {!compact && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">對齊</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(
              [
                { v: "left", icon: AlignLeft },
                { v: "center", icon: AlignCenter },
                { v: "right", icon: AlignRight },
              ] as const
            ).map(({ v, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => set("align", v)}
                className={`flex items-center justify-center rounded-md border py-2 transition ${
                  style.align === v
                    ? "border-primary bg-primary/10"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
