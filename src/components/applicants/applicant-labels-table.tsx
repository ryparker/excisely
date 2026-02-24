'use client'

import { useRouter } from 'next/navigation'

import { AnimatedTableRow } from '@/components/shared/animated-table-row'
import { ColumnHeader } from '@/components/shared/column-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BEVERAGE_ICON,
  BEVERAGE_LABEL_FULL,
  BEVERAGE_OPTIONS,
} from '@/config/beverage-display'
import { cn, confidenceColor, formatConfidence, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplicantLabelRow {
  id: string
  effectiveStatus: string
  beverageType: string
  overallConfidence: string | null
  createdAt: Date
  brandName: string | null
}

interface ApplicantLabelsTableProps {
  labels: ApplicantLabelRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApplicantLabelsTable({ labels }: ApplicantLabelsTableProps) {
  const router = useRouter()

  return (
    <Card className="overflow-clip py-0">
      <Table>
        <TableCaption className="sr-only">
          Labels for this applicant
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <ColumnHeader sortKey="brandName">Brand Name</ColumnHeader>
            <ColumnHeader
              sortKey="beverageType"
              filterKey="beverageType"
              filterOptions={BEVERAGE_OPTIONS}
            >
              Beverage Type
            </ColumnHeader>
            <ColumnHeader sortKey="overallConfidence" className="text-right">
              Confidence
            </ColumnHeader>
            <ColumnHeader
              sortKey="createdAt"
              defaultSort="desc"
              className="text-right"
            >
              Date
            </ColumnHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labels.map((label, i) => {
            const BevIcon = BEVERAGE_ICON[label.beverageType]

            return (
              <AnimatedTableRow
                key={label.id}
                index={i}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/labels/${label.id}`)}
              >
                <TableCell>
                  <div className="font-medium">
                    {label.brandName ?? 'Untitled'}
                  </div>
                  <StatusBadge
                    status={label.effectiveStatus}
                    className="mt-1"
                  />
                </TableCell>
                <TableCell>
                  {BevIcon ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <BevIcon className="size-3.5 text-muted-foreground" />
                      <span className="text-xs">
                        {BEVERAGE_LABEL_FULL[label.beverageType] ??
                          label.beverageType}
                      </span>
                    </span>
                  ) : (
                    (BEVERAGE_LABEL_FULL[label.beverageType] ??
                    label.beverageType)
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    confidenceColor(label.overallConfidence),
                  )}
                >
                  {formatConfidence(label.overallConfidence)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {formatDate(label.createdAt)}
                </TableCell>
              </AnimatedTableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
