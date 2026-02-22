import Link from 'next/link'
import { eq, count, and, gte, desc } from 'drizzle-orm'
import {
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertCircle,
  Plus,
  History,
  ClipboardList,
} from 'lucide-react'

import { db } from '@/db'
import { labels, applicationData } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const dynamic = 'force-dynamic'

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  const { user } = session
  const isAdmin = user.role === 'admin'
  const ownerFilter = isAdmin ? undefined : eq(labels.specialistId, user.id)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    totalResult,
    todayResult,
    approvedResult,
    needsCorrectionResult,
    recentLabels,
  ] = await Promise.all([
    db.select({ total: count() }).from(labels).where(ownerFilter),
    db
      .select({ total: count() })
      .from(labels)
      .where(
        ownerFilter
          ? and(ownerFilter, gte(labels.createdAt, todayStart))
          : gte(labels.createdAt, todayStart),
      ),
    db
      .select({ total: count() })
      .from(labels)
      .where(
        ownerFilter
          ? and(ownerFilter, eq(labels.status, 'approved'))
          : eq(labels.status, 'approved'),
      ),
    db
      .select({ total: count() })
      .from(labels)
      .where(
        ownerFilter
          ? and(ownerFilter, eq(labels.status, 'needs_correction'))
          : eq(labels.status, 'needs_correction'),
      ),
    db
      .select({
        id: labels.id,
        status: labels.status,
        correctionDeadline: labels.correctionDeadline,
        deadlineExpired: labels.deadlineExpired,
        createdAt: labels.createdAt,
        brandName: applicationData.brandName,
      })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(ownerFilter)
      .orderBy(desc(labels.createdAt))
      .limit(5),
  ])

  const totalLabels = totalResult[0]?.total ?? 0
  const todayCount = todayResult[0]?.total ?? 0
  const approvedCount = approvedResult[0]?.total ?? 0
  const pendingReviews = needsCorrectionResult[0]?.total ?? 0
  const approvalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : 0

  const stats = [
    {
      label: 'Total Processed',
      value: totalLabels,
      icon: ShieldCheck,
      description: isAdmin ? 'All labels' : 'Your labels',
    },
    {
      label: "Today's Validations",
      value: todayCount,
      icon: Clock,
      description: 'Labels validated today',
    },
    {
      label: 'Approval Rate',
      value: `${approvalRate}%`,
      icon: TrendingUp,
      description: 'Approved vs total',
    },
    {
      label: 'Pending Reviews',
      value: pendingReviews,
      icon: AlertCircle,
      description: 'Labels needing correction',
    },
  ]

  const recentWithStatus = recentLabels.map((label) => ({
    ...label,
    effectiveStatus: getEffectiveStatus({
      status: label.status,
      correctionDeadline: label.correctionDeadline,
      deadlineExpired: label.deadlineExpired,
    }),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of label verification activity."
      />

      <StatsCards stats={stats} />

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/validate">
                <Plus className="size-4" />
                Validate New Label
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/history">
                <History className="size-4" />
                View History
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/review">
                <ClipboardList className="size-4" />
                Review Queue
                {pendingReviews > 0 && (
                  <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {pendingReviews}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent validations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Validations</CardTitle>
          <CardDescription>
            Your most recent label verifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentWithStatus.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No validations yet. Start by validating a label.
            </p>
          ) : (
            <div className="space-y-3">
              {recentWithStatus.map((label) => (
                <Link
                  key={label.id}
                  href={`/history/${label.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={label.effectiveStatus} />
                    <span className="text-sm font-medium">
                      {label.brandName ?? 'Untitled'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(label.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
