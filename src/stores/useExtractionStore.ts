import { create } from 'zustand'

import type { ApplicantExtractedField } from '@/app/actions/extract-fields-from-image'

interface ImageClassification {
  imageIndex: number
  imageType: 'front' | 'back' | 'neck' | 'strip' | 'other'
  confidence: number
}

export type SubmissionStep = 1 | 2 | 3 | 4 | 5

interface ExtractionState {
  status: 'idle' | 'extracting' | 'success' | 'error'
  fields: ApplicantExtractedField[]
  imageClassifications: ImageClassification[]
  detectedBeverageType: string | null
  error: string | null
  activeHighlightField: string | null
  /** AI's original extracted value for each field (field name -> value) */
  aiOriginalValues: Map<string, string>
  /** Fields the applicant has edited after AI pre-fill */
  modifiedFields: Set<string>
  /** Current step in the submission flow (1-5) */
  submissionStep: SubmissionStep

  startExtraction: () => void
  setResult: (data: {
    fields: ApplicantExtractedField[]
    imageClassifications: ImageClassification[]
    detectedBeverageType: string | null
  }) => void
  setError: (error: string) => void
  reset: () => void
  setActiveHighlight: (fieldName: string | null) => void
  recordOriginalValue: (fieldName: string, value: string) => void
  markModified: (fieldName: string) => void
  setSubmissionStep: (step: SubmissionStep) => void
}

export const useExtractionStore = create<ExtractionState>((set) => ({
  status: 'idle',
  fields: [],
  imageClassifications: [],
  detectedBeverageType: null,
  error: null,
  activeHighlightField: null,
  aiOriginalValues: new Map(),
  modifiedFields: new Set(),
  submissionStep: 1,

  startExtraction: () =>
    set({
      status: 'extracting',
      fields: [],
      imageClassifications: [],
      detectedBeverageType: null,
      error: null,
      submissionStep: 2,
    }),

  setResult: (data) =>
    set({
      status: 'success',
      fields: data.fields,
      imageClassifications: data.imageClassifications,
      detectedBeverageType: data.detectedBeverageType,
      error: null,
      submissionStep: 3,
    }),

  setError: (error) =>
    set({
      status: 'error',
      error,
    }),

  reset: () =>
    set({
      status: 'idle',
      fields: [],
      imageClassifications: [],
      detectedBeverageType: null,
      error: null,
      activeHighlightField: null,
      aiOriginalValues: new Map(),
      modifiedFields: new Set(),
      submissionStep: 1,
    }),

  setActiveHighlight: (fieldName) => set({ activeHighlightField: fieldName }),

  recordOriginalValue: (fieldName, value) =>
    set((state) => {
      const next = new Map(state.aiOriginalValues)
      next.set(fieldName, value)
      return { aiOriginalValues: next }
    }),

  markModified: (fieldName) =>
    set((state) => ({
      modifiedFields: new Set([...state.modifiedFields, fieldName]),
    })),

  setSubmissionStep: (step) => set({ submissionStep: step }),
}))
