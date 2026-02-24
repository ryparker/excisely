/**
 * Maps each test label image to minimal Form 5100.31 application data.
 * Used by the E2E submission spec to submit labels through the applicant portal.
 *
 * Labels are grouped by applicant persona to produce meaningful variety in
 * approval rates and risk badges on the applicants page:
 *
 *   Old Tom Distillery  — "bad" applicant  → ~17% approval → HIGH RISK (red)
 *   Napa Valley Estate  — "good" applicant → 100% approval → LOW RISK (green)
 *   Cascade Hop Brewing — "mixed" applicant → ~83% approval → MEDIUM RISK (amber)
 *
 * Data sourced from extraction.json files in each label's directory.
 */

export interface LabelTestCase {
  /** Relative paths from project root (front + optional back) */
  imagePaths: string[]
  brandName: string
  beverageType: 'wine' | 'malt_beverage' | 'distilled_spirits'
  containerSizeMl: number
  /** Serial number (Item 4) for this COLA application */
  serialNumber: string
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
  /** Applicant persona — used for grouping/debugging */
  applicant: 'old-tom' | 'napa' | 'cascade'
  /** Fields to override with wrong values (for bad applicant scenarios) */
  overrides?: Partial<
    Pick<
      LabelTestCase,
      | 'brandName'
      | 'classType'
      | 'alcoholContent'
      | 'netContents'
      | 'fancifulName'
      | 'containerSizeMl'
    >
  >
}

// ---------------------------------------------------------------------------
// Auth state files
// ---------------------------------------------------------------------------

const AUTH_OLD_TOM = 'e2e/.auth/applicant-old-tom.json'
const AUTH_NAPA = 'e2e/.auth/applicant-napa.json'
const AUTH_CASCADE = 'e2e/.auth/applicant-cascade.json'

// ---------------------------------------------------------------------------
// Old Tom Distillery (Thomas Blackwell) — "Bad" Applicant / HIGH RISK
// Whiskey-focused distillery. Frequently submits form data that doesn't match labels.
// Expected: ~1/6 approved → ~17% approval rate → HIGH RISK (red)
// ---------------------------------------------------------------------------

const OLD_TOM_LABELS: LabelTestCase[] = [
  {
    imagePaths: [
      'test-labels/whiskey/backbone-bourbon/front.png',
      'test-labels/whiskey/backbone-bourbon/back.png',
    ],
    brandName: 'Backbone Bourbon',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26001001',
    classType: 'Straight Bourbon Whiskey',
    alcoholContent: '57% ALC/VOL 114 PROOF',
    netContents: '750ML',
    fancifulName: 'Estate',
    authState: AUTH_OLD_TOM,
    applicant: 'old-tom',
    // Submit wrong alcohol content (label says 57%, form says 45%)
    overrides: { alcoholContent: '45% ALC/VOL' },
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-bourbon-10yr/front.png'],
    brandName: 'Bulleit',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26001002',
    classType: 'American Straight Rye Whiskey',
    alcoholContent: '45% alc./vol.',
    netContents: '750 mL',
    fancifulName: 'Frontier Whiskey',
    authState: AUTH_OLD_TOM,
    applicant: 'old-tom',
    // Submit wrong brand name (label says "Bulleit", form says "Old Tom Reserve")
    overrides: { brandName: 'Old Tom Reserve' },
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-frontier/front.png'],
    brandName: 'Bulleit',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26001003',
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '45% alc./vol. 90 PROOF',
    netContents: '750 mL',
    fancifulName: 'Frontier Whiskey',
    authState: AUTH_OLD_TOM,
    applicant: 'old-tom',
    // Submit wrong class/type (label says "Kentucky Straight Bourbon", form says "Tennessee Whiskey")
    overrides: { classType: 'Tennessee Whiskey' },
  },
  {
    imagePaths: [
      'test-labels/whiskey/knob-creek/front.png',
      'test-labels/whiskey/knob-creek/back.png',
    ],
    brandName: 'Knob Creek',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26001004',
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '60% ALC./VOL.',
    netContents: '750 mL',
    fancifulName: 'Single Barrel Reserve',
    authState: AUTH_OLD_TOM,
    applicant: 'old-tom',
    // Submit wrong net contents (label says 750 mL, form says 375 mL)
    overrides: { netContents: '375 mL', containerSizeMl: 375 },
  },
  {
    imagePaths: [
      'test-labels/whiskey/branch-barrel-wheat/front.png',
      'test-labels/whiskey/branch-barrel-wheat/back.png',
    ],
    brandName: 'Branch & Barrel',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26001005',
    classType: 'Wheat Whiskey',
    alcoholContent: '46% Alc. by Vol.',
    netContents: '750ml',
    authState: AUTH_OLD_TOM,
    applicant: 'old-tom',
    // Accurate — one correct submission to show they're not always wrong
  },
  {
    imagePaths: [
      'test-labels/whiskey/bulleit-single-barrel/front.png',
      'test-labels/whiskey/bulleit-single-barrel/neck.png',
    ],
    brandName: 'Bulleit Bourbon',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26001006',
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '45% ALC. BY VOL.',
    netContents: '750 mL',
    fancifulName: 'Single Barrel',
    authState: AUTH_OLD_TOM,
    applicant: 'old-tom',
    // Submit wrong fanciful name (label says "Single Barrel", form says "Double Barrel")
    overrides: { fancifulName: 'Double Barrel' },
  },
]

// ---------------------------------------------------------------------------
// Napa Valley Estate Wines (Catherine Moreau) — "Good" Applicant / LOW RISK
// Premium winery. Always submits accurate, matching form data.
// Expected: 5/5 approved → 100% approval rate → LOW RISK (green)
// ---------------------------------------------------------------------------

const NAPA_LABELS: LabelTestCase[] = [
  {
    imagePaths: [
      'test-labels/wine/cooper-ridge-malbec/front.png',
      'test-labels/wine/cooper-ridge-malbec/back.png',
    ],
    brandName: 'Cooper Ridge',
    beverageType: 'wine',
    containerSizeMl: 750,
    serialNumber: '26002001',
    classType: 'Malbec',
    alcoholContent: 'Alc. 13% by Vol.',
    netContents: '750 ml',
    fancifulName: 'Fox Hollow Vineyard',
    authState: AUTH_NAPA,
    applicant: 'napa',
  },
  {
    imagePaths: [
      'test-labels/wine/forever-summer/front.png',
      'test-labels/wine/forever-summer/back.png',
    ],
    brandName: 'Forever Summer',
    beverageType: 'wine',
    containerSizeMl: 750,
    serialNumber: '26002002',
    classType: 'Rose Wine',
    alcoholContent: 'ALC. 12.5% BY VOL.',
    netContents: '750ML',
    authState: AUTH_NAPA,
    applicant: 'napa',
  },
  {
    imagePaths: [
      'test-labels/wine/jourdan-croix-boissee/front.png',
      'test-labels/wine/jourdan-croix-boissee/back.png',
    ],
    brandName: 'Domaine Jourdan',
    beverageType: 'wine',
    containerSizeMl: 750,
    serialNumber: '26002003',
    classType: 'White Wine',
    alcoholContent: 'ALCOHOL 13.5 % BY VOLUME',
    netContents: '750ML',
    fancifulName: 'Croix Boissée',
    authState: AUTH_NAPA,
    applicant: 'napa',
  },
  {
    imagePaths: [
      'test-labels/wine/three-fox-viognier/front.png',
      'test-labels/wine/three-fox-viognier/back.png',
    ],
    brandName: 'Three Fox Vineyards',
    beverageType: 'wine',
    containerSizeMl: 750,
    serialNumber: '26002004',
    classType: 'Viognier Reserve',
    alcoholContent: 'ALC. 12.5% BY VOL.',
    netContents: '750ML',
    authState: AUTH_NAPA,
    applicant: 'napa',
  },
  {
    imagePaths: [
      'test-labels/wine/domaine-montredon/front.png',
      'test-labels/wine/domaine-montredon/back.png',
    ],
    brandName: 'Domaine de Montredon',
    beverageType: 'wine',
    containerSizeMl: 750,
    serialNumber: '26002005',
    classType: 'Carignan',
    alcoholContent: 'ALC. 13.5% BY VOL.',
    netContents: '750 ML',
    authState: AUTH_NAPA,
    applicant: 'napa',
  },
]

// ---------------------------------------------------------------------------
// Cascade Hop Brewing (Mike Olsen) — "Mixed" Applicant / MEDIUM RISK
// Brewery. Usually careful, occasional mistakes.
// Expected: ~5/6 approved → ~83% approval rate → MEDIUM RISK (amber)
// ---------------------------------------------------------------------------

const CASCADE_LABELS: LabelTestCase[] = [
  {
    imagePaths: ['test-labels/beer/sierra-nevada/front.png'],
    brandName: 'Sierra Nevada',
    beverageType: 'malt_beverage',
    containerSizeMl: 750,
    serialNumber: '26003001',
    classType: 'Stout',
    alcoholContent: 'ALC. 13.8% BY VOL.',
    netContents: '1 PT. 9.4 FL. OZ.',
    fancifulName: 'Trip Thru the Woods',
    authState: AUTH_CASCADE,
    applicant: 'cascade',
  },
  {
    imagePaths: [
      'test-labels/beer/twisted-tea-light-lemon/front.png',
      'test-labels/beer/twisted-tea-light-lemon/top.png',
    ],
    brandName: 'Twisted Tea',
    beverageType: 'malt_beverage',
    containerSizeMl: 355,
    serialNumber: '26003002',
    classType: 'Hard Iced Tea',
    alcoholContent: '4% ALC./VOL.',
    fancifulName: 'Light',
    authState: AUTH_CASCADE,
    applicant: 'cascade',
  },
  {
    imagePaths: [
      'test-labels/whiskey/crafted-spirits-malinowka/front.png',
      'test-labels/whiskey/crafted-spirits-malinowka/back.png',
    ],
    brandName: 'Crafted Spirits by Arkadius',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26003003',
    classType: 'Liqueur',
    alcoholContent: '30% ALC. BY VOL.',
    netContents: '750 ML',
    fancifulName: 'Malinówka',
    authState: AUTH_CASCADE,
    applicant: 'cascade',
  },
  {
    imagePaths: ['test-labels/whiskey/dashfire-old-fashioned/front.png'],
    brandName: 'Dashfire',
    beverageType: 'distilled_spirits',
    containerSizeMl: 100,
    serialNumber: '26003004',
    classType: 'Bourbon',
    alcoholContent: '38% ALC. / VOL.',
    netContents: '100ML',
    fancifulName: 'Old Fashioned',
    authState: AUTH_CASCADE,
    applicant: 'cascade',
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-rye/front.png'],
    brandName: 'Bulleit 95 Rye',
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    serialNumber: '26003005',
    classType: 'Frontier Whiskey',
    alcoholContent: '45% alc./vol.',
    netContents: '750 mL',
    authState: AUTH_CASCADE,
    applicant: 'cascade',
  },
  {
    imagePaths: ['test-labels/whiskey/bulleit-old-fashioned/front.png'],
    brandName: 'Bulleit',
    beverageType: 'distilled_spirits',
    containerSizeMl: 100,
    serialNumber: '26003006',
    classType: 'Kentucky Straight Bourbon Whiskey',
    alcoholContent: '37.5% ALC BY VOL',
    netContents: '100 mL',
    fancifulName: 'Old Fashioned',
    authState: AUTH_CASCADE,
    applicant: 'cascade',
    // Submit wrong alcohol content (label says 37.5%, form says 40%)
    overrides: { alcoholContent: '40% ALC BY VOL' },
  },
]

// ---------------------------------------------------------------------------
// All labels — 17 total (Old Tom: 6, Napa: 5, Cascade: 6)
//
// Ordered: 1 from each persona first (for default limit=3), then the rest.
// ---------------------------------------------------------------------------

const ORDERED_LABELS: LabelTestCase[] = [
  // First 3 — one per applicant for variety in default limit=3 runs
  OLD_TOM_LABELS[0], // backbone-bourbon (Old Tom, has override)
  NAPA_LABELS[0], // cooper-ridge-malbec (Napa, accurate)
  CASCADE_LABELS[0], // sierra-nevada (Cascade, accurate)
  // Remaining Old Tom
  ...OLD_TOM_LABELS.slice(1),
  // Remaining Napa
  ...NAPA_LABELS.slice(1),
  // Remaining Cascade
  ...CASCADE_LABELS.slice(1),
]

export const LABEL_TEST_CASES: LabelTestCase[] = ORDERED_LABELS
