'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  CheckCircle,
  ImagePlus,
  Camera,
  Loader2,
  ScanText,
  Sparkles,
  X,
  Wine,
  Beer,
  Martini,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import { pluralize } from '@/lib/pluralize'
import { routes } from '@/config/routes'
import { extractFieldsFromImage } from '@/app/actions/extract-fields-from-image'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Separator } from '@/components/ui/Separator'
import {
  BEVERAGE_TYPES,
  isValidSize,
  type BeverageType,
} from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import {
  validateLabelSchema,
  type ValidateLabelInput,
} from '@/lib/validators/label-schema'
import { MAX_FILE_SIZE } from '@/lib/validators/file-schema'
import { decodeImageDimensions } from '@/lib/validators/decode-image-dimensions'
import { assessImageQuality } from '@/lib/validators/image-quality'
import { ProcessingProgress } from '@/components/validation/ProcessingProgress'
import type { ImageInfo } from '@/components/validation/ImageProcessingSummary'
import {
  type ProcessingStage,
  getStageCumulativeDelays,
} from '@/lib/processing-stages'
import { ApplicantImageViewer } from '@/components/validation/ApplicantImageViewer'
import { ScanStatusTicker } from '@/components/validation/ScanAnimation'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'
import {
  ImageUploadCarousel,
  type FileWithPreview,
} from '@/components/validation/ImageUploadCarousel'
import { LabelFormFields } from '@/components/validation/LabelFormFields'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'
import { parseNetContentsToMl } from '@/lib/labels/parse-net-contents'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEVERAGE_TYPE_OPTIONS: Array<{
  value: BeverageType
  label: string
  description: string
  icon: typeof Wine
}> = [
  {
    value: 'distilled_spirits',
    label: 'Distilled Spirits',
    description: 'Whiskey, vodka, gin, rum, tequila, brandy',
    icon: Martini,
  },
  {
    value: 'wine',
    label: 'Wine',
    description: 'Table wine, sparkling, dessert, vermouth',
    icon: Wine,
  },
  {
    value: 'malt_beverage',
    label: 'Malt Beverages',
    description: 'Beer, ale, lager, malt liquor, hard seltzer',
    icon: Beer,
  },
]

const ACCEPT_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

/** Reverse mapping: snake_case extracted field -> camelCase form field */
const SNAKE_TO_CAMEL: Record<string, keyof ValidateLabelInput> = {
  brand_name: 'brandName',
  fanciful_name: 'fancifulName',
  class_type: 'classType',
  alcohol_content: 'alcoholContent',
  net_contents: 'netContents',
  health_warning: 'healthWarning',
  name_and_address: 'nameAndAddress',
  qualifying_phrase: 'qualifyingPhrase',
  country_of_origin: 'countryOfOrigin',
  grape_varietal: 'grapeVarietal',
  appellation_of_origin: 'appellationOfOrigin',
  vintage_year: 'vintageYear',
  age_statement: 'ageStatement',
  state_of_distillation: 'stateOfDistillation',
}

// Fields that are mapped via SNAKE_TO_CAMEL for pre-fill (text inputs)
const PREFILLABLE_FIELDS = new Set(Object.keys(SNAKE_TO_CAMEL))

// Motion animation presets
const phaseInitial = { opacity: 0, y: 20 }
const phaseAnimate = { opacity: 1, y: 0 }
const phaseExit = { opacity: 0, y: -10 }
const phaseTransition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}

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
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage | null>(null)
  const [uploadingFileIndex, setUploadingFileIndex] = useState<number>(0)
  const stageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const dismissedRef = useRef(false)
  const [hasScannedOnce, setHasScannedOnce] = useState(false)
  const [imageCountAtLastScan, setImageCountAtLastScan] = useState(0)
  const [manualFormEntry, setManualFormEntry] = useState(false)
  const [beverageTypeSource, setBeverageTypeSource] = useState<
    'user' | 'ai' | null
  >(null)

  // Photo review dialog — auto-opens when photos are added during review phase
  const [photoReviewOpen, setPhotoReviewOpen] = useState(false)
  const prevFileCountRef = useRef(0)

  // Carousel scroll state
  const carouselRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Show camera button only on touch devices (phones/tablets)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    setOrigin(window.location.origin)
  }, [])

  // Extraction store
  const extraction = useExtractionStore()
  const prefersReducedMotion = useReducedMotion()

  // Pending pre-fill values — applied after Phase 3 mounts (fields must be registered first)
  const pendingPrefillRef = useRef<Map<
    keyof ValidateLabelInput,
    string
  > | null>(null)

  /** Start timed progression through AI pipeline stages after upload completes */
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

  // Derived state for validate mode's inline product info card
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

  // Re-apply pending pre-fill values once Phase 3 renders (fields are now registered)
  useEffect(() => {
    const map = pendingPrefillRef.current
    if (!map || map.size === 0) return
    if (extraction.status !== 'success') return

    // Defer to next frame so Phase 3 fields have mounted and registered
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
      reset(merged, { keepDirty: true, keepErrors: true })
      pendingPrefillRef.current = null
    }, 50)
    return () => clearTimeout(timer)
  }, [extraction.status, getValues, reset])

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

  // Submit-mode phase gating (phase 2 always visible — AI can auto-detect type)
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
  // Carousel scroll handling
  // -------------------------------------------------------------------------

  const updateScrollButtons = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollButtons()
  }, [files.length, updateScrollButtons])

  function scrollCarousel(direction: 'left' | 'right') {
    const el = carouselRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.7
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithPreview[] = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }))
    setFiles((prev) => [...prev, ...newFiles])

    for (let i = 0; i < newFiles.length; i++) {
      const entry = newFiles[i]
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

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFileDialog,
  } = useDropzone({
    onDrop,
    accept: ACCEPT_MAP,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    noClick: true,
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

  // Camera capture — opens rear camera on mobile via capture="environment"
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const openCamera = useCallback(() => {
    cameraInputRef.current?.click()
  }, [])
  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const capturedFiles = e.target.files
      if (capturedFiles?.length) {
        onDrop(Array.from(capturedFiles))
        toast.success('Photo added')
        // Auto-scroll carousel to the "Add more" card so user can easily take another
        setTimeout(() => {
          carouselRef.current?.scrollTo({
            left: carouselRef.current.scrollWidth,
            behavior: 'smooth',
          })
        }, 300)
      }
      // Reset so the same file can be re-captured
      e.target.value = ''
    },
    [onDrop],
  )

  // -------------------------------------------------------------------------
  // Upload files to Vercel Blob
  // -------------------------------------------------------------------------

  async function uploadFiles(): Promise<string[]> {
    const urls: string[] = []

    const updated = [...files]
    for (let i = 0; i < updated.length; i++) {
      const fileEntry = updated[i]
      if (fileEntry.status === 'uploaded' && fileEntry.url) {
        urls.push(fileEntry.url)
        continue
      }

      updated[i] = { ...fileEntry, status: 'uploading' }
      setUploadingFileIndex(i)
      setFiles([...updated])

      try {
        const body = new FormData()
        body.append('file', fileEntry.file)
        const res = await fetch('/api/blob/upload', {
          method: 'POST',
          body,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: 'Upload failed' }))
          throw new Error(data.error ?? `Upload failed (${res.status})`)
        }
        const blob: { url: string } = await res.json()
        updated[i] = { ...fileEntry, status: 'uploaded', url: blob.url }
        urls.push(blob.url)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        updated[i] = { ...fileEntry, status: 'error', error: message }
        setFiles([...updated])
        throw new Error(`Failed to upload ${fileEntry.file.name}: ${message}`)
      }
    }

    setFiles([...updated])
    return urls
  }

  // -------------------------------------------------------------------------
  // Scan Labels (AI extraction for applicant pre-fill)
  // -------------------------------------------------------------------------

  async function handleScanLabels() {
    if (files.length === 0) return

    extraction.startExtraction()

    try {
      const imageUrls = await uploadFiles()

      const result = await extractFieldsFromImage({
        imageUrls,
        beverageType: beverageType || undefined,
      })

      if (!result.success) {
        extraction.setError(result.error)
        toast.error(
          'Could not read text from image. Please fill in the fields manually.',
        )
        return
      }

      const { fields, imageClassifications, detectedBeverageType } = result.data
      extraction.setResult({
        fields,
        imageClassifications,
        detectedBeverageType,
      })
      setHasScannedOnce(true)
      setImageCountAtLastScan(files.length)

      // Pre-fill beverage type from AI detection (only if not already set)
      if (
        detectedBeverageType &&
        !getValues('beverageType') &&
        detectedBeverageType in BEVERAGE_TYPES
      ) {
        setValue('beverageType', detectedBeverageType as BeverageType, {
          shouldValidate: true,
        })
        setBeverageTypeSource('ai')
      }

      // If type still not set after scan, prompt manual selection
      if (!getValues('beverageType') && !detectedBeverageType) {
        toast.info(
          'Could not detect the product type. Please select it above.',
          { duration: 6000 },
        )
      }

      // Build pre-fill map from extracted fields (applied below + deferred via useEffect)
      const prefillMap = new Map<keyof ValidateLabelInput, string>()
      for (const field of fields) {
        if (!field.value) continue

        // Normalize AI field name: strip whitespace, ensure snake_case
        const normalizedFieldName = field.fieldName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')

        if (!PREFILLABLE_FIELDS.has(normalizedFieldName)) continue

        const camelKey = SNAKE_TO_CAMEL[normalizedFieldName]
        if (!camelKey) continue

        // Skip fields the user already typed in
        const currentValue = getValues(camelKey)
        if (
          typeof currentValue === 'string' &&
          currentValue.trim() !== '' &&
          currentValue !== HEALTH_WARNING_FULL
        ) {
          continue
        }

        // Special: don't overwrite health warning default
        if (camelKey === 'healthWarning') continue

        // Special: sulfite_declaration → boolean
        if (normalizedFieldName === 'sulfite_declaration') {
          const hasSulfites =
            field.value.toLowerCase().includes('sulfite') ||
            field.value.toLowerCase().includes('sulphite')
          if (hasSulfites) {
            prefillMap.set('sulfiteDeclaration', 'true')
            extraction.recordOriginalValue(normalizedFieldName, 'true')
          }
          continue
        }

        // Special: qualifying_phrase must match a known dropdown option
        if (camelKey === 'qualifyingPhrase') {
          const aiValue = field.value.toLowerCase().trim()
          const match =
            QUALIFYING_PHRASES.find((p) => p.toLowerCase() === aiValue) ??
            QUALIFYING_PHRASES.find(
              (p) =>
                aiValue.includes(p.toLowerCase()) ||
                p.toLowerCase().includes(aiValue),
            )
          if (match) {
            prefillMap.set('qualifyingPhrase', match)
            extraction.recordOriginalValue(normalizedFieldName, match)
          }
          continue
        }

        // Special: classTypeCode — try to match AI-extracted class/type code
        // against known codes (fuzzy: matches code number or description)
        if (camelKey === 'classTypeCode' && beverageType) {
          const aiValue = field.value.trim()
          const codes = getCodesByBeverageType(beverageType)
          const match = codes.find(
            (c) =>
              c.code === aiValue ||
              c.description.toLowerCase() === aiValue.toLowerCase(),
          )
          if (match) {
            prefillMap.set('classTypeCode', match.code)
            extraction.recordOriginalValue(normalizedFieldName, match.code)
          }
          continue
        }

        // When we get class_type, also try to auto-select the Class/Type Code dropdown
        if (normalizedFieldName === 'class_type' && beverageType) {
          // Normalize spelling variations: "whiskey"→"whisky", strip punctuation
          const normDesc = (s: string) =>
            s
              .toLowerCase()
              .replace(/whiskey/g, 'whisky')
              .replace(/[^a-z0-9 ]/g, '')
              .trim()
          const aiDesc = normDesc(field.value)
          const codes = getCodesByBeverageType(beverageType)
          const codeMatch =
            codes.find((c) => normDesc(c.description) === aiDesc) ??
            codes.find(
              (c) =>
                aiDesc.includes(normDesc(c.description)) ||
                normDesc(c.description).includes(aiDesc),
            )
          if (codeMatch && !prefillMap.has('classTypeCode')) {
            prefillMap.set('classTypeCode', codeMatch.code)
          }
        }

        prefillMap.set(camelKey, field.value)
        extraction.recordOriginalValue(normalizedFieldName, field.value)
      }

      // Auto-fill containerSizeMl from extracted net_contents (e.g. "750 mL" → 750)
      const netContentsValue = prefillMap.get('netContents')
      if (netContentsValue && !getValues('containerSizeMl')) {
        const parsedMl = parseNetContentsToMl(netContentsValue)
        if (parsedMl !== null) {
          prefillMap.set(
            'containerSizeMl' as keyof ValidateLabelInput,
            String(parsedMl),
          )
        }
      }

      // Apply pre-fill via reset() — works even for fields not yet registered
      // (Phase 3 may not have mounted yet in submit mode)
      const currentValues = getValues()
      const merged = { ...currentValues }
      for (const [key, value] of prefillMap) {
        if (key === 'sulfiteDeclaration') {
          merged.sulfiteDeclaration = true
        } else if (key === 'containerSizeMl') {
          merged.containerSizeMl = Number(value)
        } else {
          Object.assign(merged, { [key]: value })
        }
      }
      reset(merged, { keepDirty: true, keepErrors: true })

      // Also store for deferred re-application after Phase 3 mounts
      pendingPrefillRef.current = prefillMap

      toast.success(
        `Found ${fields.length} fields from ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed'
      extraction.setError(message)
      toast.error(
        'Could not read text from image. Please fill in the fields manually.',
      )
    }
  }

  // -------------------------------------------------------------------------
  // Field highlight sync
  // -------------------------------------------------------------------------

  // Auto-dismiss highlight after a timeout so the user isn't stuck with a
  // highlighted bounding box. Resets whenever the active field changes.
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const HIGHLIGHT_TIMEOUT_MS = 4000

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    },
    [],
  )

  function scheduleHighlightDismiss() {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => {
      extraction.setActiveHighlight(null)
    }, HIGHLIGHT_TIMEOUT_MS)
  }

  function handleFieldFocus(snakeCase: string) {
    // Toggle off if clicking the same field again
    if (extraction.activeHighlightField === snakeCase) {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      extraction.setActiveHighlight(null)
      return
    }
    extraction.setActiveHighlight(snakeCase)
    scheduleHighlightDismiss()
  }

  function handleBboxClick(fieldName: string) {
    extraction.setActiveHighlight(fieldName)
    scheduleHighlightDismiss()
    // Focus the corresponding form input
    const camelKey = SNAKE_TO_CAMEL[fieldName]
    if (camelKey) {
      const el = document.getElementById(camelKey as string)
      if (el) el.focus()
    }
  }

  function handleFieldChange(snakeCase: string) {
    if (extraction.aiOriginalValues.has(snakeCase)) {
      extraction.markModified(snakeCase)
    }
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
  // Local blob previews in the same order — used as placeholders while remote images load
  const localPreviewUrls = uploadedFiles.map((f) => f.preview)
  // All file previews — used during extraction when remote URLs aren't available yet
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
            {/* Beverage Type */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                Type of Product
                <span className="text-destructive">*</span>
                <AiFieldIndicator
                  showSplitPane={showSplitPane}
                  onFieldFocus={handleFieldFocus}
                  fieldName="beverage_type"
                />
              </Label>
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
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border border-input p-4 transition-colors hover:bg-accent/50',
                        beverageType === option.value &&
                          'border-primary bg-primary/5 ring-1 ring-primary/50',
                      )}
                    >
                      <RadioGroupItem value={option.value} />
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
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

            {/* Class/Type Code + Container Size (inline in validate mode) */}
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
                <Label
                  htmlFor="containerSizeMl"
                  className="flex items-center gap-1.5"
                >
                  Total Bottle Capacity (mL)
                  <span className="text-destructive">*</span>
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

          {processingStage && (
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
          )}
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
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {BEVERAGE_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon
                      const isSelected = beverageType === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setValue('beverageType', option.value, {
                              shouldValidate: true,
                            })
                            setValue('classTypeCode', '')
                            setBeverageTypeSource('user')
                          }}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-xl border-2 p-6 text-center transition-all hover:bg-accent/50',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'border-input',
                          )}
                        >
                          <Icon
                            className={cn(
                              'size-8',
                              isSelected
                                ? 'text-primary'
                                : 'text-muted-foreground',
                            )}
                          />
                          <span className="text-sm font-semibold">
                            {option.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                          {isSelected && beverageTypeSource === 'ai' && (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Sparkles className="size-3" />
                              AI detected
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {errors.beverageType && (
                    <p className="mt-2 text-sm text-destructive">
                      {errors.beverageType.message}
                    </p>
                  )}
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
            className="space-y-6"
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

            {/* Type of Product — inline form field with segmented control */}
            {mode === 'submit' &&
              extraction.status !== 'extracting' &&
              beverageType && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      Type of Product
                    </Label>
                    {beverageTypeSource === 'ai' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="size-2.5" />
                        AI detected
                      </span>
                    )}
                  </div>
                  <div className="inline-flex rounded-lg border border-input bg-muted/30 p-0.5">
                    {BEVERAGE_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon
                      const isSelected = beverageType === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setValue('beverageType', option.value, {
                              shouldValidate: true,
                            })
                            setValue('classTypeCode', '')
                            setBeverageTypeSource('user')
                          }}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            isSelected
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Icon className="size-3.5" />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
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
        {origin && (
          <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Take a photo with your phone</DialogTitle>
                <DialogDescription>
                  Scan this QR code to open the submission page on your phone.
                  You&apos;ll need to sign in.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <QRCodeSVG
                  value={`${origin}/submit`}
                  size={200}
                  level="M"
                  className="rounded-lg"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Photo review dialog — auto-opens when photos are added during review */}
        <Dialog
          open={photoReviewOpen}
          onOpenChange={(open) => {
            if (!open) {
              // Closing without action — revert newly added photos
              setFiles((prev) => prev.slice(0, imageCountAtLastScan))
              setPhotoReviewOpen(false)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pluralize(files.length - imageCountAtLastScan, 'new photo')}{' '}
                added
              </DialogTitle>
              <DialogDescription>
                Re-scan to include the new images in your verification, or add
                more.
              </DialogDescription>
            </DialogHeader>

            {/* All images with remove buttons */}
            <div className="flex flex-wrap gap-2 py-2">
              {files.map((fileEntry, index) => (
                <div
                  key={`review-${fileEntry.file.name}-${index}`}
                  className="group relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted/20"
                >
                  <Image
                    src={fileEntry.preview}
                    alt={fileEntry.file.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {index >= imageCountAtLastScan && (
                    <span className="absolute top-0.5 left-0.5 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      NEW
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      removeFile(index)
                      // Close dialog if all new photos removed
                      if (files.length - 1 <= imageCountAtLastScan) {
                        setPhotoReviewOpen(false)
                      }
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                    aria-label={`Remove ${fileEntry.file.name}`}
                  >
                    <X className="size-4 text-white" />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiles((prev) => prev.slice(0, imageCountAtLastScan))
                  setPhotoReviewOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhotoReviewOpen(false)
                  // Keep photos, let user add more — dialog will reopen on next add
                }}
              >
                <ImagePlus className="size-3.5" />
                Add more
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setPhotoReviewOpen(false)
                  handleScanLabels()
                }}
              >
                <ScanText className="size-3.5" />
                Re-scan with {pluralize(files.length, 'image')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {showSplitPane ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex gap-6"
          >
            {/* Left: Sticky image viewer — always renders ApplicantImageViewer.
              During extraction: shows local previews with scan overlay via placeholder.
              After extraction: cross-fades to annotated remote images. */}
            <div className="hidden w-[40%] shrink-0 lg:block">
              <div className="sticky top-20 h-[calc(100dvh-12rem)]">
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
        {processingStage && (
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
        )}
      </form>
    </FormProvider>
  )
}
