import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/get-session'

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request): Promise<NextResponse> {
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

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}` },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 10 MB limit' },
        { status: 400 },
      )
    }

    const blob = await put(`labels/${file.name}`, file, {
      access: 'private',
      contentType: file.type,
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url, pathname: blob.pathname })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
