'use client'

import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'

import { ColumnHeader } from '@/components/shared/column-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BEVERAGE_ICON, BEVERAGE_LABEL_FULL } from '@/config/beverage-display'
import { cn } from '@/lib/utils'

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
// Constants
// ---------------------------------------------------------------------------

const BEVERAGE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Spirits', value: 'distilled_spirits' },
  { label: 'Wine', value: 'wine' },
  { label: 'Malt Beverage', value: 'malt_beverage' },
]

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

function formatConfidence(value: string | null): string {
  if (!value) return '--'
  const num = Number(value)
  return `${Math.round(num)}%`
}

function confidenceColor(value: string | null): string {
  if (!value) return 'text-muted-foreground/40'
  const num = Number(value)
  if (num >= 90) return 'text-green-600 dark:text-green-400'
  if (num >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApplicantLabelsTable({ labels }: ApplicantLabelsTableProps) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()

  return (
    <Card className="overflow-clip py-0">
      <Table>
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
            const RowTag = shouldReduceMotion ? 'tr' : motion.tr

            return (
              <RowTag
                key={label.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/labels/${label.id}`)}
                {...(!shouldReduceMotion && {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: {
                    duration: 0.2,
                    delay: i * 0.02,
                  },
                })}
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
              </RowTag>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
