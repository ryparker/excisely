'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning',
  name_and_address: 'Name & Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Decl.',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distill.',
  standards_of_fill: 'Standards of Fill',
}

const chartConfig = {
  matchRate: {
    label: 'Match Rate',
    color: 'hsl(142, 71%, 45%)',
  },
} satisfies ChartConfig

interface FieldAccuracyChartProps {
  data: Array<{ fieldName: string; matchRate: number; total: number }>
}

export function FieldAccuracyChart({ data }: FieldAccuracyChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    displayName: FIELD_DISPLAY_NAMES[item.fieldName] ?? item.fieldName,
    matchRatePercent: Math.round(item.matchRate * 100),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Field Accuracy</CardTitle>
        <CardDescription>
          Match rate per field across all validations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              tickLine={false}
              axisLine={false}
              width={120}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <span className="font-mono">
                      {value}% ({item.payload.total} checks)
                    </span>
                  )}
                />
              }
            />
            <Bar
              dataKey="matchRatePercent"
              fill="var(--color-matchRate)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
