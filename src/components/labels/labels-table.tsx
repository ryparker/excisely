'use client'

import React, { useOptimistic, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { usePaginationState } from '@/hooks/use-pagination-state'
import pLimit from 'p-limit'

import { reanalyzeLabel } from '@/app/actions/reanalyze-label'
import { batchApprove } from '@/app/actions/batch-approve'
import { useReanalysisStore } from '@/stores/reanalysis-store'
import { routes } from '@/config/routes'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { BEVERAGE_OPTIONS } from '@/config/beverage-display'
import { DeadlineDisplay } from '@/components/shared/deadline-display'
import { confidenceColor, formatConfidence, formatDate } from '@/lib/utils'
import { ColumnHeader } from '@/components/shared/column-header'
import { LabelThumbnail } from '@/components/shared/label-thumbnail'
import { TablePagination } from '@/components/shared/table-pagination'
import { Highlight } from '@/components/shared/highlight'
import { BeverageTypeCell } from '@/components/shared/beverage-type-cell'
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
  lastReviewedAt?: Date | null
}

interface LabelsTableProps {
  labels: LabelRow[]
  userRole: string
  totalPages: number
  tableTotal: number
  pageSize: number
  queueMode?: 'ready' | 'review'
  searchTerm?: string
}

type BulkItemStatus = 'pending' | 'processing' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NON_REANALYZABLE_STATUSES = new Set(['pending', 'processing'])

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelsTable({
  labels: rows,
  userRole,
  totalPages,
  tableTotal,
  pageSize,
  queueMode,
  searchTerm = '',
}: LabelsTableProps) {
  const { currentPage, onPrevious, onNext } = usePaginationState()
  const router = useRouter()
  const isApplicant = userRole === 'applicant'
  const isReadyQueue = queueMode === 'ready'

  // Optimistic UI for batch approve — immediately show approved status
  const [optimisticLabels, updateOptimisticLabels] = useOptimistic(
    rows,
    (state, approvedIds: string[]) =>
      state.map((label) =>
        approvedIds.includes(label.id)
          ? { ...label, status: 'approved', effectiveStatus: 'approved' }
          : label,
      ),
  )
  const {
    activeIds: reanalyzingIds,
    startReanalyzing,
    stopReanalyzing,
  } = useReanalysisStore()

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Per-row re-analyze dialog
  const [confirmLabelId, setConfirmLabelId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  // Bulk re-analyze dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<Map<string, BulkItemStatus>>(
    new Map(),
  )

  // Batch approve dialog
  const [batchApproveDialogOpen, setBatchApproveDialogOpen] = useState(false)
  const [batchApproveRunning, setBatchApproveRunning] = useState(false)
  const [batchApproveResult, setBatchApproveResult] = useState<{
    approvedCount: number
    failedIds: string[]
  } | null>(null)

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

  // Per-row re-analyze — fire-and-forget with optimistic status update
  function handleRowReanalyze() {
    if (!confirmLabelId) return
    setRowError(null)
    const labelId = confirmLabelId
    setConfirmLabelId(null)

    // Optimistically mark row as processing
    startReanalyzing(labelId)

    reanalyzeLabel(labelId)
      .then((result) => {
        stopReanalyzing(labelId)
        if (!result.success) {
          console.error('Reanalysis failed:', result.error)
        }
        router.refresh()
      })
      .catch(() => {
        stopReanalyzing(labelId)
        router.refresh()
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

    // Optimistically mark all rows as processing
    for (const id of ids) {
      startReanalyzing(id)
    }

    const limit = pLimit(3)

    await Promise.all(
      ids.map((id) =>
        limit(async () => {
          progress.set(id, 'processing')
          setBulkProgress(new Map(progress))

          const result = await reanalyzeLabel(id)

          progress.set(id, result.success ? 'success' : 'error')
          setBulkProgress(new Map(progress))
          stopReanalyzing(id)
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

  // Batch approve selected
  async function handleBatchApprove() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBatchApproveRunning(true)
    setBatchApproveResult(null)
    updateOptimisticLabels(ids)

    const result = await batchApprove(ids)
    setBatchApproveResult({
      approvedCount: result.approvedCount,
      failedIds: result.failedIds,
    })
    setBatchApproveRunning(false)

    // Auto-close on full success
    if (result.failedIds.length === 0) {
      setTimeout(() => {
        setBatchApproveDialogOpen(false)
        setSelectedIds(new Set())
        setBatchApproveResult(null)
        router.refresh()
      }, 800)
    }
  }

  function handleBatchApproveClose() {
    setBatchApproveDialogOpen(false)
    setSelectedIds(new Set())
    setBatchApproveResult(null)
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

  return (
    <>
      <Card className="overflow-clip py-0">
        <Table>
          <TableCaption className="sr-only">
            Labels submitted for verification
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
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
              <ColumnHeader sortKey="brandName">Brand Name</ColumnHeader>
              <ColumnHeader
                sortKey="beverageType"
                filterKey="beverageType"
                filterOptions={BEVERAGE_OPTIONS}
              >
                Beverage Type
              </ColumnHeader>
              {!isApplicant && (
                <ColumnHeader sortKey="flaggedCount" className="text-right">
                  Flagged
                </ColumnHeader>
              )}
              {!isApplicant && (
                <ColumnHeader
                  sortKey="overallConfidence"
                  className="text-right"
                >
                  Confidence
                </ColumnHeader>
              )}
              {!isApplicant && (
                <TableHead className="text-right">Deadline</TableHead>
              )}
              <ColumnHeader
                sortKey="createdAt"
                defaultSort="desc"
                className="text-right"
              >
                {isApplicant ? 'Submitted' : 'Date'}
              </ColumnHeader>
              {isApplicant && (
                <ColumnHeader sortKey="lastReviewedAt" className="text-right">
                  Last Reviewed
                </ColumnHeader>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticLabels.map((label) => {
              const isRowReanalyzing = reanalyzingIds.has(label.id)
              const displayStatus = isRowReanalyzing
                ? 'processing'
                : label.effectiveStatus
              const canReanalyze =
                !isApplicant &&
                !NON_REANALYZABLE_STATUSES.has(displayStatus) &&
                !isRowReanalyzing
              const isSelected = selectedIds.has(label.id)

              return (
                <React.Fragment key={label.id}>
                  <TableRow
                    data-state={isSelected ? 'selected' : undefined}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() =>
                      router.push(
                        isApplicant
                          ? routes.submission(label.id)
                          : routes.label(label.id),
                      )
                    }
                  >
                    {!isApplicant && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canReanalyze || isReadyQueue ? (
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
                        <StatusBadge status={displayStatus} />
                        {!isApplicant &&
                          label.isPriority &&
                          !isRowReanalyzing && (
                            <Badge
                              variant="outline"
                              className="border-red-300 text-red-600 dark:border-red-800 dark:text-red-400"
                            >
                              Priority
                            </Badge>
                          )}
                      </div>
                      {!isApplicant && label.overrideReasonCode && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {REASON_CODE_LABELS[label.overrideReasonCode] ??
                            label.overrideReasonCode}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Highlight
                        text={label.brandName ?? 'Untitled'}
                        query={searchTerm}
                      />
                    </TableCell>
                    <TableCell>
                      <BeverageTypeCell beverageType={label.beverageType} />
                    </TableCell>
                    {!isApplicant && (
                      <TableCell className="text-right font-mono tabular-nums">
                        {label.flaggedCount > 0 ? label.flaggedCount : '--'}
                      </TableCell>
                    )}
                    {!isApplicant && (
                      <TableCell
                        className={`text-right font-mono tabular-nums ${confidenceColor(label.overallConfidence)}`}
                      >
                        {formatConfidence(label.overallConfidence)}
                      </TableCell>
                    )}
                    {!isApplicant && (
                      <TableCell className="text-right">
                        <DeadlineDisplay deadline={label.correctionDeadline} />
                      </TableCell>
                    )}
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatDate(label.createdAt)}
                    </TableCell>
                    {isApplicant && (
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {label.lastReviewedAt ? (
                          formatDate(label.lastReviewedAt)
                        ) : (
                          <span className="text-muted-foreground/40">
                            Pending
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                </React.Fragment>
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
          onPrevious={onPrevious}
          onNext={onNext}
          alwaysShowButtons
          className="bg-muted/20"
        />
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
                {isReadyQueue && (
                  <Button
                    size="sm"
                    onClick={() => setBatchApproveDialogOpen(true)}
                  >
                    <ShieldCheck className="size-4" />
                    Approve Selected ({selectedIds.size})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isReadyQueue ? 'outline' : 'default'}
                  onClick={() => setBulkDialogOpen(true)}
                >
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
              This will re-run AI text extraction and field classification on
              the label images. Previous results will be superseded. No new
              notification will be sent to the applicant. Typically takes 2-4
              seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rowError && <p className="text-sm text-destructive">{rowError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRowReanalyze}>
              Re-Analyze
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

      {/* Batch approve dialog */}
      <AlertDialog
        open={batchApproveDialogOpen}
        onOpenChange={(open) => {
          if (!open && !batchApproveRunning) handleBatchApproveClose()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve {selectedIds.size} Label
              {selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {batchApproveResult
                ? `Approved ${batchApproveResult.approvedCount} label${batchApproveResult.approvedCount !== 1 ? 's' : ''}${batchApproveResult.failedIds.length > 0 ? ` — ${batchApproveResult.failedIds.length} failed` : ''}`
                : `All selected labels have been verified by AI with high confidence and all fields match. This will approve them in bulk with an audit trail.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            {batchApproveRunning ? (
              <Button disabled>
                <Loader2 className="size-4 animate-spin" />
                Approving...
              </Button>
            ) : batchApproveResult ? (
              <AlertDialogAction onClick={handleBatchApproveClose}>
                Done
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBatchApprove}>
                  <Check className="size-4" />
                  Approve {selectedIds.size} Label
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
