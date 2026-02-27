import fs from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'

// Re-export shared constants (safe for client bundles)
export {
  LOCAL_URL_PREFIX,
  isBlobUrl,
  isLocalUrl,
  getSignedImageUrl,
} from './constants'
import { LOCAL_URL_PREFIX, isBlobUrl, isLocalUrl } from './constants'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/** Directory for local file storage (relative to project root) */
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), '.data', 'uploads')

export type AllowedMimeType = (typeof ALLOWED_TYPES)[number]

export function isAllowedType(type: string): type is AllowedMimeType {
  return (ALLOWED_TYPES as readonly string[]).includes(type)
}

export function isWithinSizeLimit(size: number): boolean {
  return size > 0 && size <= MAX_SIZE
}

/** Whether Vercel Blob storage is configured (has API token). */
export function hasBlobStorage(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadImage(file: File, folder: string): Promise<string> {
  if (hasBlobStorage()) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`${folder}/${file.name}`, file, {
      access: 'private',
      contentType: file.type,
    })
    return blob.url
  }

  return uploadImageLocal(file, folder)
}

/**
 * Uploads a file with a random suffix (for the upload API route).
 * Returns `{ url, pathname }` matching the Vercel Blob response shape.
 */
export async function uploadImageWithSuffix(
  file: File,
  folder: string,
): Promise<{ url: string; pathname: string }> {
  if (hasBlobStorage()) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`${folder}/${file.name}`, file, {
      access: 'private',
      contentType: file.type,
      addRandomSuffix: true,
    })
    return { url: blob.url, pathname: blob.pathname }
  }

  const url = await uploadImageLocal(file, folder)
  const pathname = url.replace(LOCAL_URL_PREFIX, '')
  return { url, pathname }
}

async function uploadImageLocal(file: File, folder: string): Promise<string> {
  const dir = path.join(LOCAL_UPLOADS_DIR, folder)
  await fs.mkdir(dir, { recursive: true })

  // Add random suffix to prevent collisions (matches Vercel Blob behavior)
  const ext = path.extname(file.name)
  const base = path.basename(file.name, ext)
  const filename = `${base}-${nanoid(8)}${ext}`
  const filePath = path.join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  // Store as local:// URL so we can identify it later
  return `${LOCAL_URL_PREFIX}${folder}/${filename}`
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteImage(url: string): Promise<void> {
  if (isLocalUrl(url)) {
    const relativePath = url.replace(LOCAL_URL_PREFIX, '')
    const filePath = path.join(LOCAL_UPLOADS_DIR, relativePath)
    await fs.unlink(filePath).catch(() => {
      // File already gone — not an error
    })
    return
  }

  const { del } = await import('@vercel/blob')
  await del(url)
}

// ---------------------------------------------------------------------------
// Read — server-side bytes (for OCR, AI processing)
// ---------------------------------------------------------------------------

/**
 * Fetches image bytes for server-side processing (e.g. OCR).
 * - Local URLs: reads directly from disk
 * - Blob URLs: fetches with Bearer token auth
 * - External URLs: plain fetch
 */
export async function fetchImageBytes(url: string): Promise<Buffer> {
  if (isLocalUrl(url)) {
    const relativePath = url.replace(LOCAL_URL_PREFIX, '')
    const filePath = path.join(LOCAL_UPLOADS_DIR, relativePath)
    return fs.readFile(filePath)
  }

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

// ---------------------------------------------------------------------------
// Read — local file bytes (for image proxy)
// ---------------------------------------------------------------------------

/**
 * Reads a local file by its local:// URL path. Returns the buffer and
 * a guessed content type. Used by the image proxy route.
 */
export async function readLocalImage(
  url: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const relativePath = url.replace(LOCAL_URL_PREFIX, '')
  const filePath = path.join(LOCAL_UPLOADS_DIR, relativePath)
  const buffer = await fs.readFile(filePath)

  const ext = path.extname(filePath).toLowerCase()
  const contentType =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'

  return { buffer, contentType }
}
