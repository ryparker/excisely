import { redirect } from 'next/navigation'
import { eq, sql, count, gte, desc, and } from 'drizzle-orm'
import { ShieldCheck, TrendingUp, Users, AlertTriangle } from 'lucide-react'

import { db } from '@/db'
import { labels, users, applicants, humanReviews } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getSLATargets } from '@/lib/settings/get-settings'
import { PageHeader } from '@/components/layout/page-header'
import { StatsCards } from '@/components/dashboard/stats-cards'
import {
  SLAComplianceCard,
  type SLAMetrics,
} from '@/components/admin/sla-compliance-card'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await getSession()
  if (!session) return null

  if (session.user.role !== 'admin') {
    redirect('/')
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    specialistRows,
    todayResult,
    totalResult,
    approvedResult,
    queueResult,
    flaggedApplicants,
    slaTargets,
    avgReviewResponse,
    avgTurnaround,
    autoApprovalResult,
    pendingReviewCount,
  ] = await Promise.all([
    // Per-specialist summary
    db
      .select({
        id: users.id,
        name: users.name,
        totalLabels: count(labels.id),
        approvedCount: count(
          sql`CASE WHEN ${labels.status} = 'approved' THEN 1 END`,
        ),
        pendingReviews: count(
          sql`CASE WHEN ${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved') THEN 1 END`,
        ),
      })
      .from(users)
      .leftJoin(labels, eq(labels.specialistId, users.id))
      .where(eq(users.role, 'specialist'))
      .groupBy(users.id, users.name)
      .orderBy(desc(count(labels.id))),

    // Today's labels
    db
      .select({ total: count() })
      .from(labels)
      .where(gte(labels.createdAt, todayStart)),

    // Total labels
    db.select({ total: count() }).from(labels),

    // Approved labels
    db
      .select({ total: count() })
      .from(labels)
      .where(eq(labels.status, 'approved')),

    // Queue depth (pending_review + needs_correction + conditionally_approved)
    db
      .select({ total: count() })
      .from(labels)
      .where(
        sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
      ),

    // Top flagged applicants (highest rejection/correction rate, min 5 labels)
    db
      .select({
        id: applicants.id,
        companyName: applicants.companyName,
        totalLabels: count(labels.id),
        failedCount: count(
          sql`CASE WHEN ${labels.status} IN ('rejected', 'needs_correction') THEN 1 END`,
        ),
      })
      .from(applicants)
      .innerJoin(labels, eq(labels.applicantId, applicants.id))
      .groupBy(applicants.id, applicants.companyName)
      .having(sql`count(${labels.id}) >= 5`)
      .orderBy(
        desc(
          sql`count(CASE WHEN ${labels.status} IN ('rejected', 'needs_correction') THEN 1 END)::float / count(${labels.id})`,
        ),
      )
      .limit(5),

    // SLA targets from settings
    getSLATargets(),

    // Avg hours from label creation (pending_review) to first human review
    db
      .select({
        avgHours: sql<number>`avg(extract(epoch from ${humanReviews.reviewedAt} - ${labels.createdAt}) / 3600)`,
      })
      .from(humanReviews)
      .innerJoin(labels, eq(humanReviews.labelId, labels.id))
      .where(gte(humanReviews.reviewedAt, thirtyDaysAgo)),

    // Avg hours from label creation to final status (updatedAt)
    db
      .select({
        avgHours: sql<number>`avg(extract(epoch from ${labels.updatedAt} - ${labels.createdAt}) / 3600)`,
      })
      .from(labels)
      .where(
        and(
          gte(labels.updatedAt, thirtyDaysAgo),
          sql`${labels.status} IN ('approved', 'rejected', 'needs_correction', 'conditionally_approved')`,
        ),
      ),

    // Auto-approval: labels approved with no human reviews
    db
      .select({
        total: count(),
        autoApproved: count(
          sql`CASE WHEN ${labels.status} = 'approved' AND NOT EXISTS (
            SELECT 1 FROM human_reviews hr WHERE hr.label_id = ${labels.id}
          ) THEN 1 END`,
        ),
      })
      .from(labels)
      .where(
        and(
          gte(labels.createdAt, thirtyDaysAgo),
          sql`${labels.status} IN ('approved', 'rejected', 'needs_correction', 'conditionally_approved')`,
        ),
      ),

    // Current queue depth (pending_review labels)
    db
      .select({ total: count() })
      .from(labels)
      .where(eq(labels.status, 'pending_review')),
  ])

  const todayCount = todayResult[0]?.total ?? 0
  const totalLabels = totalResult[0]?.total ?? 0
  const approvedCount = approvedResult[0]?.total ?? 0
  const queueDepth = queueResult[0]?.total ?? 0
  const teamApprovalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : 0

  // SLA metrics
  const slaMetrics: SLAMetrics = {
    avgReviewResponseHours: avgReviewResponse[0]?.avgHours ?? null,
    avgTotalTurnaroundHours: avgTurnaround[0]?.avgHours ?? null,
    autoApprovalRate:
      autoApprovalResult[0]?.total && autoApprovalResult[0].total > 0
        ? Math.round(
            (autoApprovalResult[0].autoApproved / autoApprovalResult[0].total) *
              100,
          )
        : null,
    queueDepth: pendingReviewCount[0]?.total ?? 0,
  }

  const stats = [
    {
      label: "Today's Labels",
      value: todayCount,
      icon: ShieldCheck,
      description: 'Across all specialists',
    },
    {
      label: 'Team Approval Rate',
      value: `${teamApprovalRate}%`,
      icon: TrendingUp,
      description: `${approvedCount} of ${totalLabels} approved`,
    },
    {
      label: 'Active Specialists',
      value: specialistRows.filter((s) => s.totalLabels > 0).length,
      icon: Users,
      description: `${specialistRows.length} total specialists`,
    },
    {
      label: 'Queue Depth',
      value: queueDepth,
      icon: AlertTriangle,
      description: 'Labels awaiting review',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Team performance and SLA compliance."
      />

      <StatsCards stats={stats} />

      {/* SLA Compliance */}
      <SLAComplianceCard targets={slaTargets} metrics={slaMetrics} />

      {/* Specialist performance table */}
      <Card>
        <CardHeader>
          <CardTitle>Specialist Summary</CardTitle>
          <CardDescription>
            Individual performance across all labeling specialists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {specialistRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No specialists found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Labels Processed</TableHead>
                  <TableHead className="text-right">Approval Rate</TableHead>
                  <TableHead className="text-right">Pending Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialistRows.map((specialist) => {
                  const approvalRate =
                    specialist.totalLabels > 0
                      ? Math.round(
                          (specialist.approvedCount / specialist.totalLabels) *
                            100,
                        )
                      : 0
                  return (
                    <TableRow key={specialist.id}>
                      <TableCell className="font-medium">
                        {specialist.name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {specialist.totalLabels}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {specialist.totalLabels > 0 ? `${approvalRate}%` : '--'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {specialist.pendingReviews}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top flagged applicants */}
      <Card>
        <CardHeader>
          <CardTitle>Top Flagged Applicants</CardTitle>
          <CardDescription>
            Applicants with the highest rejection or correction rates (minimum 5
            labels).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flaggedApplicants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No applicants with enough labels to analyze.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Total Labels</TableHead>
                  <TableHead className="text-right">Failures</TableHead>
                  <TableHead className="text-right">Failure Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedApplicants.map((applicant) => {
                  const failRate =
                    applicant.totalLabels > 0
                      ? Math.round(
                          (applicant.failedCount / applicant.totalLabels) * 100,
                        )
                      : 0
                  return (
                    <TableRow key={applicant.id}>
                      <TableCell className="font-medium">
                        {applicant.companyName}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {applicant.totalLabels}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {applicant.failedCount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {failRate}%
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
