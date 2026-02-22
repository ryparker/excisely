'use client'

import { Pie, PieChart, Cell } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const STATUS_COLORS: Record<string, string> = {
  approved: 'hsl(142, 71%, 45%)',
  conditionally_approved: 'hsl(45, 93%, 47%)',
  needs_correction: 'hsl(24, 95%, 53%)',
  rejected: 'hsl(0, 72%, 51%)',
  processing: 'hsl(217, 91%, 60%)',
  pending: 'hsl(220, 9%, 46%)',
}

const STATUS_LABELS: Record<string, string> = {
  approved: 'Approved',
  conditionally_approved: 'Conditionally Approved',
  needs_correction: 'Needs Correction',
  rejected: 'Rejected',
  processing: 'Processing',
  pending: 'Pending',
}

interface StatusDistributionChartProps {
  data: Array<{ status: string; count: number }>
}

export function StatusDistributionChart({
  data,
}: StatusDistributionChartProps) {
  const chartConfig = data.reduce<ChartConfig>((acc, item) => {
    acc[item.status] = {
      label: STATUS_LABELS[item.status] ?? item.status,
      color: STATUS_COLORS[item.status] ?? 'hsl(220, 9%, 46%)',
    }
    return acc
  }, {})

  const chartData = data.map((item) => ({
    ...item,
    fill: STATUS_COLORS[item.status] ?? 'hsl(220, 9%, 46%)',
  }))

  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
        <CardDescription>
          {total} total label{total !== 1 ? 's' : ''} across all statuses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="status" />}
              className="flex-wrap gap-2"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
