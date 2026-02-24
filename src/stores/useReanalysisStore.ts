import { create } from 'zustand'

interface ReanalysisState {
  /** Set of label IDs currently being reanalyzed */
  activeIds: Set<string>
  startReanalyzing: (id: string) => void
  stopReanalyzing: (id: string) => void
}

export const useReanalysisStore = create<ReanalysisState>((set) => ({
  activeIds: new Set(),
  startReanalyzing: (id) =>
    set((state) => ({
      activeIds: new Set([...state.activeIds, id]),
    })),
  stopReanalyzing: (id) =>
    set((state) => {
      const next = new Set(state.activeIds)
      next.delete(id)
      return { activeIds: next }
    }),
}))
