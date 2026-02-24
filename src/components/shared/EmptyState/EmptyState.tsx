import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/Card'

interface EmptyStateProps {
  /** Lucide icon displayed above the title. */
  icon?: LucideIcon
  /** Primary message shown to the user. */
  title: string
  /** Secondary helper text shown below the title. */
  description?: string
  /** Additional CSS classes on the outer Card. */
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {Icon && <Icon className="mb-4 size-10 text-muted-foreground" />}
        <p className="text-sm text-muted-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
