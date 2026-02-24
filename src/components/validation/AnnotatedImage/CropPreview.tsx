'use client'

interface CropPreviewProps {
  drawingRect: { x: number; y: number; width: number; height: number } | null
  pendingRect: { x: number; y: number; width: number; height: number } | null
  imageUrl: string
  imageAspect: number
  bottomOffset: number
  topOffset: number
}

const MAX_DIM = 220
const MIN_DIM = 80

export function CropPreview({
  drawingRect,
  pendingRect,
  imageUrl,
  imageAspect,
  bottomOffset,
  topOffset,
}: CropPreviewProps) {
  const previewSource = pendingRect ?? drawingRect
  if (
    !previewSource ||
    previewSource.width < 0.01 ||
    previewSource.height < 0.01
  )
    return null

  const cropAspect = (previewSource.width * imageAspect) / previewSource.height

  let previewW: number
  let previewH: number
  if (cropAspect >= 1) {
    previewW = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
    previewH = Math.max(MIN_DIM, Math.round(previewW / cropAspect))
  } else {
    previewH = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
    previewW = Math.max(MIN_DIM, Math.round(previewH * cropAspect))
  }

  const imgW = previewW / previewSource.width
  const imgH = previewH / previewSource.height

  const rectCenterX = previewSource.x + previewSource.width / 2
  const rectCenterY = previewSource.y + previewSource.height / 2
  const placeRight = rectCenterX < 0.5
  const placeBottom = rectCenterY < 0.5

  const positionStyle: React.CSSProperties = {
    width: previewW,
    height: previewH,
    ...(placeRight ? { right: 12 } : { left: 12 }),
    ...(placeBottom ? { bottom: bottomOffset } : { top: topOffset }),
  }

  return (
    <div
      className="pointer-events-none absolute z-20 overflow-hidden rounded-lg border-2 border-indigo-500/80 bg-black shadow-xl transition-[top,right,bottom,left] duration-200"
      style={positionStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Crop preview"
        draggable={false}
        className="absolute block"
        style={{
          width: imgW,
          height: imgH,
          left: -previewSource.x * imgW,
          top: -previewSource.y * imgH,
          maxWidth: 'none',
        }}
      />
      <span className="absolute top-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        Preview
      </span>
    </div>
  )
}
