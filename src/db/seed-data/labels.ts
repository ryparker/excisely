import { nanoid } from 'nanoid'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import { CLASS_TYPE_CODES } from '@/config/class-type-codes'
import { BEVERAGE_TYPES } from '@/config/beverage-types'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LabelStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'conditionally_approved'
  | 'needs_correction'
  | 'rejected'

type ValidationItemStatus =
  | 'match'
  | 'mismatch'
  | 'not_found'
  | 'needs_correction'

type FieldName =
  | 'brand_name'
  | 'fanciful_name'
  | 'class_type'
  | 'alcohol_content'
  | 'net_contents'
  | 'health_warning'
  | 'name_and_address'
  | 'qualifying_phrase'
  | 'country_of_origin'
  | 'grape_varietal'
  | 'appellation_of_origin'
  | 'vintage_year'
  | 'sulfite_declaration'
  | 'age_statement'
  | 'state_of_distillation'

export interface SeedLabel {
  id: string
  specialistId: string
  applicantId: string
  beverageType: BeverageType
  containerSizeMl: number
  status: LabelStatus
  overallConfidence: string | null
  correctionDeadline: Date | null
  deadlineExpired: boolean
  isPriority: boolean
  createdAt: Date
}

export interface SeedApplicationData {
  id: string
  labelId: string
  serialNumber: string
  brandName: string
  fancifulName: string | null
  classType: string
  classTypeCode: string
  alcoholContent: string
  netContents: string
  healthWarning: string
  nameAndAddress: string
  qualifyingPhrase: string
  countryOfOrigin: string
  grapeVarietal: string | null
  appellationOfOrigin: string | null
  vintageYear: string | null
  sulfiteDeclaration: boolean | null
  ageStatement: string | null
  stateOfDistillation: string | null
  createdAt: Date
}

export interface SeedLabelImage {
  id: string
  labelId: string
  imageUrl: string
  imageFilename: string
  imageType: 'front' | 'back' | 'neck' | 'strip' | 'other'
  sortOrder: number
  createdAt: Date
}

export interface SeedValidationResult {
  id: string
  labelId: string
  isCurrent: boolean
  aiRawResponse: Record<string, unknown>
  processingTimeMs: number
  modelUsed: string
  createdAt: Date
}

export interface SeedValidationItem {
  id: string
  validationResultId: string
  labelImageId: string
  fieldName: FieldName
  expectedValue: string
  extractedValue: string
  status: ValidationItemStatus
  confidence: string
  matchReasoning: string
  bboxX: string
  bboxY: string
  bboxWidth: string
  bboxHeight: string
  createdAt: Date
}

export interface GeneratedLabelData {
  labels: SeedLabel[]
  applicationData: SeedApplicationData[]
  labelImages: SeedLabelImage[]
  validationResults: SeedValidationResult[]
  validationItems: SeedValidationItem[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min
  const factor = Math.pow(10, decimals)
  return Math.round(val * factor) / factor
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(randInt(8, 18), randInt(0, 59), randInt(0, 59), 0)
  return d
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function serialNumber(): string {
  const year = pick(['25', '26'])
  const seq = String(randInt(100000, 999999))
  return `${year}${seq}`
}

// ---------------------------------------------------------------------------
// Brand / product data pools
// ---------------------------------------------------------------------------

const SPIRIT_BRANDS = [
  'Old Tom Reserve',
  'Heritage Gold',
  'Blackwell Single Barrel',
  'Southern Star',
  'Liberty Bell',
  'Copper Pot',
  'First Batch',
  'Bayou Gold',
  'Nordic Frost',
  'Desert Rose',
  'Midnight Express',
  'American Standard',
  'Founders Reserve',
  'Pioneer Trail',
  'Iron Horse',
  'Silver Creek',
  'Eagle Rare Select',
  'Appalachian Reserve',
  'Riverside',
  'Golden Gate',
]

const SPIRIT_FANCIFUL = [
  'Small Batch Bourbon',
  'Straight Rye Whiskey',
  'Kentucky Straight Bourbon',
  'Aged 12 Years',
  'Single Barrel Select',
  'Cask Strength',
  'Barrel Proof',
  'Limited Release',
  "Master Distiller's Choice",
  'Copper Still Reserve',
  null,
  null,
  null,
]

const WINE_BRANDS = [
  'Chateau Beaumont',
  'Napa Valley Estate',
  'Sonoma Craft',
  'Willamette Reserve',
  'Blue Ridge',
  'Finger Lakes',
  'Sunrise Cellars',
  'Smith Family',
  'Domaine Laurent',
  'Casa del Sol',
  'Emerald Coast',
  'Stone Valley',
  'Silver Oak Tribute',
  'Vineyard Select',
  'Pacific Heights',
  'Redwood Estate',
  'Golden Harvest',
  'Moonlight Cellars',
  'Fireside',
  'Autumn Ridge',
]

const WINE_FANCIFUL = [
  'Cabernet Sauvignon',
  'Pinot Noir',
  'Chardonnay',
  'Merlot',
  'Sauvignon Blanc',
  'Zinfandel',
  'Pinot Grigio',
  'Riesling',
  'Syrah',
  'Malbec',
  'Rose of Pinot Noir',
  'Viognier',
  'Petit Verdot',
  null,
]

const BEER_BRANDS = [
  'Mountain Creek',
  'Cascade Hop',
  'Great Lakes',
  'Lone Star',
  'Hometown',
  'Coastal Seltzer',
  'Evergreen',
  'Summit Peak',
  'Trailhead',
  'Riverside',
  'Iron City',
  'Bayshore',
  'Red Barn',
  'Copper Kettle',
  'Prairie Wind',
  'Northern Light',
  'Timber Wolf',
  'Anchor Point',
  'Harborside',
  'Golden Grain',
]

const BEER_FANCIFUL = [
  'India Pale Ale',
  'Pale Ale',
  'West Coast IPA',
  'Double IPA',
  'Hazy IPA',
  'American Lager',
  'Pilsner',
  'Amber Ale',
  'Porter',
  'Stout',
  'Hefeweizen',
  'Session IPA',
  'Blonde Ale',
  'Brown Ale',
  null,
  null,
]

const WINE_VARIETALS = [
  'Cabernet Sauvignon',
  'Pinot Noir',
  'Chardonnay',
  'Merlot',
  'Sauvignon Blanc',
  'Zinfandel',
  'Pinot Grigio',
  'Riesling',
  'Syrah',
  'Malbec',
  'Viognier',
  'Petit Verdot',
  'Tempranillo',
  'Sangiovese',
]

const WINE_APPELLATIONS = [
  'Napa Valley',
  'Sonoma County',
  'Willamette Valley',
  'Paso Robles',
  'Russian River Valley',
  'Finger Lakes',
  'Walla Walla Valley',
  'Santa Barbara County',
  'Mendocino County',
  'Columbia Valley',
  'Monticello AVA',
  'Lodi',
  'Temecula Valley',
  'Anderson Valley',
]

const ADDRESSES = [
  'Old Tom Distillery, Louisville, KY',
  'Mountain Creek Brewing Co., Denver, CO',
  'Napa Valley Estate Wines, Napa, CA',
  'Southern Comfort Spirits, Nashville, TN',
  'Blue Ridge Winery, Charlottesville, VA',
  'Cascade Hop Brewing, Portland, OR',
  'Heritage Distillers, Portland, OR',
  'Sonoma Craft Cellars, Sonoma, CA',
  'Great Lakes Brewing Alliance, Cleveland, OH',
  'Liberty Bell Spirits, Philadelphia, PA',
  'Desert Rose Tequila, San Antonio, TX',
  'Willamette Valley Vintners, McMinnville, OR',
  'Lone Star Brewing Co., Austin, TX',
  'Finger Lakes Wine Group, Geneva, NY',
  'Pacific Rim Imports LLC, Seattle, WA',
  'European Spirits Group, New York, NY',
  'Atlantic Wine Merchants, Boston, MA',
  'Nordic Imports Inc., Minneapolis, MN',
  'Copper Pot Distilling, Asheville, NC',
  'Bayou Spirits Co., New Orleans, LA',
]

const SPIRIT_QUALIFYING = [
  'Distilled by',
  'Bottled by',
  'Blended by',
  'Produced by',
  'Imported by',
]
const WINE_QUALIFYING = [
  'Vinted and Bottled by',
  'Cellared and Bottled by',
  'Produced by',
  'Bottled by',
]
const BEER_QUALIFYING = ['Brewed by', 'Brewed and Bottled by', 'Produced by']

const COUNTRIES = [
  'United States',
  'Scotland',
  'Ireland',
  'Mexico',
  'Canada',
  'France',
  'Italy',
  'Japan',
  'Australia',
  'Germany',
  'Spain',
  'Argentina',
  'Chile',
]

const DISTILLATION_STATES = [
  'Kentucky',
  'Tennessee',
  'Indiana',
  'Texas',
  'New York',
  'Virginia',
  'Oregon',
  'Colorado',
  'North Carolina',
  'Louisiana',
]

const MATCH_REASONS: Record<ValidationItemStatus, string[]> = {
  match: [
    'Exact match between application and label',
    'Text matches after normalization',
    'Values are equivalent — formatting differs slightly',
    'Label text confirmed via OCR with high confidence',
  ],
  mismatch: [
    'Application states "%expected%" but label reads "%extracted%"',
    'Significant discrepancy between application and label',
    'Label text does not match the application data',
    'Missing required information on label',
  ],
  not_found: [
    'Field not detected on label image',
    'OCR could not locate this field on any label panel',
    'Required field appears to be absent from the label',
  ],
  needs_correction: [
    'Minor formatting difference — may be acceptable',
    'Slight variation detected — specialist review recommended',
    'Text is present but formatting does not meet TTB requirements',
    'Value is close but not an exact match — verify manually',
  ],
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function buildAppData(
  beverageType: BeverageType,
  labelId: string,
  createdAt: Date,
): SeedApplicationData {
  const codes = CLASS_TYPE_CODES.filter((c) => c.beverageType === beverageType)
  const code = pick(codes)
  const isSpirits = beverageType === 'distilled_spirits'
  const isWine = beverageType === 'wine'

  const brandName = isSpirits
    ? pick(SPIRIT_BRANDS)
    : isWine
      ? pick(WINE_BRANDS)
      : pick(BEER_BRANDS)

  const fancifulName = isSpirits
    ? pick(SPIRIT_FANCIFUL)
    : isWine
      ? pick(WINE_FANCIFUL)
      : pick(BEER_FANCIFUL)

  const abv = isSpirits
    ? `${randFloat(35, 50)}%`
    : isWine
      ? `${randFloat(11, 15)}%`
      : `${randFloat(4, 8)}%`

  const qualifyingPhrase = isSpirits
    ? pick(SPIRIT_QUALIFYING)
    : isWine
      ? pick(WINE_QUALIFYING)
      : pick(BEER_QUALIFYING)

  const sizes = BEVERAGE_TYPES[beverageType].validSizesMl
  const sizeMl = sizes ? pick(sizes) : pick([355, 473, 500, 330, 650])

  return {
    id: nanoid(),
    labelId,
    serialNumber: serialNumber(),
    brandName,
    fancifulName,
    classType: code.description,
    classTypeCode: code.code,
    alcoholContent: abv,
    netContents: `${sizeMl} mL`,
    healthWarning: HEALTH_WARNING_FULL,
    nameAndAddress: `${qualifyingPhrase} ${pick(ADDRESSES)}`,
    qualifyingPhrase,
    countryOfOrigin: pick(COUNTRIES),
    grapeVarietal: isWine ? pick(WINE_VARIETALS) : null,
    appellationOfOrigin: isWine ? pick(WINE_APPELLATIONS) : null,
    vintageYear:
      isWine && Math.random() > 0.3 ? String(randInt(2019, 2024)) : null,
    sulfiteDeclaration: isWine ? true : null,
    ageStatement:
      isSpirits && Math.random() > 0.6 ? `${randInt(2, 18)} years` : null,
    stateOfDistillation:
      isSpirits && Math.random() > 0.5 ? pick(DISTILLATION_STATES) : null,
    createdAt,
  }
}

function buildValidationItems(
  validationResultId: string,
  labelImageId: string,
  appData: SeedApplicationData,
  status: LabelStatus,
  beverageType: BeverageType,
  createdAt: Date,
): SeedValidationItem[] {
  const mandatoryFields = BEVERAGE_TYPES[beverageType]
    .mandatoryFields as FieldName[]
  const items: SeedValidationItem[] = []

  // Decide how many fields have issues based on label status
  let mismatchCount = 0
  let needsCorrectionCount = 0

  if (status === 'rejected') {
    mismatchCount = randInt(2, 3)
  } else if (status === 'needs_correction') {
    needsCorrectionCount = randInt(1, 2)
  } else if (status === 'conditionally_approved') {
    needsCorrectionCount = 1
  }

  // Track which fields will have issues
  const shuffledFields = [...mandatoryFields].sort(() => Math.random() - 0.5)
  const mismatchFields = new Set(shuffledFields.slice(0, mismatchCount))
  const correctionFields = new Set(
    shuffledFields.slice(mismatchCount, mismatchCount + needsCorrectionCount),
  )

  for (const fieldName of mandatoryFields) {
    const expectedValue = getFieldValue(appData, fieldName)
    if (!expectedValue) continue

    let itemStatus: ValidationItemStatus = 'match'
    let confidence: number
    let extractedValue = expectedValue

    if (mismatchFields.has(fieldName)) {
      itemStatus = 'mismatch'
      confidence = randFloat(20, 55)
      extractedValue = mutateValue(expectedValue, fieldName)
    } else if (correctionFields.has(fieldName)) {
      itemStatus = 'needs_correction'
      confidence = randFloat(65, 85)
      extractedValue = slightlyMutate(expectedValue, fieldName)
    } else {
      itemStatus = 'match'
      confidence = randFloat(85, 99)
    }

    const reasoning = pick(MATCH_REASONS[itemStatus])
      .replace('%expected%', expectedValue.slice(0, 40))
      .replace('%extracted%', extractedValue.slice(0, 40))

    items.push({
      id: nanoid(),
      validationResultId,
      labelImageId,
      fieldName,
      expectedValue,
      extractedValue,
      status: itemStatus,
      confidence: String(confidence),
      matchReasoning: reasoning,
      bboxX: String(randInt(20, 200)),
      bboxY: String(randInt(50, 800)),
      bboxWidth: String(randInt(100, 400)),
      bboxHeight: String(randInt(15, 60)),
      createdAt,
    })
  }

  return items
}

function getFieldValue(
  appData: SeedApplicationData,
  fieldName: FieldName,
): string | null {
  const map: Record<string, string | boolean | null | undefined> = {
    brand_name: appData.brandName,
    fanciful_name: appData.fancifulName,
    class_type: appData.classType,
    alcohol_content: appData.alcoholContent,
    net_contents: appData.netContents,
    health_warning: appData.healthWarning,
    name_and_address: appData.nameAndAddress,
    qualifying_phrase: appData.qualifyingPhrase,
    country_of_origin: appData.countryOfOrigin,
    grape_varietal: appData.grapeVarietal,
    appellation_of_origin: appData.appellationOfOrigin,
    vintage_year: appData.vintageYear,
    sulfite_declaration: appData.sulfiteDeclaration
      ? 'Contains Sulfites'
      : null,
    age_statement: appData.ageStatement,
    state_of_distillation: appData.stateOfDistillation,
  }
  const val = map[fieldName]
  if (val === null || val === undefined || val === false) return null
  return String(val)
}

function mutateValue(value: string, fieldName: FieldName): string {
  if (fieldName === 'health_warning') {
    return 'GOVERNMENT WARNING: According to the Surgeon General, women should not drink during pregnancy.'
  }
  if (fieldName === 'alcohol_content') {
    const num = parseFloat(value)
    return `${(num + randFloat(2, 5)).toFixed(1)}%`
  }
  if (fieldName === 'net_contents') {
    return `${randInt(200, 1000)} mL`
  }
  if (fieldName === 'brand_name') {
    return value.split(' ').slice(0, -1).join(' ') || 'Unknown Brand'
  }
  // Generic: return a truncated / altered version
  return value.length > 10
    ? value.slice(0, Math.floor(value.length * 0.6))
    : `${value} (alt)`
}

function slightlyMutate(value: string, fieldName: FieldName): string {
  if (fieldName === 'health_warning') {
    // Minor punctuation difference
    return HEALTH_WARNING_FULL.replace(
      'GOVERNMENT WARNING:',
      'Government Warning:',
    )
  }
  if (fieldName === 'alcohol_content') {
    const num = parseFloat(value)
    return `${(num + 0.5).toFixed(1)}%`
  }
  if (fieldName === 'name_and_address') {
    // Missing city/state
    return value.split(',')[0]
  }
  // Generic: swap case or add extra space
  return value.replace(/\s+/g, '  ')
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

const STATUS_WEIGHTS: [LabelStatus, number][] = [
  ['approved', 40],
  ['conditionally_approved', 15],
  ['needs_correction', 15],
  ['rejected', 10],
  ['processing', 15],
  ['pending', 5],
]

const BEVERAGE_WEIGHTS: [BeverageType, number][] = [
  ['distilled_spirits', 35],
  ['wine', 40],
  ['malt_beverage', 25],
]

function weightedPick<T>(weights: [T, number][]): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [value, weight] of weights) {
    r -= weight
    if (r <= 0) return value
  }
  return weights[weights.length - 1][0]
}

// Specialist workload multipliers (Jenny processes most, Lisa the least)
const SPECIALIST_WEIGHTS: Record<string, number> = {
  'jenny.park@ttb.gov': 3,
  'marcus.williams@ttb.gov': 2,
  'janet.torres@ttb.gov': 2,
  'dave.morrison@ttb.gov': 1.5,
  'robert.kim@ttb.gov': 1.5,
  'lisa.chen@ttb.gov': 0.8,
}

function pickSpecialist(
  specialistIds: string[],
  specialistEmails: Map<string, string>,
): string {
  // Build weighted array
  const weighted: [string, number][] = specialistIds.map((id) => {
    const email = specialistEmails.get(id) ?? ''
    const weight = SPECIALIST_WEIGHTS[email] ?? 1
    return [id, weight]
  })
  return weightedPick(weighted)
}

export function generateLabels(
  applicantIds: string[],
  specialistIds: string[],
  specialistEmails: Map<string, string>,
  targetCount = 1000,
): GeneratedLabelData {
  const labels: SeedLabel[] = []
  const applicationData: SeedApplicationData[] = []
  const labelImages: SeedLabelImage[] = []
  const validationResults: SeedValidationResult[] = []
  const validationItems: SeedValidationItem[] = []

  for (let i = 0; i < targetCount; i++) {
    const labelId = nanoid()
    const beverageType = weightedPick(BEVERAGE_WEIGHTS)
    const status = weightedPick(STATUS_WEIGHTS)
    const createdDaysAgo = randInt(1, 90)
    const createdAt = daysAgo(createdDaysAgo)
    const specialistId = pickSpecialist(specialistIds, specialistEmails)
    const applicantId = pick(applicantIds)

    const sizes = BEVERAGE_TYPES[beverageType].validSizesMl
    const containerSizeMl = sizes
      ? pick(sizes)
      : pick([355, 473, 500, 330, 650])

    // Compute overall confidence based on status
    let overallConfidence: string | null = null
    if (status !== 'pending' && status !== 'processing') {
      overallConfidence =
        status === 'approved'
          ? String(randFloat(88, 99))
          : status === 'conditionally_approved'
            ? String(randFloat(75, 88))
            : status === 'needs_correction'
              ? String(randFloat(60, 78))
              : String(randFloat(25, 55))
    }

    // Correction deadlines
    let correctionDeadline: Date | null = null
    let deadlineExpired = false

    if (status === 'needs_correction') {
      if (Math.random() > 0.3) {
        correctionDeadline = daysFromNow(randInt(5, 25))
      } else {
        // Past deadline — tests lazy expiration
        correctionDeadline = daysAgo(randInt(1, 10))
        deadlineExpired = true
      }
    } else if (status === 'conditionally_approved') {
      if (Math.random() > 0.4) {
        correctionDeadline = daysFromNow(randInt(1, 6))
      } else {
        correctionDeadline = daysAgo(randInt(1, 3))
        deadlineExpired = true
      }
    }

    const isPriority = Math.random() < 0.08

    labels.push({
      id: labelId,
      specialistId,
      applicantId,
      beverageType,
      containerSizeMl,
      status,
      overallConfidence,
      correctionDeadline,
      deadlineExpired,
      isPriority,
      createdAt,
    })

    // Application data
    const appData = buildAppData(beverageType, labelId, createdAt)
    applicationData.push(appData)

    // Label images (1-2 per label)
    const imageCount = Math.random() > 0.6 ? 2 : 1
    const imageIds: string[] = []
    for (let j = 0; j < imageCount; j++) {
      const imgId = nanoid()
      imageIds.push(imgId)
      const imageType = j === 0 ? ('front' as const) : ('back' as const)
      labelImages.push({
        id: imgId,
        labelId,
        imageUrl: `https://placehold.co/800x1200/1a2332/c5a944?text=Label+${i + 1}+${imageType}`,
        imageFilename: `label-${i + 1}-${imageType}.jpg`,
        imageType,
        sortOrder: j,
        createdAt,
      })
    }

    // Validation results + items (only for non-pending labels)
    if (status !== 'pending') {
      const vrId = nanoid()
      const processingTimeMs = randInt(1500, 8000)

      validationResults.push({
        id: vrId,
        labelId,
        isCurrent: true,
        aiRawResponse: {
          pipeline: 'cloud-vision+gpt-5-mini',
          ocrConfidence: randFloat(0.92, 0.99, 3),
          classificationModel: 'gpt-5-mini',
          fieldsDetected: BEVERAGE_TYPES[beverageType].mandatoryFields.length,
          timestamp: createdAt.toISOString(),
        },
        processingTimeMs,
        modelUsed: 'gpt-5-mini',
        createdAt,
      })

      if (status !== 'processing') {
        const items = buildValidationItems(
          vrId,
          imageIds[0],
          appData,
          status,
          beverageType,
          createdAt,
        )
        validationItems.push(...items)
      }
    }
  }

  return {
    labels,
    applicationData,
    labelImages,
    validationResults,
    validationItems,
  }
}
