import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { routes } from '@/config/routes'
import { getPendingReviewCount } from '@/db/queries/labels'
import { getSLATargets } from '@/db/queries/settings'
import { fetchSLAMetrics } from '@/db/queries/sla'
import { getSession } from '@/lib/auth/get-session'
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
  await connection()
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
      const [pendingCount, slaMetrics, slaTargets] = await Promise.all([
        getPendingReviewCount(),
        fetchSLAMetrics(),
        getSLATargets(),
      ])

      reviewCount = pendingCount

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
