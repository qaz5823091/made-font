import { useEffect, useState } from "react"

/**
 * Returns true when the user's device has a precise pointing device (mouse /
 * trackpad). Used to decide whether to show desktop-style controls (sliders)
 * versus mobile-style gesture hints.
 */
export function useHasFinePointer(): boolean {
  const [fine, setFine] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true
    return window.matchMedia("(pointer: fine)").matches
  })

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia("(pointer: fine)")
    const handler = () => setFine(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return fine
}
