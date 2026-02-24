import { redirect } from 'next/navigation'
import { count, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { labels } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getSLATargets } from '@/lib/settings/get-settings'
import { getSLAStatus, worstSLAStatus, type SLAStatus } from '@/lib/sla/status'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { user } = session
  const userRole = user.role as 'specialist' | 'applicant'

  // Pending review count for sidebar badge + lightweight SLA health check
  let reviewCount = 0
  let slaHealth: SLAStatus = 'green'

  if (userRole !== 'applicant') {
    const [pendingResult, queueResult, slaTargets] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(labels)
        .where(
          sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
        ),
      db
        .select({ total: count() })
        .from(labels)
        .where(eq(labels.status, 'pending_review')),
      getSLATargets(),
    ])

    reviewCount = pendingResult[0]?.total ?? 0
    const queueDepth = queueResult[0]?.total ?? 0
    const queueStatus = getSLAStatus(queueDepth, slaTargets.maxQueueDepth)
    slaHealth = worstSLAStatus([queueStatus])
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileHeader
        userRole={userRole}
        reviewCount={reviewCount}
        user={{
          name: user.name,
          email: user.email,
          role: userRole,
        }}
      />
      <AppSidebar
        userRole={userRole}
        reviewCount={reviewCount}
        slaHealth={slaHealth}
        user={{
          name: user.name,
          email: user.email,
          role: userRole,
        }}
      />
      <main className="min-w-0 flex-1 px-4 py-4 md:px-8 md:py-6">
        {children}
      </main>
    </div>
  )
}
