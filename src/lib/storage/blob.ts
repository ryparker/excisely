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
    access: 'public',
    contentType: file.type,
  })
  return blob.url
}

export async function deleteImage(url: string): Promise<void> {
  await del(url)
}
