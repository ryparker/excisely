'use client'

import { useCallback, useState } from 'react'
import { Info } from 'lucide-react'

import { useSettingsSave } from '@/hooks/use-settings-save'
import { SaveFeedback } from '@/components/shared/save-feedback'
import { cn } from '@/lib/utils'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { updateFieldStrictness } from '@/app/actions/update-settings'
import type { StrictnessLevel } from '@/lib/settings/get-settings'

const STRICTNESS_LEVELS: readonly StrictnessLevel[] = [
  'strict',
  'moderate',
  'lenient',
]

const STRICTNESS_TOOLTIPS: Record<
  StrictnessLevel,
  { description: string; example: string }
> = {
  strict: {
    description:
      'Character-for-character match after whitespace normalization. Use for fields where any deviation signals a problem.',
    example:
      '"Jack Daniel\'s" vs "Jack Daniels" → mismatch (missing apostrophe)',
  },
  moderate: {
    description:
      'Allows minor text-reading artifacts and formatting differences. Uses bigram similarity (Dice coefficient ≥ 80%) or numeric normalization for fields like ABV and net contents.',
    example:
      '"Jack Daniel\'s" vs "Jack Daniels" → match (96% similar)\n"40% Alc./Vol." vs "40% ABV" → match (same value)',
  },
  lenient: {
    description:
      'High-tolerance fuzzy matching. Accepts partial containment, word-level overlap, and significant formatting variation. Best for fields prone to text-reading noise.',
    example:
      '"Bottled by ABC Distillery, Louisville" vs "ABC Distillery Louisville" → match',
  },
}

interface FieldStrictnessProps {
  defaults: Record<string, StrictnessLevel>
  fieldMatchRates?: Record<string, number>
  fieldOverrideRates?: Record<string, number>
}

export function FieldStrictness({
  defaults,
  fieldMatchRates = {},
  fieldOverrideRates = {},
}: FieldStrictnessProps) {
  const [values, setValues] =
    useState<Record<string, StrictnessLevel>>(defaults)
  const { isPending, saved, error, save } = useSettingsSave()

  const handleChange = useCallback(
    (fieldName: string, level: StrictnessLevel) => {
      const newValues = { ...values, [fieldName]: level }
      setValues(newValues)
      save(() => updateFieldStrictness(newValues))
    },
    [values, save],
  )

  const fieldNames = Object.keys(FIELD_DISPLAY_NAMES)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per-Field Rules</CardTitle>
        <CardDescription>
          Set strictness per field. Match and override rates help calibrate —
          high override rates suggest the setting is too strict.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-1 items-center gap-4 border-b px-3 pb-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <span className="text-sm font-medium text-muted-foreground">
              Field
            </span>
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <span className="hidden w-16 cursor-help items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground sm:flex">
                  Match
                  <Info className="size-3 shrink-0 opacity-50" />
                </span>
              </HoverCardTrigger>
              <HoverCardContent side="top" className="w-56 p-3">
                <p className="text-xs font-semibold">Match Rate</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Percentage of items where the AI found a match at current
                  strictness. Low match rate may indicate the setting is too
                  strict.
                </p>
              </HoverCardContent>
            </HoverCard>
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <span className="hidden w-16 cursor-help items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground sm:flex">
                  Override
                  <Info className="size-3 shrink-0 opacity-50" />
                </span>
              </HoverCardTrigger>
              <HoverCardContent side="top" className="w-56 p-3">
                <p className="text-xs font-semibold">Override Rate</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Of items flagged by the AI, how often a specialist overrode it
                  back to &ldquo;match.&rdquo; High override rate means false
                  positives — consider loosening strictness.
                </p>
              </HoverCardContent>
            </HoverCard>
            <div className="flex gap-1 rounded-lg p-0.5">
              {STRICTNESS_LEVELS.map((level) => {
                const tip = STRICTNESS_TOOLTIPS[level]
                return (
                  <HoverCard key={level} openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <span className="flex w-[86px] cursor-help items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground capitalize">
                        {level}
                        <Info className="size-3 shrink-0 opacity-50" />
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" className="w-72 p-3 text-left">
                      <p className="text-xs font-semibold capitalize">
                        {level}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {tip.description}
                      </p>
                      <p className="mt-2 rounded-md bg-muted px-2 py-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-line text-muted-foreground">
                        {tip.example}
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                )
              })}
            </div>
          </div>

          {/* Rows */}
          {fieldNames.map((fieldName, index) => {
            const current = values[fieldName] ?? 'moderate'
            const fieldTipData = FIELD_TOOLTIPS[fieldName]
            const matchRate = fieldMatchRates[fieldName] ?? null
            const overrideRate = fieldOverrideRates[fieldName] ?? null
            return (
              <div
                key={fieldName}
                className={cn(
                  'grid grid-cols-1 items-center gap-4 rounded-lg px-3 py-2.5 sm:grid-cols-[1fr_auto_auto_auto]',
                  index % 2 === 0 && 'bg-muted/40',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  {FIELD_DISPLAY_NAMES[fieldName]}
                  {fieldTipData && (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground/50" />
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="right"
                        align="start"
                        className="w-64 p-3"
                      >
                        <p className="text-xs font-semibold">
                          {FIELD_DISPLAY_NAMES[fieldName]}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {fieldTipData.description}
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </span>
                <span
                  className={cn(
                    'hidden w-16 text-center font-mono text-xs tabular-nums sm:block',
                    matchRate === null
                      ? 'text-muted-foreground/40'
                      : matchRate >= 80
                        ? 'text-green-600 dark:text-green-400'
                        : matchRate >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {matchRate !== null ? `${matchRate}%` : '--'}
                </span>
                <span
                  className={cn(
                    'hidden w-16 text-center font-mono text-xs tabular-nums sm:block',
                    overrideRate === null
                      ? 'text-muted-foreground/40'
                      : overrideRate >= 50
                        ? 'text-red-600 dark:text-red-400'
                        : overrideRate >= 25
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-green-600 dark:text-green-400',
                  )}
                >
                  {overrideRate !== null ? `${overrideRate}%` : '--'}
                </span>
                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                  {STRICTNESS_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={cn(
                        'flex h-8 w-[86px] items-center justify-center gap-1.5 rounded-md text-xs font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                        current === level
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => handleChange(fieldName, level)}
                      disabled={isPending}
                    >
                      {current === level && (
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            level === 'strict' && 'bg-red-500',
                            level === 'moderate' && 'bg-amber-500',
                            level === 'lenient' && 'bg-emerald-500',
                          )}
                        />
                      )}
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <SaveFeedback
          isPending={isPending}
          saved={saved}
          error={error}
          className="mt-4"
        />
      </CardContent>
    </Card>
  )
}
