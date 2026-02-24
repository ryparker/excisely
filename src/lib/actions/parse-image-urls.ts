import { validateImageUrl } from '@/lib/validators/file-schema'

type ParseImageUrlsResult =
  | { success: true; imageUrls: string[] }
  | { success: false; error: string }

/**
 * Extracts, parses, and validates image URLs from form data.
 * Expects a JSON-encoded string array under the "imageUrls" key.
 * Validates that each URL points to an allowed Vercel Blob host.
 */
export function parseImageUrls(formData: FormData): ParseImageUrlsResult {
  const imageUrlsRaw = formData.get('imageUrls')
  if (!imageUrlsRaw || typeof imageUrlsRaw !== 'string') {
    return { success: false, error: 'No image URLs provided' }
  }

  let imageUrls: string[]
  try {
    imageUrls = JSON.parse(imageUrlsRaw)
  } catch {
    return { success: false, error: 'Invalid image URLs format' }
  }

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { success: false, error: 'At least one label image is required' }
  }

  if (imageUrls.length > 10) {
    return { success: false, error: 'Maximum 10 images allowed' }
  }

  for (const url of imageUrls) {
    if (!validateImageUrl(url)) {
      return { success: false, error: `Invalid image URL: ${url}` }
    }
  }

  return { success: true, imageUrls }
}
