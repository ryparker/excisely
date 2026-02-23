'use client'

import type { ReactNode } from 'react'

import { AutoRefresh } from '@/components/shared/auto-refresh'
import { PageShell } from '@/components/layout/page-shell'

interface DashboardAnimatedShellProps {
  header: ReactNode
  stats: ReactNode
  filters: ReactNode
  table: ReactNode
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
      <PageShell className="space-y-5" staggerMs={40}>
        {header}
        {stats}
        {filters}
        {table}
      </PageShell>
    </>
  )
}
