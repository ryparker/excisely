import vision from '@google-cloud/vision'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrWord {
  text: string
  boundingPoly: { vertices: Array<{ x: number; y: number }> }
  confidence: number
}

export interface OcrResult {
  words: OcrWord[]
  fullText: string
  imageWidth: number
  imageHeight: number
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function createClient(): InstanceType<typeof vision.ImageAnnotatorClient> {
  // In Vercel, credentials JSON is stored as an env var string.
  // Locally, GOOGLE_APPLICATION_CREDENTIALS points to a file path.
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson) as {
      client_email: string
      private_key: string
    }
    return new vision.ImageAnnotatorClient({ credentials })
  }

  // Falls back to GOOGLE_APPLICATION_CREDENTIALS file path (local dev)
  return new vision.ImageAnnotatorClient()
}

// ---------------------------------------------------------------------------
// Core OCR
// ---------------------------------------------------------------------------

/**
 * Runs Google Cloud Vision text detection on image bytes (base64).
 * Returns structured word-level results with bounding polygons.
 */
export async function extractText(imageBytes: Buffer): Promise<OcrResult> {
  const client = createClient()

  const [result] = await client.textDetection({
    image: { content: imageBytes },
  })
  const annotations = result.textAnnotations

  if (!annotations || annotations.length === 0) {
    throw new Error('No text detected in image')
  }

  // First annotation contains the full concatenated text
  const fullTextAnnotation = annotations[0]
  const fullText = fullTextAnnotation.description?.trim() ?? ''

  // Remaining annotations are individual words with bounding polys
  const words: OcrWord[] = annotations.slice(1).map((annotation) => {
    const vertices = (annotation.boundingPoly?.vertices ?? []).map((v) => ({
      x: v.x ?? 0,
      y: v.y ?? 0,
    }))

    return {
      text: annotation.description ?? '',
      boundingPoly: { vertices },
      confidence: annotation.confidence ?? 0.9,
    }
  })

  // Compute image dimensions from the full-text bounding poly
  // The first annotation's bounding poly covers the entire detected area
  const fullVertices = fullTextAnnotation.boundingPoly?.vertices ?? []
  const allX = fullVertices.map((v) => v.x ?? 0)
  const allY = fullVertices.map((v) => v.y ?? 0)
  const imageWidth = Math.max(...allX, 1)
  const imageHeight = Math.max(...allY, 1)

  return {
    words,
    fullText,
    imageWidth,
    imageHeight,
  }
}

/**
 * Runs OCR on multiple images in parallel.
 * Accepts image byte buffers (fetched from private blob storage).
 */
export async function extractTextMultiImage(
  imageBuffers: Buffer[],
): Promise<OcrResult[]> {
  return Promise.all(imageBuffers.map(extractText))
}
