import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, asc, desc } from 'drizzle-orm'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react'

import { db } from '@/db'
import { batches, labels, applicationData } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { ColumnHeader } from '@/components/shared/column-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BatchProgress } from '@/components/batch/batch-progress'

export const dynamic = 'force-dynamic'

interface BatchDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sort?: string; order?: string }>
}

export default async function BatchDetailPage({
  params,
  searchParams,
}: BatchDetailPageProps) {
  await requireSpecialist()

  const { id } = await params
  const sp = await searchParams
  const sortKey = sp.sort ?? ''
  const sortOrder = sp.order === 'asc' ? 'asc' : 'desc'

  // Fetch batch
  const [batch] = await db
    .select()
    .from(batches)
    .where(eq(batches.id, id))
    .limit(1)

  if (!batch) {
    notFound()
  }

  // Map sort keys to DB columns
  const SORT_COLUMNS: Record<
    string,
    | typeof labels.createdAt
    | typeof applicationData.brandName
    | typeof labels.overallConfidence
  > = {
    brandName: applicationData.brandName,
    overallConfidence: labels.overallConfidence,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = sortOrder === 'asc' ? asc(col) : desc(col)
  } else {
    orderByClause = asc(labels.createdAt)
  }

  // Fetch all labels in this batch with their application data
  const batchLabels = await db
    .select({
      id: labels.id,
      status: labels.status,
      overallConfidence: labels.overallConfidence,
      createdAt: labels.createdAt,
      brandName: applicationData.brandName,
      serialNumber: applicationData.serialNumber,
    })
    .from(labels)
    .leftJoin(applicationData, eq(applicationData.labelId, labels.id))
    .where(eq(labels.batchId, id))
    .orderBy(orderByClause)

  const progressPercent =
    batch.totalLabels > 0
      ? Math.round((batch.processedCount / batch.totalLabels) * 100)
      : 0

  const isComplete = batch.status === 'completed' || batch.status === 'failed'
  const batchName = batch.name || `Batch ${batch.id.slice(0, 8)}`

  return (
    <PageShell className="space-y-6">
      {/* Back link + header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/batch">
            <ArrowLeft className="size-4" />
            New Batch Upload
          </Link>
        </Button>

        <PageHeader
          title={batchName}
          description={`${batch.totalLabels} labels submitted for validation`}
        >
          <StatusBadge status={batch.status} className="px-3 py-1 text-sm" />
        </PageHeader>
      </div>

      {/* Progress section */}
      {!isComplete ? (
        <BatchProgress
          batchId={batch.id}
          initialBatch={{
            id: batch.id,
            name: batch.name,
            status: batch.status,
            totalLabels: batch.totalLabels,
            processedCount: batch.processedCount,
            approvedCount: batch.approvedCount,
            conditionallyApprovedCount: batch.conditionallyApprovedCount,
            rejectedCount: batch.rejectedCount,
            needsCorrectionCount: batch.needsCorrectionCount,
            labels: batchLabels.map((l) => ({
              id: l.id,
              status: l.status,
              overallConfidence: l.overallConfidence,
            })),
          }}
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{batch.totalLabels}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle className="size-4" />
                  Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{batch.approvedCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="size-4" />
                  Conditionally Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {batch.conditionallyApprovedCount}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                  <Clock className="size-4" />
                  Needs Correction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {batch.needsCorrectionCount}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                  <XCircle className="size-4" />
                  Rejected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{batch.rejectedCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Completed progress bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between pb-2 text-sm">
                <span className="text-muted-foreground">
                  {batch.processedCount} of {batch.totalLabels} labels processed
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Results Table */}
      <Card className="overflow-clip">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Labels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-16">#</TableHead>
                <ColumnHeader sortKey="brandName">Brand Name</ColumnHeader>
                <TableHead>Serial Number</TableHead>
                <TableHead>Status</TableHead>
                <ColumnHeader
                  sortKey="overallConfidence"
                  className="text-right"
                >
                  Confidence
                </ColumnHeader>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchLabels.map((label, index) => (
                <TableRow key={label.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {label.brandName ?? 'Untitled'}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {label.serialNumber ?? '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={label.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {label.overallConfidence
                      ? `${Number(label.overallConfidence)}%`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {label.status !== 'pending' &&
                      label.status !== 'processing' && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/labels/${label.id}`}>View</Link>
                        </Button>
                      )}
                  </TableCell>
                </TableRow>
              ))}

              {batchLabels.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No labels in this batch.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  )
}
