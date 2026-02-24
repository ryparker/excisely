'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryState, parseAsInteger } from 'nuqs'

import { AnimatedTableRow } from '@/components/shared/animated-table-row'
import { ColumnHeader } from '@/components/shared/column-header'
import { LabelThumbnail } from '@/components/shared/label-thumbnail'
import { TablePagination } from '@/components/shared/table-pagination'
import { Highlight } from '@/components/shared/highlight'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BEVERAGE_ICON,
  BEVERAGE_LABEL_FULL,
  BEVERAGE_OPTIONS,
} from '@/config/beverage-display'
import { getDeadlineInfo } from '@/lib/labels/effective-status'
import { cn, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Column filter options
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Approved', value: 'approved' },
  { label: 'Conditionally Approved', value: 'conditionally_approved' },
  { label: 'Needs Correction', value: 'needs_correction' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Needs Attention', value: 'needs_attention' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmissionRow {
  id: string
  status: string
  effectiveStatus: string
  beverageType: string
  correctionDeadline: Date | null
  createdAt: Date
  brandName: string | null
  fancifulName: string | null
  serialNumber: string | null
  flaggedCount: number
  thumbnailUrl: string | null
}

interface SubmissionsTableProps {
  rows: SubmissionRow[]
  totalPages: number
  tableTotal: number
  pageSize: number
  searchTerm: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const URGENCY_COLORS: Record<string, string> = {
  green: 'text-muted-foreground',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  expired: 'text-destructive',
}

function getDeadlineText(deadline: Date | null): React.ReactNode {
  const info = getDeadlineInfo(deadline)
  if (!info) return null

  if (info.urgency === 'expired') {
    return <span className={URGENCY_COLORS.expired}>Expired</span>
  }

  return (
    <span className={URGENCY_COLORS[info.urgency]}>
      {info.daysRemaining}d remaining
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubmissionsTable({
  rows,
  totalPages,
  tableTotal,
  pageSize,
  searchTerm,
}: SubmissionsTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger
      .withDefault(1)
      .withOptions({ shallow: false, startTransition }),
  )

  return (
    <Card className="overflow-clip py-0">
      <Table>
        <TableCaption className="sr-only">
          Your submitted applications
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[60px]">Label</TableHead>
            <ColumnHeader sortKey="brandName">Brand Name</ColumnHeader>
            <TableHead>Serial Number</TableHead>
            <ColumnHeader filterKey="status" filterOptions={STATUS_OPTIONS}>
              Status
            </ColumnHeader>
            <ColumnHeader
              sortKey="beverageType"
              filterKey="beverageType"
              filterOptions={BEVERAGE_OPTIONS}
            >
              Beverage Type
            </ColumnHeader>
            <ColumnHeader sortKey="flaggedCount" className="text-right">
              Issues
            </ColumnHeader>
            <ColumnHeader
              sortKey="createdAt"
              defaultSort="desc"
              className="text-right"
            >
              Submitted
            </ColumnHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const BevIcon = BEVERAGE_ICON[row.beverageType]
            const deadlineText =
              (row.effectiveStatus === 'needs_correction' ||
                row.effectiveStatus === 'conditionally_approved') &&
              row.correctionDeadline
                ? getDeadlineText(row.correctionDeadline)
                : null

            return (
              <AnimatedTableRow
                key={row.id}
                index={i}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/submissions/${row.id}`)}
              >
                <TableCell>
                  <LabelThumbnail
                    src={row.thumbnailUrl}
                    alt={row.brandName ?? 'Label'}
                    size="size-20"
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    <Highlight
                      text={row.brandName ?? 'Untitled'}
                      query={searchTerm}
                    />
                  </div>
                  {row.fancifulName && (
                    <div className="text-xs text-muted-foreground">
                      <Highlight text={row.fancifulName} query={searchTerm} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.serialNumber ? (
                    <Highlight text={row.serialNumber} query={searchTerm} />
                  ) : (
                    '--'
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.effectiveStatus} />
                  {deadlineText && (
                    <p className="mt-0.5 text-[11px]">{deadlineText}</p>
                  )}
                </TableCell>
                <TableCell>
                  {BevIcon && (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <BevIcon className="size-3.5 text-muted-foreground" />
                      <span className="text-xs">
                        {BEVERAGE_LABEL_FULL[row.beverageType] ??
                          row.beverageType}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono text-sm',
                    row.flaggedCount > 0
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-muted-foreground/40',
                  )}
                >
                  {row.flaggedCount > 0 ? row.flaggedCount : '--'}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {formatDate(row.createdAt)}
                </TableCell>
              </AnimatedTableRow>
            )
          })}
        </TableBody>
      </Table>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        tableTotal={tableTotal}
        pageSize={pageSize}
        entityName="label"
        onPrevious={() =>
          setCurrentPage(currentPage - 1 > 1 ? currentPage - 1 : null)
        }
        onNext={() => setCurrentPage(currentPage + 1)}
      />
    </Card>
  )
}
