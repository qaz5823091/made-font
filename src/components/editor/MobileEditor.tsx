import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Circle,
  Copy,
  Download,
  Film,
  Italic,
  Loader2,
  Palette,
  Type as TypeIcon,
} from "lucide-react"
import {
  FONT_FAMILIES,
  ensureFontLoaded,
  fontCssFamily,
  getFamily,
  hasVariant,
  resolveVariant,
} from "@/lib/fonts"
import { useCustomFonts, importCustomFont } from "@/lib/customFonts"
import {
  emojiCssFamily,
  ensureEmojiFontLoaded,
  textHasEmoji,
} from "@/lib/emojiFonts"
import {
  canvasPadding,
  cssFontShorthand,
  drawStyledLine,
  layoutCurvedText,
  measureText,
  resolveColors,
} from "@/lib/canvas"
import {
  LINE_PRESETS,
  styleLineHeight,
  type BgMode,
  type LinePreset,
  type TextStyle,
} from "@/lib/types"
import {
  canvasToPngBlob,
  copyBlobToClipboard,
  downloadBlob,
  timestampedName,
} from "@/lib/export"
import {
  checkerBackgroundStyle,
  complementColor,
  hslToRgb,
  rgbToHex,
} from "@/lib/color"
import { useI18n } from "@/lib/i18n"
import { useFlashToast } from "@/lib/useFlashToast"
import { buildExportConfig, track } from "@/lib/analytics"
import { EmojiFontPicker } from "./EmojiFontPicker"

const BASE_PADDING = 24
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
const BG_MODES: BgMode[] = ["transparent", "complement-bg", "complement-text"]

const FAMILY_LABELS: Record<string, string> = {
  GenYoMin2TW: "源樣明朝",
  IBMPlexSans: "IBM Plex Sans",
  DelaGothicOne: "Dela Gothic One",
  ChenYuluoyanThin: "辰宇落雁體",
  BpmfZihiKaiStd: "字嗨注音標楷",
}

type Panel = "color" | "curve" | "family" | null

type Props = {
  text: string
  setText: (v: string) => void
  style: TextStyle
  setStyle: (v: TextStyle | ((s: TextStyle) => TextStyle)) => void
  editing: boolean
  setEditing: (v: boolean) => void
  onOpenAnimation?: () => void
}

export function MobileEditor({
  text,
  setText,
  style,
  setStyle,
  editing,
  setEditing,
  onOpenAnimation,
}: Props) {
  const { t } = useI18n()
  const { toast, flash } = useFlashToast()
  const [fontReady, setFontReady] = useState(false)
  const [openPanel, setOpenPanel] = useState<Panel>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  // Shared display size — both textarea (while editing) and canvas (preview)
  // render at this size, so the visual is consistent across modes. Auto-fit
  // shrinks this when content overflows the stage area.
  const [displaySize, setDisplaySize] = useState(style.size)
  const [stageW, setStageW] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const colorBtnRef = useRef<HTMLButtonElement>(null)
  const curvePopoverRef = useRef<HTMLDivElement>(null)
  const curveBtnRef = useRef<HTMLButtonElement>(null)
  const customFonts = useCustomFonts()
  const familyBtnRef = useRef<HTMLButtonElement>(null)
  const familyPopoverRef = useRef<HTMLDivElement>(null)

  // Track stage width — feeds both the auto-fit loop and the canvas wrap width.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStageW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Only pay for the emoji webfont download when the text actually has emoji.
  const hasEmoji = useMemo(() => textHasEmoji(text), [text])

  useEffect(() => {
    let cancelled = false
    setFontReady(false)
    const jobs: Promise<unknown>[] = [
      ensureFontLoaded(style.family, style.bold, style.italic),
    ]
    if (style.emojiFamily !== "system" && hasEmoji) {
      jobs.push(ensureEmojiFontLoaded(style.emojiFamily))
    }
    // A failed download must never brick the editor — we still mark ready and
    // let the browser fall back to whatever it can render.
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

  // Whenever style.size changes (e.g. user picks a different base), reset the
  // display size; auto-fit may shrink it back down below.
  useEffect(() => {
    setDisplaySize(style.size)
  }, [style.size])

  // Resolve the effective style that drives both the textarea and the canvas.
  const effective: TextStyle = { ...style, size: displaySize }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (stageW <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const measureCanvas = document.createElement("canvas")
    const mctx = measureCanvas.getContext("2d")
    if (!mctx) return
    // Lines only break at explicit \n — auto-fit shrinks the size if a line
    // is too wide. Width is locked to the stage so alignment matches the textarea.
    const isEmpty = text.length === 0
    const placeholder = t("panel.text.placeholder")
    const drawText = isEmpty ? placeholder : text
    mctx.font = cssFontShorthand(effective)
    const pad = canvasPadding(effective, BASE_PADDING)
    const cssWidth = stageW
    const { fg, bg } = resolveColors(effective)

    if (effective.curve !== 0) {
      // Curve mode on mobile: lock width to stage, scale the natural curve
      // layout so it fits within (stageW - 2*pad) along its dominant axis,
      // then center it. Keeps the slider live-preview honest at any radius.
      const layout = layoutCurvedText(mctx, drawText, effective, effective.curve)
      const target = Math.max(1, cssWidth - pad * 2)
      const naturalMax = Math.max(layout.width, layout.height, 1)
      const scale = Math.min(1, target / naturalMax)
      const cssHeight = Math.max(Math.ceil(layout.height * scale + pad * 2), 64)
      canvas.width = cssWidth * dpr
      canvas.height = cssHeight * dpr
      canvas.style.width = `${cssWidth}px`

      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      if (bg) {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, cssWidth, cssHeight)
      }
      ctx.fillStyle = fg
      ctx.globalAlpha = isEmpty ? 0.35 : 1
      // Center the (scaled) layout inside the canvas.
      ctx.save()
      ctx.translate(cssWidth / 2, cssHeight / 2)
      ctx.scale(scale, scale)
      ctx.translate(-layout.width / 2, -layout.height / 2)
      layout.draw(ctx, 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
      return
    }

    const metrics = measureText(mctx, drawText, effective)
    const cssHeight = Math.max(Math.ceil(metrics.height + pad * 2), 64)
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    canvas.style.width = `${cssWidth}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, cssWidth, cssHeight)
    }
    // font + textAlign are owned by drawStyledLine (they vary per emoji run).
    ctx.fillStyle = fg
    ctx.globalAlpha = isEmpty ? 0.35 : 1
    ctx.textBaseline = "middle"
    const anchorX =
      effective.align === "left"
        ? pad
        : effective.align === "right"
          ? cssWidth - pad
          : cssWidth / 2
    let cursorY = pad + metrics.lineHeightPx / 2
    for (const line of metrics.lines) {
      drawStyledLine(ctx, line, effective, anchorX, cursorY)
      cursorY += metrics.lineHeightPx
    }
    ctx.globalAlpha = 1
  }, [effective, text, stageW, t])

  // Close whichever popover is open when the user taps outside it. Each panel
  // anchors to its own toggle button so we whitelist both.
  useEffect(() => {
    if (openPanel === null) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (colorBtnRef.current?.contains(target)) return
      if (curvePopoverRef.current?.contains(target)) return
      if (curveBtnRef.current?.contains(target)) return
      if (familyPopoverRef.current?.contains(target)) return
      if (familyBtnRef.current?.contains(target)) return
      setOpenPanel(null)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [openPanel])

  // The curve effect only renders to the canvas (the textarea can't show
  // curved text), so adjusting it during editing has no visible feedback.
  // Force-close the popover when editing starts; the trigger button is also
  // disabled below so the user can't re-open it.
  useEffect(() => {
    if (editing && openPanel === "curve") setOpenPanel(null)
  }, [editing, openPanel])

  // Redraw whenever we land back in preview mode or shared inputs change.
  useEffect(() => {
    if (!fontReady) return
    if (editing) return
    draw()
  }, [draw, fontReady, editing])

  // Auto-fit: shrink displaySize until textarea fits inside its own inner box.
  // Using ta.client* (rather than stage.client*) keeps autofit correct after
  // the bg/padding wrapper, which trims the textarea by 2 * BASE_PADDING per axis.
  useLayoutEffect(() => {
    if (!editing) return
    const ta = textareaRef.current
    const stage = stageRef.current
    if (!ta || !stage) return
    let size = style.size
    ta.style.fontSize = `${size}px`
    for (let i = 0; i < 24; i++) {
      const availW = ta.clientWidth
      const availH = ta.clientHeight
      const overW = ta.scrollWidth - availW
      const overH = ta.scrollHeight - availH
      if (overW <= 1 && overH <= 1) break
      const ratio = Math.min(
        availW / Math.max(1, ta.scrollWidth),
        availH / Math.max(1, ta.scrollHeight),
      )
      const next = Math.max(10, Math.floor(size * ratio * 0.97))
      if (next === size) break
      size = next
      ta.style.fontSize = `${size}px`
    }
    if (size !== displaySize) setDisplaySize(size)
  }, [
    editing,
    text,
    style.size,
    style.family,
    style.bold,
    style.italic,
    style.linePreset,
    style.align,
    displaySize,
  ])

  // Mirror auto-fit for preview mode (not editing). Without this the initial
  // splash text and any text typed at full SIZE_DEFAULT overflows the locked
  // stageW on narrow phones. We skip curve mode because layoutCurvedText
  // already scales the layout to fit the canvas.
  useLayoutEffect(() => {
    if (editing) return
    if (stageW <= 0) return
    if (style.curve !== 0) {
      if (displaySize !== style.size) setDisplaySize(style.size)
      return
    }
    const probe = document.createElement("canvas").getContext("2d")
    if (!probe) return
    const pad = canvasPadding(style, BASE_PADDING)
    const target = Math.max(1, stageW - pad * 2)
    let size = style.size
    const placeholder = t("panel.text.placeholder")
    const drawText = text.length === 0 ? placeholder : text
    for (let i = 0; i < 24; i++) {
      // measureText sets the probe font itself and is emoji-run aware, so the
      // fitted size accounts for emoji glyph widths exactly as draw() will.
      const metrics = measureText(probe, drawText, { ...style, size })
      if (metrics.inkWidth <= target) break
      const ratio = target / metrics.inkWidth
      const next = Math.max(10, Math.floor(size * ratio * 0.97))
      if (next === size) break
      size = next
    }
    if (size !== displaySize) setDisplaySize(size)
  }, [
    editing,
    stageW,
    text,
    style,
    displaySize,
    t,
  ])

  // While editing, swallow the default focus-on-mousedown that toolbars and
  // popovers would otherwise trigger. Without this, tapping any button blurs
  // the textarea, the OS dismisses the keyboard, and the editor unmounts
  // before the button's onClick runs (so the tap appears to do nothing).
  const preserveFocusIfEditing = (e: React.MouseEvent) => {
    if (editingRef.current) e.preventDefault()
  }

  const exportBlob = useCallback(async () => {
    draw()
    if (!canvasRef.current) return null
    return canvasToPngBlob(canvasRef.current)
  }, [draw])

  const handleCopy = () => {
    // Synchronous call into clipboard.write keeps the Safari user gesture.
    const blobPromise = (async () => {
      const blob = await exportBlob()
      if (!blob) throw new Error(t("error.exportFailed"))
      return blob
    })()
    copyBlobToClipboard(blobPromise)
      .then(() => {
        flash(t("toast.copied"))
        track.copyImage(buildExportConfig("mobile", style))
      })
      .catch((err) =>
        flash(err instanceof Error ? err.message : t("toast.copyFailed")),
      )
  }

  const handleDownload = async () => {
    try {
      const blob = await exportBlob()
      if (!blob) return
      downloadBlob(blob, timestampedName())
      flash(t("toast.downloading"))
      track.downloadImage(buildExportConfig("mobile", style))
    } catch (err) {
      flash(err instanceof Error ? err.message : t("toast.downloadFailed"))
    }
  }

  const set = <K extends keyof TextStyle>(key: K, value: TextStyle[K]) =>
    setStyle((s) => ({ ...s, [key]: value }))

  const family = getFamily(style.family)
  const variant = resolveVariant(family, style.bold, style.italic)
  const cssFamily = fontCssFamily(style.family, variant)
  const { fg, bg } = resolveColors(style)
  const canBold = hasVariant(family, true, style.italic)
  const canItalic = hasVariant(family, style.bold, true)

  const cycleBg = () => {
    const idx = BG_MODES.indexOf(style.bgMode)
    const next = BG_MODES[(idx + 1) % BG_MODES.length]
    set("bgMode", next)
    track.changeStyle("bg_mode", next)
  }

  const enterEditing = () => {
    setOpenPanel(null)
    setEditing(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  // Keep a ref so the visualViewport handler can read editing state without
  // re-subscribing every time it changes.
  const editingRef = useRef(editing)
  useEffect(() => { editingRef.current = editing }, [editing])

  // Single visualViewport effect: tracks keyboard height for toolbar offset,
  // and detects keyboard dismissal when onBlur doesn't fire (iOS Done / Android back).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
      setKeyboardOffset(offset)
      if (editingRef.current && offset < 50) {
        setEditing(false)
        textareaRef.current?.blur()
      }
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={checkerBackgroundStyle(style.color)}
    >
      {/* Stage — shared bounds for preview canvas + edit textarea so visuals match */}
      <div
        ref={stageRef}
        className="absolute inset-x-2 top-12 flex items-center justify-center overflow-hidden"
        style={{ bottom: keyboardOffset + 64 }}
      >
        {!editing && (
          <button
            type="button"
            onClick={enterEditing}
            aria-label={t("panel.text.placeholder")}
            className="flex h-full w-full items-center justify-center"
          >
            <div className="relative inline-block max-h-full max-w-full">
              {!fontReady && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm dark:bg-black/40">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("font.loading")}
                  </div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                style={{ height: "auto" }}
                className="block max-h-full max-w-full rounded-lg shadow-sm ring-1 ring-black/5"
              />
            </div>
          </button>
        )}

        {editing && (
          <div
            className="flex h-full w-full overflow-hidden"
            style={{
              backgroundColor: bg ?? "transparent",
              borderRadius: bg ? 12 : 0,
              padding: `${BASE_PADDING}px`,
              boxSizing: "border-box",
            }}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => setEditing(false)}
              rows={1}
              wrap="off"
              className="block h-full w-full resize-none overflow-hidden border-0 bg-transparent outline-none"
              style={{
                // Preview approximation: a textarea can't override the font per
                // run the way the canvas does, so the emoji family is appended
                // as a fallback — the main font keeps the text and emoji, which
                // it has no glyphs for, fall through to the emoji webfont.
                fontFamily:
                  style.emojiFamily === "system"
                    ? `"${cssFamily}"`
                    : `"${cssFamily}", "${emojiCssFamily(style.emojiFamily)}"`,
                fontSize: `${displaySize}px`,
                lineHeight: styleLineHeight(style),
                color: fg,
                textAlign: style.align,
                caretColor: fg,
                whiteSpace: "pre",
                padding: 0,
                margin: 0,
                scrollbarWidth: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* Done button — explicit exit from edit mode. Without this, with focus
          preserved on the textarea, the user has no easy way to dismiss the
          keyboard (since tapping outside the textarea is rare on mobile). */}
      {editing && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setEditing(false)
            textareaRef.current?.blur()
          }}
          aria-label={t("action.done")}
          title={t("action.done")}
          className="pointer-events-auto absolute left-2 top-2 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-black/10"
        >
          <Check className="h-4 w-4" />
        </button>
      )}

      {/* Top floating bar: align + line + bg */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-2 z-20 flex justify-center px-2"
      >
        <div
          className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-background/85 px-1.5 py-1 shadow-md ring-1 ring-black/5 backdrop-blur"
          onMouseDown={preserveFocusIfEditing}
        >
          <PillBtn
            active={style.align === "left"}
            onClick={() => { set("align", "left"); track.changeStyle("align", "left") }}
            aria={t("align.left")}
          >
            <AlignLeft className="h-4 w-4" />
          </PillBtn>
          <PillBtn
            active={style.align === "center"}
            onClick={() => { set("align", "center"); track.changeStyle("align", "center") }}
            aria={t("align.center")}
          >
            <AlignCenter className="h-4 w-4" />
          </PillBtn>
          <PillBtn
            active={style.align === "right"}
            onClick={() => { set("align", "right"); track.changeStyle("align", "right") }}
            aria={t("align.right")}
          >
            <AlignRight className="h-4 w-4" />
          </PillBtn>
          <Divider />
          {(Object.keys(LINE_PRESETS) as LinePreset[]).map((k) => (
            <PillBtn
              key={k}
              active={style.linePreset === k}
              onClick={() => { set("linePreset", k); track.changeStyle("line_preset", k) }}
              aria={t(`line.${k}`)}
            >
              <LineIcon variant={k} />
            </PillBtn>
          ))}
          <Divider />
          <PillBtn
            onClick={cycleBg}
            aria={t(`bg.${style.bgMode}`)}
            active={style.bgMode !== "transparent"}
          >
            <BgIcon
              mode={style.bgMode}
              color={style.color}
              complement={complementColor(style.color)}
            />
          </PillBtn>
          {/* Curve only renders into the preview canvas, not the textarea,
              so we hide its toggle entirely while editing — keeping a disabled
              button around just looked like a bug. The button reappears the
              moment editing ends. */}
          {!editing && (
            <>
              <Divider />
              <button
                ref={curveBtnRef}
                type="button"
                onClick={() =>
                  setOpenPanel(openPanel === "curve" ? null : "curve")
                }
                aria-pressed={openPanel === "curve"}
                aria-label={t("panel.curve")}
                title={t("panel.curve")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
                  style.curve !== 0
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Circle className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Curve popover — opens below the top floating bar where the curve
          toggle lives, so the spatial relationship to the trigger reads
          immediately. */}
      {openPanel === "curve" && (
        <div
          ref={curvePopoverRef}
          onMouseDown={preserveFocusIfEditing}
          className="absolute left-1/2 top-12 z-30 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl bg-background/95 p-3 shadow-xl ring-1 ring-black/10 backdrop-blur"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("panel.curve")}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {Math.round(style.curve * 100)}
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={Math.round(style.curve * 100)}
            onChange={(e) => {
              // Magnetic snap around 0 — mirrors StyleControls so the slider
              // pulls back to "straight" without needing pixel precision.
              const raw = Number(e.target.value)
              const snapped = Math.abs(raw) < 5 ? 0 : raw
              set("curve", snapped / 100)
            }}
            // Fire GA on release only — same pattern as StyleControls.
            onPointerUp={() => track.changeCurve(style.curve)}
            className="h-7 w-full accent-primary"
          />
        </div>
      )}

      {/* Bottom toolbar: color, family, bold, italic, copy/download */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-20 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
        style={{ bottom: keyboardOffset }}
      >
        <div className="relative flex items-center">
        {/* gap-0.5, not gap-1: with the emoji picker added, this row carries 8
            round 36px targets plus a divider, which at a 360px viewport would
            otherwise burst out of the page's px-3 gutter. Tightening the gaps
            (never the touch targets) buys back the 16px needed. */}
        <div
          className="pointer-events-auto mx-auto flex w-fit items-center gap-0.5 rounded-full bg-background/85 px-2 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur"
          onMouseDown={preserveFocusIfEditing}
        >
          <button
            ref={colorBtnRef}
            type="button"
            onClick={() =>
              setOpenPanel(openPanel === "color" ? null : "color")
            }
            aria-label={t("panel.color")}
            aria-pressed={openPanel === "color"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: style.color }}
          >
            <Palette
              className="h-4 w-4"
              style={{ color: complementColor(style.color) }}
            />
          </button>
          <button
            ref={familyBtnRef}
            type="button"
            onClick={() =>
              setOpenPanel(openPanel === "family" ? null : "family")
            }
            aria-label={t("panel.family")}
            aria-pressed={openPanel === "family"}
            title={FAMILY_LABELS[style.family] ?? style.family}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
              openPanel === "family" ? "bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            <TypeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { if (!canBold) return; const next = !style.bold; set("bold", next); track.changeStyle("bold", next) }}
            disabled={!canBold}
            aria-pressed={style.bold}
            aria-label={t("style.bold")}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
              !canBold
                ? "bg-background/50 text-muted-foreground/40"
                : style.bold
                  ? "bg-primary text-primary-foreground"
                  : "bg-background"
            }`}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { if (!canItalic) return; const next = !style.italic; set("italic", next); track.changeStyle("italic", next) }}
            disabled={!canItalic}
            aria-pressed={style.italic}
            aria-label={t("style.italic")}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
              !canItalic
                ? "bg-background/50 text-muted-foreground/40"
                : style.italic
                  ? "bg-primary text-primary-foreground"
                  : "bg-background"
            }`}
          >
            <Italic className="h-4 w-4" />
          </button>
          {/* Emoji font sits in the always-visible group so it stays reachable
              while editing (the textarea previews it live). Its panel opens
              upward because this toolbar is anchored to the bottom, and being a
              DOM child of the wrapper below it inherits the wrapper's
              onMouseDown guard — tapping inside the panel can't blur the
              textarea and dismiss the keyboard.
              The picker fires change_emoji_font itself — no track() here. */}
          <EmojiFontPicker
            value={style.emojiFamily}
            onChange={(id) => set("emojiFamily", id)}
            placement="up"
            triggerClassName="h-9 w-9 rounded-full bg-background"
          />

          {!editing && (
            <>
              <span className="mx-0.5 h-5 w-px bg-border" />
              {onOpenAnimation && (
                <button
                  type="button"
                  onClick={onOpenAnimation}
                  aria-label={t("action.animate")}
                  title={t("action.animate")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background"
                >
                  <Film className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                aria-label={t("action.copy")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                aria-label={t("action.download")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background"
              >
                <Download className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
          <span className="pointer-events-none absolute right-0 select-none text-[11px] font-medium text-muted-foreground/70">
            @cppdesigns
          </span>
        </div>
      </div>

      {/* Color popover — anchored above the bottom toolbar. Uses keyboardOffset
          so the popover stays above the on-screen keyboard on real devices;
          otherwise `bottom-20` lands behind the keyboard and the popover is
          invisible (matches the "web mobile view works, real phone doesn't"
          report). */}
      {openPanel === "color" && (
        <div
          ref={popoverRef}
          onMouseDown={preserveFocusIfEditing}
          style={{ bottom: keyboardOffset + 80 }}
          className="absolute left-3 z-30 rounded-2xl bg-background/95 p-3 shadow-xl ring-1 ring-black/10 backdrop-blur"
        >
          <HueWheel
            value={style.color}
            onChange={(c) => set("color", c)}
            onCommit={() => setOpenPanel(null)}
          />
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  set("color", c)
                  setOpenPanel(null)
                }}
                aria-label={c}
                className={`h-7 w-7 rounded-full border transition ${
                  style.color.toLowerCase() === c
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    : "border-input"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Family popover — tap the family button to open. The font list scrolls
          while the import row stays pinned at the bottom, so importing is always
          reachable no matter how many fonts have been added. */}
      {openPanel === "family" && (
        <div
          ref={familyPopoverRef}
          onMouseDown={preserveFocusIfEditing}
          style={{ bottom: keyboardOffset + 80 }}
          className="absolute left-1/2 -translate-x-1/2 z-30 flex max-h-[50vh] w-[min(16rem,calc(100vw-1.5rem))] flex-col rounded-2xl bg-background/95 p-2 shadow-xl ring-1 ring-black/10 backdrop-blur"
        >
          <div className="mb-1 px-2 pt-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("panel.family")}
            </span>
          </div>
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
            {[...FONT_FAMILIES, ...customFonts].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  set("family", f.id)
                  track.changeFont(f.id)
                  setOpenPanel(null)
                }}
                className={`rounded-md px-3 py-2 text-left text-sm transition ${
                  style.family === f.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {FAMILY_LABELS[f.id] ?? f.id}
              </button>
            ))}
          </div>
          {/* Pinned import row — stays reachable however long the font list
              grows. The emoji-font picker lives in the bottom toolbar instead,
              so it is also reachable while editing. */}
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={async () => {
                const res = await importCustomFont()
                if (res.ok) {
                  set("family", res.family.id)
                  track.changeFont(res.family.id)
                  setOpenPanel(null)
                } else if (res.reason !== "cancelled") {
                  flash(
                    t(
                      res.reason === "quota"
                        ? "font.quotaExceeded"
                        : "font.importFailed",
                    ),
                  )
                }
              }}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-primary transition hover:bg-muted"
            >
              + {t("font.import")}
            </button>
          </div>
        </div>
      )}

      {/* Toast — positioned inside MobileEditor, just below the floating top
          toolbar so it never overlaps it (and the keyboard can't cover it). */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-40 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}

function PillBtn({
  children,
  onClick,
  active,
  aria,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  aria: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" />
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

function BgIcon({
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
      <span className="inline-block h-4 w-4 rounded-sm bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] bg-[length:4px_4px] bg-[position:0_0,0_2px,2px_-2px,-2px_0]" />
    )
  }
  if (mode === "complement-bg") {
    return (
      <span
        className="inline-block h-4 w-4 rounded-sm"
        style={{ backgroundColor: complement }}
      />
    )
  }
  return (
    <span
      className="inline-block h-4 w-4 rounded-sm"
      style={{ backgroundColor: color }}
    />
  )
}

const WHEEL_SIZE = 160

function HueWheel({
  value,
  onChange,
  onCommit,
}: {
  value: string
  onChange: (hex: string) => void
  onCommit: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const pick = (clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const radius = rect.width / 2
    const dist = Math.min(1, Math.hypot(dx, dy) / radius)
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const hue = (angle + 360) % 360
    const sat = Math.round(dist * 100)
    const { r, g, b } = hslToRgb(hue, sat, 50)
    onChange(rgbToHex(r, g, b))
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Hue wheel"
      aria-valuetext={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pick(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        if (e.buttons) pick(e.clientX, e.clientY)
      }}
      onPointerUp={onCommit}
      className="relative touch-none select-none rounded-full ring-1 ring-black/10"
      style={{
        width: WHEEL_SIZE,
        height: WHEEL_SIZE,
        background:
          "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #84cc16, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 65%)",
        }}
      />
    </div>
  )
}
