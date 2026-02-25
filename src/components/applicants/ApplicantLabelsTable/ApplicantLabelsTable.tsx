'use client'

import { useRouter } from 'next/navigation'

import { AnimatedTableRow } from '@/components/shared/AnimatedTableRow'
import { BeverageTypeCell } from '@/components/shared/BeverageTypeCell'
import { ColumnHeader } from '@/components/shared/ColumnHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { BEVERAGE_OPTIONS } from '@/config/beverage-display'
import { routes } from '@/config/routes'
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
            <ColumnHeader
              sortKey="brandName"
              description="The brand name (Item 6) from the COLA application."
            >
              Brand Name
            </ColumnHeader>
            <ColumnHeader
              sortKey="beverageType"
              filterKey="beverageType"
              filterOptions={BEVERAGE_OPTIONS}
              description="Product category — wine, malt beverage, or distilled spirits."
            >
              Beverage Type
            </ColumnHeader>
            <ColumnHeader
              sortKey="overallConfidence"
              className="text-right"
              description="AI verification confidence score for this label."
            >
              Confidence
            </ColumnHeader>
            <ColumnHeader
              sortKey="createdAt"
              defaultSort="desc"
              className="text-right"
              description="Date the application was submitted for review."
            >
              Date
            </ColumnHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labels.map((label, i) => {
            return (
              <AnimatedTableRow
                key={label.id}
                index={i}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(routes.label(label.id))}
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
                  <BeverageTypeCell beverageType={label.beverageType} />
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
