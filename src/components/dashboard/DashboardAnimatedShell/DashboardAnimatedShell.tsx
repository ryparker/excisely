'use client'

import type { ReactNode } from 'react'

import { AutoRefresh } from '@/components/shared/AutoRefresh'
import { PageShell } from '@/components/layout/PageShell'

interface DashboardAnimatedShellProps {
  header: ReactNode
  banner?: ReactNode
  stats: ReactNode
  /** Search + filters + table, grouped as one section for tighter spacing. */
  filters: ReactNode
  table?: ReactNode
}

export function DashboardAnimatedShell({
  header,
  banner,
  stats,
  filters,
  table,
}: DashboardAnimatedShellProps) {
  return (
    <>
      <AutoRefresh />
      <PageShell className="space-y-6" staggerMs={40}>
        {header}
        {banner}
        {stats}
        {filters}
        {table}
      </PageShell>
    </>
  )
}
