'use client'

import { useEffect, useRef } from 'react'

import { useExtractionStore } from '@/stores/useExtractionStore'

import { SNAKE_TO_CAMEL } from './UploadFormConstants'

const HIGHLIGHT_TIMEOUT_MS = 4000

export function useFieldHighlight() {
  const extraction = useExtractionStore()
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount
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

  return {
    handleFieldFocus,
    handleBboxClick,
    handleFieldChange,
  }
}
