import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'

import { routes } from '@/config/routes'
import { db } from '@/db'
import { labels } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getSLATargets } from '@/lib/settings/get-settings'
import { fetchSLAMetrics } from '@/lib/sla/queries'
import { getSLAStatus, worstSLAStatus, type SLAStatus } from '@/lib/sla/status'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { ParallelRouteGuard } from '@/components/layout/parallel-route-guard'

export default async function AppLayout({
  children,
  specialist,
  applicant,
}: Readonly<{
  children: React.ReactNode
  specialist: React.ReactNode
  applicant: React.ReactNode
}>) {
  const session = await getSession()

  if (!session) {
    redirect(routes.login())
  }

  const { user } = session
  const userRole = user.role as 'specialist' | 'applicant'

  // Pending review count for sidebar badge + lightweight SLA health check
  let reviewCount = 0
  let slaHealth: SLAStatus = 'green'

  if (userRole !== 'applicant') {
    try {
      const [pendingResult, slaMetrics, slaTargets] = await Promise.all([
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(labels)
          .where(
            sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
          ),
        fetchSLAMetrics(),
        getSLATargets(),
      ])

      reviewCount = pendingResult[0]?.total ?? 0

      const statuses: SLAStatus[] = [
        getSLAStatus(slaMetrics.queueDepth, slaTargets.maxQueueDepth),
      ]
      if (slaMetrics.avgReviewResponseHours !== null) {
        statuses.push(
          getSLAStatus(
            slaMetrics.avgReviewResponseHours,
            slaTargets.reviewResponseHours,
          ),
        )
      }
      if (slaMetrics.avgTotalTurnaroundHours !== null) {
        statuses.push(
          getSLAStatus(
            slaMetrics.avgTotalTurnaroundHours,
            slaTargets.totalTurnaroundHours,
          ),
        )
      }
      if (slaMetrics.autoApprovalRate !== null) {
        statuses.push(
          getSLAStatus(
            slaMetrics.autoApprovalRate,
            slaTargets.autoApprovalRateTarget,
            false,
          ),
        )
      }
      slaHealth = worstSLAStatus(statuses)
    } catch (error) {
      console.error('[Layout] Failed to fetch sidebar data:', error)
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4 focus:text-foreground"
      >
        Skip to main content
      </a>
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
      <main id="main" className="min-w-0 flex-1 px-4 py-4 md:px-8 md:py-6">
        <ParallelRouteGuard showAtRoot>
          {userRole === 'specialist' ? specialist : applicant}
        </ParallelRouteGuard>
        <ParallelRouteGuard showAtRoot={false}>{children}</ParallelRouteGuard>
      </main>
    </div>
  )
}
