'use client'

import { useState, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  FileText,
  Loader2,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useQueryState, parseAsInteger } from 'nuqs'
import pLimit from 'p-limit'

import { reanalyzeLabel } from '@/app/actions/reanalyze-label'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabelRow {
  id: string
  status: string
  effectiveStatus: string
  beverageType: string
  overallConfidence: string | null
  correctionDeadline: Date | null
  deadlineExpired: boolean
  isPriority: boolean
  createdAt: Date
  brandName: string | null
  flaggedCount: number
  thumbnailUrl: string | null
  overrideReasonCode?: string | null
}

interface LabelsTableProps {
  labels: LabelRow[]
  userRole: string
  totalPages: number
  tableTotal: number
  pageSize: number
}

type BulkItemStatus = 'pending' | 'processing' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEVERAGE_TYPE_LABELS: Record<string, string> = {
  distilled_spirits: 'Distilled Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt Beverage',
}

const REVIEWABLE_STATUSES = new Set([
  'pending_review',
  'needs_correction',
  'conditionally_approved',
])

const NON_REANALYZABLE_STATUSES = new Set(['pending', 'processing'])

const URGENCY_COLORS: Record<string, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  expired: 'text-destructive',
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

function formatConfidence(value: string | null): string {
  if (!value) return '--'
  const num = Number(value)
  return `${Math.round(num)}%`
}

function getDeadlineDisplay(deadline: Date | null): React.ReactNode {
  if (!deadline) return '--'
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (daysRemaining <= 0) {
    return <span className={URGENCY_COLORS.expired}>Expired</span>
  }

  let urgency: string
  if (daysRemaining <= 2) urgency = 'red'
  else if (daysRemaining <= 5) urgency = 'amber'
  else urgency = 'green'

  return (
    <span className={URGENCY_COLORS[urgency]}>
      {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Thumbnail with error fallback
// ---------------------------------------------------------------------------

function LabelThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])

  const showImage = src && !failed

  return (
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelsTable({
  labels: rows,
  userRole,
  totalPages,
  tableTotal,
  pageSize,
}: LabelsTableProps) {
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  )
  const router = useRouter()
  const isApplicant = userRole === 'applicant'

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Per-row re-analyze dialog
  const [confirmLabelId, setConfirmLabelId] = useState<string | null>(null)
  const [rowPending, startRowTransition] = useTransition()
  const [rowError, setRowError] = useState<string | null>(null)

  // Bulk re-analyze dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<Map<string, BulkItemStatus>>(
    new Map(),
  )

  // Selectable rows: not pending/processing
  const selectableRows = rows.filter(
    (r) => !NON_REANALYZABLE_STATUSES.has(r.effectiveStatus),
  )
  const selectableIds = new Set(selectableRows.map((r) => r.id))

  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedIds.has(r.id))

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableIds))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Per-row re-analyze
  function handleRowReanalyze() {
    if (!confirmLabelId) return
    setRowError(null)
    startRowTransition(async () => {
      const result = await reanalyzeLabel(confirmLabelId)
      if (result.success) {
        setConfirmLabelId(null)
        router.refresh()
      } else {
        setRowError(result.error)
      }
    })
  }

  // Bulk re-analyze
  async function handleBulkReanalyze() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBulkRunning(true)
    const progress = new Map<string, BulkItemStatus>(
      ids.map((id) => [id, 'pending']),
    )
    setBulkProgress(new Map(progress))

    const limit = pLimit(3)

    await Promise.all(
      ids.map((id) =>
        limit(async () => {
          progress.set(id, 'processing')
          setBulkProgress(new Map(progress))

          const result = await reanalyzeLabel(id)

          progress.set(id, result.success ? 'success' : 'error')
          setBulkProgress(new Map(progress))
        }),
      ),
    )

    setBulkRunning(false)

    // Auto-close after a brief delay if all succeeded
    const allSucceeded = Array.from(progress.values()).every(
      (s) => s === 'success',
    )
    if (allSucceeded) {
      setTimeout(() => {
        setBulkDialogOpen(false)
        setSelectedIds(new Set())
        setBulkProgress(new Map())
        router.refresh()
      }, 800)
    }
  }

  function handleBulkClose() {
    setBulkDialogOpen(false)
    setSelectedIds(new Set())
    setBulkProgress(new Map())
    router.refresh()
  }

  // Bulk progress stats
  const bulkCompleted = Array.from(bulkProgress.values()).filter(
    (s) => s === 'success' || s === 'error',
  ).length
  const bulkErrors = Array.from(bulkProgress.values()).filter(
    (s) => s === 'error',
  ).length
  const bulkTotal = bulkProgress.size
  const bulkPercent =
    bulkTotal > 0 ? Math.round((bulkCompleted / bulkTotal) * 100) : 0

  const offset = (currentPage - 1) * pageSize

  return (
    <>
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {!isApplicant && (
                <TableHead className="w-[40px]">
                  {selectableRows.length > 0 && (
                    <Checkbox
                      checked={allSelectableSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all labels"
                    />
                  )}
                </TableHead>
              )}
              <TableHead className="w-[60px]">Label</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Brand Name</TableHead>
              <TableHead>Beverage Type</TableHead>
              <TableHead className="text-right">Flagged</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((label) => {
              const isReviewable = REVIEWABLE_STATUSES.has(
                label.effectiveStatus,
              )
              const canReanalyze =
                !isApplicant &&
                !NON_REANALYZABLE_STATUSES.has(label.effectiveStatus)
              const isSelected = selectedIds.has(label.id)

              return (
                <TableRow
                  key={label.id}
                  data-state={isSelected ? 'selected' : undefined}
                >
                  {!isApplicant && (
                    <TableCell>
                      {canReanalyze ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(label.id)}
                          aria-label={`Select ${label.brandName ?? 'label'}`}
                        />
                      ) : (
                        <div className="size-4" />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <LabelThumbnail
                      src={label.thumbnailUrl}
                      alt={label.brandName ?? 'Label'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={label.effectiveStatus} />
                      {label.isPriority && (
                        <Badge
                          variant="outline"
                          className="border-red-300 text-red-600 dark:border-red-800 dark:text-red-400"
                        >
                          Priority
                        </Badge>
                      )}
                    </div>
                    {label.overrideReasonCode && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {REASON_CODE_LABELS[label.overrideReasonCode] ??
                          label.overrideReasonCode}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {label.brandName ?? 'Untitled'}
                  </TableCell>
                  <TableCell>
                    {BEVERAGE_TYPE_LABELS[label.beverageType] ??
                      label.beverageType}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {label.flaggedCount > 0 ? label.flaggedCount : '--'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatConfidence(label.overallConfidence)}
                  </TableCell>
                  <TableCell>
                    {getDeadlineDisplay(label.correctionDeadline)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(label.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant={isReviewable ? 'default' : 'ghost'}
                        size="sm"
                        className={
                          isReviewable
                            ? 'h-7 text-xs'
                            : 'h-7 text-xs text-muted-foreground'
                        }
                        asChild
                      >
                        <Link href={`/labels/${label.id}`}>
                          {isReviewable ? 'Review' : 'View'}
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                      {canReanalyze && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">More actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => setConfirmLabelId(label.id)}
                            >
                              <RefreshCw className="size-4" />
                              Re-Analyze
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
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

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          >
            <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3">
              <p className="text-sm font-medium">
                {selectedIds.size} label{selectedIds.size !== 1 ? 's' : ''}{' '}
                selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </button>
                <Button size="sm" onClick={() => setBulkDialogOpen(true)}>
                  <RefreshCw className="size-4" />
                  Re-Analyze Selected
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Per-row re-analyze dialog */}
      <AlertDialog
        open={confirmLabelId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmLabelId(null)
            setRowError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-Analyze Label</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-run the AI pipeline (OCR + classification) on the
              label images. Previous results will be superseded. Typically takes
              2-4 seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rowError && <p className="text-sm text-destructive">{rowError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rowPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRowReanalyze}
              disabled={rowPending}
            >
              {rowPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Re-Analyze'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk re-analyze dialog */}
      <AlertDialog
        open={bulkDialogOpen}
        onOpenChange={(open) => {
          if (!open && !bulkRunning) handleBulkClose()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Re-Analyze {selectedIds.size} Label
              {selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkTotal === 0
                ? `This will re-run the AI pipeline on each selected label. Processing 3 at a time.`
                : `Completed ${bulkCompleted} of ${bulkTotal}${bulkErrors > 0 ? ` \u2014 ${bulkErrors} error${bulkErrors !== 1 ? 's' : ''}` : ''}`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {bulkTotal > 0 && (
            <div className="py-2">
              <Progress value={bulkPercent} className="h-2" />
            </div>
          )}

          <AlertDialogFooter>
            {bulkRunning ? (
              <Button disabled>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </Button>
            ) : bulkCompleted > 0 ? (
              <AlertDialogAction onClick={handleBulkClose}>
                Done
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkReanalyze}>
                  Re-Analyze {selectedIds.size} Label
                  {selectedIds.size !== 1 ? 's' : ''}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
