'use client'

import type { ReactNode } from 'react'

import { AutoRefresh } from '@/components/shared/AutoRefresh'
import { PageShell } from '@/components/layout/PageShell'

interface DashboardAnimatedShellProps {
  header: ReactNode
  stats: ReactNode
  /** Search + filters + table, grouped as one section for tighter spacing. */
  filters: ReactNode
  table?: ReactNode
}

export function DashboardAnimatedShell({
  header,
  stats,
  filters,
  table,
}: DashboardAnimatedShellProps) {
  return (
    <>
      <AutoRefresh />
      <PageShell className="space-y-6" staggerMs={40}>
        {header}
        {stats}
        {filters}
        {table}
      </PageShell>
    </>
  )
}
