import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types (unchanged — downstream consumers depend on this interface)
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
// Tesseract worker (eager init — starts WASM compilation at module load)
// ---------------------------------------------------------------------------

let _workerPromise: Promise<Tesseract.Worker> | null = null

async function initWorker(): Promise<Tesseract.Worker> {
  const langPath = path.join(process.cwd(), 'public', 'tesseract')

  // Custom worker that forces the plain LSTM core (no SIMD).
  // The default auto-detected relaxedsimd core crashes in Node.js
  // with a missing DotProductSSE symbol.
  const workerPath = path.join(
    process.cwd(),
    'src',
    'lib',
    'ai',
    'tesseract-worker.js',
  )

  const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    langPath,
    workerPath,
    gzip: false,
  })

  // PSM 11 = Sparse text. Find as much text as possible in no particular order.
  // Best for label-style scattered layouts where text isn't in neat columns.
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
  })

  return worker
}

function getWorker(): Promise<Tesseract.Worker> {
  if (!_workerPromise) {
    _workerPromise = initWorker().catch((err) => {
      _workerPromise = null // Allow retry on next call
      throw err
    })
  }
  return _workerPromise
}

// Eagerly start worker init at module load so WASM is compiled before
// the first submission arrives (~1.5s head start). Catch the rejection
// to prevent unhandled promise errors in test environments where the
// Tesseract worker path doesn't exist.
getWorker().catch(() => {})

// ---------------------------------------------------------------------------
// Image preprocessing (sharp)
// ---------------------------------------------------------------------------

interface PreprocessResult {
  buffer: Buffer
  width: number
  height: number
}

/**
 * Preprocesses an image for optimal Tesseract OCR accuracy:
 * 1. EXIF auto-orient (fixes phone photo rotation)
 * 2. Grayscale conversion (reduces noise, faster processing)
 * 3. Contrast normalization (helps with low-contrast label text)
 * 4. Resize to max 2000px on longest side (balances accuracy vs speed)
 * 5. Output as PNG (lossless, Tesseract's preferred format)
 *
 * Returns the processed buffer AND dimensions, avoiding a redundant
 * sharp metadata call downstream.
 */
async function preprocessImage(imageBytes: Buffer): Promise<PreprocessResult> {
  try {
    const { data, info } = await sharp(imageBytes)
      .rotate() // EXIF auto-orient
      .grayscale()
      .normalize() // Stretch contrast to full range
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true })
    return { buffer: data, width: info.width, height: info.height }
  } catch {
    // If preprocessing fails, try with just rotation
    try {
      const { data, info } = await sharp(imageBytes)
        .rotate()
        .png()
        .toBuffer({ resolveWithObject: true })
      return { buffer: data, width: info.width, height: info.height }
    } catch {
      return { buffer: imageBytes, width: 0, height: 0 }
    }
  }
}

// ---------------------------------------------------------------------------
// Core OCR
// ---------------------------------------------------------------------------

/**
 * Runs Tesseract.js WASM OCR on image bytes.
 * Returns word-level bounding boxes in the same 4-vertex polygon format
 * that Google Cloud Vision used, so downstream consumers are unaffected.
 *
 * Images are preprocessed (EXIF orient, grayscale, contrast normalize,
 * resize) for optimal OCR accuracy on label images.
 */
export async function extractText(imageBytes: Buffer): Promise<OcrResult> {
  const worker = await getWorker()

  // Preprocess image for better OCR accuracy (returns dimensions too)
  const {
    buffer: processed,
    width: imageWidth,
    height: imageHeight,
  } = await preprocessImage(imageBytes)

  // Run OCR with block-level hierarchy for word extraction
  // options=undefined, output={ blocks: true } enables hierarchical word data
  const { data } = await worker.recognize(processed, {}, { blocks: true })

  // Traverse hierarchy: blocks → paragraphs → lines → words
  const words: OcrWord[] = []
  const blocks = data.blocks ?? []

  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          if (!word.text || word.text.trim() === '') continue

          // Convert Tesseract bbox {x0, y0, x1, y1} to 4-vertex polygon
          // matching Google Cloud Vision's format
          const { x0, y0, x1, y1 } = word.bbox
          const vertices = [
            { x: x0, y: y0 }, // top-left
            { x: x1, y: y0 }, // top-right
            { x: x1, y: y1 }, // bottom-right
            { x: x0, y: y1 }, // bottom-left
          ]

          words.push({
            text: word.text,
            boundingPoly: { vertices },
            // Tesseract confidence is 0-100, normalize to 0-1
            confidence: (word.confidence ?? 0) / 100,
          })
        }
      }
    }
  }

  // Build full text from words (preserving reading order from Tesseract)
  const fullText = data.text?.trim() ?? words.map((w) => w.text).join(' ')

  if (words.length === 0) {
    throw new Error('No text detected in image')
  }

  return {
    words,
    fullText,
    imageWidth,
    imageHeight,
  }
}

/**
 * Runs OCR on multiple images sequentially.
 * Tesseract.js WASM is single-threaded so Promise.all would serialize anyway.
 * Sequential processing is clearer and avoids potential memory pressure.
 */
export async function extractTextMultiImage(
  imageBuffers: Buffer[],
): Promise<OcrResult[]> {
  const results: OcrResult[] = []
  for (const buffer of imageBuffers) {
    results.push(await extractText(buffer))
  }
  return results
}
