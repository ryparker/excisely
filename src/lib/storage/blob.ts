import { del, put } from '@vercel/blob'

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
 * Returns a browser-accessible URL for a private blob.
 * Routes through the /api/blob/image proxy which fetches server-side with the token.
 * Non-blob URLs (e.g. external images) are returned as-is.
 */
export function getSignedImageUrl(url: string): string {
  if (!isBlobUrl(url)) return url
  return `/api/blob/image?url=${encodeURIComponent(url)}`
}

/**
 * Fetches image bytes from a private blob for server-side processing (e.g. OCR).
 * Uses Bearer token auth for private blob URLs.
 * Also handles non-blob URLs (e.g. external images).
 */
export async function fetchImageBytes(url: string): Promise<Buffer> {
  const headers: Record<string, string> = {}
  if (isBlobUrl(url)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
