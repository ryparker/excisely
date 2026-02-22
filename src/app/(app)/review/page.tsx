import Link from 'next/link'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { ArrowRight, ClipboardList } from 'lucide-react'

import { db } from '@/db'
import {
  labels,
  applicationData,
  validationItems,
  validationResults,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import {
  getEffectiveStatus,
  getDeadlineInfo,
} from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

const URGENCY_COLORS: Record<string, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  expired: 'text-destructive',
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatConfidence(value: string | null): string {
  if (!value) return '--'
  const num = Number(value)
  return `${Math.round(num * 100)}%`
}

function formatDeadline(deadline: Date | null): React.ReactNode {
  const info = getDeadlineInfo(deadline)
  if (!info) return '--'

  const colorClass = URGENCY_COLORS[info.urgency] ?? 'text-muted-foreground'

  if (info.urgency === 'expired') {
    return <span className={colorClass}>Expired</span>
  }

  return (
    <span className={colorClass}>
      {info.daysRemaining} day{info.daysRemaining !== 1 ? 's' : ''}
    </span>
  )
}

export default async function ReviewQueuePage() {
  const session = await getSession()
  if (!session) return null

  // Query labels that need review: needs_correction or conditionally_approved
  // with unresolved (needs_correction) validation items
  const rows = await db
    .select({
      id: labels.id,
      status: labels.status,
      overallConfidence: labels.overallConfidence,
      correctionDeadline: labels.correctionDeadline,
      deadlineExpired: labels.deadlineExpired,
      isPriority: labels.isPriority,
      createdAt: labels.createdAt,
      brandName: applicationData.brandName,
      flaggedCount: count(validationItems.id),
    })
    .from(labels)
    .innerJoin(applicationData, eq(labels.id, applicationData.labelId))
    .innerJoin(
      validationResults,
      and(
        eq(validationResults.labelId, labels.id),
        eq(validationResults.isCurrent, true),
      ),
    )
    .innerJoin(
      validationItems,
      and(
        eq(validationItems.validationResultId, validationResults.id),
        sql`${validationItems.status} IN ('needs_correction', 'mismatch', 'not_found')`,
      ),
    )
    .where(
      sql`${labels.status} IN ('needs_correction', 'conditionally_approved')`,
    )
    .groupBy(
      labels.id,
      labels.status,
      labels.overallConfidence,
      labels.correctionDeadline,
      labels.deadlineExpired,
      labels.isPriority,
      labels.createdAt,
      applicationData.brandName,
    )
    .orderBy(desc(labels.isPriority), labels.createdAt)

  const labelsWithEffectiveStatus = rows.map((row) => ({
    ...row,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  // Filter out labels whose effective status has expired to rejected
  const reviewableLabels = labelsWithEffectiveStatus.filter(
    (label) =>
      label.effectiveStatus === 'needs_correction' ||
      label.effectiveStatus === 'conditionally_approved',
  )

  const queueCount = reviewableLabels.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Labels requiring specialist review and resolution."
      >
        <Badge variant="secondary" className="text-sm">
          {queueCount} pending
        </Badge>
      </PageHeader>

      {reviewableLabels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="mb-4 size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No labels waiting for review. All caught up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Brand Name</TableHead>
                <TableHead className="text-right">Flagged Fields</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewableLabels.map((label) => (
                <TableRow key={label.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={label.effectiveStatus} />
                      {label.isPriority && (
                        <Badge
                          variant="outline"
                          className="border-red-300 text-red-600 dark:border-red-800 dark:text-red-400"
                        >
                          Priority
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {label.brandName ?? 'Untitled'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {label.flaggedCount}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatConfidence(label.overallConfidence)}
                  </TableCell>
                  <TableCell>
                    {formatDeadline(label.correctionDeadline)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(label.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/review/${label.id}`}>
                        Review
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
