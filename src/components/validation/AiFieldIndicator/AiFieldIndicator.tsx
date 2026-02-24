'use client'

import { Pencil, Sparkles } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { useExtractionStore } from '@/stores/useExtractionStore'

interface AiFieldIndicatorProps {
  fieldName: string
  showSplitPane: boolean
  onFieldFocus: (fieldName: string) => void
}

export function AiFieldIndicator({
  fieldName,
  showSplitPane,
  onFieldFocus,
}: AiFieldIndicatorProps) {
  const extraction = useExtractionStore()

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
                onFieldFocus(fieldName)
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
