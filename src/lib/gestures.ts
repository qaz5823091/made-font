import { useRef, type PointerEvent as ReactPointerEvent } from "react"

type Point = { x: number; y: number }

export type GestureUpdate = {
  /** distance ratio relative to gesture start (1 = same) */
  scale: number
  /** rotation delta in degrees relative to gesture start */
  rotation: number
  /** Midpoint of the two pointers (client coords) */
  midpoint: Point
}

export type PinchHandlers<E extends HTMLElement> = {
  onPointerDown: (e: ReactPointerEvent<E>) => void
  onPointerMove: (e: ReactPointerEvent<E>) => void
  onPointerUp: (e: ReactPointerEvent<E>) => void
  onPointerCancel: (e: ReactPointerEvent<E>) => void
  active: () => boolean
}

/**
 * Tracks two-pointer pinch + rotate gestures on an element using Pointer Events.
 * Single-pointer events are delegated to the supplied single-finger callbacks
 * so the host element can implement drag behavior alongside pinch.
 */
export function usePinchGesture<E extends HTMLElement>({
  onPinchStart,
  onPinchMove,
  onPinchEnd,
  onSinglePointerDown,
  onSinglePointerMove,
  onSinglePointerUp,
}: {
  onPinchStart?: () => void
  onPinchMove: (g: GestureUpdate) => void
  onPinchEnd?: () => void
  onSinglePointerDown?: (e: ReactPointerEvent<E>) => void
  onSinglePointerMove?: (e: ReactPointerEvent<E>) => void
  onSinglePointerUp?: (e: ReactPointerEvent<E>) => void
}): PinchHandlers<E> {
  const pointers = useRef(new Map<number, Point>())
  const start = useRef<{ dist: number; angle: number } | null>(null)
  const active = useRef(false)

  const computeFromMap = (): GestureUpdate | null => {
    if (pointers.current.size < 2 || !start.current) return null
    const [a, b] = [...pointers.current.values()]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    return {
      scale: dist / start.current.dist,
      rotation: angle - start.current.angle,
      midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const onPointerDown = (e: ReactPointerEvent<E>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      onSinglePointerDown?.(e)
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      start.current = {
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      }
      active.current = true
      // Capture both pointers so we keep getting moves outside the element.
      for (const pid of pointers.current.keys()) {
        try {
          ;(e.currentTarget as Element).setPointerCapture(pid)
        } catch {}
      }
      onPinchStart?.()
    }
  }

  const onPointerMove = (e: ReactPointerEvent<E>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (active.current) {
      const update = computeFromMap()
      if (update) onPinchMove(update)
    } else if (pointers.current.size === 1) {
      onSinglePointerMove?.(e)
    }
  }

  const finishPointer = (e: ReactPointerEvent<E>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    if (active.current && pointers.current.size < 2) {
      active.current = false
      start.current = null
      onPinchEnd?.()
    }
    if (pointers.current.size === 0) {
      onSinglePointerUp?.(e)
    }
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {}
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    active: () => active.current,
  }
}
