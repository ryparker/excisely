'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Loader2, Upload, XCircle } from 'lucide-react'
import pLimit from 'p-limit'

import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog'
import { pluralize } from '@/lib/pluralize'
import { csvRowToLabelInput } from '@/lib/validators/csv-row-schema'
import { batchSubmitRow } from '@/app/actions/batch-submit'
import {
  useBatchUploadStore,
  type BatchRow,
  type RowProcessingStatus,
} from '@/stores/useBatchUploadStore'

const CONCURRENCY = 3

const STATUS_ICON: Record<RowProcessingStatus, React.ReactNode> = {
  pending: <Clock className="size-4 text-muted-foreground" />,
  uploading: <Upload className="size-4 animate-pulse text-primary" />,
  processing: <Loader2 className="size-4 animate-spin text-primary" />,
  success: (
    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
  ),
  error: <XCircle className="size-4 text-destructive" />,
}

export function BatchProgressDialog() {
  const {
    phase,
    rows,
    imageFiles,
    rowProcessingStatus,
    setRowProcessingStatus,
    setRowResult,
    setPhase,
  } = useBatchUploadStore()

  const processingRef = useRef(false)

  // Live elapsed timer
  const startRef = useRef<number>(performance.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (phase !== 'processing') return
    startRef.current = performance.now()
    let raf: number
    function tick() {
      setElapsedMs(performance.now() - startRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const elapsedDisplay = (elapsedMs / 1000).toFixed(1)

  // Only rows that are both CSV-valid and have all images uploaded
  const validRows = rows.filter(
    (r) =>
      r.errors.length === 0 && r.imageFilenames.every((f) => imageFiles.has(f)),
  )
  const total = validRows.length
  const completed = Array.from(rowProcessingStatus.values()).filter(
    (s) => s === 'success' || s === 'error',
  ).length
  const errorCount = Array.from(rowProcessingStatus.values()).filter(
    (s) => s === 'error',
  ).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const isComplete = completed === total && total > 0

  const processRow = useCallback(
    async (row: BatchRow) => {
      try {
        // 1. Upload images
        setRowProcessingStatus(row.index, 'uploading')
        const imageUrls: string[] = []
        for (const filename of row.imageFilenames) {
          const file = imageFiles.get(filename)
          if (!file) throw new Error(`Missing image: ${filename}`)
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/blob/upload', {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: formData,
          })
          if (!res.ok) throw new Error(`Upload failed: ${filename}`)
          const { url } = await res.json()
          imageUrls.push(url)
        }

        // 2. Submit via server action
        setRowProcessingStatus(row.index, 'processing')
        const input = csvRowToLabelInput(row.data)
        const result = await batchSubmitRow({ data: input, imageUrls })

        if (result.success) {
          setRowProcessingStatus(row.index, 'success')
          setRowResult(row.index, {
            status: 'success',
            labelId: result.labelId,
          })
        } else {
          setRowProcessingStatus(row.index, 'error')
          setRowResult(row.index, {
            status: 'error',
            error: result.error,
          })
        }
      } catch (err) {
        setRowProcessingStatus(row.index, 'error')
        setRowResult(row.index, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    },
    [imageFiles, setRowProcessingStatus, setRowResult],
  )

  useEffect(() => {
    if (phase !== 'processing' || processingRef.current) return
    processingRef.current = true

    const limit = pLimit(CONCURRENCY)

    // Only process rows that haven't already succeeded (supports retry)
    const rowsToProcess = validRows.filter((r) => {
      const status = rowProcessingStatus.get(r.index)
      return status !== 'success'
    })

    // Initialize pending status for rows about to be processed
    for (const row of rowsToProcess) {
      setRowProcessingStatus(row.index, 'pending')
    }

    const promises = rowsToProcess.map((row) => limit(() => processRow(row)))

    Promise.allSettled(promises).then(() => {
      processingRef.current = false
      setPhase('results')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when processing starts
  }, [phase])

  return (
    <AlertDialog open={phase === 'processing'}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Processing Batch</AlertDialogTitle>
          <AlertDialogDescription>
            Completed {completed} of {total}
            {errorCount > 0 && ` \u2014 ${pluralize(errorCount, 'error')}`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Progress value={percent} className="h-2" />
            <div className="flex justify-end">
              <span
                className={`font-mono text-xs tabular-nums ${
                  isComplete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground/70'
                }`}
              >
                {elapsedDisplay}s
              </span>
            </div>
          </div>

          {/* Per-row status list */}
          <div className="max-h-[240px] space-y-1 overflow-auto">
            {validRows.map((row) => {
              const status = rowProcessingStatus.get(row.index) ?? 'pending'
              return (
                <div
                  key={row.index}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm"
                >
                  {STATUS_ICON[status]}
                  <span className="min-w-0 truncate">
                    Row {row.index + 1}: {row.data.brand_name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <AlertDialogFooter>
          <Button disabled={!isComplete} onClick={() => setPhase('results')}>
            {isComplete ? (
              'View Results'
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
