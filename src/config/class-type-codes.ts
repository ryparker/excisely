import type { BeverageType } from './beverage-types'

export interface ClassTypeCode {
  code: string
  description: string
  beverageType: BeverageType
}

/**
 * TTB class/type codes used in the COLA (Certificate of Label Approval) system.
 *
 * Real TTB codes use range-based assignment:
 *   0–99:   Wine
 *   100–199: Whisky
 *   200–299: Gin
 *   300–399: Vodka
 *   400–499: Rum
 *   500–599: Brandy
 *   600–699: Cordials, Liqueurs, Specialties
 *   700–799: Cocktails / Mixed Drinks
 *   900–999: Beer, Agave Spirits, Neutral Spirits, Other
 *
 * This is a representative subset of the most common codes. The full TTB
 * code list has 200+ entries. See the COLA Public Registry for the complete
 * list: https://www.ttb.gov/labeling/cola-public-registry
 *
 * @see https://www.ttb.gov/labeling/colas — COLAs Online
 */
export const CLASS_TYPE_CODES: ClassTypeCode[] = [
  // ─── Wine (0–99) ────────────────────────────────────────────────────
  { code: '80', description: 'Table Wine — Red', beverageType: 'wine' },
  { code: '80A', description: 'Table Wine — Rosé', beverageType: 'wine' },
  { code: '81', description: 'Table Wine — White', beverageType: 'wine' },
  { code: '82', description: 'Flavored Wine', beverageType: 'wine' },
  { code: '83', description: 'Fruit Wine', beverageType: 'wine' },
  { code: '83C', description: 'Hard Cider (Wine)', beverageType: 'wine' },
  {
    code: '84',
    description: 'Sparkling Wine / Champagne',
    beverageType: 'wine',
  },
  {
    code: '88',
    description: 'Dessert / Port / Sherry Wine',
    beverageType: 'wine',
  },
  { code: '71', description: 'Sake', beverageType: 'wine' },

  // ─── Whisky (100–199) ───────────────────────────────────────────────
  {
    code: '100',
    description: 'Straight Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '101',
    description: 'Straight Bourbon Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '102',
    description: 'Straight Rye Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '103',
    description: 'Straight Corn Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '110',
    description: 'Bottled in Bond Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '130',
    description: 'Blended Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '140',
    description: 'Bourbon Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '150',
    description: 'Scotch Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '153',
    description: 'Single Malt Scotch Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '160',
    description: 'Canadian Whisky',
    beverageType: 'distilled_spirits',
  },
  {
    code: '170',
    description: 'Irish Whisky',
    beverageType: 'distilled_spirits',
  },

  // ─── Gin (200–299) ─────────────────────────────────────────────────
  {
    code: '200',
    description: 'Gin',
    beverageType: 'distilled_spirits',
  },
  {
    code: '201',
    description: 'Dry Gin',
    beverageType: 'distilled_spirits',
  },
  {
    code: '210',
    description: 'London Dry Gin',
    beverageType: 'distilled_spirits',
  },

  // ─── Vodka (300–399) ────────────────────────────────────────────────
  {
    code: '310',
    description: 'Vodka',
    beverageType: 'distilled_spirits',
  },
  {
    code: '330',
    description: 'Flavored Vodka',
    beverageType: 'distilled_spirits',
  },

  // ─── Rum (400–499) ─────────────────────────────────────────────────
  {
    code: '400',
    description: 'Rum — White',
    beverageType: 'distilled_spirits',
  },
  {
    code: '410',
    description: 'Rum — Gold',
    beverageType: 'distilled_spirits',
  },
  {
    code: '430',
    description: 'Flavored Rum',
    beverageType: 'distilled_spirits',
  },
  {
    code: '450',
    description: 'Foreign Rum',
    beverageType: 'distilled_spirits',
  },

  // ─── Brandy (500–599) ──────────────────────────────────────────────
  {
    code: '500',
    description: 'Brandy',
    beverageType: 'distilled_spirits',
  },
  {
    code: '510',
    description: 'Cognac',
    beverageType: 'distilled_spirits',
  },

  // ─── Cordials / Liqueurs (600–699) ─────────────────────────────────
  {
    code: '600',
    description: 'Cordials / Liqueurs',
    beverageType: 'distilled_spirits',
  },

  // ─── Agave Spirits / Other (900–999) ───────────────────────────────
  {
    code: '925',
    description: 'Neutral Spirits',
    beverageType: 'distilled_spirits',
  },
  {
    code: '977',
    description: 'Tequila',
    beverageType: 'distilled_spirits',
  },
  {
    code: '978',
    description: 'Mezcal',
    beverageType: 'distilled_spirits',
  },

  // ─── Malt Beverages (900–999, beer range) ──────────────────────────
  { code: '901', description: 'Beer', beverageType: 'malt_beverage' },
  { code: '902', description: 'Ale', beverageType: 'malt_beverage' },
  { code: '903', description: 'Porter', beverageType: 'malt_beverage' },
  { code: '904', description: 'Stout', beverageType: 'malt_beverage' },
  { code: '905', description: 'Lager', beverageType: 'malt_beverage' },
  {
    code: '906',
    description: 'Malt Beverage Specialty',
    beverageType: 'malt_beverage',
  },
  { code: '920', description: 'Malt Liquor', beverageType: 'malt_beverage' },
]

/**
 * Returns all class/type codes for a given beverage type.
 */
export function getCodesByBeverageType(type: BeverageType): ClassTypeCode[] {
  return CLASS_TYPE_CODES.filter((c) => c.beverageType === type)
}
