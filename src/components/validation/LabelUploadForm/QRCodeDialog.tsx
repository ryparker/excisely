'use client'

import { QRCodeSVG } from 'qrcode.react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  origin: string
}

export function QRCodeDialog({
  open,
  onOpenChange,
  origin,
}: QRCodeDialogProps) {
  if (!origin) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Take a photo with your phone</DialogTitle>
          <DialogDescription>
            Scan this QR code to open the submission page on your phone.
            You&apos;ll need to sign in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <QRCodeSVG
            value={`${origin}/submit`}
            size={200}
            level="M"
            className="rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
