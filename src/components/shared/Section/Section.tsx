'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { SectionErrorBoundary } from './SectionErrorBoundary'

interface SectionProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function Section({
  title,
  description,
  children,
  className,
}: SectionProps) {
  return (
    <section data-slot="section" className={cn(className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      <SectionErrorBoundary>{children}</SectionErrorBoundary>
    </section>
  )
}
