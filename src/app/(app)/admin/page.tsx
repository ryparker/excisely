import { redirect } from 'next/navigation'
import { eq, sql, count, gte, desc } from 'drizzle-orm'
import { ShieldCheck, TrendingUp, Users, AlertTriangle } from 'lucide-react'

import { db } from '@/db'
import { labels, users, applicants } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { PageHeader } from '@/components/layout/page-header'
import { StatsCards } from '@/components/dashboard/stats-cards'
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

  const [
    specialistRows,
    todayResult,
    totalResult,
    approvedResult,
    queueResult,
    flaggedApplicants,
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
          sql`CASE WHEN ${labels.status} IN ('needs_correction', 'conditionally_approved') THEN 1 END`,
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

    // Queue depth (needs_correction + conditionally_approved)
    db
      .select({ total: count() })
      .from(labels)
      .where(
        sql`${labels.status} IN ('needs_correction', 'conditionally_approved')`,
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
  ])

  const todayCount = todayResult[0]?.total ?? 0
  const totalLabels = totalResult[0]?.total ?? 0
  const approvedCount = approvedResult[0]?.total ?? 0
  const queueDepth = queueResult[0]?.total ?? 0
  const teamApprovalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : 0

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
        title="Admin Dashboard"
        description="Team performance overview and operational metrics."
      />

      <StatsCards stats={stats} />

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
