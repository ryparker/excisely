'use client'

import { useFormContext } from 'react-hook-form'

import { FieldShimmer } from '@/components/validation/ScanAnimation'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

export function ExtractionSkeleton() {
  const { watch } = useFormContext<ValidateLabelInput>()
  const beverageType = watch('beverageType')

  return (
    <div className="space-y-6">
      {/* Class/Type Code + Container Size skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
      </div>
      {/* Serial + Brand skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
      </div>
      {/* Fanciful + Class/Type skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
      </div>
      {/* Alcohol + Net Contents skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
          <FieldShimmer />
        </div>
      </div>
      <div className="h-px animate-pulse bg-muted/40" />
      {/* Name/Address + Qualifying Phrase skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
          <FieldShimmer className="h-20" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
            <FieldShimmer />
          </div>
        </div>
      </div>
      {/* Beverage-specific section skeleton */}
      {beverageType && (
        <>
          <div className="h-px animate-pulse bg-muted/40" />
          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                <FieldShimmer />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                <FieldShimmer />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
