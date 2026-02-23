'use client'

import { Children, type ReactNode, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

interface PageShellProps {
  children: ReactNode
  className?: string
  /** Delay in ms between each child's entrance. Default: 50 */
  staggerMs?: number
}

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]
const EXIT_EASE: [number, number, number, number] = [0.55, 0, 1, 0.45] // ease-in-quad (reverse feels snappier)
const EXIT_STAGGER_MS = 30

export function PageShell({
  children,
  className,
  staggerMs = 50,
}: PageShellProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const [isExiting, setIsExiting] = useState(false)
  const items = Children.toArray(children)
  const lastIndex = items.length - 1

  useEffect(() => {
    const handler = () => setIsExiting(true)
    window.addEventListener('app-exit', handler)
    return () => window.removeEventListener('app-exit', handler)
  }, [])

  return (
    <div className={className}>
      {items.map((child, index) => (
        <motion.div
          key={(child as React.ReactElement).key ?? index}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={isExiting ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : isExiting
                ? {
                    type: 'tween',
                    duration: 0.2,
                    // Reverse stagger: last child exits first
                    delay: ((lastIndex - index) * EXIT_STAGGER_MS) / 1000,
                    ease: EXIT_EASE,
                  }
                : {
                    type: 'tween',
                    duration: 0.35,
                    delay: (index * staggerMs) / 1000,
                    ease: EASE,
                  }
          }
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
