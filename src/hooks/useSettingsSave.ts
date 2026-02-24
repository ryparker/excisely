'use client'

import { useCallback, useRef, useState, useTransition } from 'react'

type ActionResult = { success: boolean; error?: string }

interface UseSettingsSaveOptions {
  debounceMs?: number
  clearAfterMs?: number
}

interface UseSettingsSaveReturn {
  isPending: boolean
  saved: boolean
  error: string | null
  save: (fn: () => Promise<ActionResult>) => void
}

export function useSettingsSave({
  debounceMs = 500,
  clearAfterMs = 2000,
}: UseSettingsSaveOptions = {}): UseSettingsSaveReturn {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    (fn: () => Promise<ActionResult>) => {
      const execute = () => {
        startTransition(async () => {
          setError(null)
          setSaved(false)
          const result = await fn()
          if (result.success) {
            setSaved(true)
            setTimeout(() => setSaved(false), clearAfterMs)
          } else {
            setError(result.error ?? 'An unexpected error occurred')
          }
        })
      }

      if (debounceMs > 0) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(execute, debounceMs)
      } else {
        execute()
      }
    },
    [startTransition, debounceMs, clearAfterMs],
  )

  return { isPending, saved, error, save }
}
