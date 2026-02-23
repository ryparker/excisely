'use client'

import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Beer,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  Loader2,
  Martini,
  Package,
  Sparkles,
  Trash2,
  Upload,
  Wine,
  X,
  XCircle,
} from 'lucide-react'

import {
  submitBatchApplication,
  type BatchLabelInput,
} from '@/app/actions/submit-batch-application'
import { extractFieldsFromImage } from '@/app/actions/extract-fields-from-image'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { type BeverageType } from '@/config/beverage-types'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import { MAX_FILE_SIZE } from '@/lib/validators/file-schema'
import { parseLabelCsv } from '@/lib/csv/parse-label-csv'
import {
  useBatchUploadStore,
  createBatchItemId,
  type BatchItem,
} from '@/stores/batch-upload-store'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 50

const ACCEPT_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const BEVERAGE_TYPE_OPTIONS: Array<{
  value: BeverageType
  label: string
  icon: typeof Wine
}> = [
  { value: 'distilled_spirits', label: 'Spirits', icon: Martini },
  { value: 'wine', label: 'Wine', icon: Wine },
  { value: 'malt_beverage', label: 'Malt', icon: Beer },
]

/** Display labels for extracted fields */
const FIELD_LABELS: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  name_and_address: 'Name & Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation',
  vintage_year: 'Vintage Year',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distillation',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApplicantBatchUpload() {
  const router = useRouter()
  const csvInputRef = useRef<HTMLInputElement>(null)

  const {
    items,
    overallStatus,
    progress,
    addItems,
    removeItem,
    clearAll,
    updateItem,
    updateItemField,
    setBeverageType,
    setContainerSize,
    setOverallStatus,
    setProgress,
  } = useBatchUploadStore()

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  // -------------------------------------------------------------------------
  // File drop handling
  // -------------------------------------------------------------------------

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remaining = MAX_BATCH_SIZE - items.length
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_BATCH_SIZE} labels per batch`)
        return
      }

      const filesToAdd = acceptedFiles.slice(0, remaining)
      if (filesToAdd.length < acceptedFiles.length) {
        toast.warning(
          `Only ${filesToAdd.length} of ${acceptedFiles.length} files added (batch limit: ${MAX_BATCH_SIZE})`,
        )
      }

      const newItems: BatchItem[] = filesToAdd.map((file) => ({
        id: createBatchItemId(),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
        imageUrl: null,
        error: null,
        extractedFields: {},
        editedFields: {},
        detectedBeverageType: null,
        beverageType: null,
        containerSizeMl: null,
        fields: [],
        labelId: null,
      }))

      addItems(newItems)
    },
    [items.length, addItems],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_MAP,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    onDropRejected: (rejections) => {
      for (const rejection of rejections) {
        const error = rejection.errors[0]
        if (error?.code === 'file-too-large') {
          toast.error(`${rejection.file.name} exceeds the 10 MB limit`)
        } else if (error?.code === 'file-invalid-type') {
          toast.error(`${rejection.file.name} is not a supported image format`)
        } else {
          toast.error(`${rejection.file.name}: ${error?.message}`)
        }
      }
    },
  })

  // -------------------------------------------------------------------------
  // CSV import — apply supplementary data to uploaded images
  // -------------------------------------------------------------------------

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const result = parseLabelCsv(text)

      if (result.errors.length > 0) {
        for (const err of result.errors.slice(0, 5)) {
          toast.error(`Row ${err.rowNumber}: ${err.message}`)
        }
        if (result.errors.length > 5) {
          toast.error(`...and ${result.errors.length - 5} more errors`)
        }
      }

      if (result.unmappedColumns.length > 0) {
        toast.warning(`Unmapped columns: ${result.unmappedColumns.join(', ')}`)
      }

      if (result.rows.length > 0) {
        // Apply CSV data to items in order — overwrite any empty fields
        const targetItems = items.filter(
          (item) =>
            Object.keys(item.extractedFields).length === 0 &&
            Object.keys(item.editedFields).length === 0,
        )

        const rowCount = Math.min(result.rows.length, targetItems.length)
        for (let i = 0; i < rowCount; i++) {
          const item = targetItems[i]
          const row = result.rows[i]

          const beverageType = row.fields.beverage_type as
            | BeverageType
            | undefined
          const containerSize = row.fields.container_size_ml
            ? Number(row.fields.container_size_ml)
            : null

          updateItem(item.id, {
            extractedFields: row.fields,
            beverageType: beverageType ?? null,
            containerSizeMl: containerSize,
          })
        }

        toast.success(
          `Applied CSV data to ${rowCount} label${rowCount !== 1 ? 's' : ''}`,
        )

        if (result.rows.length > targetItems.length) {
          toast.info(
            `${result.rows.length - targetItems.length} CSV rows had no matching image`,
          )
        }
      }
    }

    reader.readAsText(file)
    e.target.value = ''
  }

  // -------------------------------------------------------------------------
  // Upload + Extract — uploads each image and runs AI extraction
  // -------------------------------------------------------------------------

  async function handleUploadAndExtract() {
    const pendingItems = items.filter(
      (i) => i.status === 'pending' || i.status === 'error',
    )
    if (pendingItems.length === 0) {
      toast.info('All images already processed')
      return
    }

    setOverallStatus('uploading')
    setProgress(0, pendingItems.length)

    let completed = 0

    for (const item of pendingItems) {
      try {
        // Upload image
        updateItem(item.id, { status: 'uploading', error: null })
        const body = new FormData()
        body.append('file', item.file)
        const res = await fetch('/api/blob/upload', { method: 'POST', body })
        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: 'Upload failed' }))
          throw new Error(data.error ?? `Upload failed (${res.status})`)
        }
        const blob: { url: string } = await res.json()
        updateItem(item.id, { status: 'uploaded', imageUrl: blob.url })

        // Run AI extraction
        updateItem(item.id, { status: 'extracting' })
        const extraction = await extractFieldsFromImage({
          imageUrls: [blob.url],
        })

        if (!extraction.success) {
          updateItem(item.id, {
            status: 'extracted',
            error: extraction.error,
          })
        } else {
          const { fields, detectedBeverageType } = extraction.data
          const fieldMap: Record<string, string> = {}
          for (const f of fields) {
            if (f.value) {
              fieldMap[f.fieldName] = f.value
            }
          }

          updateItem(item.id, {
            status: 'extracted',
            extractedFields: fieldMap,
            fields,
            detectedBeverageType: detectedBeverageType as BeverageType | null,
            beverageType:
              (detectedBeverageType as BeverageType | null) ??
              item.beverageType,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed'
        updateItem(item.id, { status: 'error', error: message })
      }

      completed++
      setProgress(completed, pendingItems.length)
    }

    setOverallStatus('ready')
  }

  // -------------------------------------------------------------------------
  // Submit all ready labels as a batch
  // -------------------------------------------------------------------------

  async function handleSubmitAll() {
    const readyItems = items.filter(
      (i) =>
        (i.status === 'extracted' || i.status === 'uploaded') &&
        i.imageUrl &&
        i.beverageType &&
        i.containerSizeMl,
    )

    if (readyItems.length === 0) {
      toast.error(
        'No labels ready to submit. Each label needs an image, beverage type, and container size.',
      )
      return
    }

    setOverallStatus('submitting')
    setProgress(0, readyItems.length)

    for (const item of readyItems) {
      updateItem(item.id, { status: 'submitting' })
    }

    const batchInputs: BatchLabelInput[] = readyItems.map((item) => ({
      imageUrls: [item.imageUrl!],
      beverageType: item.beverageType!,
      containerSizeMl: item.containerSizeMl!,
      fields: {
        ...item.extractedFields,
        ...item.editedFields,
        health_warning:
          item.editedFields.health_warning ??
          item.extractedFields.health_warning ??
          HEALTH_WARNING_FULL,
      },
    }))

    const result = await submitBatchApplication(batchInputs)

    if (!result.success) {
      toast.error(result.error)
      for (const item of readyItems) {
        updateItem(item.id, { status: 'error', error: result.error })
      }
      setOverallStatus('ready')
      return
    }

    // Map results back to items
    let labelIdOffset = 0
    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i]
      const error = result.errors.find((e) => e.index === i)
      if (error) {
        updateItem(item.id, { status: 'error', error: error.error })
      } else {
        updateItem(item.id, {
          status: 'submitted',
          labelId: result.labelIds[labelIdOffset] ?? null,
        })
        labelIdOffset++
      }
    }

    setOverallStatus('done')
    setProgress(result.totalSubmitted, readyItems.length)

    if (result.failedCount > 0) {
      toast.warning(
        `${result.totalSubmitted} labels submitted, ${result.failedCount} failed`,
      )
    } else {
      toast.success(
        `All ${result.totalSubmitted} labels submitted successfully`,
      )
    }
  }

  // -------------------------------------------------------------------------
  // Card expand/collapse
  // -------------------------------------------------------------------------

  function toggleCard(id: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const readyCount = items.filter(
    (i) =>
      (i.status === 'extracted' || i.status === 'uploaded') &&
      i.imageUrl &&
      i.beverageType &&
      i.containerSizeMl,
  ).length

  const submittedCount = items.filter((i) => i.status === 'submitted').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const isProcessing =
    overallStatus === 'uploading' || overallStatus === 'extracting'
  const isSubmitting = overallStatus === 'submitting'

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  function getFieldValue(item: BatchItem, fieldName: string): string {
    return item.editedFields[fieldName] ?? item.extractedFields[fieldName] ?? ''
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Drop zone + CSV import */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Upload Label Images
          </CardTitle>
          <CardDescription>
            Drop up to {MAX_BATCH_SIZE} label images. Each image will be scanned
            and turned into a pre-filled submission card.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30',
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive
                ? 'Drop images here...'
                : 'Drag and drop label images, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, or WebP up to 10 MB each ({items.length}/
              {MAX_BATCH_SIZE})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvInputRef.current?.click()}
            >
              <FileSpreadsheet className="size-4" />
              Import CSV Data
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />

            {items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isProcessing || isSubmitting}
              >
                <Trash2 className="size-4" />
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress bar */}
      {(isProcessing || isSubmitting) && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {isSubmitting
                  ? 'Submitting labels...'
                  : 'Uploading and extracting...'}
              </span>
              <span className="text-muted-foreground">
                {progress.current}/{progress.total} ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="mt-2" />
          </CardContent>
        </Card>
      )}

      {/* Summary badges */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="gap-1.5">
            <Layers className="size-3" />
            {items.length} image{items.length !== 1 ? 's' : ''}
          </Badge>
          {readyCount > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle className="size-3" />
              {readyCount} ready
            </Badge>
          )}
          {submittedCount > 0 && (
            <Badge className="gap-1.5 bg-green-600 hover:bg-green-700">
              <CheckCircle className="size-3" />
              {submittedCount} submitted
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1.5">
              <XCircle className="size-3" />
              {errorCount} failed
            </Badge>
          )}
        </div>
      )}

      {/* Label cards grid */}
      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <BatchItemCard
              key={item.id}
              item={item}
              isExpanded={expandedCards.has(item.id)}
              onToggle={() => toggleCard(item.id)}
              onRemove={() => removeItem(item.id)}
              onBeverageTypeChange={(type) => setBeverageType(item.id, type)}
              onContainerSizeChange={(size) => setContainerSize(item.id, size)}
              onFieldChange={(fieldName, value) =>
                updateItemField(item.id, fieldName, value)
              }
              getFieldValue={(fieldName) => getFieldValue(item, fieldName)}
            />
          ))}
        </div>
      )}

      {/* Sticky action bar */}
      {items.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-between gap-4 border-t bg-background/95 px-1 py-4 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            {overallStatus === 'done'
              ? `${submittedCount} label${submittedCount !== 1 ? 's' : ''} submitted`
              : `${items.length} label${items.length !== 1 ? 's' : ''} in batch`}
          </p>

          <div className="flex items-center gap-3">
            {overallStatus === 'done' ? (
              <Button onClick={() => router.push('/submissions')}>
                <Package className="size-4" />
                View Submissions
              </Button>
            ) : (
              <>
                {items.some(
                  (i) => i.status === 'pending' || i.status === 'error',
                ) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUploadAndExtract}
                    disabled={isProcessing || isSubmitting}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Upload & Extract
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={readyCount === 0 || isProcessing || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4" />
                      Submit {readyCount > 0 ? `${readyCount} Labels` : 'All'}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BatchItemCard — individual label card
// ---------------------------------------------------------------------------

interface BatchItemCardProps {
  item: BatchItem
  isExpanded: boolean
  onToggle: () => void
  onRemove: () => void
  onBeverageTypeChange: (type: BeverageType) => void
  onContainerSizeChange: (size: number) => void
  onFieldChange: (fieldName: string, value: string) => void
  getFieldValue: (fieldName: string) => string
}

function BatchItemCard({
  item,
  isExpanded,
  onToggle,
  onRemove,
  onBeverageTypeChange,
  onContainerSizeChange,
  onFieldChange,
  getFieldValue,
}: BatchItemCardProps) {
  const brandName = getFieldValue('brand_name')
  const isAiPrefilled = Object.keys(item.extractedFields).length > 0
  const isLocked = item.status === 'submitting' || item.status === 'submitted'

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-shadow',
        item.status === 'submitted' && 'border-green-500/50',
        item.status === 'error' && 'border-destructive/50',
      )}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={isLocked}
        className="hover:text-destructive-foreground absolute top-2 right-2 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground transition-colors hover:bg-destructive active:scale-95 disabled:opacity-50"
        aria-label={`Remove ${item.file.name}`}
      >
        <X className="size-3.5" />
      </button>

      {/* Image thumbnail */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <Image
          src={item.preview}
          alt={item.file.name}
          fill
          className="object-cover"
          unoptimized
        />

        {/* Status overlays */}
        {(item.status === 'uploading' || item.status === 'extracting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium">
              <Loader2 className="size-3.5 animate-spin" />
              {item.status === 'uploading' ? 'Uploading...' : 'Scanning...'}
            </div>
          </div>
        )}

        {item.status === 'submitted' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/10">
            <div className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white">
              <CheckCircle className="size-3.5" />
              Submitted
            </div>
          </div>
        )}

        {item.status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
            <div className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-medium text-white">
              <XCircle className="size-3.5" />
              Error
            </div>
          </div>
        )}
      </div>

      <CardContent className="space-y-3 p-4">
        {/* File name + brand */}
        <div className="space-y-1">
          <p className="truncate text-xs text-muted-foreground">
            {item.file.name}
          </p>
          <p className="truncate text-sm font-medium">
            {brandName || 'Untitled Label'}
            {isAiPrefilled && (
              <Sparkles className="ml-1.5 inline size-3 text-indigo-500" />
            )}
          </p>
        </div>

        {/* Beverage type selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Type of Product</Label>
          <RadioGroup
            value={item.beverageType ?? ''}
            onValueChange={(v) => onBeverageTypeChange(v as BeverageType)}
            className="flex gap-2"
            disabled={isLocked}
          >
            {BEVERAGE_TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
                    item.beverageType === opt.value
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-input hover:bg-accent/50',
                  )}
                >
                  <RadioGroupItem value={opt.value} className="sr-only" />
                  <Icon className="size-3" />
                  {opt.label}
                </label>
              )
            })}
          </RadioGroup>
        </div>

        {/* Container size */}
        <div className="space-y-1.5">
          <Label className="text-xs">Container Size (mL)</Label>
          <Input
            type="number"
            min={1}
            placeholder="e.g., 750"
            value={item.containerSizeMl ?? ''}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v > 0) onContainerSizeChange(v)
            }}
            disabled={isLocked}
            className="h-8 text-sm"
          />
        </div>

        {/* Expand/collapse field details */}
        {(isAiPrefilled || Object.keys(item.editedFields).length > 0) && (
          <>
            <button
              type="button"
              onClick={onToggle}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>
                {
                  Object.keys({
                    ...item.extractedFields,
                    ...item.editedFields,
                  }).length
                }{' '}
                fields detected
              </span>
              {isExpanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>

            {isExpanded && (
              <div className="space-y-2 border-t pt-3">
                {Object.entries(FIELD_LABELS).map(([fieldName, label]) => {
                  const value = getFieldValue(fieldName)
                  if (!value && !item.extractedFields[fieldName]) return null

                  const isMultiline = fieldName === 'name_and_address'

                  return (
                    <div key={fieldName} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {label}
                      </Label>
                      {isMultiline ? (
                        <Textarea
                          rows={2}
                          value={value}
                          onChange={(e) =>
                            onFieldChange(fieldName, e.target.value)
                          }
                          disabled={isLocked}
                          className="h-auto min-h-0 resize-none text-xs"
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) =>
                            onFieldChange(fieldName, e.target.value)
                          }
                          disabled={isLocked}
                          className="h-7 text-xs"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Error message */}
        {item.error && <p className="text-xs text-destructive">{item.error}</p>}
      </CardContent>
    </Card>
  )
}
