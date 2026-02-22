import dotenv from 'dotenv'

// Load .env first, then .env.local with override (mimics Next.js behavior)
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { nanoid } from 'nanoid'

import * as schema from './schema'
import { SEED_USERS } from './seed-data/users'
import { SEED_APPLICANTS } from './seed-data/applicants'
import { SEED_SETTINGS } from './seed-data/settings'
import { generateLabels } from './seed-data/labels'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function hashPassword(password: string): Promise<string> {
  const { hashPassword: hash } = await import('better-auth/crypto')
  return hash(password)
}

// ---------------------------------------------------------------------------
// Database connection (standalone — not the proxy from db/index.ts)
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof drizzleNeon<typeof schema>>

function createDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Create a .env.local file with your connection string.',
    )
  }

  if (url.includes('neon.tech')) {
    const sql = neon(url)
    return drizzleNeon(sql, { schema })
  }

  // Local Postgres (OrbStack / Docker)
  const pool = new pg.Pool({ connectionString: url })
  return drizzleNode(pool, { schema }) as unknown as Db
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

async function clearAllData(db: Db) {
  console.log('\n--- Clearing existing data ---')

  // Delete in reverse FK order
  await db.delete(schema.humanReviews)
  await db.delete(schema.validationItems)
  await db.delete(schema.validationResults)
  await db.delete(schema.applicationData)
  await db.delete(schema.labelImages)
  await db.delete(schema.labels)
  await db.delete(schema.batches)
  await db.delete(schema.applicants)
  await db.delete(schema.acceptedVariants)
  await db.delete(schema.settings)
  await db.delete(schema.sessions)
  await db.delete(schema.accounts)
  await db.delete(schema.verifications)
  await db.delete(schema.users)

  console.log('All tables cleared.')
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function seedUsers(db: Db) {
  console.log('\n--- Seeding users ---')

  const userIds: string[] = []
  const specialistIds: string[] = []
  const specialistEmails = new Map<string, string>()

  for (const user of SEED_USERS) {
    const userId = nanoid()
    const accountId = nanoid()
    const hashedPassword = await hashPassword(user.password)
    const now = new Date()

    await db.insert(schema.users).values({
      id: userId,
      name: user.name,
      email: user.email,
      emailVerified: true,
      role: user.role,
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(schema.accounts).values({
      id: accountId,
      userId,
      accountId: userId,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    })

    userIds.push(userId)
    if (user.role === 'specialist') {
      specialistIds.push(userId)
      specialistEmails.set(userId, user.email)
    }

    console.log(`  Created ${user.role}: ${user.name} (${user.email})`)
  }

  return { userIds, specialistIds, specialistEmails }
}

// ---------------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------------

async function seedApplicants(db: Db) {
  console.log('\n--- Seeding applicants ---')

  const applicantIds: string[] = []

  for (const applicant of SEED_APPLICANTS) {
    const id = nanoid()
    const now = new Date()

    await db.insert(schema.applicants).values({
      id,
      companyName: applicant.companyName,
      contactEmail: applicant.contactEmail,
      contactName: applicant.contactName,
      notes: applicant.notes,
      createdAt: now,
      updatedAt: now,
    })

    applicantIds.push(id)
  }

  console.log(`  Created ${applicantIds.length} applicants.`)
  return applicantIds
}

// ---------------------------------------------------------------------------
// Labels + related tables
// ---------------------------------------------------------------------------

async function seedLabels(
  db: Db,
  applicantIds: string[],
  specialistIds: string[],
  specialistEmails: Map<string, string>,
) {
  console.log('\n--- Generating labels ---')

  const data = generateLabels(
    applicantIds,
    specialistIds,
    specialistEmails,
    1000,
  )

  console.log(`  Generated ${data.labels.length} labels`)
  console.log(
    `  Generated ${data.applicationData.length} application data records`,
  )
  console.log(`  Generated ${data.labelImages.length} label images`)
  console.log(`  Generated ${data.validationResults.length} validation results`)
  console.log(`  Generated ${data.validationItems.length} validation items`)

  const CHUNK = 100

  console.log('  Inserting labels...')
  for (let i = 0; i < data.labels.length; i += CHUNK) {
    await db.insert(schema.labels).values(
      data.labels.slice(i, i + CHUNK).map((l) => ({
        id: l.id,
        specialistId: l.specialistId,
        applicantId: l.applicantId,
        beverageType: l.beverageType,
        containerSizeMl: l.containerSizeMl,
        status: l.status,
        overallConfidence: l.overallConfidence,
        correctionDeadline: l.correctionDeadline,
        deadlineExpired: l.deadlineExpired,
        isPriority: l.isPriority,
        createdAt: l.createdAt,
        updatedAt: l.createdAt,
      })),
    )
  }

  console.log('  Inserting application data...')
  for (let i = 0; i < data.applicationData.length; i += CHUNK) {
    await db.insert(schema.applicationData).values(
      data.applicationData.slice(i, i + CHUNK).map((a) => ({
        id: a.id,
        labelId: a.labelId,
        serialNumber: a.serialNumber,
        brandName: a.brandName,
        fancifulName: a.fancifulName,
        classType: a.classType,
        classTypeCode: a.classTypeCode,
        alcoholContent: a.alcoholContent,
        netContents: a.netContents,
        healthWarning: a.healthWarning,
        nameAndAddress: a.nameAndAddress,
        qualifyingPhrase: a.qualifyingPhrase,
        countryOfOrigin: a.countryOfOrigin,
        grapeVarietal: a.grapeVarietal,
        appellationOfOrigin: a.appellationOfOrigin,
        vintageYear: a.vintageYear,
        sulfiteDeclaration: a.sulfiteDeclaration,
        ageStatement: a.ageStatement,
        stateOfDistillation: a.stateOfDistillation,
        createdAt: a.createdAt,
        updatedAt: a.createdAt,
      })),
    )
  }

  console.log('  Inserting label images...')
  for (let i = 0; i < data.labelImages.length; i += CHUNK) {
    await db.insert(schema.labelImages).values(
      data.labelImages.slice(i, i + CHUNK).map((img) => ({
        id: img.id,
        labelId: img.labelId,
        imageUrl: img.imageUrl,
        imageFilename: img.imageFilename,
        imageType: img.imageType,
        sortOrder: img.sortOrder,
        createdAt: img.createdAt,
        updatedAt: img.createdAt,
      })),
    )
  }

  console.log('  Inserting validation results...')
  for (let i = 0; i < data.validationResults.length; i += CHUNK) {
    await db.insert(schema.validationResults).values(
      data.validationResults.slice(i, i + CHUNK).map((vr) => ({
        id: vr.id,
        labelId: vr.labelId,
        isCurrent: vr.isCurrent,
        aiRawResponse: vr.aiRawResponse,
        processingTimeMs: vr.processingTimeMs,
        modelUsed: vr.modelUsed,
        createdAt: vr.createdAt,
        updatedAt: vr.createdAt,
      })),
    )
  }

  console.log('  Inserting validation items...')
  for (let i = 0; i < data.validationItems.length; i += CHUNK) {
    await db.insert(schema.validationItems).values(
      data.validationItems.slice(i, i + CHUNK).map((vi) => ({
        id: vi.id,
        validationResultId: vi.validationResultId,
        labelImageId: vi.labelImageId,
        fieldName: vi.fieldName,
        expectedValue: vi.expectedValue,
        extractedValue: vi.extractedValue,
        status: vi.status,
        confidence: vi.confidence,
        matchReasoning: vi.matchReasoning,
        bboxX: vi.bboxX,
        bboxY: vi.bboxY,
        bboxWidth: vi.bboxWidth,
        bboxHeight: vi.bboxHeight,
        createdAt: vi.createdAt,
        updatedAt: vi.createdAt,
      })),
    )
  }

  return data
}

// ---------------------------------------------------------------------------
// Batches (group ~20% of labels)
// ---------------------------------------------------------------------------

async function seedBatches(
  db: Db,
  labels: ReturnType<typeof generateLabels>['labels'],
) {
  console.log('\n--- Seeding batches ---')

  const batchableLabels = labels
    .filter((l) => l.status !== 'pending')
    .slice(0, Math.floor(labels.length * 0.2))

  // Group by specialist + applicant pair
  const groups = new Map<string, typeof batchableLabels>()
  for (const label of batchableLabels) {
    const key = `${label.specialistId}::${label.applicantId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(label)
  }

  let batchCount = 0
  for (const [key, groupLabels] of groups) {
    if (groupLabels.length < 3) continue

    const [specialistId, applicantId] = key.split('::')
    const batchId = nanoid()
    const now = new Date()

    const approved = groupLabels.filter((l) => l.status === 'approved').length
    const condApproved = groupLabels.filter(
      (l) => l.status === 'conditionally_approved',
    ).length
    const rejected = groupLabels.filter((l) => l.status === 'rejected').length
    const needsCorr = groupLabels.filter(
      (l) => l.status === 'needs_correction',
    ).length
    const processed = approved + condApproved + rejected + needsCorr
    const allDone = processed === groupLabels.length

    await db.insert(schema.batches).values({
      id: batchId,
      specialistId,
      applicantId,
      name: `Batch ${batchCount + 1} — ${groupLabels.length} labels`,
      status: allDone ? 'completed' : 'processing',
      totalLabels: groupLabels.length,
      processedCount: processed,
      approvedCount: approved,
      conditionallyApprovedCount: condApproved,
      rejectedCount: rejected,
      needsCorrectionCount: needsCorr,
      createdAt: now,
      updatedAt: now,
    })

    for (const label of groupLabels) {
      await db
        .update(schema.labels)
        .set({ batchId })
        .where(eq(schema.labels.id, label.id))
    }

    batchCount++
  }

  console.log(`  Created ${batchCount} batches.`)
}

// ---------------------------------------------------------------------------
// Human reviews
// ---------------------------------------------------------------------------

const REVIEWER_NOTES = [
  'Confirmed mismatch after manual inspection of the physical label.',
  'Label text matches application data — OCR misread due to stylized font.',
  'Minor formatting difference is acceptable per TTB guidelines.',
  'Verified against original COLA application. Discrepancy is confirmed.',
  'Spoke with applicant — they will submit a corrected label.',
  'The slight variation in spacing is within acceptable tolerance.',
  'Reviewed high-resolution scan. Text matches after accounting for print artifacts.',
  'Applicant notified of required corrections via email.',
  null,
  null,
]

async function seedHumanReviews(
  db: Db,
  validationItems: ReturnType<typeof generateLabels>['validationItems'],
  itemToLabelId: Map<string, string>,
  specialistIds: string[],
) {
  console.log('\n--- Seeding human reviews ---')

  const reviewableItems = validationItems.filter(
    (vi) => vi.status === 'needs_correction' || vi.status === 'mismatch',
  )

  const targetCount = Math.min(randInt(80, 100), reviewableItems.length)
  const shuffled = [...reviewableItems].sort(() => Math.random() - 0.5)
  const toReview = shuffled.slice(0, targetCount)

  const rows = toReview
    .map((vi) => {
      const labelId = itemToLabelId.get(vi.id)
      if (!labelId) return null

      const resolvedStatus =
        Math.random() > 0.4 ? ('mismatch' as const) : ('match' as const)
      const reviewedAt = new Date(
        vi.createdAt.getTime() + randInt(3600000, 86400000 * 3),
      )

      return {
        id: nanoid(),
        specialistId: pick(specialistIds),
        labelId,
        validationItemId: vi.id,
        originalStatus: vi.status,
        resolvedStatus,
        reviewerNotes: pick(REVIEWER_NOTES),
        reviewedAt,
        createdAt: reviewedAt,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    specialistId: string
    labelId: string
    validationItemId: string
    originalStatus: 'match' | 'mismatch' | 'not_found' | 'needs_correction'
    resolvedStatus: 'match' | 'mismatch' | 'not_found'
    reviewerNotes: string | null
    reviewedAt: Date
    createdAt: Date
  }>

  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(schema.humanReviews).values(rows.slice(i, i + CHUNK))
  }

  console.log(`  Created ${rows.length} human reviews.`)
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function seedSettings(db: Db) {
  console.log('\n--- Seeding settings ---')

  for (const setting of SEED_SETTINGS) {
    await db.insert(schema.settings).values({
      id: nanoid(),
      key: setting.key,
      value: setting.value,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  console.log(`  Created ${SEED_SETTINGS.length} settings.`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Excisely Database Seed ===')
  console.log(`Time: ${new Date().toISOString()}`)

  const db = createDb()

  await clearAllData(db)
  const { specialistIds, specialistEmails } = await seedUsers(db)
  const applicantIds = await seedApplicants(db)
  const generated = await seedLabels(
    db,
    applicantIds,
    specialistIds,
    specialistEmails,
  )

  // Build validation item -> label ID lookup for human reviews
  const vrToLabelId = new Map<string, string>()
  for (const vr of generated.validationResults) {
    vrToLabelId.set(vr.id, vr.labelId)
  }
  const itemToLabelId = new Map<string, string>()
  for (const vi of generated.validationItems) {
    const labelId = vrToLabelId.get(vi.validationResultId)
    if (labelId) itemToLabelId.set(vi.id, labelId)
  }

  await seedHumanReviews(
    db,
    generated.validationItems,
    itemToLabelId,
    specialistIds,
  )
  await seedBatches(db, generated.labels)
  await seedSettings(db)

  // Summary
  console.log('\n=== Seed Complete ===')
  console.log(`  Users:              ${SEED_USERS.length}`)
  console.log(`  Applicants:         ${SEED_APPLICANTS.length}`)
  console.log(`  Labels:             ${generated.labels.length}`)
  console.log(`  Application Data:   ${generated.applicationData.length}`)
  console.log(`  Label Images:       ${generated.labelImages.length}`)
  console.log(`  Validation Results: ${generated.validationResults.length}`)
  console.log(`  Validation Items:   ${generated.validationItems.length}`)
  console.log(`  Settings:           ${SEED_SETTINGS.length}`)
  console.log('')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
