'use client'

import { useCallback, useRef, useState, useTransition } from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

const STRICTNESS_LEVELS = ['strict', 'moderate', 'lenient'] as const
type StrictnessLevel = (typeof STRICTNESS_LEVELS)[number]

const STRICTNESS_DESCRIPTIONS: Record<StrictnessLevel, string> = {
  strict: 'Exact match required',
  moderate: 'Allows minor formatting differences',
  lenient: 'Fuzzy matching with high tolerance',
}

interface FieldStrictnessProps {
  defaults: Record<string, string>
}

export function FieldStrictness({ defaults }: FieldStrictnessProps) {
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
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Field
            </span>
            <div className="flex gap-1">
              {STRICTNESS_LEVELS.map((level) => (
                <span
                  key={level}
                  className="w-[90px] text-center text-xs font-medium text-muted-foreground capitalize"
                  title={STRICTNESS_DESCRIPTIONS[level]}
                >
                  {level}
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          {fieldNames.map((fieldName) => {
            const current = (values[fieldName] ?? 'moderate') as StrictnessLevel
            return (
              <div
                key={fieldName}
                className="grid grid-cols-[1fr_auto] items-center gap-4 py-1.5"
              >
                <span className="text-sm">
                  {FIELD_DISPLAY_NAMES[fieldName]}
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
  )
}
