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

/**
 * Returns a time-limited signed download URL for a private blob.
 * Use this in server components before passing image URLs to client components.
 */
export async function getSignedImageUrl(url: string): Promise<string> {
  const metadata = await head(url)
  return metadata.downloadUrl
}

/**
 * Fetches image bytes from a private blob for server-side processing (e.g. OCR).
 */
export async function fetchImageBytes(url: string): Promise<Buffer> {
  const signedUrl = await getSignedImageUrl(url)
  const response = await fetch(signedUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
