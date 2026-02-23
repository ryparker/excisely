import dotenv from 'dotenv'

// Load .env first, then .env.local with override (mimics Next.js behavior)
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { nanoid } from 'nanoid'

import * as schema from './schema'
import { SEED_USERS } from './seed-data/users'
import { SEED_APPLICANTS } from './seed-data/applicants'
import { SEED_SETTINGS } from './seed-data/settings'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Users (staff + applicants)
// ---------------------------------------------------------------------------

async function seedUsers(db: Db) {
  console.log('\n--- Seeding users ---')

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

    console.log(`  Created ${user.role}: ${user.name} (${user.email})`)
  }
}

// ---------------------------------------------------------------------------
// Applicants (companies)
// ---------------------------------------------------------------------------

async function seedApplicants(db: Db) {
  console.log('\n--- Seeding applicants ---')

  for (const applicant of SEED_APPLICANTS) {
    const now = new Date()

    await db.insert(schema.applicants).values({
      id: nanoid(),
      companyName: applicant.companyName,
      contactEmail: applicant.contactEmail,
      contactName: applicant.contactName,
      notes: applicant.notes,
      createdAt: now,
      updatedAt: now,
    })
  }

  console.log(`  Created ${SEED_APPLICANTS.length} applicants.`)
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
  console.log('=== Excisely Database Seed (Lean) ===')
  console.log(`Time: ${new Date().toISOString()}`)

  const db = createDb()

  await clearAllData(db)
  await seedUsers(db)
  await seedApplicants(db)
  await seedSettings(db)

  // Summary
  const staffCount = SEED_USERS.filter((u) => u.role !== 'applicant').length
  const applicantUserCount = SEED_USERS.filter(
    (u) => u.role === 'applicant',
  ).length

  console.log('\n=== Seed Complete ===')
  console.log(`  Staff users:     ${staffCount}`)
  console.log(`  Applicant users: ${applicantUserCount}`)
  console.log(`  Companies:       ${SEED_APPLICANTS.length}`)
  console.log(`  Settings:        ${SEED_SETTINGS.length}`)
  console.log('')
  console.log(
    'Labels will be created via the applicant portal (E2E tests or manual submission).',
  )
  console.log('')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
