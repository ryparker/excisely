import { nanoid } from 'nanoid'

import type {
  Applicant,
  ApplicationData,
  HumanReview,
  Label,
  StatusOverride,
  ValidationItem,
  ValidationResult,
} from '@/db/schema'

// ---------------------------------------------------------------------------
// Session (Better Auth shape — not a DB table type)
// ---------------------------------------------------------------------------

export interface MockSession {
  user: {
    id: string
    name: string
    email: string
    role: 'specialist' | 'applicant'
    image?: string | null
    emailVerified: boolean
    createdAt: Date
    updatedAt: Date
  }
  session: {
    id: string
    userId: string
    token: string
    expiresAt: Date
    ipAddress: string | null
    userAgent: string | null
    createdAt: Date
    updatedAt: Date
  }
}

export function createSession(
  overrides?: Partial<MockSession['user']> & {
    session?: Partial<MockSession['session']>
  },
): MockSession {
  const userId = overrides?.id ?? nanoid()
  const now = new Date()
  return {
    user: {
      id: userId,
      name: 'Sarah Chen',
      email: 'sarah.chen@ttb.gov',
      role: 'specialist',
      image: null,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    session: {
      id: nanoid(),
      userId,
      token: nanoid(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      createdAt: now,
      updatedAt: now,
      ...overrides?.session,
    },
  }
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

export function createLabel(overrides?: Partial<Label>): Label {
  const now = new Date()
  return {
    id: nanoid(),
    specialistId: nanoid(),
    applicantId: null,
    priorLabelId: null,
    beverageType: 'distilled_spirits',
    containerSizeMl: 750,
    status: 'approved',
    overallConfidence: '95',
    correctionDeadline: null,
    deadlineExpired: false,
    aiProposedStatus: null,
    isPriority: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Application Data
// ---------------------------------------------------------------------------

export function createApplicationData(
  overrides?: Partial<ApplicationData>,
): ApplicationData {
  const now = new Date()
  return {
    id: nanoid(),
    labelId: nanoid(),
    serialNumber: '26001001000042',
    brandName: 'Old Tom Reserve',
    fancifulName: 'Single Barrel Select',
    classType: 'Whisky',
    classTypeCode: '130',
    alcoholContent: '45% Alc./Vol.',
    netContents: '750ml',
    healthWarning:
      'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    nameAndAddress: 'Old Tom Distillery, Louisville, KY',
    qualifyingPhrase: 'Distilled by',
    countryOfOrigin: 'United States',
    grapeVarietal: null,
    appellationOfOrigin: null,
    vintageYear: null,
    sulfiteDeclaration: null,
    ageStatement: '4 Years',
    stateOfDistillation: 'Kentucky',
    fdcYellow5: false,
    cochinealCarmine: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export function createValidationResult(
  overrides?: Partial<ValidationResult>,
): ValidationResult {
  const now = new Date()
  return {
    id: nanoid(),
    labelId: nanoid(),
    supersededBy: null,
    isCurrent: true,
    aiRawResponse: { classification: {}, usage: {}, metrics: {} },
    processingTimeMs: 2500,
    modelUsed: 'gpt-4.1',
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Validation Item
// ---------------------------------------------------------------------------

export function createValidationItem(
  overrides?: Partial<ValidationItem>,
): ValidationItem {
  const now = new Date()
  return {
    id: nanoid(),
    validationResultId: nanoid(),
    labelImageId: null,
    fieldName: 'brand_name',
    expectedValue: 'Old Tom Reserve',
    extractedValue: 'Old Tom Reserve',
    status: 'match',
    confidence: '95',
    matchReasoning: 'Exact match',
    bboxX: null,
    bboxY: null,
    bboxWidth: null,
    bboxHeight: null,
    bboxAngle: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Human Review
// ---------------------------------------------------------------------------

export function createHumanReview(
  overrides?: Partial<HumanReview>,
): HumanReview {
  const now = new Date()
  return {
    id: nanoid(),
    specialistId: nanoid(),
    labelId: nanoid(),
    validationItemId: null,
    originalStatus: 'mismatch',
    resolvedStatus: 'match',
    reviewerNotes: 'Verified correct on label',
    annotationData: null,
    reviewedAt: now,
    createdAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Status Override
// ---------------------------------------------------------------------------

export function createStatusOverride(
  overrides?: Partial<StatusOverride>,
): StatusOverride {
  const now = new Date()
  return {
    id: nanoid(),
    labelId: nanoid(),
    specialistId: nanoid(),
    previousStatus: 'pending_review',
    newStatus: 'approved',
    justification: 'Manual review confirmed label accuracy',
    reasonCode: null,
    createdAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Applicant
// ---------------------------------------------------------------------------

export function createApplicant(overrides?: Partial<Applicant>): Applicant {
  const now = new Date()
  return {
    id: nanoid(),
    companyName: 'Old Tom Distillery',
    contactEmail: 'labeling@oldtomdistillery.com',
    contactName: 'Thomas Blackwell',
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
