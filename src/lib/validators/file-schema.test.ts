import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  validateFile,
  validateImageUrl,
} from '@/lib/validators/file-schema'

describe('validateImageUrl', () => {
  it('accepts public Vercel Blob URLs', () => {
    expect(
      validateImageUrl(
        'https://abc123.public.blob.vercel-storage.com/image.jpg',
      ),
    ).toBe(true)
  })

  it('accepts private Vercel Blob URLs', () => {
    expect(
      validateImageUrl('https://abc123.blob.vercel-storage.com/image.png'),
    ).toBe(true)
  })

  it('rejects non-blob domains', () => {
    expect(validateImageUrl('https://example.com/image.jpg')).toBe(false)
    expect(validateImageUrl('https://evil.com/blob.vercel-storage.com')).toBe(
      false,
    )
  })

  it('rejects invalid URLs', () => {
    expect(validateImageUrl('not-a-url')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateImageUrl('')).toBe(false)
  })
})

describe('validateFile', () => {
  function makeFile(
    content: Uint8Array,
    type: string,
    name = 'test.jpg',
  ): File {
    return new File([content as BlobPart], name, { type })
  }

  // JPEG magic bytes: FF D8 FF
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
  // PNG magic bytes: 89 50 4E 47
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

  it('accepts a valid JPEG file', async () => {
    const file = makeFile(jpegHeader, 'image/jpeg', 'photo.jpg')
    const result = await validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('accepts a valid PNG file', async () => {
    const file = makeFile(pngHeader, 'image/png', 'photo.png')
    const result = await validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('rejects disallowed MIME types', async () => {
    const file = makeFile(new Uint8Array([0x00]), 'image/gif', 'photo.gif')
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid file type')
  })

  it('rejects empty files', async () => {
    const file = makeFile(new Uint8Array(0), 'image/jpeg', 'empty.jpg')
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('rejects files exceeding size limit', async () => {
    // Create a file object that reports a large size
    const content = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const file = makeFile(content, 'image/jpeg', 'big.jpg')
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 })
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('10 MB limit')
  })

  it('rejects magic byte mismatch', async () => {
    // File claims to be JPEG but has PNG bytes
    const file = makeFile(pngHeader, 'image/jpeg', 'fake.jpg')
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('magic byte mismatch')
  })

  it('exports expected constants', () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024)
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/webp')
  })
})
