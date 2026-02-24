'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { getStageCumulativeDelays } from '@/lib/processing-stages'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Scan status messages by pipeline stage
// ---------------------------------------------------------------------------

const STAGE_MESSAGES: Record<string, string[]> = {
  ocr: ['Scanning label images...', 'Detecting text regions...'],
  classifying: ['Analyzing label content...', 'Identifying fields...'],
  comparing: ['Mapping field locations...', 'Preparing results...'],
}

// ---------------------------------------------------------------------------
// ScanAnimation — glowing line that sweeps top-to-bottom over image container
// ---------------------------------------------------------------------------

interface ScanAnimationProps {
  className?: string
}

export function ScanAnimation({ className }: ScanAnimationProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 overflow-hidden',
        className,
      )}
    >
      {/* Ambient glow — subtle blue tint that pulses with the scan cycle */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, oklch(0.6 0.1 250 / 0.02), oklch(0.6 0.1 250 / 0.06), oklch(0.6 0.1 250 / 0.02))',
        }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />
      {/* Scan line — blue bar with soft glow, ping-pongs top ↔ bottom */}
      <motion.div
        className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/80 to-transparent"
        style={{
          boxShadow:
            '0 0 16px 4px oklch(0.6 0.15 250 / 0.35), 0 0 40px 12px oklch(0.6 0.15 250 / 0.1)',
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />
      {/* Trailing gradient behind scan line — follows the line and fades at edges */}
      <motion.div
        className="absolute inset-x-0 h-[30%]"
        style={{
          background:
            'linear-gradient(to bottom, transparent, oklch(0.6 0.1 250 / 0.08), transparent)',
        }}
        animate={{ top: ['-15%', '85%'] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScanStatusTicker — cycles through descriptive messages
// ---------------------------------------------------------------------------

interface ScanStatusTickerProps {
  imageCount: number
  className?: string
}

export function ScanStatusTicker({
  imageCount,
  className,
}: ScanStatusTickerProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  const delays = getStageCumulativeDelays(imageCount)
  const allMessages: string[] = []

  for (const { stageId } of delays) {
    const stageMessages = STAGE_MESSAGES[stageId]
    if (stageMessages) {
      for (const msg of stageMessages) {
        allMessages.push(
          msg.replace('images', imageCount === 1 ? 'image' : 'images'),
        )
      }
    }
  }

  if (allMessages.length === 0) {
    allMessages.push('Analyzing label...')
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % allMessages.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [allMessages.length])

  return (
    <div className={cn('relative h-5 overflow-hidden', className)}>
      <AnimatePresence mode="wait">
        <motion.p
          key={messageIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 text-center text-sm text-muted-foreground"
        >
          {allMessages[messageIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldShimmer — pulsing placeholder for form fields during extraction
// ---------------------------------------------------------------------------

interface FieldShimmerProps {
  className?: string
}

export function FieldShimmer({ className }: FieldShimmerProps) {
  return (
    <div
      className={cn('h-9 animate-pulse rounded-md bg-muted/60', className)}
    />
  )
}
