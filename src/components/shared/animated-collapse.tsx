'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

interface AnimatedCollapseProps {
  visible: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Smoothly animates children in/out with height + opacity.
 * Uses AnimatePresence so the exit animation plays before unmount.
 */
export function AnimatedCollapse({
  visible,
  children,
  className,
}: AnimatedCollapseProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }
          }
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
