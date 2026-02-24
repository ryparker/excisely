'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Pencil,
  ScanText,
  Smartphone,
  Sparkles,
  Upload,
  XCircle,
  X,
  AlertTriangle,
  Wine,
  Beer,
  Martini,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import { extractFieldsFromImage } from '@/app/actions/extract-fields-from-image'
import { submitApplication } from '@/app/actions/submit-application'
import { validateLabel } from '@/app/actions/validate-label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  assessImageQuality,
  type ImageQualityResult,
} from '@/lib/validators/image-quality'
import { FieldLabel } from '@/components/shared/field-label'
import { ProcessingProgress } from '@/components/validation/processing-progress'
import type { ImageInfo } from '@/components/validation/image-processing-summary'
import {
  type ProcessingStage,
  getStageCumulativeDelays,
} from '@/lib/processing-stages'
import { ApplicantImageViewer } from '@/components/validation/applicant-image-viewer'
import {
  ScanAnimation,
  ScanStatusTicker,
  FieldShimmer,
} from '@/components/validation/scan-animation'
import { useExtractionStore } from '@/stores/extraction-store'
import { cn } from '@/lib/utils'

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

/** Parse a net contents string (e.g. "750 mL", "25.4 FL OZ", "1 L") to mL */
function parseNetContentsToMl(text: string): number | null {
  const cleaned = text.trim().toLowerCase()

  // Try "NNN mL" or "NNN ml"
  const mlMatch = cleaned.match(/([\d,.]+)\s*ml/)
  if (mlMatch) {
    const val = parseFloat(mlMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val) : null
  }

  // Try "N L" or "N liter(s)"
  const literMatch = cleaned.match(/([\d,.]+)\s*(?:l(?:iter)?s?\b)/)
  if (literMatch) {
    const val = parseFloat(literMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val * 1000) : null
  }

  // Try "N FL OZ" or "N fl. oz."
  const ozMatch = cleaned.match(/([\d,.]+)\s*(?:fl\.?\s*oz\.?)/)
  if (ozMatch) {
    const val = parseFloat(ozMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val * 29.5735) : null
  }

  // Try bare number (assume mL)
  const bareMatch = cleaned.match(/^([\d,.]+)$/)
  if (bareMatch) {
    const val = parseFloat(bareMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val) : null
  }

  return null
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ValidateLabelInput>({
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
          ;(merged as Record<string, unknown>).sulfiteDeclaration = true
        } else if (key === 'containerSizeMl') {
          ;(merged as Record<string, unknown>).containerSizeMl = Number(value)
        } else {
          ;(merged as Record<string, unknown>)[key] = value
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
        ['distilled_spirits', 'wine', 'malt_beverage'].includes(
          detectedBeverageType,
        )
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
          ;(merged as Record<string, unknown>).sulfiteDeclaration = true
        } else if (key === 'containerSizeMl') {
          ;(merged as Record<string, unknown>).containerSizeMl = Number(value)
        } else {
          ;(merged as Record<string, unknown>)[key] = value
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
          router.push(`/submissions/${result.labelId}?confirmed=true`)
        } else {
          router.push(`/labels/${result.labelId}`)
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
    router.push(mode === 'submit' ? '/submissions' : '/')
  }

  // -------------------------------------------------------------------------
  // Helper: AI pre-fill indicator
  // -------------------------------------------------------------------------

  function AiFieldIndicator({ fieldName }: { fieldName: string }) {
    const isPreFilled = extraction.aiOriginalValues.has(fieldName)
    const isModified = extraction.modifiedFields.has(fieldName)
    const hasBbox =
      showSplitPane &&
      extraction.fields.some((f) => f.fieldName === fieldName && f.boundingBox)

    if (!isPreFilled) return null

    const icon = isModified ? (
      <Pencil className="inline size-3.5" />
    ) : (
      <Sparkles className="inline size-3.5" />
    )

    const tooltipText = isModified
      ? 'You edited the AI value'
      : hasBbox
        ? 'AI-detected — click to show on image'
        : 'Pre-filled from label image'

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {hasBbox ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleFieldFocus(fieldName)
                }}
                className={cn(
                  'inline-flex size-4 items-center justify-center rounded transition-colors',
                  isModified
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300',
                )}
              >
                {icon}
              </button>
            ) : (
              <span
                className={
                  isModified ? 'text-muted-foreground' : 'text-indigo-500'
                }
              >
                {icon}
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
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
  // Shared: Dropzone component
  // -------------------------------------------------------------------------

  const cameraInput = isTouchDevice ? (
    <input
      ref={cameraInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      className="hidden"
      onChange={handleCameraCapture}
    />
  ) : null

  const dropzone = (
    <div
      {...getRootProps()}
      onClick={openFileDialog}
      className={cn(
        'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        mode === 'submit' && 'p-6',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30',
      )}
    >
      <input {...getInputProps()} />
      {cameraInput}
      <Upload
        className={cn(
          'mx-auto mb-3 text-muted-foreground',
          mode === 'submit' ? 'size-8' : 'size-10',
        )}
      />
      <p className="text-sm font-medium">
        {isDragActive
          ? 'Drop images here...'
          : 'Drag and drop label images, or click to browse'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        JPEG, PNG, or WebP up to 10 MB
      </p>
      {isTouchDevice ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openCamera()
          }}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Camera className="size-3.5" />
          Take a photo
        </button>
      ) : (
        origin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowQrDialog(true)
            }}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Smartphone className="size-3.5" />
            Take a photo with your phone
          </button>
        )
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Shared: Image carousel (horizontal scroll-snap for submit, grid for validate)
  // -------------------------------------------------------------------------

  const imageCarousel = files.length > 0 && (
    <div className="relative">
      <div
        ref={carouselRef}
        onScroll={updateScrollButtons}
        className={cn(
          mode === 'submit'
            ? 'scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2'
            : 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4',
        )}
      >
        {files.map((fileEntry, index) => (
          <motion.div
            key={`${fileEntry.file.name}-${index}`}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              'group relative overflow-hidden rounded-xl border',
              mode === 'submit'
                ? 'w-[80%] shrink-0 snap-center sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)]'
                : '',
            )}
          >
            {extraction.status === 'extracting' && <ScanAnimation />}
            <Image
              src={fileEntry.preview}
              alt={fileEntry.file.name}
              width={400}
              height={mode === 'submit' ? 267 : 200}
              className={cn(
                'w-full object-cover',
                mode === 'submit' ? 'aspect-[3/2]' : 'aspect-square',
              )}
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2.5 pt-5 pb-2">
              <p className="truncate text-xs font-medium text-white">
                {fileEntry.file.name}
              </p>
              <div className="flex items-center gap-1 text-xs">
                {fileEntry.status === 'pending' && (
                  <span className="text-white/70">Ready to upload</span>
                )}
                {fileEntry.status === 'uploading' && (
                  <span className="flex items-center gap-1 text-white/70">
                    <Loader2 className="size-3 animate-spin" />
                    Uploading...
                  </span>
                )}
                {fileEntry.status === 'uploaded' && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CheckCircle className="size-3" />
                    Uploaded
                  </span>
                )}
                {fileEntry.status === 'error' && (
                  <span className="flex items-center gap-1 text-red-300">
                    <XCircle className="size-3" />
                    {fileEntry.error || 'Failed'}
                  </span>
                )}
              </div>
            </div>
            {fileEntry.quality?.level === 'warning' && (
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="absolute top-1.5 left-1.5 flex size-6 cursor-help items-center justify-center rounded-full bg-amber-500/90 text-white shadow-sm">
                    <AlertTriangle className="size-3.5" />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom"
                  align="start"
                  className="w-64 p-3"
                >
                  <p className="text-[13px] leading-tight font-semibold">
                    Image Quality Warning
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {fileEntry.quality.issues[0]?.message ||
                      'This image may be too small for accurate text detection.'}
                  </p>
                  <p className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground/70">
                    For best results, use images at least 500px wide with clear,
                    legible text.
                  </p>
                </HoverCardContent>
              </HoverCard>
            )}
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="hover:text-destructive-foreground absolute top-1 right-1 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive active:scale-95"
              aria-label={`Remove ${fileEntry.file.name}`}
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Carousel navigation arrows (submit mode only) */}
      {mode === 'submit' && files.length > 1 && (
        <>
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollCarousel('left')}
              className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md transition-colors hover:bg-accent"
              aria-label="Scroll left"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollCarousel('right')}
              className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md transition-colors hover:bg-accent"
              aria-label="Scroll right"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Submit mode: Unified upload area (dropzone + carousel merged)
  // -------------------------------------------------------------------------

  const unifiedUploadArea = (
    <div
      {...getRootProps()}
      className={cn(
        'rounded-xl border-2 border-dashed transition-all',
        isDragActive
          ? 'scale-[1.01] border-primary bg-primary/5'
          : files.length === 0
            ? 'border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/30'
            : 'border-muted-foreground/25',
        files.length === 0 && 'cursor-pointer',
      )}
      onClick={files.length === 0 ? openFileDialog : undefined}
    >
      <input {...getInputProps()} />
      {cameraInput}
      {files.length === 0 ? (
        <div className="flex min-h-[34rem] flex-col gap-5 p-5">
          {/* Ghost placeholder cards */}
          <div className="flex flex-1 gap-3">
            <div className="group/front flex w-full flex-1 flex-col pb-1 sm:w-1/2 md:w-1/3 md:flex-none">
              <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out group-hover/front:-translate-y-1 group-hover/front:border-primary/40 group-hover/front:bg-primary/[0.04] group-hover/front:shadow-md">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60 transition-[background-color] duration-200 ease-out group-hover/front:bg-primary/15">
                  <ImagePlus className="size-5 text-muted-foreground/40 transition-[color] duration-200 ease-out group-hover/front:text-primary/70" />
                </div>
                <span className="text-xs font-medium text-muted-foreground/40 transition-[color] duration-200 ease-out group-hover/front:text-primary/70">
                  Front label
                </span>
              </div>
            </div>
            <div className="group/back hidden flex-1 flex-col pb-1 sm:flex sm:w-1/2 md:w-1/3 md:flex-none">
              <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-muted-foreground/15 bg-muted/5 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out group-hover/back:-translate-y-1 group-hover/back:border-primary/40 group-hover/back:bg-primary/[0.04] group-hover/back:shadow-md">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted/40 transition-[background-color] duration-200 ease-out group-hover/back:bg-primary/15">
                  <ImagePlus className="size-5 text-muted-foreground/25 transition-[color] duration-200 ease-out group-hover/back:text-primary/70" />
                </div>
                <span className="text-xs font-medium text-muted-foreground/25 transition-[color] duration-200 ease-out group-hover/back:text-primary/70">
                  Back label
                </span>
              </div>
            </div>
          </div>
          {/* Upload instructions */}
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium">
              {isDragActive
                ? 'Drop images here...'
                : 'Drag and drop label images, or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP up to 10 MB
            </p>
            {isTouchDevice ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openCamera()
                }}
                className="mt-1 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Camera className="size-3.5" />
                Take a photo
              </button>
            ) : (
              origin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowQrDialog(true)
                  }}
                  className="mt-1 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Smartphone className="size-3.5" />
                  Take a photo with your phone
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="relative">
            <div
              ref={carouselRef}
              onScroll={updateScrollButtons}
              className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1"
            >
              <AnimatePresence>
                {files.map((fileEntry, index) => (
                  <motion.div
                    key={`${fileEntry.file.name}-${index}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative h-[31rem] w-[75%] shrink-0 snap-center overflow-hidden rounded-xl border bg-muted/20 sm:w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)]"
                  >
                    {extraction.status === 'extracting' && <ScanAnimation />}
                    <Image
                      src={fileEntry.preview}
                      alt={fileEntry.file.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2.5 pt-5 pb-2">
                      <p className="truncate text-xs font-medium text-white">
                        {fileEntry.file.name}
                      </p>
                      <div className="flex items-center gap-1 text-xs">
                        {fileEntry.status === 'pending' && (
                          <span className="text-white/70">Ready</span>
                        )}
                        {fileEntry.status === 'uploading' && (
                          <span className="flex items-center gap-1 text-white/70">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading...
                          </span>
                        )}
                        {fileEntry.status === 'uploaded' && (
                          <span className="flex items-center gap-1 text-emerald-300">
                            <CheckCircle className="size-3" />
                            Uploaded
                          </span>
                        )}
                        {fileEntry.status === 'error' && (
                          <span className="flex items-center gap-1 text-red-300">
                            <XCircle className="size-3" />
                            {fileEntry.error || 'Failed'}
                          </span>
                        )}
                      </div>
                    </div>
                    {fileEntry.quality?.level === 'warning' && (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="absolute top-1.5 left-1.5 flex size-6 cursor-help items-center justify-center rounded-full bg-amber-500/90 text-white shadow-sm">
                            <AlertTriangle className="size-3.5" />
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="bottom"
                          align="start"
                          className="w-64 p-3"
                        >
                          <p className="text-[13px] leading-tight font-semibold">
                            Image Quality Warning
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                            {fileEntry.quality.issues[0]?.message ||
                              'This image may be too small for accurate text detection.'}
                          </p>
                          <p className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground/70">
                            For best results, use images at least 500px wide
                            with clear, legible text.
                          </p>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(index)
                      }}
                      className="hover:text-destructive-foreground absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive active:scale-95"
                      aria-label={`Remove ${fileEntry.file.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add more card */}
              <div className="flex h-[31rem] w-[75%] shrink-0 snap-center flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 sm:w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openFileDialog()
                  }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Upload className="size-4" />
                  {isTouchDevice ? 'Browse files' : 'Add more'}
                </button>
                {isTouchDevice ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openCamera()
                    }}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Camera className="size-4" />
                    Take a photo
                  </button>
                ) : (
                  origin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowQrDialog(true)
                      }}
                      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Smartphone className="size-4" />
                      Use your phone
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Carousel arrows */}
            {files.length > 1 && (
              <>
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      scrollCarousel('left')
                    }}
                    className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md transition-colors hover:bg-accent"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      scrollCarousel('right')
                    }}
                    className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md transition-colors hover:bg-accent"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Shared: Form fields (used by both modes)
  // -------------------------------------------------------------------------

  const formFields = (
    <>
      {extraction.status === 'extracting' ? (
        <div className="space-y-6">
          {/* Class/Type Code + Container Size skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
          </div>
          {/* Serial + Brand skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
          </div>
          {/* Fanciful + Class/Type skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
          </div>
          {/* Alcohol + Net Contents skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
              <FieldShimmer />
            </div>
          </div>
          <div className="h-px animate-pulse bg-muted/40" />
          {/* Name/Address + Qualifying Phrase skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
              <FieldShimmer className="h-20" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                <FieldShimmer />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                <FieldShimmer />
              </div>
            </div>
          </div>
          {/* Beverage-specific section skeleton */}
          {beverageType && (
            <>
              <div className="h-px animate-pulse bg-muted/40" />
              <div className="space-y-4">
                <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                    <FieldShimmer />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                    <FieldShimmer />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Brand Name + Serial Number — primary identifiers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brandName" className="flex items-center gap-1.5">
                <FieldLabel fieldName="brand_name">
                  Brand Name (Item 6)
                </FieldLabel>{' '}
                <span className="text-destructive">*</span>
                <AiFieldIndicator fieldName="brand_name" />
              </Label>
              <Input
                id="brandName"
                placeholder="e.g., Maker's Mark"
                className={cn(
                  extraction.aiOriginalValues.has('brand_name') &&
                    !extraction.modifiedFields.has('brand_name') &&
                    'bg-indigo-50/50 dark:bg-indigo-950/20',
                )}
                {...register('brandName')}
                onFocus={() => handleFieldFocus('brand_name')}
                onChange={(e) => {
                  register('brandName').onChange(e)
                  handleFieldChange('brand_name')
                }}
                aria-invalid={!!errors.brandName}
              />
              {errors.brandName && (
                <p className="text-sm text-destructive">
                  {errors.brandName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="fancifulName"
                className="flex items-center gap-1.5"
              >
                <FieldLabel fieldName="fanciful_name">
                  Fanciful Name (Item 7)
                </FieldLabel>
                <AiFieldIndicator fieldName="fanciful_name" />
              </Label>
              <Input
                id="fancifulName"
                placeholder="Optional"
                className={cn(
                  extraction.aiOriginalValues.has('fanciful_name') &&
                    !extraction.modifiedFields.has('fanciful_name') &&
                    'bg-indigo-50/50 dark:bg-indigo-950/20',
                )}
                {...register('fancifulName')}
                onFocus={() => handleFieldFocus('fanciful_name')}
                onChange={(e) => {
                  register('fancifulName').onChange(e)
                  handleFieldChange('fanciful_name')
                }}
              />
            </div>
          </div>

          {/* Serial Number + Class/Type Designation */}
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
              <Label htmlFor="classType" className="flex items-center gap-1.5">
                <FieldLabel fieldName="class_type">
                  Class/Type Designation
                </FieldLabel>
                <AiFieldIndicator fieldName="class_type" />
              </Label>
              <Input
                id="classType"
                placeholder="e.g., Kentucky Straight Bourbon Whisky"
                className={cn(
                  extraction.aiOriginalValues.has('class_type') &&
                    !extraction.modifiedFields.has('class_type') &&
                    'bg-indigo-50/50 dark:bg-indigo-950/20',
                )}
                {...register('classType')}
                onFocus={() => handleFieldFocus('class_type')}
                onChange={(e) => {
                  register('classType').onChange(e)
                  handleFieldChange('class_type')
                }}
              />
            </div>
          </div>

          {/* Class/Type Code + Total Bottle Capacity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="classTypeCode">
                <FieldLabel fieldName="class_type">Class/Type Code</FieldLabel>
              </Label>
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
                <FieldLabel fieldName="standards_of_fill">
                  Total Bottle Capacity (mL)
                </FieldLabel>
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

          {/* Alcohol Content + Net Contents */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="alcoholContent"
                className="flex items-center gap-1.5"
              >
                <FieldLabel fieldName="alcohol_content">
                  Alcohol Content
                </FieldLabel>
                <AiFieldIndicator fieldName="alcohol_content" />
              </Label>
              <Input
                id="alcoholContent"
                placeholder="e.g., 45% Alc./Vol."
                className={cn(
                  extraction.aiOriginalValues.has('alcohol_content') &&
                    !extraction.modifiedFields.has('alcohol_content') &&
                    'bg-indigo-50/50 dark:bg-indigo-950/20',
                )}
                {...register('alcoholContent')}
                onFocus={() => handleFieldFocus('alcohol_content')}
                onChange={(e) => {
                  register('alcoholContent').onChange(e)
                  handleFieldChange('alcohol_content')
                }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="netContents"
                className="flex items-center gap-1.5"
              >
                <FieldLabel fieldName="net_contents">Net Contents</FieldLabel>
                <AiFieldIndicator fieldName="net_contents" />
              </Label>
              <Input
                id="netContents"
                placeholder="e.g., 750 mL"
                className={cn(
                  extraction.aiOriginalValues.has('net_contents') &&
                    !extraction.modifiedFields.has('net_contents') &&
                    'bg-indigo-50/50 dark:bg-indigo-950/20',
                )}
                {...register('netContents')}
                onFocus={() => handleFieldFocus('net_contents')}
                onChange={(e) => {
                  register('netContents').onChange(e)
                  handleFieldChange('net_contents')
                }}
              />
            </div>
          </div>

          <Separator />

          {/* Name, Address, and Qualifying Phrase */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="nameAndAddress"
                className="flex items-center gap-1.5"
              >
                <FieldLabel fieldName="name_and_address">
                  Name and Address (Item 8)
                </FieldLabel>
                <AiFieldIndicator fieldName="name_and_address" />
              </Label>
              <Textarea
                id="nameAndAddress"
                rows={3}
                placeholder="e.g., Beam Suntory, Clermont, KY"
                className={cn(
                  extraction.aiOriginalValues.has('name_and_address') &&
                    !extraction.modifiedFields.has('name_and_address') &&
                    'bg-indigo-50/50 dark:bg-indigo-950/20',
                )}
                {...register('nameAndAddress')}
                onFocus={() => handleFieldFocus('name_and_address')}
                onChange={(e) => {
                  register('nameAndAddress').onChange(e)
                  handleFieldChange('name_and_address')
                }}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="qualifyingPhrase"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="qualifying_phrase">
                    Qualifying Phrase
                  </FieldLabel>
                  <AiFieldIndicator fieldName="qualifying_phrase" />
                </Label>
                <Select
                  value={watch('qualifyingPhrase') || ''}
                  onValueChange={(value) => {
                    setValue('qualifyingPhrase', value, {
                      shouldValidate: true,
                    })
                    handleFieldChange('qualifying_phrase')
                  }}
                >
                  <SelectTrigger
                    id="qualifyingPhrase"
                    className="w-full"
                    onFocus={() => handleFieldFocus('qualifying_phrase')}
                  >
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
                <Label
                  htmlFor="countryOfOrigin"
                  className="flex items-center gap-1.5"
                >
                  <FieldLabel fieldName="country_of_origin">
                    Country of Origin
                  </FieldLabel>
                  <AiFieldIndicator fieldName="country_of_origin" />
                </Label>
                <Input
                  id="countryOfOrigin"
                  placeholder="e.g., United States"
                  className={cn(
                    extraction.aiOriginalValues.has('country_of_origin') &&
                      !extraction.modifiedFields.has('country_of_origin') &&
                      'bg-indigo-50/50 dark:bg-indigo-950/20',
                  )}
                  {...register('countryOfOrigin')}
                  onFocus={() => handleFieldFocus('country_of_origin')}
                  onChange={(e) => {
                    register('countryOfOrigin').onChange(e)
                    handleFieldChange('country_of_origin')
                  }}
                />
              </div>
            </div>
          </div>

          {/* Health Warning Statement (validate mode only — submit auto-submits default) */}
          {mode === 'validate' && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="healthWarning">
                  <FieldLabel fieldName="health_warning">
                    Health Warning Statement
                  </FieldLabel>
                </Label>
                <Textarea
                  id="healthWarning"
                  rows={4}
                  className="font-mono text-xs"
                  {...register('healthWarning')}
                  onFocus={() => handleFieldFocus('health_warning')}
                />
                <p className="text-xs text-muted-foreground">
                  Pre-filled with the standard GOVERNMENT WARNING per 27 CFR
                  Part 16.
                </p>
              </div>
            </>
          )}

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
                    <Label
                      htmlFor="grapeVarietal"
                      className="flex items-center gap-1.5"
                    >
                      <FieldLabel fieldName="grape_varietal">
                        Grape Varietal (Item 10)
                      </FieldLabel>
                      <AiFieldIndicator fieldName="grape_varietal" />
                    </Label>
                    <Input
                      id="grapeVarietal"
                      placeholder="e.g., Cabernet Sauvignon"
                      className={cn(
                        extraction.aiOriginalValues.has('grape_varietal') &&
                          !extraction.modifiedFields.has('grape_varietal') &&
                          'bg-indigo-50/50 dark:bg-indigo-950/20',
                      )}
                      {...register('grapeVarietal')}
                      onFocus={() => handleFieldFocus('grape_varietal')}
                      onChange={(e) => {
                        register('grapeVarietal').onChange(e)
                        handleFieldChange('grape_varietal')
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="appellationOfOrigin"
                      className="flex items-center gap-1.5"
                    >
                      <FieldLabel fieldName="appellation_of_origin">
                        Appellation of Origin (Item 14)
                      </FieldLabel>
                      <AiFieldIndicator fieldName="appellation_of_origin" />
                    </Label>
                    <Input
                      id="appellationOfOrigin"
                      placeholder="e.g., Napa Valley"
                      className={cn(
                        extraction.aiOriginalValues.has(
                          'appellation_of_origin',
                        ) &&
                          !extraction.modifiedFields.has(
                            'appellation_of_origin',
                          ) &&
                          'bg-indigo-50/50 dark:bg-indigo-950/20',
                      )}
                      {...register('appellationOfOrigin')}
                      onFocus={() => handleFieldFocus('appellation_of_origin')}
                      onChange={(e) => {
                        register('appellationOfOrigin').onChange(e)
                        handleFieldChange('appellation_of_origin')
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="vintageYear"
                      className="flex items-center gap-1.5"
                    >
                      <FieldLabel fieldName="vintage_year">
                        Vintage Year (Item 15)
                      </FieldLabel>
                      <AiFieldIndicator fieldName="vintage_year" />
                    </Label>
                    <Input
                      id="vintageYear"
                      placeholder="e.g., 2022"
                      className={cn(
                        extraction.aiOriginalValues.has('vintage_year') &&
                          !extraction.modifiedFields.has('vintage_year') &&
                          'bg-indigo-50/50 dark:bg-indigo-950/20',
                      )}
                      {...register('vintageYear')}
                      onFocus={() => handleFieldFocus('vintage_year')}
                      onChange={(e) => {
                        register('vintageYear').onChange(e)
                        handleFieldChange('vintage_year')
                      }}
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
                      <FieldLabel fieldName="sulfite_declaration">
                        Contains Sulfites
                      </FieldLabel>
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
                    <Label
                      htmlFor="ageStatement"
                      className="flex items-center gap-1.5"
                    >
                      <FieldLabel fieldName="age_statement">
                        Age Statement
                      </FieldLabel>
                      <AiFieldIndicator fieldName="age_statement" />
                    </Label>
                    <Input
                      id="ageStatement"
                      placeholder="e.g., Aged 12 Years"
                      className={cn(
                        extraction.aiOriginalValues.has('age_statement') &&
                          !extraction.modifiedFields.has('age_statement') &&
                          'bg-indigo-50/50 dark:bg-indigo-950/20',
                      )}
                      {...register('ageStatement')}
                      onFocus={() => handleFieldFocus('age_statement')}
                      onChange={(e) => {
                        register('ageStatement').onChange(e)
                        handleFieldChange('age_statement')
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="stateOfDistillation"
                      className="flex items-center gap-1.5"
                    >
                      <FieldLabel fieldName="state_of_distillation">
                        State of Distillation
                      </FieldLabel>
                      <AiFieldIndicator fieldName="state_of_distillation" />
                    </Label>
                    <Input
                      id="stateOfDistillation"
                      placeholder="e.g., Kentucky"
                      className={cn(
                        extraction.aiOriginalValues.has(
                          'state_of_distillation',
                        ) &&
                          !extraction.modifiedFields.has(
                            'state_of_distillation',
                          ) &&
                          'bg-indigo-50/50 dark:bg-indigo-950/20',
                      )}
                      {...register('stateOfDistillation')}
                      onFocus={() => handleFieldFocus('state_of_distillation')}
                      onChange={(e) => {
                        register('stateOfDistillation').onChange(e)
                        handleFieldChange('state_of_distillation')
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
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
            {dropzone}
            {imageCarousel}
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
                <AiFieldIndicator fieldName="beverage_type" />
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

                  {unifiedUploadArea}

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
                    {files.length} image{files.length !== 1 ? 's' : ''}
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
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Hidden file inputs — always in DOM for add-photos-in-review */}
      {showSplitPane && (
        <div className="hidden">
          <input {...getInputProps()} />
          {cameraInput}
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
              {files.length - imageCountAtLastScan} new photo
              {files.length - imageCountAtLastScan !== 1 ? 's' : ''} added
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
              Re-scan with {files.length} image
              {files.length !== 1 ? 's' : ''}
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
  )
}
