'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  CheckCircle,
  ImagePlus,
  Camera,
  Loader2,
  ScanText,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'

import { pluralize } from '@/lib/pluralize'
import { routes } from '@/config/routes'
import { submitApplication } from '@/app/actions/submit-application'
import { validateLabel } from '@/app/actions/validate-label'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { Combobox } from '@/components/ui/Combobox'
import { Input } from '@/components/ui/Input'
import { Separator } from '@/components/ui/Separator'
import {
  BEVERAGE_TYPES,
  isValidSize,
  type BeverageType,
} from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import {
  validateLabelSchema,
  type ValidateLabelInput,
} from '@/lib/validators/label-schema'
import { ProcessingProgress } from '@/components/validation/ProcessingProgress'
import type { ImageInfo } from '@/components/validation/ImageProcessingSummary'
import {
  type ProcessingStage,
  getStageCumulativeDelays,
} from '@/lib/processing-stages'
import { ApplicantImageViewer } from '@/components/validation/ApplicantImageViewer'
import { ScanStatusTicker } from '@/components/validation/ScanAnimation'
import { ImageUploadCarousel } from '@/components/validation/ImageUploadCarousel'
import { LabelFormFields } from '@/components/validation/LabelFormFields'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'

import {
  phaseInitial,
  phaseAnimate,
  phaseExit,
  phaseTransition,
} from './UploadFormConstants'
import { useFileUploadManager } from './UseFileUploadManager'
import { useScanLabels } from './UseScanLabels'
import { useFieldHighlight } from './UseFieldHighlight'
import {
  BeverageTypeRadio,
  BeverageTypeCards,
  BeverageTypeSegmented,
} from './BeverageTypeSelector'
import { PhotoReviewDialog } from './PhotoReviewDialog'
import { QRCodeDialog } from './QRCodeDialog'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LabelUploadFormProps {
  mode?: 'validate' | 'submit'
  onActiveChange?: (active: boolean) => void
}

export function LabelUploadForm({
  mode = 'validate',
  onActiveChange,
}: LabelUploadFormProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()

  // State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage | null>(null)
  const stageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const dismissedRef = useRef(false)
  const [beverageTypeSource, setBeverageTypeSource] = useState<
    'user' | 'ai' | null
  >(null)
  const [photoReviewOpen, setPhotoReviewOpen] = useState(false)
  const prevFileCountRef = useRef(0)
  const [showQrDialog, setShowQrDialog] = useState(false)
  // Extraction store
  const extraction = useExtractionStore()

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------

  const methods = useForm<ValidateLabelInput>({
    resolver: zodResolver(validateLabelSchema),
    defaultValues: {
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = methods

  const beverageType = watch('beverageType')
  const containerSizeMl = watch('containerSizeMl')

  // -------------------------------------------------------------------------
  // Extracted hooks
  // -------------------------------------------------------------------------

  const fileManager = useFileUploadManager()
  const {
    files,
    setFiles,
    uploadingFileIndex,
    carouselRef,
    canScrollLeft,
    canScrollRight,
    updateScrollButtons,
    scrollCarousel,
    getRootProps,
    getInputProps,
    isDragActive,
    openFileDialog,
    isTouchDevice,
    cameraInputRef,
    openCamera,
    handleCameraCapture,
    origin,
    removeFile,
    uploadFiles,
  } = fileManager

  const scanLabels = useScanLabels({
    form: methods,
    uploadFiles,
    fileCount: files.length,
    setBeverageTypeSource,
  })
  const {
    hasScannedOnce,
    imageCountAtLastScan,
    manualFormEntry,
    setManualFormEntry,
    pendingPrefillRef,
    handleScanLabels,
  } = scanLabels

  const { handleFieldFocus, handleBboxClick, handleFieldChange } =
    useFieldHighlight()

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

  // Submit-mode phase gating
  const showPhase2 = true
  const showPhase3 =
    mode === 'submit'
      ? extraction.status === 'success' ||
        extraction.status === 'extracting' ||
        manualFormEntry
      : true
  const showSplitPane =
    mode === 'submit' &&
    (extraction.status === 'success' || extraction.status === 'extracting')
  const showScanButton =
    mode === 'submit' && files.length > 0 && extraction.status !== 'extracting'
  const scanButtonLabel =
    hasScannedOnce && files.length !== imageCountAtLastScan
      ? `Re-scan with ${files.length} image${files.length > 1 ? 's' : ''}`
      : mode === 'submit' && !beverageType
        ? `Scan & detect type from ${files.length} image${files.length > 1 ? 's' : ''}`
        : `Scan ${files.length} image${files.length > 1 ? 's' : ''}`

  // -------------------------------------------------------------------------
  // Pipeline stage progression
  // -------------------------------------------------------------------------

  function startPipelineStages(imageCount: number) {
    for (const t of stageTimersRef.current) clearTimeout(t)
    stageTimersRef.current = []

    const delays = getStageCumulativeDelays(imageCount)

    setProcessingStage('ocr')
    const ocrDelay = delays.find((d) => d.stageId === 'ocr')?.delay ?? 0
    for (const { stageId, delay } of delays) {
      if (stageId === 'uploading' || stageId === 'ocr') continue
      const relativeDelay = delay - ocrDelay
      if (relativeDelay > 0) {
        stageTimersRef.current.push(
          setTimeout(() => setProcessingStage(stageId), relativeDelay),
        )
      }
    }
  }

  function clearPipelineStages() {
    for (const t of stageTimersRef.current) clearTimeout(t)
    stageTimersRef.current = []
    setProcessingStage(null)
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Re-apply pending pre-fill values once Phase 3 renders (fields are now registered)
  useEffect(() => {
    const map = pendingPrefillRef.current
    if (!map || map.size === 0) return
    if (extraction.status !== 'success') return

    const timer = setTimeout(() => {
      const current = pendingPrefillRef.current
      if (!current) return
      const currentValues = getValues()
      const merged = { ...currentValues }
      for (const [key, value] of current) {
        if (key === 'sulfiteDeclaration') {
          merged.sulfiteDeclaration = true
        } else if (key === 'containerSizeMl') {
          merged.containerSizeMl = Number(value)
        } else {
          Object.assign(merged, { [key]: value })
        }
      }
      reset(merged, { keepDirty: true })
      pendingPrefillRef.current = null
    }, 50)
    return () => clearTimeout(timer)
  }, [extraction.status, getValues, reset, pendingPrefillRef])

  // Notify parent when files are added or removed
  useEffect(() => {
    onActiveChange?.(files.length > 0)
  }, [files.length, onActiveChange])

  // Auto-open photo review dialog when new photos are added during review phase
  useEffect(() => {
    if (
      hasScannedOnce &&
      extraction.status === 'success' &&
      files.length > prevFileCountRef.current &&
      files.length > imageCountAtLastScan
    ) {
      setPhotoReviewOpen(true)
    }
    prevFileCountRef.current = files.length
  }, [files.length, hasScannedOnce, extraction.status, imageCountAtLastScan])

  // Reset submission step when returning to idle upload state
  const setSubmissionStep = extraction.setSubmissionStep
  useEffect(() => {
    if (files.length === 0 && extraction.status === 'idle') {
      setSubmissionStep(1)
    }
  }, [files.length, extraction.status, setSubmissionStep])

  // -------------------------------------------------------------------------
  // Beverage type selection handler (shared by all selector variants)
  // -------------------------------------------------------------------------

  function handleBeverageTypeSelect(value: BeverageType) {
    setValue('beverageType', value, { shouldValidate: true })
    setValue('classTypeCode', '')
    setBeverageTypeSource('user')
  }

  // -------------------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------------------

  async function onSubmit(data: ValidateLabelInput) {
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
    dismissedRef.current = false
    extraction.setSubmissionStep(4)
    setProcessingStage('uploading')

    try {
      const imageUrls = await uploadFiles()

      startPipelineStages(files.length)

      // Show a reassurance message after 30s (non-terminal — stages stay active)
      if (mode === 'submit') {
        stageTimersRef.current.push(
          setTimeout(() => setProcessingStage('slow'), 30_000),
        )
      }

      const formData = new FormData()
      formData.set('beverageType', data.beverageType)
      formData.set('containerSizeMl', String(data.containerSizeMl))
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
      formData.set('imageUrls', JSON.stringify(imageUrls))

      // Specialist submitting on behalf of an applicant
      // Send AI extraction data for correction delta computation
      if (mode === 'submit' && extraction.aiOriginalValues.size > 0) {
        const aiFields = Object.fromEntries(extraction.aiOriginalValues)
        formData.set('aiExtractedFields', JSON.stringify(aiFields))
      }

      // Race the server action against a 45s client-side timeout
      const CLIENT_TIMEOUT_MS = 45_000
      const clientTimeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('CLIENT_TIMEOUT')),
          CLIENT_TIMEOUT_MS,
        ),
      )

      const result = await Promise.race([
        mode === 'submit'
          ? submitApplication(formData)
          : validateLabel(formData),
        clientTimeout,
      ])

      if (result.success) {
        // If the user already dismissed and navigated away, don't interfere
        if (dismissedRef.current) return

        extraction.setSubmissionStep(5)

        // Stop fake stage timers and show completion state
        for (const t of stageTimersRef.current) clearTimeout(t)
        stageTimersRef.current = []
        setProcessingStage('complete')

        // Brief pause for the completion animation, then navigate
        await new Promise((resolve) => setTimeout(resolve, 1500))
        setIsSubmitting(false)

        if (mode === 'submit') {
          router.push(`${routes.submission(result.labelId)}?confirmed=true`)
        } else {
          router.push(routes.label(result.labelId))
        }
      } else if ('timeout' in result && result.timeout) {
        // Server-side pipeline timeout
        setProcessingStage('timeout')
        setIsSubmitting(false)
      } else {
        setProcessingStage('error')
        setIsSubmitting(false)
        toast.error(result.error)
      }
    } catch (err) {
      const isClientTimeout =
        err instanceof Error && err.message === 'CLIENT_TIMEOUT'
      if (isClientTimeout) {
        setProcessingStage('timeout')
      } else {
        setProcessingStage('error')
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        toast.error(message)
      }
      setIsSubmitting(false)
    }
  }

  /** Dismiss the processing dialog — navigates away while processing continues in background */
  function handleDismiss() {
    dismissedRef.current = true
    clearPipelineStages()
    setIsSubmitting(false)
    toast.info('Processing will continue in the background')
    router.push(mode === 'submit' ? routes.submissions() : routes.home())
  }

  // -------------------------------------------------------------------------
  // Helper: get uploaded image URLs for the viewer
  // -------------------------------------------------------------------------

  const uploadedFiles = files.filter((f) => f.status === 'uploaded' && f.url)
  const uploadedImageUrls = uploadedFiles.map((f) => f.url!)
  const localPreviewUrls = uploadedFiles.map((f) => f.preview)
  const allPreviewUrls = files.map((f) => f.preview)

  // -------------------------------------------------------------------------
  // Shared props for ImageUploadCarousel
  // -------------------------------------------------------------------------

  const carouselProps = {
    files,
    mode,
    isExtracting: extraction.status === 'extracting',
    getRootProps,
    getInputProps,
    isDragActive,
    openFileDialog,
    carouselRef,
    canScrollLeft,
    canScrollRight,
    onScroll: updateScrollButtons,
    onScrollCarousel: scrollCarousel,
    onRemoveFile: removeFile,
    isTouchDevice,
    cameraInputRef,
    onOpenCamera: openCamera,
    onCameraCapture: handleCameraCapture,
    origin,
    onShowQrDialog: () => setShowQrDialog(true),
  } as const

  const formFields = (
    <LabelFormFields
      mode={mode}
      showSplitPane={showSplitPane}
      onFieldFocus={handleFieldFocus}
      onFieldChange={handleFieldChange}
    />
  )

  // -------------------------------------------------------------------------
  // Submit buttons
  // -------------------------------------------------------------------------

  const submitButtons = (
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
        disabled={isSubmitting}
        size="lg"
        className="active:scale-[0.97]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            {mode === 'submit' ? 'Submitting...' : 'Validating...'}
          </>
        ) : (
          <>
            <CheckCircle />
            {mode === 'submit' ? 'Submit Application' : 'Validate Label'}
          </>
        )}
      </Button>
    </div>
  )

  // -------------------------------------------------------------------------
  // Processing progress overlay (shared between modes)
  // -------------------------------------------------------------------------

  const processingOverlay = processingStage && (
    <ProcessingProgress
      stage={processingStage}
      imageCount={files.length}
      images={files.map(
        (f): ImageInfo => ({
          name: f.file.name,
          thumbnailUrl: f.preview,
        }),
      )}
      uploadingIndex={uploadingFileIndex}
      onDismiss={handleDismiss}
    />
  )

  // -------------------------------------------------------------------------
  // Photo review dialog handlers
  // -------------------------------------------------------------------------

  function handlePhotoReviewCancel() {
    setFiles((prev) => prev.slice(0, imageCountAtLastScan))
    setPhotoReviewOpen(false)
  }

  function handlePhotoReviewAddMore() {
    setPhotoReviewOpen(false)
    // Keep photos, let user add more — dialog will reopen on next add
  }

  function handlePhotoReviewRescan() {
    setPhotoReviewOpen(false)
    handleScanLabels()
  }

  // -------------------------------------------------------------------------
  // Validate mode: original card-based layout (unchanged)
  // -------------------------------------------------------------------------

  if (mode === 'validate') {
    const validateFormContent = (
      <div className="space-y-6">
        {/* Section 1: Label Images */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Label Images</CardTitle>
            <CardDescription>
              Upload one or more label images. JPEG, PNG, or WebP up to 10 MB
              each.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImageUploadCarousel {...carouselProps} layout="separate" />
          </CardContent>
        </Card>

        {/* Section 2: Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Product Information
            </CardTitle>
            <CardDescription>
              Select the beverage type, class/type code, and container size.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <BeverageTypeRadio
              beverageType={beverageType}
              onSelect={(value) => {
                setValue('beverageType', value, { shouldValidate: true })
                setValue('classTypeCode', '')
              }}
              showSplitPane={showSplitPane}
              onFieldFocus={handleFieldFocus}
              error={errors.beverageType?.message}
            />

            <Separator />

            {/* Class/Type Code + Container Size (inline in validate mode) */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="classTypeCode">Class/Type Code</Label>
                <Combobox
                  id="classTypeCode"
                  options={filteredCodes.map((code) => ({
                    value: code.code,
                    label: `${code.code} — ${code.description}`,
                  }))}
                  value={watch('classTypeCode') || ''}
                  onValueChange={(value) =>
                    setValue('classTypeCode', value, { shouldValidate: true })
                  }
                  disabled={!beverageType}
                  placeholder={
                    beverageType
                      ? 'Search codes...'
                      : 'Select a beverage type first'
                  }
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="containerSizeMl"
                  className="flex items-center gap-1.5"
                >
                  Total Bottle Capacity (mL)
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="containerSizeMl"
                  type="number"
                  min={1}
                  placeholder="e.g., 750"
                  aria-required="true"
                  {...register('containerSizeMl', { valueAsNumber: true })}
                />
                {errors.containerSizeMl && (
                  <p className="text-sm text-destructive">
                    {errors.containerSizeMl.message}
                  </p>
                )}
                {standardsOfFillStatus && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-sm',
                      standardsOfFillStatus.valid
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
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

        {/* Section 3: Application Data */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Application Data (Form 5100.31)
            </CardTitle>
            <CardDescription>
              Enter the data from your label application to compare against the
              label.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">{formFields}</CardContent>
        </Card>

        {submitButtons}
      </div>
    )

    return (
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          {validateFormContent}
          {processingOverlay}
        </form>
      </FormProvider>
    )
  }

  // -------------------------------------------------------------------------
  // Submit mode: progressive 3-phase reveal
  // -------------------------------------------------------------------------

  const submitFormContent = (
    <div className="space-y-8">
      {/* Phase 1+2: Hidden when split pane is active (images visible in left panel) */}
      <AnimatePresence>
        {!showSplitPane && (
          <motion.div
            initial={phaseAnimate}
            animate={phaseAnimate}
            exit={phaseExit}
            transition={phaseTransition}
            className="space-y-8"
          >
            {/* Phase 1: Image Upload + Scan (upload first, AI detects type) */}
            <AnimatePresence>
              {showPhase2 && (
                <motion.div
                  initial={phaseInitial}
                  animate={phaseAnimate}
                  exit={phaseExit}
                  transition={phaseTransition}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="font-heading text-lg font-semibold tracking-tight">
                      Upload label images
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upload front, back, and any additional label images for
                      the best results.
                    </p>
                  </div>

                  <ImageUploadCarousel {...carouselProps} layout="unified" />

                  {/* Scan / Skip controls */}
                  {files.length > 0 && (
                    <div className="space-y-3">
                      {showScanButton && (
                        <button
                          type="button"
                          onClick={handleScanLabels}
                          disabled={extraction.status === 'extracting'}
                          className={cn(
                            'relative flex h-12 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition-all',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                            'disabled:pointer-events-none disabled:opacity-50',
                            extraction.status === 'extracting'
                              ? 'bg-muted text-muted-foreground'
                              : [
                                  'bg-gradient-to-r from-gold via-[oklch(0.84_0.13_75)] to-gold text-gold-foreground',
                                  'shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_16px_-2px_oklch(0.82_0.12_85/0.3)]',
                                  'hover:shadow-[0_1px_2px_rgba(0,0,0,0.1),0_6px_20px_-2px_oklch(0.82_0.12_85/0.45)] hover:brightness-[1.08]',
                                  'active:scale-[0.98] active:brightness-100',
                                ],
                          )}
                        >
                          {extraction.status === 'extracting' ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <ScanText className="size-4" />
                              {scanButtonLabel}
                            </>
                          )}
                        </button>
                      )}

                      {extraction.status !== 'success' && !manualFormEntry && (
                        <p className="text-center">
                          <button
                            type="button"
                            onClick={() => setManualFormEntry(true)}
                            className="text-sm text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                          >
                            Skip — fill in manually
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phase 2: Beverage Type (shown after scan or manual entry) */}
            <AnimatePresence>
              {(hasScannedOnce || manualFormEntry) && (
                <motion.div
                  initial={phaseInitial}
                  animate={phaseAnimate}
                  exit={phaseExit}
                  transition={phaseTransition}
                >
                  <h2 className="font-heading text-lg font-semibold tracking-tight">
                    What type of product is this?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {beverageTypeSource === 'ai'
                      ? 'AI detected the product type from your label. You can change it if needed.'
                      : 'Select the product type for this label.'}
                  </p>
                  <div className="mt-4">
                    <BeverageTypeCards
                      beverageType={beverageType}
                      beverageTypeSource={beverageTypeSource}
                      onSelect={handleBeverageTypeSelect}
                      error={errors.beverageType?.message}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 3: Form Fields + Submit */}
      <AnimatePresence>
        {showPhase3 && (
          <motion.div
            initial={phaseInitial}
            animate={phaseAnimate}
            exit={phaseExit}
            transition={phaseTransition}
            className="space-y-8"
          >
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {extraction.status === 'success'
                  ? 'Verify application data'
                  : extraction.status === 'extracting'
                    ? 'Reading your labels...'
                    : 'Enter application data'}
              </h2>
              {extraction.status === 'extracting' ? (
                <ScanStatusTicker
                  imageCount={files.length}
                  className="mt-2 [&_p]:text-muted-foreground"
                />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {extraction.status === 'success'
                    ? 'Review the AI-detected values below and correct anything that looks wrong.'
                    : 'Fill in the Form 5100.31 fields for your label.'}
                </p>
              )}
            </div>

            {/* Add photos during review — thumbnails + action buttons (mobile/tablet only; desktop shows these in left panel) */}
            {showSplitPane && extraction.status === 'success' && (
              <div className="space-y-3 lg:hidden">
                {/* Thumbnail strip */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-2 overflow-x-auto">
                    {files.map((fileEntry, index) => (
                      <div
                        key={`${fileEntry.file.name}-${index}`}
                        className="group relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted/20"
                      >
                        <Image
                          src={fileEntry.preview}
                          alt={fileEntry.file.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                          aria-label={`Remove ${fileEntry.file.name}`}
                        >
                          <X className="size-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {pluralize(files.length, 'image')}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openFileDialog}
                  >
                    <ImagePlus className="size-3.5" />
                    Add photos
                  </Button>
                  {isTouchDevice && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCamera}
                    >
                      <Camera className="size-3.5" />
                      Take a photo
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Type of Product — inline segmented control */}
            {mode === 'submit' &&
              extraction.status !== 'extracting' &&
              beverageType && (
                <BeverageTypeSegmented
                  beverageType={beverageType}
                  beverageTypeSource={beverageTypeSource}
                  onSelect={handleBeverageTypeSelect}
                />
              )}

            {formFields}
            {extraction.status !== 'extracting' && submitButtons}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Hidden file inputs — always in DOM for add-photos-in-review */}
        {showSplitPane && (
          <div className="hidden">
            <input {...getInputProps()} />
            {isTouchDevice && (
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
            )}
          </div>
        )}

        {/* QR code dialog — desktop camera access via phone */}
        <QRCodeDialog
          open={showQrDialog}
          onOpenChange={setShowQrDialog}
          origin={origin}
        />

        {/* Photo review dialog — auto-opens when photos are added during review */}
        <PhotoReviewDialog
          open={photoReviewOpen}
          onOpenChange={setPhotoReviewOpen}
          files={files}
          imageCountAtLastScan={imageCountAtLastScan}
          onRemoveFile={removeFile}
          onCancel={handlePhotoReviewCancel}
          onAddMore={handlePhotoReviewAddMore}
          onRescan={handlePhotoReviewRescan}
        />

        {showSplitPane ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex gap-6"
          >
            {/* Left: Sticky image viewer */}
            <div className="hidden w-[40%] shrink-0 lg:block">
              <div className="sticky top-20 h-[calc(100dvh-20rem)]">
                <ApplicantImageViewer
                  imageUrls={
                    extraction.status === 'extracting'
                      ? allPreviewUrls
                      : uploadedImageUrls
                  }
                  fields={
                    extraction.status === 'extracting' ? [] : extraction.fields
                  }
                  onFieldClick={
                    extraction.status === 'extracting'
                      ? undefined
                      : handleBboxClick
                  }
                  placeholderUrls={
                    extraction.status === 'extracting'
                      ? allPreviewUrls
                      : localPreviewUrls
                  }
                  isScanning={extraction.status === 'extracting'}
                  action={
                    extraction.status === 'success' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={openFileDialog}
                      >
                        <ImagePlus className="size-3.5" />
                        Add photos
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            </div>

            {/* Right: Scrollable form (slides in from right) */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="min-w-0 flex-1"
            >
              {submitFormContent}
            </motion.div>
          </motion.div>
        ) : (
          submitFormContent
        )}

        {/* Multi-stage processing progress overlay */}
        {processingOverlay}
      </form>
    </FormProvider>
  )
}
