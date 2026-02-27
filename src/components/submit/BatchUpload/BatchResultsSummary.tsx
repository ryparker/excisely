'use client'

import Link from 'next/link'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { pluralize } from '@/lib/pluralize'
import { useBatchUploadStore } from '@/stores/useBatchUploadStore'

export function BatchResultsSummary() {
  const { rows, rowResults, imageFiles, setPhase, reset } =
    useBatchUploadStore()

  // Same filter as BatchProgressDialog — CSV-valid + all images uploaded
  const validRows = rows.filter(
    (r) =>
      r.errors.length === 0 && r.imageFilenames.every((f) => imageFiles.has(f)),
  )
  const succeeded = validRows.filter(
    (r) => rowResults.get(r.index)?.status === 'success',
  )
  const failed = validRows.filter(
    (r) => rowResults.get(r.index)?.status === 'error',
  )

  function handleRetry() {
    setPhase('processing')
  }

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="flex items-center gap-6 text-sm">
        {succeeded.length > 0 && (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            <span className="font-medium">
              {pluralize(succeeded.length, 'application')} submitted
            </span>
          </span>
        )}
        {failed.length > 0 && (
          <span className="flex items-center gap-1.5 text-destructive">
            <XCircle className="size-4" />
            <span className="font-medium">
              {pluralize(failed.length, 'error')}
            </span>
          </span>
        )}
      </div>

      {/* Results table */}
      <div className="max-h-[360px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Brand Name</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validRows.map((row) => {
              const result = rowResults.get(row.index)
              const isSuccess = result?.status === 'success'
              return (
                <TableRow key={row.index}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.index + 1}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {row.data.brand_name}
                  </TableCell>
                  <TableCell>
                    {isSuccess ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="size-3" />
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="size-3" />
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                    {isSuccess && result?.labelId ? (
                      <Link
                        href={`/submissions/${result.labelId}`}
                        className="text-primary hover:underline"
                      >
                        View submission
                      </Link>
                    ) : (
                      (result?.error ?? 'Unknown error')
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {failed.length > 0 && (
          <Button variant="outline" onClick={handleRetry}>
            <RefreshCw className="size-3.5" />
            Retry Failed
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/submissions">View Submissions</Link>
        </Button>
        <Button variant="ghost" onClick={reset}>
          Submit Another Batch
        </Button>
      </div>
    </div>
  )
}
