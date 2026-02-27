import { create } from 'zustand'

import type { CsvRowData } from '@/lib/validators/csv-row-schema'
import type { CsvRowError } from '@/components/submit/BatchUpload/CsvParser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BatchPhase = 'upload' | 'processing' | 'results'

export type RowProcessingStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'

export interface BatchRow {
  index: number
  data: CsvRowData
  errors: CsvRowError[]
  imageFilenames: string[]
}

export interface BatchRowResult {
  status: 'success' | 'error'
  labelId?: string
  error?: string
}

interface BatchUploadState {
  phase: BatchPhase
  csvFile: File | null
  imageFiles: Map<string, File>
  rows: BatchRow[]
  validCount: number
  invalidCount: number
  parseErrors: string[]
  duplicateImages: string[]
  rowResults: Map<number, BatchRowResult>
  rowProcessingStatus: Map<number, RowProcessingStatus>

  // Actions
  setCsvData: (data: {
    file: File
    rows: BatchRow[]
    validCount: number
    invalidCount: number
    parseErrors: string[]
    duplicateImages: string[]
  }) => void
  addImageFiles: (files: File[]) => void
  removeImageFile: (filename: string) => void
  setPhase: (phase: BatchPhase) => void
  setRowProcessingStatus: (index: number, status: RowProcessingStatus) => void
  setRowResult: (index: number, result: BatchRowResult) => void
  reset: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState = {
  phase: 'upload' as BatchPhase,
  csvFile: null as File | null,
  imageFiles: new Map<string, File>(),
  rows: [] as BatchRow[],
  validCount: 0,
  invalidCount: 0,
  parseErrors: [] as string[],
  duplicateImages: [] as string[],
  rowResults: new Map<number, BatchRowResult>(),
  rowProcessingStatus: new Map<number, RowProcessingStatus>(),
}

export const useBatchUploadStore = create<BatchUploadState>((set) => ({
  ...initialState,

  setCsvData: ({
    file,
    rows,
    validCount,
    invalidCount,
    parseErrors,
    duplicateImages,
  }) =>
    set({
      csvFile: file,
      rows,
      validCount,
      invalidCount,
      parseErrors,
      duplicateImages,
    }),

  addImageFiles: (files) =>
    set((state) => {
      const next = new Map(state.imageFiles)
      for (const file of files) {
        next.set(file.name, file)
      }
      return { imageFiles: next }
    }),

  removeImageFile: (filename) =>
    set((state) => {
      const next = new Map(state.imageFiles)
      next.delete(filename)
      return { imageFiles: next }
    }),

  setPhase: (phase) => set({ phase }),

  setRowProcessingStatus: (index, status) =>
    set((state) => {
      const next = new Map(state.rowProcessingStatus)
      next.set(index, status)
      return { rowProcessingStatus: next }
    }),

  setRowResult: (index, result) =>
    set((state) => {
      const next = new Map(state.rowResults)
      next.set(index, result)
      return { rowResults: next }
    }),

  reset: () => set({ ...initialState }),
}))
