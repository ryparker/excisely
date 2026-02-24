'use client'

import { usePathname } from 'next/navigation'

/**
 * Guards parallel route slots against the "sticky slot" behavior during soft
 * navigation. Next.js keeps a slot's previously-rendered content when the new
 * URL doesn't define a page for that slot. This component hides stale content
 * by checking the current pathname.
 *
 * - `showAtRoot` — render children only when pathname is exactly "/"
 * - `!showAtRoot` — render children only when pathname is NOT "/"
 */
export function ParallelRouteGuard({
  children,
  showAtRoot,
}: {
  children: React.ReactNode
  showAtRoot: boolean
}) {
  const pathname = usePathname()
  const isRoot = pathname === '/'

  if (showAtRoot && !isRoot) return null
  if (!showAtRoot && isRoot) return null

  return <>{children}</>
}
