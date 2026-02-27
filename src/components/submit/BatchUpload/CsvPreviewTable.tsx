'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  XCircle,
} from 'lucide-react'

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
import {
  useBatchUploadStore,
  type BatchRow,
} from '@/stores/useBatchUploadStore'

const BEVERAGE_LABELS: Record<string, string> = {
  distilled_spirits: 'Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt',
}

type RowStatus = 'ready' | 'missing_images' | 'invalid'

function getRowStatus(
  row: BatchRow,
  uploadedImages: Map<string, File>,
): RowStatus {
  if (row.errors.length > 0) return 'invalid'
  const allImagesUploaded = row.imageFilenames.every((f) =>
    uploadedImages.has(f),
  )
  if (!allImagesUploaded) return 'missing_images'
  return 'ready'
}

export function CsvPreviewTable() {
  const { rows, invalidCount, setPhase, reset } = useBatchUploadStore()
  const imageFiles = useBatchUploadStore((s) => s.imageFiles)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const { readyCount, missingImagesCount } = useMemo(() => {
    let ready = 0
    let missingImages = 0
    for (const row of rows) {
      const status = getRowStatus(row, imageFiles)
      if (status === 'ready') ready++
      else if (status === 'missing_images') missingImages++
    }
    return { readyCount: ready, missingImagesCount: missingImages }
  }, [rows, imageFiles])

  function toggleRow(index: number) {
    setExpandedRow((prev) => (prev === index ? null : index))
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{pluralize(rows.length, 'row')}:</span>
        {readyCount > 0 && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            {readyCount} ready
          </span>
        )}
        {missingImagesCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            {missingImagesCount} missing images
          </span>
        )}
        {invalidCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="size-3.5" />
            {invalidCount} with errors
          </span>
        )}
      </div>

      {/* Table */}
      <div className="max-h-[400px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead>Brand Name</TableHead>
              <TableHead className="w-20">Images</TableHead>
              <TableHead className="w-20">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <RowWithStatus
                key={row.index}
                row={row}
                imageFiles={imageFiles}
                expanded={expandedRow === row.index}
                onToggle={() => toggleRow(row.index)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => setPhase('processing')}
          disabled={readyCount === 0}
        >
          Submit {pluralize(readyCount, 'Application')}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Start Over
        </Button>
      </div>
    </div>
  )
}

function RowWithStatus({
  row,
  imageFiles,
  expanded,
  onToggle,
}: {
  row: BatchRow
  imageFiles: Map<string, File>
  expanded: boolean
  onToggle: () => void
}) {
  const status = getRowStatus(row, imageFiles)
  const isExpandable = status !== 'ready'
  const brandName = status === 'invalid' ? '(invalid row)' : row.data.brand_name
  const beverageType = status === 'invalid' ? null : row.data.beverage_type

  const missingFiles =
    status === 'missing_images'
      ? row.imageFilenames.filter((f) => !imageFiles.has(f))
      : []

  const uploadedCount = row.imageFilenames.filter((f) =>
    imageFiles.has(f),
  ).length

  return (
    <>
      <TableRow
        className={isExpandable ? 'cursor-pointer' : undefined}
        onClick={isExpandable ? onToggle : undefined}
      >
        <TableCell className="font-mono text-xs text-muted-foreground">
          {isExpandable && (
            <span className="mr-1 inline-block">
              {expanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </span>
          )}
          {row.index + 1}
        </TableCell>
        <TableCell>
          {beverageType && (
            <Badge variant="secondary" className="text-[11px]">
              {BEVERAGE_LABELS[beverageType] ?? beverageType}
            </Badge>
          )}
        </TableCell>
        <TableCell className="max-w-[200px] truncate font-medium">
          {brandName}
        </TableCell>
        <TableCell className="font-variant-numeric text-muted-foreground tabular-nums">
          {uploadedCount}/{row.imageFilenames.length}
        </TableCell>
        <TableCell>
          {status === 'invalid' && (
            <XCircle className="size-4 text-destructive" />
          )}
          {status === 'missing_images' && (
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          )}
          {status === 'ready' && (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </TableCell>
      </TableRow>

      {/* Expandable details */}
      {isExpandable && expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 px-4 py-3">
            <ul className="space-y-1 text-sm">
              {row.errors.map((err, i) => (
                <li key={`err-${i}`} className="text-destructive">
                  <span className="font-medium">{err.field}:</span>{' '}
                  {err.message}
                </li>
              ))}
              {missingFiles.map((f) => (
                <li
                  key={`img-${f}`}
                  className="text-amber-600 dark:text-amber-400"
                >
                  <span className="font-medium">Missing image:</span> {f}
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
