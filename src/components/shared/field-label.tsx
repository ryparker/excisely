import { Info } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>
            {displayText}
            <Info className="ml-1 inline size-3 text-muted-foreground/60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
