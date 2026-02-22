import { del, head, put } from '@vercel/blob'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export type AllowedMimeType = (typeof ALLOWED_TYPES)[number]

export function isAllowedType(type: string): type is AllowedMimeType {
  return (ALLOWED_TYPES as readonly string[]).includes(type)
}

export function isWithinSizeLimit(size: number): boolean {
  return size > 0 && size <= MAX_SIZE
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const blob = await put(`${folder}/${file.name}`, file, {
    access: 'private',
    contentType: file.type,
  })
  return blob.url
}

export async function deleteImage(url: string): Promise<void> {
  await del(url)
}

function isBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com')
}

/**
 * Returns a time-limited signed download URL for a private blob.
 * Non-blob URLs (e.g. placeholders from seed data) are returned as-is.
 */
export async function getSignedImageUrl(url: string): Promise<string> {
  if (!isBlobUrl(url)) return url
  const metadata = await head(url)
  return metadata.downloadUrl
}

/**
 * Fetches image bytes from a private blob for server-side processing (e.g. OCR).
 * Also handles non-blob URLs (e.g. placeholders from seed data).
 */
export async function fetchImageBytes(url: string): Promise<Buffer> {
  const fetchUrl = isBlobUrl(url) ? await getSignedImageUrl(url) : url
  const response = await fetch(fetchUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
