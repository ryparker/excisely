import { sql } from 'drizzle-orm'

import { labels } from '@/db/schema'

/**
 * Subquery: count of non-match validation items for the current result.
 * Returns the number of items with status 'needs_correction', 'mismatch', or 'not_found'.
 */
export function flaggedCountSubquery() {
  return sql<number>`(
    SELECT count(*)::int FROM validation_items vi
    INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
    WHERE vr.label_id = ${labels.id}
    AND vr.is_current = true
    AND vi.status IN ('needs_correction', 'mismatch', 'not_found')
  )`
}

/**
 * Subquery: URL of the first image, preferring front-type images.
 * Falls back to the lowest sort_order image if no front image exists.
 */
export function thumbnailUrlSubquery() {
  return sql<string | null>`(
    SELECT li.image_url FROM label_images li
    WHERE li.label_id = ${labels.id}
    ORDER BY
      CASE WHEN li.image_type = 'front' THEN 0 ELSE 1 END,
      li.sort_order
    LIMIT 1
  )`
}
