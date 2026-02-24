'use client'

import { CheckCircle, Loader2, XCircle } from 'lucide-react'

import type { FileWithPreview } from './ImageUploadCarousel'

export function FileStatusOverlay({
  status,
  error,
}: Pick<FileWithPreview, 'status' | 'error'>) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {status === 'pending' && (
        <span className="text-white/70">Ready to upload</span>
      )}
      {status === 'uploading' && (
        <span className="flex items-center gap-1 text-white/70">
          <Loader2 className="size-3 animate-spin" />
          Uploading...
        </span>
      )}
      {status === 'uploaded' && (
        <span className="flex items-center gap-1 text-emerald-300">
          <CheckCircle className="size-3" />
          Uploaded
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-red-300">
          <XCircle className="size-3" />
          {error || 'Failed'}
        </span>
      )}
    </div>
  )
}
