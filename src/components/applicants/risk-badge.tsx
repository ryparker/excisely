'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const RISK_DESCRIPTIONS = {
  none: 'No reviewed labels yet — risk will be calculated once labels are reviewed.',
  low: 'Approval rate ≥ 90%. Consistently compliant submissions — routine review.',
  medium:
    'Approval rate 70–89%. Some labels needed corrections — review with moderate attention.',
  high: 'Approval rate below 70%. Frequent issues found — review carefully for recurring problems.',
} as const

export function RiskBadge({ approvalRate }: { approvalRate: number | null }) {
  if (approvalRate === null) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-default text-xs">
              No data
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60">
            {RISK_DESCRIPTIONS.none}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (approvalRate >= 90) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="cursor-default bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400">
              Low Risk
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60">
            {RISK_DESCRIPTIONS.low}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (approvalRate >= 70) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="cursor-default bg-amber-100 text-amber-800 hover:bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400">
              Medium Risk
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60">
            {RISK_DESCRIPTIONS.medium}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="cursor-default bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400">
            High Risk
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60">
          {RISK_DESCRIPTIONS.high}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
