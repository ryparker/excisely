import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { settings } from '@/db/schema'

// ---------------------------------------------------------------------------
// upsertSetting
// ---------------------------------------------------------------------------

export async function upsertSetting(
  key: string,
  value: unknown,
): Promise<void> {
  const [existing] = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value })
  }
}
