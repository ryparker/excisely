import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  validationItems,
  validationResults,
  type NewValidationItem,
  type NewValidationResult,
} from '@/db/schema'

// ---------------------------------------------------------------------------
// insertValidationResult
// ---------------------------------------------------------------------------

type InsertValidationResultData = Omit<
  NewValidationResult,
  'id' | 'createdAt' | 'updatedAt'
>

export async function insertValidationResult(data: InsertValidationResultData) {
  const [result] = await db
    .insert(validationResults)
    .values(data)
    .returning({ id: validationResults.id })
  return result
}

// ---------------------------------------------------------------------------
// supersedeValidationResult
// ---------------------------------------------------------------------------

export async function supersedeValidationResult(
  resultId: string,
  supersededById: string,
) {
  await db
    .update(validationResults)
    .set({
      isCurrent: false,
      supersededBy: supersededById,
    })
    .where(eq(validationResults.id, resultId))
}

// ---------------------------------------------------------------------------
// insertValidationItems
// ---------------------------------------------------------------------------

type InsertValidationItemData = Omit<
  NewValidationItem,
  'id' | 'createdAt' | 'updatedAt'
>

export async function insertValidationItems(items: InsertValidationItemData[]) {
  await db.insert(validationItems).values(items)
}

// ---------------------------------------------------------------------------
// updateValidationItemStatus
// ---------------------------------------------------------------------------

export async function updateValidationItemStatus(
  itemId: string,
  status: NewValidationItem['status'],
) {
  await db
    .update(validationItems)
    .set({ status })
    .where(eq(validationItems.id, itemId))
}
