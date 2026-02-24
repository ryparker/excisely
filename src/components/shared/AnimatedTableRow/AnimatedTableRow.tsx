'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

interface AnimatedTableRowProps {
  index: number
  onClick?: () => void
  className?: string
  children: ReactNode
}

export function AnimatedTableRow({
  index,
  onClick,
  className,
  children,
}: AnimatedTableRowProps) {
  const shouldReduceMotion = useReducedMotion()
  const RowTag = shouldReduceMotion ? 'tr' : motion.tr

  return (
    <RowTag
      className={className}
      onClick={onClick}
      {...(!shouldReduceMotion && {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: {
          duration: 0.2,
          delay: index * 0.02,
        },
      })}
    >
      {children}
    </RowTag>
  )
}
