'use client'

import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { upload } from '@vercel/blob/client'
import pLimit from 'p-limit'
import {
  CheckCircle,
  Loader2,
  Upload,
  XCircle,
  X,
  AlertTriangle,
  Wine,
  Beer,
  Martini,
  Layers,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { z } from 'zod'

import { createBatch } from '@/app/actions/create-batch'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  BEVERAGE_TYPES,
  isValidSize,
  type BeverageType,
} from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import { MAX_FILE_SIZE } from '@/lib/validators/file-schema'
import { decodeImageDimensions } from '@/lib/validators/decode-image-dimensions'
import {
  assessImageQuality,
  type ImageQualityResult,
} from '@/lib/validators/image-quality'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileWithPreview {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
  url?: string
  error?: string
  quality?: ImageQualityResult
}

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const batchFormSchema = z.object({
  name: z.string().optional(),
  beverageType: z.enum(['distilled_spirits', 'wine', 'malt_beverage'], {
    message: 'Select a beverage type',
  }),
  containerSizeMl: z
    .number({ message: 'Container size is required' })
    .int()
    .positive(),
  classTypeCode: z.string().optional(),
  serialNumber: z.string().optional(),
  brandName: z.string().min(1, 'Brand Name is required'),
  fancifulName: z.string().optional(),
  classType: z.string().optional(),
  alcoholContent: z.string().optional(),
  netContents: z.string().optional(),
  healthWarning: z.string().optional(),
  nameAndAddress: z.string().optional(),
  qualifyingPhrase: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  grapeVarietal: z.string().optional(),
  appellationOfOrigin: z.string().optional(),
  vintageYear: z.string().optional(),
  sulfiteDeclaration: z.boolean().optional(),
  ageStatement: z.string().optional(),
  stateOfDistillation: z.string().optional(),
})

type BatchFormInput = z.infer<typeof batchFormSchema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILES = 300
const UPLOAD_CONCURRENCY = 5

const BEVERAGE_TYPE_OPTIONS: Array<{
  value: BeverageType
  label: string
  icon: typeof Wine
}> = [
  { value: 'distilled_spirits', label: 'Distilled Spirits', icon: Martini },
  { value: 'wine', label: 'Wine', icon: Wine },
  { value: 'malt_beverage', label: 'Malt Beverages', icon: Beer },
]

const ACCEPT_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchUploadForm() {
  const router = useRouter()
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BatchFormInput>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      name: '',
      beverageType: undefined,
      containerSizeMl: undefined,
      classTypeCode: '',
      serialNumber: '',
      brandName: '',
      fancifulName: '',
      classType: '',
      alcoholContent: '',
      netContents: '',
      healthWarning: HEALTH_WARNING_FULL,
      nameAndAddress: '',
      qualifyingPhrase: '',
      countryOfOrigin: '',
      grapeVarietal: '',
      appellationOfOrigin: '',
      vintageYear: '',
      sulfiteDeclaration: false,
      ageStatement: '',
      stateOfDistillation: '',
    },
  })

  const beverageType = watch('beverageType')
  const containerSizeMl = watch('containerSizeMl')

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const filteredCodes = useMemo(() => {
    if (!beverageType) return []
    return getCodesByBeverageType(beverageType)
  }, [beverageType])

  const standardsOfFillStatus = useMemo(() => {
    if (!beverageType || !containerSizeMl || containerSizeMl <= 0) return null

    if (beverageType === 'malt_beverage') {
      return { valid: true, message: 'Any size permitted' }
    }

    if (isValidSize(beverageType, containerSizeMl)) {
      return { valid: true, message: 'Valid standard of fill' }
    }

    const typeLabel = BEVERAGE_TYPES[beverageType].label
    return {
      valid: false,
      message: `Not a valid standard of fill for ${typeLabel}`,
    }
  }, [beverageType, containerSizeMl])

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Track new entries so we can quality-check them after state update
    const added: FileWithPreview[] = []

    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_FILES} files allowed`)
        return prev
      }

      const toAdd = acceptedFiles.slice(0, remaining)
      if (toAdd.length < acceptedFiles.length) {
        toast.warning(
          `Only ${toAdd.length} of ${acceptedFiles.length} files added (limit: ${MAX_FILES})`,
        )
      }

      const newFiles: FileWithPreview[] = toAdd.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
      }))
      added.push(...newFiles)

      return [...prev, ...newFiles]
    })

    // Async quality check for each newly added file
    // Runs after setFiles so entries are in state before we update them
    setTimeout(() => {
      for (const entry of added) {
        decodeImageDimensions(entry.preview)
          .then(({ width, height }) => {
            const result = assessImageQuality(
              width,
              height,
              entry.file.size,
              entry.file.type,
            )

            if (result.level === 'error') {
              setFiles((prev) => {
                const idx = prev.findIndex((f) => f.preview === entry.preview)
                if (idx === -1) return prev
                URL.revokeObjectURL(entry.preview)
                return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
              })
              toast.error(
                `${entry.file.name} rejected — ${result.issues[0]?.message}`,
              )
            } else if (result.level === 'warning') {
              setFiles((prev) =>
                prev.map((f) =>
                  f.preview === entry.preview ? { ...f, quality: result } : f,
                ),
              )
              toast.warning(`${entry.file.name}: ${result.issues[0]?.message}`)
            } else {
              setFiles((prev) =>
                prev.map((f) =>
                  f.preview === entry.preview ? { ...f, quality: result } : f,
                ),
              )
            }
          })
          .catch(() => {
            // Could not decode — leave as-is
          })
      }
    }, 0)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = [...prev]
      const removed = updated.splice(index, 1)
      if (removed[0]) {
        URL.revokeObjectURL(removed[0].preview)
      }
      return updated
    })
  }, [])

  const clearAllFiles = useCallback(() => {
    setFiles((prev) => {
      for (const f of prev) {
        URL.revokeObjectURL(f.preview)
      }
      return []
    })
  }, [])

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
  // Upload files to Vercel Blob with concurrency control
  // -------------------------------------------------------------------------

  async function uploadFiles(): Promise<string[]> {
    const limit = pLimit(UPLOAD_CONCURRENCY)
    setUploadTotal(files.length)
    setUploadProgress(0)

    const updated = [...files]
    const urls: (string | null)[] = new Array(files.length).fill(null)

    // Mark already-uploaded files
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'uploaded' && updated[i].url) {
        urls[i] = updated[i].url!
        setUploadProgress((prev) => prev + 1)
      }
    }

    const tasks = updated.map((fileEntry, i) => {
      if (fileEntry.status === 'uploaded' && fileEntry.url) {
        return Promise.resolve()
      }

      return limit(async () => {
        // Mark as uploading
        setFiles((prev) => {
          const next = [...prev]
          next[i] = { ...next[i], status: 'uploading' }
          return next
        })

        try {
          const blob = await upload(fileEntry.file.name, fileEntry.file, {
            access: 'public',
            handleUploadUrl: '/api/blob/upload',
          })

          urls[i] = blob.url

          setFiles((prev) => {
            const next = [...prev]
            next[i] = { ...next[i], status: 'uploaded', url: blob.url }
            return next
          })

          setUploadProgress((prev) => prev + 1)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed'

          setFiles((prev) => {
            const next = [...prev]
            next[i] = { ...next[i], status: 'error', error: message }
            return next
          })

          throw new Error(`Failed to upload ${fileEntry.file.name}: ${message}`)
        }
      })
    })

    await Promise.all(tasks)

    const validUrls = urls.filter((url): url is string => url !== null)
    if (validUrls.length !== files.length) {
      throw new Error('Some files failed to upload')
    }

    return validUrls
  }

  // -------------------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------------------

  async function onSubmit(data: BatchFormInput) {
    if (files.length === 0) {
      toast.error('Please upload at least one label image')
      return
    }

    if (files.some((f) => f.quality?.level === 'error')) {
      toast.error(
        'Remove images that do not meet the minimum quality requirements',
      )
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Upload all images
      const imageUrls = await uploadFiles()

      // 2. Build FormData for server action
      const formData = new FormData()
      if (data.name) formData.set('name', data.name)
      formData.set('beverageType', data.beverageType)
      formData.set('containerSizeMl', String(data.containerSizeMl))
      formData.set('imageUrls', JSON.stringify(imageUrls))
      if (data.classTypeCode) formData.set('classTypeCode', data.classTypeCode)
      if (data.serialNumber) formData.set('serialNumber', data.serialNumber)
      formData.set('brandName', data.brandName)
      if (data.fancifulName) formData.set('fancifulName', data.fancifulName)
      if (data.classType) formData.set('classType', data.classType)
      if (data.alcoholContent)
        formData.set('alcoholContent', data.alcoholContent)
      if (data.netContents) formData.set('netContents', data.netContents)
      if (data.healthWarning) formData.set('healthWarning', data.healthWarning)
      if (data.nameAndAddress)
        formData.set('nameAndAddress', data.nameAndAddress)
      if (data.qualifyingPhrase)
        formData.set('qualifyingPhrase', data.qualifyingPhrase)
      if (data.countryOfOrigin)
        formData.set('countryOfOrigin', data.countryOfOrigin)
      if (data.grapeVarietal) formData.set('grapeVarietal', data.grapeVarietal)
      if (data.appellationOfOrigin)
        formData.set('appellationOfOrigin', data.appellationOfOrigin)
      if (data.vintageYear) formData.set('vintageYear', data.vintageYear)
      if (data.sulfiteDeclaration) formData.set('sulfiteDeclaration', 'true')
      if (data.ageStatement) formData.set('ageStatement', data.ageStatement)
      if (data.stateOfDistillation)
        formData.set('stateOfDistillation', data.stateOfDistillation)

      // 3. Call server action
      const result = await createBatch(formData)

      if (result.success) {
        toast.success(`Batch created with ${files.length} labels`)
        router.push(`/batch/${result.batchId}`)
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const uploadPercent =
    uploadTotal > 0 ? Math.round((uploadProgress / uploadTotal) * 100) : 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Section 1: Batch Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Batch Details</CardTitle>
          <CardDescription>
            Give this batch an optional name for easy reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="name">Batch Name</Label>
            <Input
              id="name"
              placeholder="e.g., Acme Spirits Q1 2026"
              {...register('name')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Product Information */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Product Information
          </CardTitle>
          <CardDescription>
            All labels in this batch share the same product type and application
            data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Beverage Type */}
          <div className="space-y-3">
            <Label>Type of Product</Label>
            <RadioGroup
              value={beverageType}
              onValueChange={(value) => {
                setValue('beverageType', value as BeverageType, {
                  shouldValidate: true,
                })
                setValue('classTypeCode', '')
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {BEVERAGE_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border border-input p-4 transition-colors hover:bg-accent/50 ${
                      beverageType === option.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/50'
                        : ''
                    }`}
                  >
                    <RadioGroupItem value={option.value} />
                    <Icon className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                )
              })}
            </RadioGroup>
            {errors.beverageType && (
              <p className="text-sm text-destructive">
                {errors.beverageType.message}
              </p>
            )}
          </div>

          <Separator />

          {/* Class/Type Code + Container Size */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="classTypeCode">Class/Type Code</Label>
              <Select
                value={watch('classTypeCode') || ''}
                onValueChange={(value) =>
                  setValue('classTypeCode', value, { shouldValidate: true })
                }
                disabled={!beverageType}
              >
                <SelectTrigger id="classTypeCode" className="w-full">
                  <SelectValue
                    placeholder={
                      beverageType
                        ? 'Select a code'
                        : 'Select a beverage type first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCodes.map((code) => (
                    <SelectItem key={code.code} value={code.code}>
                      {code.code} — {code.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="containerSizeMl">
                Total Bottle Capacity (mL)
              </Label>
              <Input
                id="containerSizeMl"
                type="number"
                min={1}
                placeholder="e.g., 750"
                {...register('containerSizeMl', { valueAsNumber: true })}
              />
              {errors.containerSizeMl && (
                <p className="text-sm text-destructive">
                  {errors.containerSizeMl.message}
                </p>
              )}
              {standardsOfFillStatus && (
                <p
                  className={`flex items-center gap-1.5 text-sm ${
                    standardsOfFillStatus.valid
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {standardsOfFillStatus.valid ? (
                    <CheckCircle className="size-4" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                  {standardsOfFillStatus.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Label Images */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="font-heading text-lg">
                Label Images
              </CardTitle>
              <CardDescription>
                Upload up to {MAX_FILES} label images. Each image becomes a
                separate label in the batch. JPEG, PNG, or WebP up to 10 MB
                each.
              </CardDescription>
            </div>
            {files.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllFiles}
                disabled={isSubmitting}
              >
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive
                ? 'Drop images here...'
                : 'Drag and drop label images, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, or WebP up to 10 MB each (max {MAX_FILES} files)
            </p>
          </div>

          {files.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {files.length} {files.length === 1 ? 'file' : 'files'} selected
            </p>
          )}

          {/* Upload Progress */}
          {isSubmitting && uploadTotal > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Uploading {uploadProgress} of {uploadTotal} files...
                </span>
                <span className="font-medium">{uploadPercent}%</span>
              </div>
              <Progress value={uploadPercent} />
            </div>
          )}

          {/* Image Previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {files.map((fileEntry, index) => (
                <div
                  key={`${fileEntry.file.name}-${index}`}
                  className="group relative overflow-hidden rounded-lg border"
                >
                  <Image
                    src={fileEntry.preview}
                    alt={fileEntry.file.name}
                    width={120}
                    height={120}
                    className="aspect-square w-full object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-background/80 px-1.5 py-1">
                    <p className="truncate text-[10px] font-medium">
                      {fileEntry.file.name}
                    </p>
                    <div className="flex items-center gap-1 text-[10px]">
                      {fileEntry.status === 'pending' && (
                        <span className="text-muted-foreground">Ready</span>
                      )}
                      {fileEntry.status === 'uploading' && (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <Loader2 className="size-2.5 animate-spin" />
                          Uploading
                        </span>
                      )}
                      {fileEntry.status === 'uploaded' && (
                        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                          <CheckCircle className="size-2.5" />
                          Done
                        </span>
                      )}
                      {fileEntry.status === 'error' && (
                        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                          <XCircle className="size-2.5" />
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                  {fileEntry.quality?.level === 'warning' && (
                    <span className="absolute top-0.5 left-0.5 flex items-center gap-0.5 rounded-full bg-amber-500/90 px-1 py-px text-[9px] font-medium text-white">
                      <AlertTriangle className="size-2.5" />
                      Low quality
                    </span>
                  )}
                  {!isSubmitting && (
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="hover:text-destructive-foreground absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Application Data (Form 5100.31) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Shared Application Data (Form 5100.31)
          </CardTitle>
          <CardDescription>
            This data will be used to verify every label in the batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Common Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number (Item 4)</Label>
              <Input
                id="serialNumber"
                placeholder="e.g., 12345678"
                {...register('serialNumber')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandName">
                Brand Name (Item 6) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brandName"
                placeholder="e.g., Maker's Mark"
                {...register('brandName')}
                aria-invalid={!!errors.brandName}
              />
              {errors.brandName && (
                <p className="text-sm text-destructive">
                  {errors.brandName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fancifulName">Fanciful Name (Item 7)</Label>
              <Input
                id="fancifulName"
                placeholder="Optional"
                {...register('fancifulName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="classType">Class/Type Designation</Label>
              <Input
                id="classType"
                placeholder="e.g., Kentucky Straight Bourbon Whisky"
                {...register('classType')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="alcoholContent">Alcohol Content</Label>
              <Input
                id="alcoholContent"
                placeholder="e.g., 45% Alc./Vol."
                {...register('alcoholContent')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="netContents">Net Contents</Label>
              <Input
                id="netContents"
                placeholder="e.g., 750 mL"
                {...register('netContents')}
              />
            </div>
          </div>

          <Separator />

          {/* Health Warning Statement */}
          <div className="space-y-2">
            <Label htmlFor="healthWarning">Health Warning Statement</Label>
            <Textarea
              id="healthWarning"
              rows={4}
              className="font-mono text-xs"
              {...register('healthWarning')}
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled with the standard GOVERNMENT WARNING per 27 CFR Part
              16.
            </p>
          </div>

          <Separator />

          {/* Name, Address, and Qualifying Phrase */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nameAndAddress">Name and Address (Item 8)</Label>
              <Textarea
                id="nameAndAddress"
                rows={3}
                placeholder="e.g., Beam Suntory, Clermont, KY"
                {...register('nameAndAddress')}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qualifyingPhrase">Qualifying Phrase</Label>
                <Select
                  value={watch('qualifyingPhrase') || ''}
                  onValueChange={(value) =>
                    setValue('qualifyingPhrase', value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="qualifyingPhrase" className="w-full">
                    <SelectValue placeholder="Select a phrase" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFYING_PHRASES.map((phrase) => (
                      <SelectItem key={phrase} value={phrase}>
                        {phrase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="countryOfOrigin">Country of Origin</Label>
                <Input
                  id="countryOfOrigin"
                  placeholder="e.g., United States"
                  {...register('countryOfOrigin')}
                />
              </div>
            </div>
          </div>

          {/* Wine-specific fields */}
          {beverageType === 'wine' && (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 font-heading text-sm font-semibold tracking-tight">
                  Wine-Specific Fields
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="grapeVarietal">
                      Grape Varietal (Item 10)
                    </Label>
                    <Input
                      id="grapeVarietal"
                      placeholder="e.g., Cabernet Sauvignon"
                      {...register('grapeVarietal')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appellationOfOrigin">
                      Appellation of Origin (Item 14)
                    </Label>
                    <Input
                      id="appellationOfOrigin"
                      placeholder="e.g., Napa Valley"
                      {...register('appellationOfOrigin')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vintageYear">Vintage Year (Item 15)</Label>
                    <Input
                      id="vintageYear"
                      placeholder="e.g., 2022"
                      {...register('vintageYear')}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <Checkbox
                      id="sulfiteDeclaration"
                      checked={watch('sulfiteDeclaration') || false}
                      onCheckedChange={(checked) =>
                        setValue('sulfiteDeclaration', checked === true, {
                          shouldValidate: true,
                        })
                      }
                    />
                    <Label
                      htmlFor="sulfiteDeclaration"
                      className="cursor-pointer"
                    >
                      Contains Sulfites
                    </Label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Spirits-specific fields */}
          {beverageType === 'distilled_spirits' && (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 font-heading text-sm font-semibold tracking-tight">
                  Spirits-Specific Fields
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ageStatement">Age Statement</Label>
                    <Input
                      id="ageStatement"
                      placeholder="e.g., Aged 12 Years"
                      {...register('ageStatement')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stateOfDistillation">
                      State of Distillation
                    </Label>
                    <Input
                      id="stateOfDistillation"
                      placeholder="e.g., Kentucky"
                      {...register('stateOfDistillation')}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Submit */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || files.length === 0}
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              {uploadTotal > 0 && uploadProgress < uploadTotal
                ? `Uploading (${uploadProgress}/${uploadTotal})...`
                : 'Creating batch...'}
            </>
          ) : (
            <>
              <Layers />
              Upload & Validate ({files.length}{' '}
              {files.length === 1 ? 'label' : 'labels'})
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
