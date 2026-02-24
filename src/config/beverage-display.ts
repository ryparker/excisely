import { Beer, Martini, Wine } from 'lucide-react'

export const BEVERAGE_BADGE_STYLE: Record<string, string> = {
  distilled_spirits:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  wine: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  malt_beverage:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

export const BEVERAGE_LABEL: Record<string, string> = {
  distilled_spirits: 'Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt',
}

export const BEVERAGE_LABEL_FULL: Record<string, string> = {
  distilled_spirits: 'Distilled Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt Beverage',
}

export const BEVERAGE_ICON: Record<string, typeof Wine> = {
  distilled_spirits: Martini,
  wine: Wine,
  malt_beverage: Beer,
}

export const BEVERAGE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Spirits', value: 'distilled_spirits' },
  { label: 'Wine', value: 'wine' },
  { label: 'Malt Beverage', value: 'malt_beverage' },
] as const
