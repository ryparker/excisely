'use client'

import { RefreshCw, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { pluralize } from '@/lib/pluralize'
import { Button } from '@/components/ui/Button'

interface BulkActionBarProps {
  selectedCount: number
  isReadyQueue: boolean
  onClear: () => void
  onApprove: () => void
  onReanalyze: () => void
}

export function BulkActionBar({
  selectedCount,
  isReadyQueue,
  onClear,
  onApprove,
  onReanalyze,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3">
            <p className="text-sm font-medium">
              {pluralize(selectedCount, 'label')} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={onClear}
              >
                Clear Selection
              </button>
              {isReadyQueue && (
                <Button size="sm" onClick={onApprove}>
                  <ShieldCheck className="size-4" />
                  Approve Selected ({selectedCount})
                </Button>
              )}
              <Button
                size="sm"
                variant={isReadyQueue ? 'outline' : 'default'}
                onClick={onReanalyze}
              >
                <RefreshCw className="size-4" />
                Re-Analyze Selected
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
