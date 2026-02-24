'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

/** Animate a number from 0 to `end` over `duration` ms with ease-out cubic. */
export function useCountUp(end: number | null, duration = 600) {
  const shouldReduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(() =>
    shouldReduceMotion ? (end ?? 0) : 0,
  )
  const raf = useRef(0)

  useEffect(() => {
    if (end === null || shouldReduceMotion) return
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * end!))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [end, duration, shouldReduceMotion])

  if (end === null) return null
  if (shouldReduceMotion) return end
  return display
}
