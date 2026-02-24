'use client'

import { useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { extractFieldsFromImage } from '@/app/actions/extract-fields-from-image'
import { BEVERAGE_TYPES, type BeverageType } from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import { parseNetContentsToMl } from '@/lib/labels/parse-net-contents'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import { useExtractionStore } from '@/stores/useExtractionStore'

import { SNAKE_TO_CAMEL, PREFILLABLE_FIELDS } from './UploadFormConstants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseScanLabelsParams {
  form: UseFormReturn<ValidateLabelInput>
  uploadFiles: () => Promise<string[]>
  fileCount: number
  setBeverageTypeSource: (source: 'user' | 'ai' | null) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScanLabels({
  form,
  uploadFiles,
  fileCount,
  setBeverageTypeSource,
}: UseScanLabelsParams) {
  const { setValue, getValues, reset } = form
  const extraction = useExtractionStore()

  const [hasScannedOnce, setHasScannedOnce] = useState(false)
  const [imageCountAtLastScan, setImageCountAtLastScan] = useState(0)
  const [manualFormEntry, setManualFormEntry] = useState(false)

  // Pending pre-fill values — applied after Phase 3 mounts (fields must be registered first)
  const pendingPrefillRef = useRef<Map<
    keyof ValidateLabelInput,
    string
  > | null>(null)

  // -------------------------------------------------------------------------
  // Scan handler
  // -------------------------------------------------------------------------

  async function handleScanLabels() {
    if (fileCount === 0) return

    extraction.startExtraction()

    try {
      const imageUrls = await uploadFiles()
      const beverageType = getValues('beverageType')

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
      setImageCountAtLastScan(fileCount)

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

  return {
    hasScannedOnce,
    imageCountAtLastScan,
    manualFormEntry,
    setManualFormEntry,
    pendingPrefillRef,
    handleScanLabels,
  }
}
