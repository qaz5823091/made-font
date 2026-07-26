import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Ephemeral toast state shared by the editors. `flash(msg)` shows a message and
 * auto-clears it after `durationMs`. Re-flashing resets the timer, so a newer
 * message is never cut short by an older one's pending clear (the bug the
 * hand-rolled copies in each editor all had).
 */
export function useFlashToast(durationMs = 1800) {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const flash = useCallback(
    (msg: string) => {
      setToast(msg)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setToast(null), durationMs)
    },
    [durationMs],
  )

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  return { toast, flash }
}
