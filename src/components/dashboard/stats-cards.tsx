import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

interface StatItem {
  label: string
  value: string | number
  icon: LucideIcon
  description?: string
}

interface StatsCardsProps {
  stats: StatItem[]
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                {stat.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
