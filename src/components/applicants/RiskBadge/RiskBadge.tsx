'use client'

import { Badge } from '@/components/ui/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'

interface RiskLevel {
  label: string
  className: string
  description: string
}

const RISK_LEVELS: RiskLevel[] = [
  {
    label: 'Low Risk',
    className:
      'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400',
    description:
      'Approval rate \u2265 90%. Consistently compliant submissions \u2014 routine review.',
  },
  {
    label: 'Medium Risk',
    className:
      'bg-amber-100 text-amber-800 hover:bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400',
    description:
      'Approval rate 70\u201389%. Some labels needed corrections \u2014 review with moderate attention.',
  },
  {
    label: 'High Risk',
    className:
      'bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400',
    description:
      'Approval rate below 70%. Frequent issues found \u2014 review carefully for recurring problems.',
  },
]

function getRiskLevel(approvalRate: number): RiskLevel {
  if (approvalRate >= 90) return RISK_LEVELS[0]
  if (approvalRate >= 70) return RISK_LEVELS[1]
  return RISK_LEVELS[2]
}

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
            No reviewed labels yet — risk will be calculated once labels are
            reviewed.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const risk = getRiskLevel(approvalRate)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`cursor-default ${risk.className}`}>
            {risk.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60">
          {risk.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
