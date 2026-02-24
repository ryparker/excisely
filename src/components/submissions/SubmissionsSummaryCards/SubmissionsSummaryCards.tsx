'use client'

import { useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useQueryStates } from 'nuqs'

import { searchParamParsers } from '@/lib/search-params'

import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'
import { StatCardContent, STAT_CARD_BASE } from '@/components/shared/StatCard'

interface SummaryCard {
  icon: LucideIcon
  label: string
  value: number
  subtext: string
  tint: string
  iconBg: string
  /** Value to set on the status URL param when clicked. Empty string clears the filter. */
  filterValue: string
}

interface SubmissionsSummaryCardsProps {
  total: number
  approved: number
  approvalRate: number
  inReview: number
  needsAttention: number
  nearestDeadline: string | null
}

function SummaryCardValue({ value }: { value: number }) {
  const display = useCountUp(value) ?? value
  return <>{display}</>
}

export function SubmissionsSummaryCards({
  total,
  approved,
  approvalRate,
  inReview,
  needsAttention,
  nearestDeadline,
}: SubmissionsSummaryCardsProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [params, setParams] = useQueryStates(
    {
      status: searchParamParsers.status,
      page: searchParamParsers.page,
    },
    { shallow: false, startTransition },
  )

  const activeFilter = params.status

  function handleCardClick(filterValue: string) {
    // Clicking the already-active card clears the filter
    const next = activeFilter === filterValue ? '' : filterValue
    void setParams({ status: next || null, page: null })
  }

  const cards: SummaryCard[] = [
    {
      icon: FileText,
      label: 'Total Submissions',
      value: total,
      subtext: 'All time submissions',
      tint: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      filterValue: '',
    },
    {
      icon: CheckCircle2,
      label: 'Approved',
      value: approved,
      subtext: `${approvalRate}% approval rate`,
      tint: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      filterValue: 'approved',
    },
    {
      icon: Clock,
      label: 'In Review',
      value: inReview,
      subtext: 'Pending + processing',
      tint: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      filterValue: 'in_review',
    },
    {
      icon: AlertTriangle,
      label: 'Needs Attention',
      value: needsAttention,
      subtext: nearestDeadline ?? 'No active deadlines',
      tint: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      filterValue: 'needs_attention',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => {
        const Icon = card.icon
        const isActive =
          card.filterValue === ''
            ? activeFilter === ''
            : activeFilter === card.filterValue
        return (
          <motion.button
            key={card.label}
            type="button"
            onClick={() => handleCardClick(card.filterValue)}
            className={cn(
              STAT_CARD_BASE,
              'cursor-pointer text-left transition-[box-shadow,border-color] hover:shadow-md',
              isActive &&
                card.filterValue !== '' &&
                'border-primary/40 ring-1 ring-primary/20',
              isPending && 'opacity-80',
            )}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    type: 'tween',
                    duration: 0.35,
                    delay: i * 0.06,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }
            }
          >
            <StatCardContent
              icon={Icon}
              iconBg={card.iconBg}
              iconColor={card.tint}
              label={card.label}
              value={<SummaryCardValue value={card.value} />}
              description={card.subtext}
            />
          </motion.button>
        )
      })}
    </div>
  )
}
