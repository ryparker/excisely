import { create } from 'zustand'

import type { ApplicantExtractedField } from '@/app/actions/extract-fields-from-image'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BatchItemStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'submitting'
  | 'submitted'
  | 'error'

export interface BatchItem {
  id: string
  file: File
  preview: string
  status: BatchItemStatus
  imageUrl: string | null
  error: string | null

  /** AI-extracted fields (snake_case keys) */
  extractedFields: Record<string, string>
  /** User-edited fields (snake_case keys) -- overrides extractedFields */
  editedFields: Record<string, string>
  /** Detected beverage type from AI */
  detectedBeverageType: BeverageType | null
  /** User-selected beverage type */
  beverageType: BeverageType | null
  /** Container size in mL */
  containerSizeMl: number | null
  /** Bounding box data for image viewer */
  fields: ApplicantExtractedField[]

  /** Resulting label ID after submission */
  labelId: string | null
}

interface BatchUploadState {
  items: BatchItem[]
  overallStatus:
    | 'idle'
    | 'uploading'
    | 'extracting'
    | 'ready'
    | 'submitting'
    | 'done'
  progress: { current: number; total: number }

  addItems: (items: BatchItem[]) => void
  removeItem: (id: string) => void
  clearAll: () => void

  updateItem: (id: string, updates: Partial<BatchItem>) => void
  updateItemField: (id: string, fieldName: string, value: string) => void
  setBeverageType: (id: string, type: BeverageType) => void
  setContainerSize: (id: string, sizeMl: number) => void

  setOverallStatus: (status: BatchUploadState['overallStatus']) => void
  setProgress: (current: number, total: number) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let idCounter = 0

export function createBatchItemId(): string {
  return `batch-item-${++idCounter}-${Date.now()}`
}

export const useBatchUploadStore = create<BatchUploadState>((set) => ({
  items: [],
  overallStatus: 'idle',
  progress: { current: 0, total: 0 },

  addItems: (newItems) =>
    set((state) => ({
      items: [...state.items, ...newItems],
    })),

  removeItem: (id) =>
    set((state) => {
      const item = state.items.find((i) => i.id === id)
      if (item) {
        URL.revokeObjectURL(item.preview)
      }
      return { items: state.items.filter((i) => i.id !== id) }
    }),

  clearAll: () =>
    set((state) => {
      for (const item of state.items) {
        URL.revokeObjectURL(item.preview)
      }
      return {
        items: [],
        overallStatus: 'idle',
        progress: { current: 0, total: 0 },
      }
    }),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    })),

  updateItemField: (id, fieldName, value) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              editedFields: { ...item.editedFields, [fieldName]: value },
            }
          : item,
      ),
    })),

  setBeverageType: (id, type) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, beverageType: type } : item,
      ),
    })),

  setContainerSize: (id, sizeMl) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, containerSizeMl: sizeMl } : item,
      ),
    })),

  setOverallStatus: (overallStatus) => set({ overallStatus }),

  setProgress: (current, total) => set({ progress: { current, total } }),
}))
