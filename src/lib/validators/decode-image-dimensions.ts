/**
 * Decodes image dimensions from an object URL using the HTML5 Image API.
 * Reuses existing preview URLs — no extra createObjectURL needed.
 */
export function decodeImageDimensions(
  objectUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to decode image dimensions'))
    img.src = objectUrl
  })
}
