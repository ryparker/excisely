/**
 * Maps each test label image to minimal Form 5100.31 application data.
 * Used by the E2E submission spec to submit labels through the applicant portal.
 *
 * Data sourced from extraction.json files in each label's directory.
 */

export interface LabelTestCase {
  /** Relative paths from project root (front + optional back) */
  imagePaths: string[]
  brandName: string
  beverageType: 'wine' | 'malt_beverage' | 'distilled_spirits'
  containerSizeMl: number
  /** Optional — submitted as class/type designation if provided */
  classType?: string
  /** Optional — alcohol content if known */
  alcoholContent?: string
  /** Optional — net contents if known */
  netContents?: string
  /** Optional — fanciful name if known */
  fancifulName?: string
  /** Playwright storage state file for the applicant who submits this label */
  authState: string
}

const APPLICANT_AUTH_FILES = [
  'e2e/.auth/applicant-old-tom.json',
  'e2e/.auth/applicant-napa.json',
  'e2e/.auth/applicant-cascade.json',
]

// ---------------------------------------------------------------------------
// Local test-labels — data from extraction.json files
// ---------------------------------------------------------------------------

type LabelData = Omit<LabelTestCase, 'authState'>

const BEER_LABELS: LabelData[] = [
  {
    imagePaths: ['test-labels/beer/sierra-nevada/front.png'],
    brandName: 'Sierra Nevada',
    beverageType: 'malt_beverage',
    containerSizeMl: 750,
    classType: 'Stout',
    alcoholContent: 'ALC. 13.8% BY VOL.',
    netContents: '1 PT. 9.4 FL. OZ.',
    fancifulName: 'Trip Thru the Woods',
  },
  {
    imagePaths: [
      'test-labels/beer/twisted-tea-light-lemon/front.png',
      'test-labels/beer/twisted-tea-light-lemon/top.png',
    ],
    brandName: 'Twisted Tea',
    beverageType: 'malt_beverage',
    containerSizeMl: 355,
    classType: 'Hard Iced Tea',
    alcoholContent: '4% ALC./VOL.',
    fancifulName: 'Light',
  },
]

const WINE_LABELS: LabelData[] = [
  {
    imagePaths: [
      'test-labels/wine/cooper-ridge-malbec/front.png',
      'test-labels/wine/cooper-ridge-malbec/back.png',
    ],
    brandName: 'Cooper Ridge',
    beverageType: 'wine',
    containerSizeMl: 750,
    classType: 'Malbec',
    alcoholContent: 'Alc. 13% by Vol.',
    netContents: '750 ml',
    fancifulName: 'Fox Hollow Vineyard',
  },
  {
    imagePaths: [
      'test-labels/wine/forever-summer/front.png',
      'test-labels/wine/forever-summer/back.png',
    ],
    brandName: 'Forever Summer',
    beverageType: 'wine',
    containerSizeMl: 750,
    classType: 'Rose Wine',
    alcoholContent: 'ALC. 12.5% BY VOL.',
    netContents: '750ML',
  },
  {
    imagePaths: [
      'test-labels/wine/jourdan-croix-boissee/front.png',
      'test-labels/wine/jourdan-croix-boissee/back.png',
    ],
    brandName: 'Domaine Jourdan',
    beverageType: 'wine',
    containerSizeMl: 750,
    classType: 'White Wine',
    alcoholContent: 'ALCOHOL 13.5 % BY VOLUME',
    netContents: '750ML',
    fancifulName: 'Croix Boissée',
  },
  {
    imagePaths: [
      'test-labels/wine/three-fox-viognier/front.png',
      'test-labels/wine/three-fox-viognier/back.png',
    ],
    brandName: 'Three Fox Vineyards',
    beverageType: 'wine',
    containerSizeMl: 750,
    classType: 'Viognier Reserve',
    alcoholContent: 'ALC. 12.5% BY VOL.',
    netContents: '750ML',
  },
  {
    imagePaths: [
      'test-labels/wine/domaine-montredon/front.png',
      'test-labels/wine/domaine-montredon/back.png',
    ],
    brandName: 'Domaine de Montredon',
    beverageType: 'wine',
    containerSizeMl: 750,
    classType: 'Carignan',
    alcoholContent: 'ALC. 13.5% BY VOL.',
    netContents: '750 ML',
  },
]

const WHISKEY_LABELS: LabelData[] = [
  {
    imagePaths: [
      'test-labels/whiskey/backbone-bourbon/front.png',
      'test-labels/whiskey/backbone-bourbon/back.png',
    ],
    brandName: 'Backbone Bourbon',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Straight Bourbon Whiskey',
    alcoholContent: '57% ALC/VOL 114 PROOF',
    netContents: '750ML',
    fancifulName: 'Estate',
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-bourbon-10yr/front.png'],
    brandName: 'Bulleit',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'American Straight Rye Whiskey',
    alcoholContent: '45% alc./vol.',
    netContents: '750 mL',
    fancifulName: 'Frontier Whiskey',
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-frontier/front.png'],
    brandName: 'Bulleit',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '45% alc./vol. 90 PROOF',
    netContents: '750 mL',
    fancifulName: 'Frontier Whiskey',
  },
  {
    imagePaths: [
      'test-labels/whiskey/bulleit-single-barrel/front.png',
      'test-labels/whiskey/bulleit-single-barrel/neck.png',
    ],
    brandName: 'Bulleit Bourbon',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '45% ALC. BY VOL.',
    netContents: '750 mL',
    fancifulName: 'Single Barrel',
  },
  {
    imagePaths: [
      'test-labels/whiskey/knob-creek/front.png',
      'test-labels/whiskey/knob-creek/back.png',
    ],
    brandName: 'Knob Creek',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '60% ALC./VOL.',
    netContents: '750 mL',
    fancifulName: 'Single Barrel Reserve',
  },
  {
    imagePaths: [
      'test-labels/whiskey/branch-barrel-wheat/front.png',
      'test-labels/whiskey/branch-barrel-wheat/back.png',
    ],
    brandName: 'Branch & Barrel',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Wheat Whiskey',
    alcoholContent: '46% Alc. by Vol.',
    netContents: '750ml',
  },
  {
    imagePaths: [
      'test-labels/whiskey/crafted-spirits-malinowka/front.png',
      'test-labels/whiskey/crafted-spirits-malinowka/back.png',
    ],
    brandName: 'Crafted Spirits by Arkadius',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Liqueur',
    alcoholContent: '30% ALC. BY VOL.',
    netContents: '750 ML',
    fancifulName: 'Malinówka',
  },
  {
    imagePaths: ['test-labels/whiskey/dashfire-old-fashioned/front.png'],
    brandName: 'Dashfire',
    beverageType: 'distilled_spirits',
    containerSizeMl: 100,
    classType: 'Bourbon',
    alcoholContent: '38% ALC. / VOL.',
    netContents: '100ML',
    fancifulName: 'Old Fashioned',
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-rye/front.png'],
    brandName: 'Bulleit 95 Rye',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    classType: 'Frontier Whiskey',
    alcoholContent: '45% alc./vol.',
    netContents: '750 mL',
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-old-fashioned/front.png'],
    brandName: 'Bulleit',
    beverageType: 'distilled_spirits',
    containerSizeMl: 100,
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '37.5% ALC BY VOL',
    netContents: '100 mL',
    fancifulName: 'Old Fashioned',
  },
]

// ---------------------------------------------------------------------------
// All labels — 17 total (beer: 2, wine: 5, whiskey: 10)
//
// First 3 chosen for variety: wine (front+back), whiskey (front+back), beer (front only)
// ---------------------------------------------------------------------------

// Ordered for variety: wine, whiskey, beer, then the rest.
// authState assigned round-robin across the 3 applicant accounts.
const ORDERED_LABELS: LabelData[] = [
  WINE_LABELS[0], // Cooper Ridge (wine, front+back)
  WHISKEY_LABELS[4], // Knob Creek (whiskey, front+back)
  BEER_LABELS[0], // Sierra Nevada (beer, front only)
  ...BEER_LABELS.filter((l) => l !== BEER_LABELS[0]),
  ...WINE_LABELS.filter((l) => l !== WINE_LABELS[0]),
  ...WHISKEY_LABELS.filter((l) => l !== WHISKEY_LABELS[4]),
]

export const LABEL_TEST_CASES: LabelTestCase[] = ORDERED_LABELS.map(
  (label, i) => ({
    ...label,
    authState: APPLICANT_AUTH_FILES[i % APPLICANT_AUTH_FILES.length],
  }),
)
