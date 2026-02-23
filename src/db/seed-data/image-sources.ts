import type { BeverageType } from '@/config/beverage-types'

export interface ImageSource {
  slideNumber: number
  brandName: string
  beverageType: BeverageType
  classType: string
  /** Known fields on the label (used to build realistic application data) */
  knownFields: {
    alcoholContent?: string
    netContents?: string
    fancifulName?: string | null
    appellationOfOrigin?: string | null
    grapeVarietal?: string | null
    vintageYear?: string | null
    countryOfOrigin?: string
  }
}

/**
 * 18 TTB sample label images from the Allowable Changes Sample Label Generator.
 * URL pattern: https://www.ttb.gov/system/files/images/labels/Slide{N}.jpg
 * Each slide shows side-by-side "Approved COLA" vs "Allowable revision".
 * The prepare-ttb-slides script crops the left half (Approved COLA).
 */
export const IMAGE_SOURCES: ImageSource[] = [
  // --- Wine (6) ---
  {
    slideNumber: 1,
    brandName: 'Rainy Day',
    beverageType: 'wine',
    classType: 'Table Wine',
    knownFields: {
      alcoholContent: '12.5%',
      netContents: '750 mL',
      fancifulName: 'Albariño',
      appellationOfOrigin: 'Virginia',
      grapeVarietal: 'Albariño',
      vintageYear: '2014',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 10,
    brandName: "PaPa's Winery",
    beverageType: 'wine',
    classType: 'Table Wine',
    knownFields: {
      fancifulName: 'Merlot Shiraz',
      appellationOfOrigin: 'Napa Valley',
      grapeVarietal: 'Merlot',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 15,
    brandName: '4 Points',
    beverageType: 'wine',
    classType: 'Table Wine',
    knownFields: {
      alcoholContent: '14%',
      netContents: '750 mL',
      fancifulName: 'White Wine',
      appellationOfOrigin: 'Napa Valley',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 25,
    brandName: 'Bailey Best',
    beverageType: 'wine',
    classType: 'Table Wine',
    knownFields: {
      netContents: '750 ML',
      fancifulName: 'Zinfandel',
      grapeVarietal: 'Zinfandel',
      appellationOfOrigin: 'California',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 40,
    brandName: "Tori's Point",
    beverageType: 'wine',
    classType: 'Table Wine',
    knownFields: {
      fancifulName: 'Red Wine',
      countryOfOrigin: 'Australia',
    },
  },
  {
    slideNumber: 55,
    brandName: 'Christina Wine Co.',
    beverageType: 'wine',
    classType: 'Table Wine',
    knownFields: {
      alcoholContent: '14%',
      netContents: '750 mL',
      countryOfOrigin: 'United States',
    },
  },

  // --- Malt Beverages (7) ---
  {
    slideNumber: 3,
    brandName: "Polly's Spiced Ale",
    beverageType: 'malt_beverage',
    classType: 'Ale',
    knownFields: {
      alcoholContent: '6%',
      netContents: '12 FL OZ',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 22,
    brandName: 'Fire Alarm',
    beverageType: 'malt_beverage',
    classType: 'Stout',
    knownFields: {
      alcoholContent: '5%',
      netContents: '12 FL OZ',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 30,
    brandName: 'Red Lightning',
    beverageType: 'malt_beverage',
    classType: 'Lite Beer',
    knownFields: {
      netContents: '12 FL OZ',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 33,
    brandName: 'Big Black Cat',
    beverageType: 'malt_beverage',
    classType: 'India Pale Ale',
    knownFields: {
      netContents: '12 FL OZ',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 45,
    brandName: 'Burnett Brews',
    beverageType: 'malt_beverage',
    classType: 'Winter Ale',
    knownFields: {
      alcoholContent: '4.5%',
      netContents: '12 FL OZ',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 57,
    brandName: 'Christina Beer Co.',
    beverageType: 'malt_beverage',
    classType: 'Raspberry Ale',
    knownFields: {
      alcoholContent: '5%',
      netContents: '1 PT',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 60,
    brandName: 'Fish Creek',
    beverageType: 'malt_beverage',
    classType: 'Pale Ale',
    knownFields: {
      netContents: '10 FL OZ',
      countryOfOrigin: 'United States',
    },
  },

  // --- Distilled Spirits (4) ---
  {
    slideNumber: 5,
    brandName: 'Sunnyside Distillery',
    beverageType: 'distilled_spirits',
    classType: 'Vodka',
    knownFields: {
      alcoholContent: '40%',
      netContents: '1 Liter',
      fancifulName: 'Apple Vodka',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 20,
    brandName: 'Parker Mill',
    beverageType: 'distilled_spirits',
    classType: 'Rum',
    knownFields: {
      alcoholContent: '40%',
      netContents: '750 mL',
      countryOfOrigin: 'United States',
    },
  },
  {
    slideNumber: 35,
    brandName: 'Cognac',
    beverageType: 'distilled_spirits',
    classType: 'Cognac',
    knownFields: {
      countryOfOrigin: 'France',
    },
  },
  {
    slideNumber: 50,
    brandName: 'Nicole',
    beverageType: 'distilled_spirits',
    classType: 'Vodka',
    knownFields: {
      alcoholContent: '40%',
      netContents: '750 mL',
      fancifulName: 'Premium Vodka',
      countryOfOrigin: 'United States',
    },
  },

  // --- Malt Beverage (1 more, importer) ---
  {
    slideNumber: 63,
    brandName: 'Willow Hollow',
    beverageType: 'malt_beverage',
    classType: 'Belgian Blonde Ale',
    knownFields: {
      netContents: '12 FL OZ',
      countryOfOrigin: 'Belgium',
    },
  },
]
