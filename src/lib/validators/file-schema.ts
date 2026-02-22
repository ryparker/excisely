export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/**
 * Magic byte signatures for validating file content matches its declared type.
 * Each entry maps a MIME type to one or more valid byte prefixes.
 */
export const MAGIC_BYTES: Record<AllowedMimeType, Uint8Array[]> = {
  'image/jpeg': [new Uint8Array([0xff, 0xd8, 0xff])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  'image/webp': [
    // WebP files start with "RIFF" (4 bytes), then 4 bytes of file size,
    // then "WEBP" (4 bytes). We check bytes 0-3 and 8-11.
    new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  ],
}

const WEBP_SIGNATURE = new Uint8Array([0x57, 0x45, 0x42, 0x50])

/**
 * Validates a file by checking MIME type, size, and magic bytes.
 * Returns `{ valid: true }` on success, or `{ valid: false, error }` on failure.
 */
export async function validateFile(
  file: File,
): Promise<{ valid: boolean; error?: string }> {
  // Check MIME type
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type "${file.type}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    }
  }

  // Check size
  if (file.size <= 0) {
    return { valid: false, error: 'File is empty' }
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the 10 MB limit`,
    }
  }

  // Check magic bytes
  const mimeType = file.type as AllowedMimeType
  const signatures = MAGIC_BYTES[mimeType]
  const headerSize = mimeType === 'image/webp' ? 12 : 4
  const buffer = await file.slice(0, headerSize).arrayBuffer()
  const header = new Uint8Array(buffer)

  const prefixMatch = signatures.some((sig) => {
    for (let i = 0; i < sig.length; i++) {
      if (header[i] !== sig[i]) return false
    }
    return true
  })

  if (!prefixMatch) {
    return {
      valid: false,
      error:
        'File content does not match its declared type (magic byte mismatch)',
    }
  }

  // Additional WebP check: bytes 8-11 must be "WEBP"
  if (mimeType === 'image/webp') {
    const webpTag = header.slice(8, 12)
    const isWebp = WEBP_SIGNATURE.every((byte, i) => webpTag[i] === byte)
    if (!isWebp) {
      return {
        valid: false,
        error: 'File has RIFF header but is not a valid WebP image',
      }
    }
  }

  return { valid: true }
}

const ALLOWED_BLOB_HOSTS = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
]

/**
 * Checks whether a URL points to an allowed Vercel Blob storage domain.
 */
export function validateImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_BLOB_HOSTS.some((host) => parsed.hostname.endsWith(host))
  } catch {
    return false
  }
}
