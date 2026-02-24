'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useQueryState } from 'nuqs'

import { searchParamParsers } from '@/lib/search-params'

import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { routes } from '@/config/routes'
import { confidenceColor } from '@/lib/utils'
import { ColumnHeader } from '@/components/shared/column-header'
import { TablePagination } from '@/components/shared/table-pagination'
import { Highlight } from '@/components/shared/highlight'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIErrorRow {
  id: string
  reviewedAt: Date
  originalStatus: string
  resolvedStatus: string
  reviewerNotes: string | null
  fieldName: string
  confidence: string | null
  labelId: string
  brandName: string | null
  specialistName: string | null
}

interface AIErrorsTableProps {
  rows: AIErrorRow[]
  totalPages: number
  tableTotal: number
  pageSize: number
  searchTerm?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  match: {
    label: 'Match',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  mismatch: {
    label: 'Mismatch',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  not_found: {
    label: 'Not Found',
    className: 'bg-secondary text-muted-foreground',
  },
  needs_correction: {
    label: 'Needs Correction',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
}

const FIELD_FILTER_OPTIONS = [
  { label: 'All Fields', value: '' },
  ...Object.entries(FIELD_DISPLAY_NAMES).map(([value, label]) => ({
    label,
    value,
  })),
]

const ERROR_TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Missed Errors', value: 'missed' },
  { label: 'Over-Flagged', value: 'over_flagged' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatReviewDate(date: Date): string {
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIErrorsTable({
  rows,
  totalPages,
  tableTotal,
  pageSize,
  searchTerm = '',
}: AIErrorsTableProps) {
  const [, startTransition] = useTransition()
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    searchParamParsers.page.withOptions({ shallow: false, startTransition }),
  )
  const router = useRouter()

  return (
    <Card className="overflow-clip py-0">
      <Table>
        <TableCaption className="sr-only">
          Fields where specialist review disagreed with AI classification
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <ColumnHeader sortKey="reviewedAt" defaultSort="desc">
              Date
            </ColumnHeader>
            <ColumnHeader sortKey="brandName">Label</ColumnHeader>
            <ColumnHeader
              sortKey="fieldName"
              filterKey="field"
              filterOptions={FIELD_FILTER_OPTIONS}
            >
              Field
            </ColumnHeader>
            <ColumnHeader filterKey="type" filterOptions={ERROR_TYPE_OPTIONS}>
              AI → Specialist
            </ColumnHeader>
            <ColumnHeader sortKey="confidence" className="text-right">
              Confidence
            </ColumnHeader>
            <TableHead className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Specialist
            </TableHead>
            <TableHead className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Notes
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const aiStatus = STATUS_BADGE[row.originalStatus] ?? {
              label: row.originalStatus,
              className: 'bg-secondary text-muted-foreground',
            }
            const specStatus = STATUS_BADGE[row.resolvedStatus] ?? {
              label: row.resolvedStatus,
              className: 'bg-secondary text-muted-foreground',
            }

            return (
              <TableRow
                key={row.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(routes.label(row.labelId))}
              >
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatReviewDate(new Date(row.reviewedAt))}
                </TableCell>
                <TableCell className="max-w-[200px] truncate font-medium">
                  <Highlight
                    text={row.brandName || 'Unknown'}
                    query={searchTerm}
                  />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                  {FIELD_DISPLAY_NAMES[row.fieldName] ?? row.fieldName}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Badge className={aiStatus.className} variant="secondary">
                      {aiStatus.label}
                    </Badge>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                    <Badge className={specStatus.className} variant="secondary">
                      {specStatus.label}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-sm tabular-nums ${confidenceColor(row.confidence)}`}
                >
                  {row.confidence
                    ? `${Math.round(Number(row.confidence))}%`
                    : '--'}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                  {row.specialistName || '--'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.reviewerNotes ? (
                    <Popover>
                      <PopoverTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="max-w-[200px] cursor-pointer truncate text-left underline decoration-muted-foreground/30 underline-offset-2 hover:decoration-muted-foreground"
                        >
                          {row.reviewerNotes}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="left"
                        align="start"
                        className="max-w-sm text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="whitespace-pre-wrap">
                          {row.reviewerNotes}
                        </p>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-muted-foreground/40">--</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        tableTotal={tableTotal}
        pageSize={pageSize}
        entityName="error"
        onPrevious={() =>
          setCurrentPage(currentPage - 1 > 1 ? currentPage - 1 : null)
        }
        onNext={() => setCurrentPage(currentPage + 1)}
        alwaysShowButtons
        className="bg-muted/20"
      />
    </Card>
  )
}
