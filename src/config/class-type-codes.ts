import type { BeverageType } from './beverage-types'

export interface ClassTypeCode {
  code: string
  description: string
  beverageType: BeverageType
}

export const CLASS_TYPE_CODES: ClassTypeCode[] = [
  // Distilled Spirits (codes 0-199)
  {
    code: '001',
    description: 'Neutral Spirits or Alcohol',
    beverageType: 'distilled_spirits',
  },
  { code: '011', description: 'Vodka', beverageType: 'distilled_spirits' },
  { code: '021', description: 'Dry Gin', beverageType: 'distilled_spirits' },
  {
    code: '041',
    description: 'Blended Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '062',
    description: 'Bourbon Whisky',
    beverageType: 'distilled_spirits',
  },
  { code: '065', description: 'Rye Whisky', beverageType: 'distilled_spirits' },
  {
    code: '072',
    description: 'Corn Whisky',
    beverageType: 'distilled_spirits',
  },
  { code: '081', description: 'Rum', beverageType: 'distilled_spirits' },
  {
    code: '101',
    description: 'Straight Bourbon Whisky',
    beverageType: 'distilled_spirits',
  },
  { code: '111', description: 'Brandy', beverageType: 'distilled_spirits' },
  { code: '131', description: 'Tequila', beverageType: 'distilled_spirits' },
  {
    code: '141',
    description: 'Liqueur/Cordial',
    beverageType: 'distilled_spirits',
  },
  {
    code: '161',
    description: 'Scotch Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '171',
    description: 'Irish Whisky',
    beverageType: 'distilled_spirits',
  },

  // Wine (codes 200-499)
  { code: '201', description: 'Grape Wine — Red', beverageType: 'wine' },
  { code: '202', description: 'Grape Wine — White', beverageType: 'wine' },
  { code: '203', description: 'Grape Wine — Rosé', beverageType: 'wine' },
  { code: '211', description: 'Sparkling Wine', beverageType: 'wine' },
  { code: '221', description: 'Champagne', beverageType: 'wine' },
  { code: '231', description: 'Dessert Wine', beverageType: 'wine' },
  { code: '241', description: 'Fortified Wine', beverageType: 'wine' },
  { code: '271', description: 'Sake', beverageType: 'wine' },
  { code: '301', description: 'Table Wine', beverageType: 'wine' },

  // Malt Beverages (codes 900+)
  { code: '901', description: 'Beer', beverageType: 'malt_beverage' },
  { code: '902', description: 'Ale', beverageType: 'malt_beverage' },
  { code: '903', description: 'Porter', beverageType: 'malt_beverage' },
  { code: '904', description: 'Stout', beverageType: 'malt_beverage' },
  { code: '911', description: 'Lager', beverageType: 'malt_beverage' },
  { code: '921', description: 'Malt Liquor', beverageType: 'malt_beverage' },
  { code: '931', description: 'Hard Seltzer', beverageType: 'malt_beverage' },
  { code: '941', description: 'Hard Cider', beverageType: 'malt_beverage' },
]

/**
 * Returns all class/type codes for a given beverage type.
 */
export function getCodesByBeverageType(type: BeverageType): ClassTypeCode[] {
  return CLASS_TYPE_CODES.filter((c) => c.beverageType === type)
}
