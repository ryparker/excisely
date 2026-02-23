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
    // dotenv may interpret \n in the private key as literal newlines,
    // which are invalid control characters inside a JSON string literal.
    // Re-escape them so JSON.parse succeeds.
    const sanitized = credentialsJson
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
    const credentials = JSON.parse(sanitized) as {
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
 * Runs Google Cloud Vision document text detection on image bytes.
 * Uses documentTextDetection (not textDetection) to get accurate page
 * dimensions along with word-level bounding polygons.
 */
export async function extractText(imageBytes: Buffer): Promise<OcrResult> {
  const client = createClient()

  const [result] = await client.documentTextDetection({
    image: { content: imageBytes },
  })

  // Get actual image dimensions from the page-level annotation
  const pages = result.fullTextAnnotation?.pages ?? []
  const page = pages[0]
  const imageWidth = page?.width ?? 0
  const imageHeight = page?.height ?? 0

  // Fall back to textAnnotations for word-level data
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

  // If page dimensions aren't available, estimate from text bounding poly
  let finalWidth = imageWidth
  let finalHeight = imageHeight
  if (finalWidth === 0 || finalHeight === 0) {
    const fullVertices = fullTextAnnotation.boundingPoly?.vertices ?? []
    const allX = fullVertices.map((v) => v.x ?? 0)
    const allY = fullVertices.map((v) => v.y ?? 0)
    finalWidth = Math.max(...allX, 1)
    finalHeight = Math.max(...allY, 1)
  }

  return {
    words,
    fullText,
    imageWidth: finalWidth,
    imageHeight: finalHeight,
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
