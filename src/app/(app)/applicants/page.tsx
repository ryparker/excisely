import Link from 'next/link'
import { desc, eq, sql, count } from 'drizzle-orm'
import { ArrowRight, Building2, Search } from 'lucide-react'

import { db } from '@/db'
import { applicants, labels } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getRiskBadge(approvalRate: number | null) {
  if (approvalRate === null) {
    return (
      <Badge variant="secondary" className="text-xs">
        No data
      </Badge>
    )
  }

  if (approvalRate >= 90) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400">
        Low Risk
      </Badge>
    )
  }

  if (approvalRate >= 70) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400">
        Medium Risk
      </Badge>
    )
  }

  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400">
      High Risk
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ApplicantsPageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function ApplicantsPage({
  searchParams,
}: ApplicantsPageProps) {
  const session = await getSession()
  if (!session) return null

  const params = await searchParams
  const searchTerm = params.search?.trim() ?? ''

  // Query applicants with aggregated label stats
  const rows = await db
    .select({
      id: applicants.id,
      companyName: applicants.companyName,
      contactEmail: applicants.contactEmail,
      createdAt: applicants.createdAt,
      totalLabels: count(labels.id),
      approvedCount: sql<number>`count(case when ${labels.status} = 'approved' then 1 end)`,
      lastSubmission: sql<Date | null>`max(${labels.createdAt})`,
    })
    .from(applicants)
    .leftJoin(labels, eq(applicants.id, labels.applicantId))
    .where(
      searchTerm
        ? sql`lower(${applicants.companyName}) like ${`%${searchTerm.toLowerCase()}%`}`
        : undefined,
    )
    .groupBy(applicants.id)
    .orderBy(desc(applicants.createdAt))

  const applicantsWithStats = rows.map((row) => {
    const approvalRate =
      row.totalLabels > 0
        ? Math.round((row.approvedCount / row.totalLabels) * 100)
        : null
    return { ...row, approvalRate }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Companies that have submitted labels for verification."
      >
        <Badge variant="secondary" className="text-sm">
          {applicantsWithStats.length} total
        </Badge>
      </PageHeader>

      {/* Search */}
      <form className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Search by company name..."
            defaultValue={searchTerm}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
        {searchTerm && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/applicants">Clear</Link>
          </Button>
        )}
      </form>

      {applicantsWithStats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? `No applicants found matching "${searchTerm}".`
                : 'No applicants yet. Applicants are created when submitting labels for verification.'}
            </p>
            {searchTerm && (
              <Button variant="ghost" size="sm" className="mt-2" asChild>
                <Link href="/applicants">Clear search</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead className="text-right">Total Labels</TableHead>
                <TableHead className="text-right">Approval Rate</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Last Submission</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicantsWithStats.map((applicant) => (
                <TableRow key={applicant.id}>
                  <TableCell className="font-medium">
                    {applicant.companyName}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {applicant.totalLabels}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {applicant.approvalRate !== null
                      ? `${applicant.approvalRate}%`
                      : '--'}
                  </TableCell>
                  <TableCell>{getRiskBadge(applicant.approvalRate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {applicant.lastSubmission
                      ? formatDate(new Date(applicant.lastSubmission))
                      : '--'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/applicants/${applicant.id}`}>
                        View
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
