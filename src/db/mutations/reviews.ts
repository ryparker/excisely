import { db } from '@/db'
import {
  humanReviews,
  statusOverrides,
  type NewHumanReview,
  type NewStatusOverride,
} from '@/db/schema'

// ---------------------------------------------------------------------------
// insertHumanReview
// ---------------------------------------------------------------------------

type InsertHumanReviewData = Omit<
  NewHumanReview,
  'id' | 'reviewedAt' | 'createdAt'
>

export async function insertHumanReview(data: InsertHumanReviewData) {
  await db.insert(humanReviews).values(data)
}

// ---------------------------------------------------------------------------
// insertStatusOverride
// ---------------------------------------------------------------------------

type InsertStatusOverrideData = Omit<NewStatusOverride, 'id' | 'createdAt'>

export async function insertStatusOverride(data: InsertStatusOverrideData) {
  await db.insert(statusOverrides).values(data)
}
