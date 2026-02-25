'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { usePaginationState } from '@/hooks/usePaginationState'

import {
  FIELD_FILTER_OPTIONS,
  formatFieldName,
} from '@/config/field-display-names'
import {
  VALIDATION_BADGE_LABEL,
  VALIDATION_BADGE_STYLE,
} from '@/config/validation-item-config'
import { routes } from '@/config/routes'
import { confidenceColor, formatReviewDate } from '@/lib/utils'
import { ColumnHeader } from '@/components/shared/ColumnHeader'
import { TablePagination } from '@/components/shared/TablePagination'
import { Highlight } from '@/components/shared/Highlight'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'

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

const ERROR_TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Missed Errors', value: 'missed' },
  { label: 'Over-Flagged', value: 'over_flagged' },
]

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
  const { currentPage, onPrevious, onNext } = usePaginationState()
  const router = useRouter()

  return (
    <Card className="overflow-clip py-0">
      <Table>
        <TableCaption className="sr-only">
          Fields where specialist review disagreed with AI classification
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <ColumnHeader
              sortKey="reviewedAt"
              defaultSort="desc"
              description="Date the labeling specialist reviewed this field."
            >
              Date
            </ColumnHeader>
            <ColumnHeader
              sortKey="brandName"
              description="Brand name of the label where the AI disagreement occurred."
            >
              Label
            </ColumnHeader>
            <ColumnHeader
              sortKey="fieldName"
              filterKey="field"
              filterOptions={FIELD_FILTER_OPTIONS}
              description="The specific Form 5100.31 field the AI misclassified."
            >
              Field
            </ColumnHeader>
            <ColumnHeader
              filterKey="type"
              filterOptions={ERROR_TYPE_OPTIONS}
              description="How the AI classification changed after specialist review."
            >
              AI → Specialist
            </ColumnHeader>
            <ColumnHeader
              sortKey="confidence"
              className="text-right"
              description="AI confidence score for the original classification."
            >
              Confidence
            </ColumnHeader>
            <ColumnHeader description="Labeling specialist who reviewed and corrected this field.">
              Specialist
            </ColumnHeader>
            <ColumnHeader description="Specialist's notes explaining why the AI classification was overridden.">
              Notes
            </ColumnHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const aiStatus = {
              label:
                VALIDATION_BADGE_LABEL[row.originalStatus] ??
                row.originalStatus,
              className:
                VALIDATION_BADGE_STYLE[row.originalStatus] ??
                'bg-secondary text-muted-foreground',
            }
            const specStatus = {
              label:
                VALIDATION_BADGE_LABEL[row.resolvedStatus] ??
                row.resolvedStatus,
              className:
                VALIDATION_BADGE_STYLE[row.resolvedStatus] ??
                'bg-secondary text-muted-foreground',
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
                  {formatFieldName(row.fieldName)}
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
        onPrevious={onPrevious}
        onNext={onNext}
        alwaysShowButtons
        className="bg-muted/20"
      />
    </Card>
  )
}
