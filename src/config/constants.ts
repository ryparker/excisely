export const APP_NAME = 'Excisely'
export const APP_TAGLINE = 'Label verification, precisely.'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const DEFAULT_CONFIDENCE_THRESHOLD = 80
export const CORRECTION_DEADLINE_DAYS = 30
export const CONDITIONAL_DEADLINE_DAYS = 7
