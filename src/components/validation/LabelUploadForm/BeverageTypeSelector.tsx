'use client'

import { Sparkles } from 'lucide-react'

import { Label } from '@/components/ui/Label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import type { BeverageType } from '@/config/beverage-types'
import { cn } from '@/lib/utils'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'

import { BEVERAGE_TYPE_OPTIONS } from './UploadFormConstants'

// ---------------------------------------------------------------------------
// Validate mode: radio list
// ---------------------------------------------------------------------------

interface RadioVariantProps {
  beverageType: BeverageType | undefined
  onSelect: (value: BeverageType) => void
  showSplitPane: boolean
  onFieldFocus: (snakeCase: string) => void
  error?: string
}

export function BeverageTypeRadio({
  beverageType,
  onSelect,
  showSplitPane,
  onFieldFocus,
  error,
}: RadioVariantProps) {
  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5">
        Type of Product
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
        <AiFieldIndicator
          showSplitPane={showSplitPane}
          onFieldFocus={onFieldFocus}
          fieldName="beverage_type"
        />
      </Label>
      <RadioGroup
        value={beverageType}
        onValueChange={(value) => onSelect(value as BeverageType)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        aria-required="true"
      >
        {BEVERAGE_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border border-input p-4 transition-colors hover:bg-accent/50',
                beverageType === option.value &&
                  'border-primary bg-primary/5 ring-1 ring-primary/50',
              )}
            >
              <RadioGroupItem value={option.value} />
              <Icon className="size-5 text-muted-foreground" />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          )
        })}
      </RadioGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Submit mode: card grid (phase 2 reveal)
// ---------------------------------------------------------------------------

interface CardVariantProps {
  beverageType: BeverageType | undefined
  beverageTypeSource: 'user' | 'ai' | null
  onSelect: (value: BeverageType) => void
  error?: string
}

export function BeverageTypeCards({
  beverageType,
  beverageTypeSource,
  onSelect,
  error,
}: CardVariantProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {BEVERAGE_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = beverageType === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 p-6 text-center transition-all hover:bg-accent/50',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-input',
              )}
            >
              <Icon
                className={cn(
                  'size-8',
                  isSelected ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
              {isSelected && beverageTypeSource === 'ai' && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Sparkles className="size-3" />
                  AI detected
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Submit mode: segmented control (inline in phase 3)
// ---------------------------------------------------------------------------

interface SegmentedVariantProps {
  beverageType: BeverageType | undefined
  beverageTypeSource: 'user' | 'ai' | null
  onSelect: (value: BeverageType) => void
}

export function BeverageTypeSegmented({
  beverageType,
  beverageTypeSource,
  onSelect,
}: SegmentedVariantProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          Type of Product
        </Label>
        {beverageTypeSource === 'ai' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles className="size-2.5" />
            AI detected
          </span>
        )}
      </div>
      <div className="inline-flex rounded-lg border border-input bg-muted/30 p-0.5">
        {BEVERAGE_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = beverageType === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                isSelected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
