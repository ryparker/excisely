import Link from 'next/link'
import { eq, desc, count } from 'drizzle-orm'
import { ArrowRight, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { labels, applicationData, applicants } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
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

const PAGE_SIZE = 20

const BEVERAGE_TYPE_LABELS: Record<string, string> = {
  distilled_spirits: 'Distilled Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt Beverage',
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
  return `${Math.round(num)}%`
}

interface SubmissionsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function SubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  if (session.user.role !== 'applicant') {
    redirect('/')
  }

  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Find applicant record by email
  const [applicantRecord] = await db
    .select({ id: applicants.id })
    .from(applicants)
    .where(eq(applicants.contactEmail, session.user.email))
    .limit(1)

  // Filter labels by applicant ID or those with no specialist (submitted by applicant)
  const whereClause = applicantRecord
    ? eq(labels.applicantId, applicantRecord.id)
    : // Fallback: show nothing if no applicant record
      eq(labels.id, '__none__')

  const [totalResult, rows] = await Promise.all([
    db.select({ total: count() }).from(labels).where(whereClause),
    db
      .select({
        id: labels.id,
        status: labels.status,
        beverageType: labels.beverageType,
        overallConfidence: labels.overallConfidence,
        correctionDeadline: labels.correctionDeadline,
        deadlineExpired: labels.deadlineExpired,
        createdAt: labels.createdAt,
        brandName: applicationData.brandName,
      })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(whereClause)
      .orderBy(desc(labels.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const total = totalResult[0]?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const labelsWithEffectiveStatus = rows.map((row) => ({
    ...row,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Submissions"
        description="Your submitted COLA applications and their verification results."
      >
        <Button asChild>
          <Link href="/submit">
            <Plus className="size-4" />
            Submit Label
          </Link>
        </Button>
      </PageHeader>

      {labelsWithEffectiveStatus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-sm text-muted-foreground">
              No submissions yet. Start by submitting a COLA application.
            </p>
            <Button asChild>
              <Link href="/submit">
                <Plus className="size-4" />
                Submit Label
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Brand Name</TableHead>
                <TableHead>Beverage Type</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labelsWithEffectiveStatus.map((label) => (
                <TableRow key={label.id}>
                  <TableCell>
                    <StatusBadge status={label.effectiveStatus} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {label.brandName ?? 'Untitled'}
                  </TableCell>
                  <TableCell>
                    {BEVERAGE_TYPE_LABELS[label.beverageType] ??
                      label.beverageType}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatConfidence(label.overallConfidence)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(label.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/submissions/${label.id}`}>
                        View
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of{' '}
                {total} submissions
              </p>
              <div className="flex items-center gap-2">
                {currentPage > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/submissions?page=${currentPage - 1}`}>
                      Previous
                    </Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/submissions?page=${currentPage + 1}`}>
                      Next
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
