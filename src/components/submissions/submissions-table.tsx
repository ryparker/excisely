'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useQueryState, parseAsInteger } from 'nuqs'

import { ColumnHeader } from '@/components/shared/column-header'
import { Highlight } from '@/components/shared/highlight'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BEVERAGE_ICON, BEVERAGE_LABEL_FULL } from '@/config/beverage-display'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

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

const BEVERAGE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Spirits', value: 'distilled_spirits' },
  { label: 'Wine', value: 'wine' },
  { label: 'Malt Beverage', value: 'malt_beverage' },
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getDeadlineText(deadline: Date | null): React.ReactNode {
  if (!deadline) return null
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days <= 0) {
    return <span className="text-destructive">Expired</span>
  }

  const color =
    days <= 2
      ? 'text-red-600 dark:text-red-400'
      : days <= 5
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'

  return <span className={color}>{days}d remaining</span>
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function LabelThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])
  const openTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [open, setOpen] = useState(false)

  const showImage = src && !failed

  const thumbnail = (
    <div className="size-20 overflow-hidden rounded-lg border bg-muted">
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          onError={onError}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/30">
          <FileText className="size-5" />
        </div>
      )}
    </div>
  )

  if (!showImage) return thumbnail

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={300}
      closeDelay={0}
    >
      <HoverCardTrigger
        asChild
        onMouseEnter={() => {
          openTimerRef.current = setTimeout(() => setOpen(true), 300)
        }}
        onMouseLeave={() => {
          if (openTimerRef.current) clearTimeout(openTimerRef.current)
          setOpen(false)
        }}
      >
        {thumbnail}
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-auto p-1"
        onMouseEnter={() => setOpen(false)}
        onPointerDownOutside={() => setOpen(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-72 max-w-64 rounded object-contain"
        />
      </HoverCardContent>
    </HoverCard>
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

            const RowTag = shouldReduceMotion ? 'tr' : motion.tr

            return (
              <RowTag
                key={row.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/submissions/${row.id}`)}
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
                  <LabelThumbnail
                    src={row.thumbnailUrl}
                    alt={row.brandName ?? 'Label'}
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
              </RowTag>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-6 py-3">
        <p className="text-xs text-muted-foreground">
          {totalPages > 1
            ? `Showing ${offset + 1}\u2013${Math.min(offset + pageSize, tableTotal)} of ${tableTotal} labels`
            : `${tableTotal} label${tableTotal !== 1 ? 's' : ''}`}
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
