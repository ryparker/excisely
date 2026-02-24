import { BEVERAGE_ICON, BEVERAGE_LABEL_FULL } from '@/config/beverage-display'

interface BeverageTypeCellProps {
  beverageType: string
}

export function BeverageTypeCell({ beverageType }: BeverageTypeCellProps) {
  const Icon = BEVERAGE_ICON[beverageType]
  const label = BEVERAGE_LABEL_FULL[beverageType] ?? beverageType

  if (!Icon) return label

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-xs">{label}</span>
    </span>
  )
}
