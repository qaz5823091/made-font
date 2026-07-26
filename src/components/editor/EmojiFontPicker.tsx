import { useEffect, useRef, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import {
  EMOJI_FONTS,
  ensureEmojiFontLoaded,
  getEmojiFont,
  isEmojiFontLoaded,
  type EmojiFontId,
} from "@/lib/emojiFonts"
import type { EmojiFamilyId } from "@/lib/types"
import { useI18n } from "@/lib/i18n"
import { track } from "@/lib/analytics"

/**
 * The single glyph every row previews. "Face with tears of joy" is drawn very
 * differently by each vendor, so one sample is enough to tell the fonts apart.
 */
const SAMPLE = "😂"

type Props = {
  value: EmojiFamilyId
  onChange: (id: EmojiFamilyId) => void
  /**
   * Which way the panel opens. "down" suits the desktop side panel; "up" is for
   * the mobile sheet, which is anchored to the bottom of the screen where a
   * downward panel would fall behind the toolbar.
   */
  placement?: "down" | "up"
  /**
   * Box styling for the trigger — size, radius, border, background — so each
   * host can make it match the row it sits in: a square cell beside the
   * bold/italic toggles on desktop, a round pill in the mobile toolbar.
   * Centering and the open-state ring are always applied on top.
   */
  triggerClassName?: string
}

/**
 * Compact emoji-font selector: a square trigger showing the current sample plus
 * a hand-rolled popover listing the four choices. Hand-rolled because the only
 * Radix package in the tree is react-slot — there is no popover primitive.
 *
 * Owns the change_emoji_font analytics event so every host (desktop panel,
 * mobile sheet) reports it exactly once.
 */
export function EmojiFontPicker({
  value,
  onChange,
  placement = "down",
  triggerClassName = "h-8 w-8 rounded-md border bg-background",
}: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<EmojiFontId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Dismiss on outside pointerdown / Escape. pointerdown (not click) so the
  // panel closes on the same gesture that starts an interaction elsewhere.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const label = t("panel.emoji")

  const select = (id: EmojiFamilyId) => {
    onChange(id)
    track.changeEmojiFont(id)
    setOpen(false)
    // Picking a font is explicit intent, so start the download now instead of
    // waiting for the user to type an emoji. Failures are swallowed: the
    // editors already fall back to the device emoji font when a load fails.
    if (id !== "system" && !isEmojiFontLoaded(id)) {
      setLoadingId(id)
      ensureEmojiFontLoaded(id)
        .catch(() => {})
        .finally(() => setLoadingId((cur) => (cur === id ? null : cur)))
    }
  }

  const options: { id: EmojiFamilyId; label: string }[] = [
    { id: "system", label: t("emoji.system") },
    ...EMOJI_FONTS.map((f) => ({ id: f.id, label: f.label })),
  ]

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={label}
        className={`inline-flex items-center justify-center transition ${triggerClassName} ${
          open ? "border-primary ring-2 ring-primary/40" : "border-input"
        }`}
      >
        <EmojiSample id={value} px={20} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`absolute right-0 z-50 w-max min-w-[11rem] max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-input bg-popover p-1 text-popover-foreground shadow-lg ${
            placement === "up" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => select(o.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                o.id === value ? "bg-muted font-medium" : "hover:bg-muted"
              }`}
            >
              <EmojiSample id={o.id} px={24} />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <Hint
                id={o.id}
                selected={o.id === value}
                loading={loadingId === o.id}
                loadingLabel={t("emoji.loading")}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Trailing status for a row: spinner while downloading, check when selected,
 *  otherwise the download weight so the cost is visible before committing. */
function Hint({
  id,
  selected,
  loading,
  loadingLabel,
}: {
  id: EmojiFamilyId
  selected: boolean
  loading: boolean
  loadingLabel: string
}) {
  if (loading) {
    return (
      <Loader2
        aria-label={loadingLabel}
        className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
      />
    )
  }
  if (selected) {
    return <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" />
  }
  if (id === "system" || isEmojiFontLoaded(id)) return null
  return (
    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
      ~{getEmojiFont(id).approxMB} MB
    </span>
  )
}

/** The 😂 sample: a real character for "system" (whatever the device draws),
 *  a pre-rendered PNG for the webfonts so no download is needed to preview. */
function EmojiSample({ id, px }: { id: EmojiFamilyId; px: number }) {
  if (id === "system") {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center"
        style={{
          width: px,
          height: px,
          fontSize: Math.round(px * 0.9),
          lineHeight: 1,
        }}
      >
        {SAMPLE}
      </span>
    )
  }
  return (
    <img
      src={getEmojiFont(id).previewSrc}
      alt=""
      aria-hidden
      width={px}
      height={px}
      className="shrink-0 object-contain"
      style={{ width: px, height: px }}
    />
  )
}
