import { Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'

export interface ApplicantCorrection {
  fieldName: string
  aiExtractedValue: string
  applicantSubmittedValue: string
}

export function ApplicantCorrectionBadge({
  correction,
}: {
  correction: ApplicantCorrection
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className="ml-1 h-5 cursor-help gap-1 border-amber-200 px-1.5 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-400"
        >
          <Pencil className="size-2.5" />
          Applicant edited
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-72">
        <div className="space-y-2 text-xs">
          <p className="font-medium">
            The applicant changed the AI-extracted value for this field.
          </p>
          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground">AI extracted: </span>
              <span className="font-mono">
                {correction.aiExtractedValue || '(empty)'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Applicant submitted:{' '}
              </span>
              <span className="font-mono">
                {correction.applicantSubmittedValue || '(empty)'}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
