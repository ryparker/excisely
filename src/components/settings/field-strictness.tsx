'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { updateFieldStrictness } from '@/app/actions/update-settings'

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning Statement',
  name_and_address: 'Name and Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation of Origin',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Declaration',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distillation',
  standards_of_fill: 'Standards of Fill',
}

const FIELD_TOOLTIPS: Record<string, string> = {
  brand_name:
    'Item 6 on Form 5100.31. The primary commercial name on the label, e.g. "Jack Daniel\'s".',
  fanciful_name:
    'Item 7. An optional distinctive name like "Old No. 7" or "Gentleman Jack".',
  class_type:
    'The product classification, e.g. "Whisky", "Bourbon Whiskey", "Table Wine".',
  alcohol_content:
    'ABV as printed on the label. Normalized to a percentage, e.g. "40% Alc./Vol." and "80 Proof" both resolve to 40%.',
  net_contents:
    'Volume of the container. Normalized to mL, so "750 mL" and "25.4 FL OZ" are treated as equivalent.',
  health_warning:
    'The GOVERNMENT WARNING statement required on all containers. Must begin with "GOVERNMENT WARNING:" in all caps.',
  name_and_address:
    'Item 8. The producer/bottler name and address, e.g. "Jack Daniel Distillery, Lynchburg, Tennessee".',
  qualifying_phrase:
    'The bottler/producer relationship, e.g. "Distilled by", "Bottled by", "Imported by". Matched against known TTB phrases.',
  country_of_origin:
    'Required for imported products, e.g. "Product of Scotland". Uses containment matching.',
  grape_varietal:
    'Wine only. The grape variety, e.g. "Cabernet Sauvignon", "Chardonnay".',
  appellation_of_origin:
    'Wine only. The geographic origin, e.g. "Napa Valley", "Willamette Valley".',
  vintage_year:
    'Wine only. The harvest year, e.g. "2019". Compared as exact numeric match.',
  sulfite_declaration:
    'Wine only. "Contains Sulfites" statement required on most wines.',
  age_statement:
    'Spirits only. Aging duration, e.g. "Aged 12 Years". Normalized to a numeric year value.',
  state_of_distillation:
    'Spirits only. State where distilled, e.g. "Kentucky", "Tennessee".',
  standards_of_fill:
    'Whether the container size is a TTB-approved standard of fill (e.g. 750 mL, 1 L, 1.75 L).',
}

const STRICTNESS_LEVELS = ['strict', 'moderate', 'lenient'] as const
type StrictnessLevel = (typeof STRICTNESS_LEVELS)[number]

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
      'Allows minor OCR artifacts and formatting differences. Uses bigram similarity (Dice coefficient ≥ 80%) or numeric normalization for fields like ABV and net contents.',
    example:
      '"Jack Daniel\'s" vs "Jack Daniels" → match (96% similar)\n"40% Alc./Vol." vs "40% ABV" → match (same value)',
  },
  lenient: {
    description:
      'High-tolerance fuzzy matching. Accepts partial containment, word-level overlap, and significant formatting variation. Best for fields prone to OCR noise.',
    example:
      '"Bottled by ABC Distillery, Louisville" vs "ABC Distillery Louisville" → match',
  },
}

interface FieldStrictnessProps {
  defaults: Record<string, string>
  fieldMatchRates?: Record<string, number>
  fieldOverrideRates?: Record<string, number>
}

export function FieldStrictness({
  defaults,
  fieldMatchRates = {},
  fieldOverrideRates = {},
}: FieldStrictnessProps) {
  const [values, setValues] = useState<Record<string, string>>(defaults)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    (newValues: Record<string, string>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          setError(null)
          setSaved(false)
          const result = await updateFieldStrictness(newValues)
          if (result.success) {
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          } else {
            setError(result.error)
          }
        })
      }, 500)
    },
    [startTransition],
  )

  const handleChange = useCallback(
    (fieldName: string, level: string) => {
      const newValues = { ...values, [fieldName]: level }
      setValues(newValues)
      save(newValues)
    },
    [values, save],
  )

  const fieldNames = Object.keys(FIELD_DISPLAY_NAMES)

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Field Comparison Strictness</CardTitle>
          <CardDescription>
            Control how strictly each field is compared between the application
            data and the label image OCR output.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Field
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex w-16 cursor-help items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground">
                    Match
                    <Info className="size-3 shrink-0 opacity-50" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-56">
                  Percentage of items where the AI found a match at current
                  strictness. Low match rate may indicate the setting is too
                  strict.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex w-16 cursor-help items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground">
                    Override
                    <Info className="size-3 shrink-0 opacity-50" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-56">
                  Of items flagged by the AI, how often did a specialist
                  override it back to &ldquo;match&rdquo;. High override rate
                  means the AI is generating false positives — consider
                  loosening strictness.
                </TooltipContent>
              </Tooltip>
              <div className="flex gap-1">
                {STRICTNESS_LEVELS.map((level) => {
                  const tip = STRICTNESS_TOOLTIPS[level]
                  return (
                    <Tooltip key={level}>
                      <TooltipTrigger asChild>
                        <span className="flex w-[90px] cursor-help items-center justify-center gap-1 text-center text-xs font-medium text-muted-foreground capitalize">
                          {level}
                          <Info className="size-3 shrink-0 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-72 space-y-1.5 text-left"
                      >
                        <p>{tip.description}</p>
                        <p className="border-t border-background/20 pt-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-line opacity-80">
                          {tip.example}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            {fieldNames.map((fieldName) => {
              const current = (values[fieldName] ??
                'moderate') as StrictnessLevel
              const fieldTip = FIELD_TOOLTIPS[fieldName]
              const matchRate = fieldMatchRates[fieldName] ?? null
              const overrideRate = fieldOverrideRates[fieldName] ?? null
              return (
                <div
                  key={fieldName}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-1.5"
                >
                  <span className="flex items-center gap-1.5 text-sm">
                    {FIELD_DISPLAY_NAMES[fieldName]}
                    {fieldTip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-64">
                          {fieldTip}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  <span
                    className={cn(
                      'w-16 text-center font-mono text-xs tabular-nums',
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
                      'w-16 text-center font-mono text-xs tabular-nums',
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
                  <div className="flex gap-1">
                    {STRICTNESS_LEVELS.map((level) => (
                      <Button
                        key={level}
                        variant={current === level ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'w-[90px] capitalize',
                          current === level &&
                            level === 'strict' &&
                            'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
                          current === level &&
                            level === 'moderate' &&
                            'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700',
                          current === level &&
                            level === 'lenient' &&
                            'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
                        )}
                        onClick={() => handleChange(fieldName, level)}
                        disabled={isPending}
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 h-5 text-sm">
            {isPending && (
              <span className="text-muted-foreground">Saving...</span>
            )}
            {saved && (
              <span className="text-green-600 dark:text-green-400">Saved</span>
            )}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
