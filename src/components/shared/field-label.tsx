'use client'

import { useCallback, useRef, useState } from 'react'
import { Info, Scale } from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RegulationQuickView } from '@/components/shared/regulation-quick-view'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'
import { getSection } from '@/lib/regulations/lookup'

interface FieldLabelProps {
  /** The field key (e.g. 'brand_name', 'class_type') used to look up the tooltip. */
  fieldName: string
  /** Display text. Falls back to fieldName formatted as title case if omitted. */
  children?: React.ReactNode
  /** Additional CSS classes applied to the wrapper span. */
  className?: string
}

export function FieldLabel({
  fieldName,
  children,
  className,
}: FieldLabelProps) {
  const tooltip = FIELD_TOOLTIPS[fieldName]
  const displayText = children ?? fieldName.replace(/_/g, ' ')

  if (!tooltip) {
    return <span className={className}>{displayText}</span>
  }

  return (
    <span className={className}>
      {displayText}
      <FieldInfoPopover fieldName={fieldName} tooltip={tooltip} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inner component (needs hooks, split out so FieldLabel can early-return)
// ---------------------------------------------------------------------------

interface FieldInfoPopoverProps {
  fieldName: string
  tooltip: (typeof FIELD_TOOLTIPS)[string]
}

function FieldInfoPopover({ fieldName, tooltip }: FieldInfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  const title = FIELD_DISPLAY_NAMES[fieldName] ?? fieldName.replace(/_/g, ' ')

  const cfrSections = tooltip.cfr
    ?.map((id) => {
      const section = getSection(id)
      return section ? section : null
    })
    .filter(Boolean) as
    | Array<NonNullable<ReturnType<typeof getSection>>>
    | undefined

  const handlePointerEnter = useCallback(() => {
    // Only hover-open for mouse (not touch)
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    hoverTimeout.current = setTimeout(() => setOpen(true), 200)
  }, [])

  const handlePointerLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    closeTimeout.current = setTimeout(() => setOpen(false), 150)
  }, [])

  const handleContentPointerEnter = useCallback(() => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') handlePointerEnter()
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') handlePointerLeave()
          }}
          className="ml-1 inline-flex translate-y-px items-center rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Info about ${title}`}
        >
          <Info className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-3"
        onPointerEnter={handleContentPointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] leading-tight font-semibold">{title}</p>
          {tooltip.reference && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {tooltip.reference}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {tooltip.description}
        </p>
        {tooltip.example && (
          <p className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground/70">
            e.g. {tooltip.example}
          </p>
        )}
        {cfrSections && cfrSections.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
              <Scale className="size-2.5" />
              Regulations
            </p>
            <div className="flex flex-wrap gap-1">
              {cfrSections.map((section) => (
                <RegulationQuickView
                  key={section.section}
                  citation={section.citation}
                  title={section.title}
                  summary={section.summary}
                  keyRequirements={section.keyRequirements}
                  relatedFields={section.relatedFields}
                  ecfrUrl={section.ecfrUrl}
                  contextPart={section.part}
                  contextField={fieldName}
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
