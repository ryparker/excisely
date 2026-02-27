import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/get-session'
import { uploadImageWithSuffix } from '@/lib/storage/blob'
import { validateFile } from '@/lib/validators/file-schema'

export async function POST(request: Request): Promise<Response> {
  // CSRF-like protection: require XMLHttpRequest header
  const requestedWith = request.headers.get('X-Requested-With')
  if (requestedWith !== 'XMLHttpRequest') {
    return new Response('Forbidden', { status: 403 })
  }

  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Full validation: MIME type, size, and magic bytes
    const validation = await validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Sanitize filename
    const sanitizedName = file.name
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(0, 255)

    // Create a new File with sanitized name (File constructor requires re-wrapping)
    const sanitizedFile = new File([file], sanitizedName, {
      type: file.type,
    })

    const result = await uploadImageWithSuffix(sanitizedFile, 'labels')

    return NextResponse.json({ url: result.url, pathname: result.pathname })
  } catch (error) {
    console.error('[blob/upload] Error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
