import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  applicationData,
  labelImages,
  labels,
  type NewApplicationData,
  type NewLabel,
  type NewLabelImage,
} from '@/db/schema'

// ---------------------------------------------------------------------------
// insertLabel
// ---------------------------------------------------------------------------

type InsertLabelData = Omit<NewLabel, 'id' | 'createdAt' | 'updatedAt'>

export async function insertLabel(data: InsertLabelData) {
  const [label] = await db
    .insert(labels)
    .values(data)
    .returning({ id: labels.id })
  return label
}

// ---------------------------------------------------------------------------
// insertApplicationData
// ---------------------------------------------------------------------------

type InsertApplicationDataFields = Omit<
  NewApplicationData,
  'id' | 'createdAt' | 'updatedAt'
>

export async function insertApplicationData(data: InsertApplicationDataFields) {
  await db.insert(applicationData).values(data)
}

// ---------------------------------------------------------------------------
// insertLabelImages
// ---------------------------------------------------------------------------

type InsertLabelImageFields = Omit<
  NewLabelImage,
  'id' | 'createdAt' | 'updatedAt'
>

export async function insertLabelImages(data: InsertLabelImageFields[]) {
  return db.insert(labelImages).values(data).returning({ id: labelImages.id })
}

// ---------------------------------------------------------------------------
// updateImageTypes
// ---------------------------------------------------------------------------

export async function updateImageTypes(
  updates: Array<{ id: string; imageType: NewLabelImage['imageType'] }>,
) {
  for (const update of updates) {
    await db
      .update(labelImages)
      .set({ imageType: update.imageType })
      .where(eq(labelImages.id, update.id))
  }
}

// ---------------------------------------------------------------------------
// updateLabelStatus
// ---------------------------------------------------------------------------

type LabelStatusFields = Partial<
  Pick<
    NewLabel,
    | 'status'
    | 'overallConfidence'
    | 'aiProposedStatus'
    | 'correctionDeadline'
    | 'deadlineExpired'
  >
>

export async function updateLabelStatus(
  labelId: string,
  statusFields: LabelStatusFields,
) {
  await db.update(labels).set(statusFields).where(eq(labels.id, labelId))
}
