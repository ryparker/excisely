import { Info, Scale } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
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

  const title = FIELD_DISPLAY_NAMES[fieldName] ?? fieldName.replace(/_/g, ' ')

  const cfrSections = tooltip.cfr
    ?.map((id) => {
      const section = getSection(id)
      return section ? section : null
    })
    .filter(Boolean) as
    | Array<NonNullable<ReturnType<typeof getSection>>>
    | undefined

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className={className}>
          {displayText}
          <Info className="ml-1 inline size-3 text-muted-foreground/50" />
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-72 p-3">
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
      </HoverCardContent>
    </HoverCard>
  )
}
