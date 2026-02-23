import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/get-session'

/**
 * Image proxy for private Vercel Blob store.
 * Fetches the blob server-side using BLOB_READ_WRITE_TOKEN and streams it to the client.
 * Usage: /api/blob/image?url=<encoded-blob-url>
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    )
  }

  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 },
    )
  }

  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('.blob.vercel-storage.com')) {
      return NextResponse.json({ error: 'Invalid blob URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid blob URL' }, { status: 400 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'Storage not configured' },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Blob fetch failed: ${response.status}` },
        { status: response.status },
      )
    }

    const body = response.body
    if (!body) {
      return NextResponse.json({ error: 'Empty response' }, { status: 502 })
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
