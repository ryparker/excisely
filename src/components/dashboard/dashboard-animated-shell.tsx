'use client'

import { type ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'

const AUTO_REFRESH_INTERVAL_MS = 30_000

interface DashboardAnimatedShellProps {
  header: ReactNode
  stats: ReactNode
  filters: ReactNode
  table: ReactNode
}

const STAGGER_MS = 40
const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

function AnimatedSlot({
  children,
  index,
  skip,
}: {
  children: ReactNode
  index: number
  skip: boolean
}) {
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        skip
          ? { duration: 0 }
          : {
              type: 'tween',
              duration: 0.35,
              delay: (index * STAGGER_MS) / 1000,
              ease: EASE,
            }
      }
    >
      {children}
    </motion.div>
  )
}

export function DashboardAnimatedShell({
  header,
  stats,
  filters,
  table,
}: DashboardAnimatedShellProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const router = useRouter()

  // Auto-refresh server data every 30s (paused when tab is hidden)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [router])

  return (
    <div className="space-y-5">
      <AnimatedSlot index={0} skip={shouldReduceMotion}>
        {header}
      </AnimatedSlot>
      <AnimatedSlot index={1} skip={shouldReduceMotion}>
        {stats}
      </AnimatedSlot>
      <AnimatedSlot index={2} skip={shouldReduceMotion}>
        {filters}
      </AnimatedSlot>
      <AnimatedSlot index={3} skip={shouldReduceMotion}>
        {table}
      </AnimatedSlot>
    </div>
  )
}
