'use client'

import React, { useOptimistic, useState } from 'react'
import { useRouter } from 'next/navigation'
import pLimit from 'p-limit'

import { usePaginationState } from '@/hooks/usePaginationState'
import { reanalyzeLabel } from '@/app/actions/reanalyze-label'
import { batchApprove } from '@/app/actions/batch-approve'
import { useReanalysisStore } from '@/stores/useReanalysisStore'
import { routes } from '@/config/routes'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { BEVERAGE_OPTIONS } from '@/config/beverage-display'
import { DeadlineDisplay } from '@/components/shared/DeadlineDisplay'
import { confidenceColor, formatConfidence, formatDate } from '@/lib/utils'
import { ColumnHeader } from '@/components/shared/ColumnHeader'
import { LabelThumbnail } from '@/components/shared/LabelThumbnail'
import { TablePagination } from '@/components/shared/TablePagination'
import { Highlight } from '@/components/shared/Highlight'
import { BeverageTypeCell } from '@/components/shared/BeverageTypeCell'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'

import type { LabelsTableProps, BulkItemStatus } from './LabelsTableTypes'
import { NON_REANALYZABLE_STATUSES } from './LabelsTableTypes'
import { BulkActionBar } from './BulkActionBar'
import { ConfirmReanalyzeDialog } from './ConfirmReanalyzeDialog'
import { BulkReanalyzeDialog } from './BulkReanalyzeDialog'
import { BatchApproveDialog } from './BatchApproveDialog'

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

  function handleRowReanalyze() {
    if (!confirmLabelId) return
    setRowError(null)
    const labelId = confirmLabelId
    setConfirmLabelId(null)

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

  async function handleBulkReanalyze() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBulkRunning(true)
    const progress = new Map<string, BulkItemStatus>(
      ids.map((id) => [id, 'pending']),
    )
    setBulkProgress(new Map(progress))

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

      <BulkActionBar
        selectedCount={selectedIds.size}
        isReadyQueue={isReadyQueue}
        onClear={() => setSelectedIds(new Set())}
        onApprove={() => setBatchApproveDialogOpen(true)}
        onReanalyze={() => setBulkDialogOpen(true)}
      />

      <ConfirmReanalyzeDialog
        open={confirmLabelId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmLabelId(null)
            setRowError(null)
          }
        }}
        onConfirm={handleRowReanalyze}
        error={rowError}
      />

      <BulkReanalyzeDialog
        open={bulkDialogOpen}
        running={bulkRunning}
        selectedCount={selectedIds.size}
        progress={bulkProgress}
        onOpenChange={setBulkDialogOpen}
        onConfirm={handleBulkReanalyze}
        onClose={handleBulkClose}
      />

      <BatchApproveDialog
        open={batchApproveDialogOpen}
        running={batchApproveRunning}
        selectedCount={selectedIds.size}
        result={batchApproveResult}
        onOpenChange={setBatchApproveDialogOpen}
        onConfirm={handleBatchApprove}
        onClose={handleBatchApproveClose}
      />
    </>
  )
}
