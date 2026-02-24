'use client'

import { useRouter } from 'next/navigation'

import { usePaginationState } from '@/hooks/use-pagination-state'

import { AnimatedTableRow } from '@/components/shared/animated-table-row'
import { ColumnHeader } from '@/components/shared/column-header'
import { TablePagination } from '@/components/shared/table-pagination'
import { Highlight } from '@/components/shared/highlight'
import { RiskBadge } from '@/components/applicants/risk-badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { routes } from '@/config/routes'
import { cn, confidenceColor, formatDate } from '@/lib/utils'

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
  const { currentPage, onPrevious, onNext } = usePaginationState()

  return (
    <Card className="overflow-clip py-0">
      <Table>
        <TableCaption className="sr-only">Registered applicants</TableCaption>
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
            return (
              <AnimatedTableRow
                key={applicant.id}
                index={i}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(routes.applicant(applicant.id))}
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
                    confidenceColor(applicant.approvalRate),
                  )}
                >
                  {applicant.approvalRate !== null
                    ? `${applicant.approvalRate}%`
                    : '--'}
                </TableCell>
                <TableCell>
                  <RiskBadge approvalRate={applicant.approvalRate} />
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
        entityName="applicant"
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </Card>
  )
}
