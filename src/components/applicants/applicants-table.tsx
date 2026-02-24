'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { useQueryState, parseAsInteger } from 'nuqs'

import { ColumnHeader } from '@/components/shared/column-header'
import { Highlight } from '@/components/shared/highlight'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplicantRow {
  id: string
  companyName: string
  contactEmail: string | null
  totalLabels: number
  approvalRate: number | null
  topReason: string | null
  lastSubmission: Date | null
}

interface ApplicantsTableProps {
  rows: ApplicantRow[]
  totalPages: number
  tableTotal: number
  pageSize: number
  searchTerm: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RISK_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Low Risk', value: 'low' },
  { label: 'Medium Risk', value: 'medium' },
  { label: 'High Risk', value: 'high' },
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

function approvalRateColor(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground/40'
  if (rate >= 90) return 'text-green-600 dark:text-green-400'
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApplicantsTable({
  rows,
  totalPages,
  tableTotal,
  pageSize,
  searchTerm,
}: ApplicantsTableProps) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [, startTransition] = useTransition()
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger
      .withDefault(1)
      .withOptions({ shallow: false, startTransition }),
  )

  const offset = (currentPage - 1) * pageSize

  return (
    <Card className="overflow-clip py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <ColumnHeader sortKey="companyName">Company Name</ColumnHeader>
            <ColumnHeader sortKey="totalLabels" className="text-right">
              Total Labels
            </ColumnHeader>
            <ColumnHeader sortKey="approvalRate" className="text-right">
              Approval Rate
            </ColumnHeader>
            <ColumnHeader filterKey="risk" filterOptions={RISK_OPTIONS}>
              Risk
            </ColumnHeader>
            <ColumnHeader
              sortKey="lastSubmission"
              defaultSort="desc"
              className="text-right"
            >
              Last Submission
            </ColumnHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((applicant, i) => {
            const RowTag = shouldReduceMotion ? 'tr' : motion.tr

            return (
              <RowTag
                key={applicant.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/applicants/${applicant.id}`)}
                {...(!shouldReduceMotion && {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: {
                    duration: 0.2,
                    delay: i * 0.02,
                  },
                })}
              >
                <TableCell className="font-medium">
                  <Highlight text={applicant.companyName} query={searchTerm} />
                  {applicant.contactEmail && (
                    <div className="text-xs text-muted-foreground">
                      {applicant.contactEmail}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {applicant.totalLabels}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    approvalRateColor(applicant.approvalRate),
                  )}
                >
                  {applicant.approvalRate !== null
                    ? `${applicant.approvalRate}%`
                    : '--'}
                </TableCell>
                <TableCell>
                  {getRiskBadge(applicant.approvalRate)}
                  {applicant.topReason && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {applicant.topReason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {applicant.lastSubmission
                    ? formatDate(new Date(applicant.lastSubmission))
                    : '--'}
                </TableCell>
              </RowTag>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-6 py-3">
        <p className="text-xs text-muted-foreground">
          {totalPages > 1
            ? `Showing ${offset + 1}\u2013${Math.min(offset + pageSize, tableTotal)} of ${tableTotal} applicants`
            : `${tableTotal} applicant${tableTotal !== 1 ? 's' : ''}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {currentPage > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage(currentPage - 1 > 1 ? currentPage - 1 : null)
                }
              >
                Previous
              </Button>
            )}
            {currentPage < totalPages && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
