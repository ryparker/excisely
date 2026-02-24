'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_INTERVAL_MS = 30_000

export function AutoRefresh({
  intervalMs = DEFAULT_INTERVAL_MS,
}: {
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
