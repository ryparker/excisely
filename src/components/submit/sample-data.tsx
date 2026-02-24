'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Copy,
  Check,
  FlaskConical,
  X,
  Download,
  ImageIcon,
  GripVertical,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import Image from 'next/image'

import { cn } from '@/lib/utils'

interface SampleImage {
  src: string
  label: string
  filename: string
}

interface SampleField {
  label: string
  value: string
}

interface SampleLabel {
  name: string
  beverageType: string
  images: SampleImage[]
  fields: SampleField[]
}

const SAMPLE_LABELS: SampleLabel[] = [
  {
    name: 'Cooper Ridge Malbec',
    beverageType: 'Wine',
    images: [
      {
        src: '/sample-labels/cooper-ridge-malbec/front.png',
        label: 'Front',
        filename: 'cooper-ridge-malbec-front.png',
      },
      {
        src: '/sample-labels/cooper-ridge-malbec/back.png',
        label: 'Back',
        filename: 'cooper-ridge-malbec-back.png',
      },
    ],
    fields: [
      { label: 'Serial Number', value: '26009001' },
      { label: 'Brand Name', value: 'Cooper Ridge' },
      { label: 'Fanciful Name', value: 'Fox Hollow Vineyard' },
      { label: 'Class/Type', value: 'Malbec' },
      { label: 'Alcohol Content', value: 'Alc. 13% by Vol.' },
      { label: 'Net Contents', value: '750 ml' },
      { label: 'Container Size', value: '750' },
    ],
  },
  {
    name: 'Backbone Bourbon',
    beverageType: 'Distilled Spirits',
    images: [
      {
        src: '/sample-labels/backbone-bourbon/front.png',
        label: 'Front',
        filename: 'backbone-bourbon-front.png',
      },
      {
        src: '/sample-labels/backbone-bourbon/back.png',
        label: 'Back',
        filename: 'backbone-bourbon-back.png',
      },
    ],
    fields: [
      { label: 'Serial Number', value: '26009002' },
      { label: 'Brand Name', value: 'Backbone Bourbon' },
      { label: 'Fanciful Name', value: 'Estate' },
      { label: 'Class/Type', value: 'Straight Bourbon Whiskey' },
      { label: 'Alcohol Content', value: '57% ALC/VOL 114 PROOF' },
      { label: 'Net Contents', value: '750ML' },
      { label: 'Container Size', value: '750' },
    ],
  },
  {
    name: 'Sierra Nevada Stout',
    beverageType: 'Malt Beverages',
    images: [
      {
        src: '/sample-labels/sierra-nevada/front.png',
        label: 'Front',
        filename: 'sierra-nevada-front.png',
      },
    ],
    fields: [
      { label: 'Serial Number', value: '26009003' },
      { label: 'Brand Name', value: 'Sierra Nevada' },
      { label: 'Fanciful Name', value: 'Trip Thru the Woods' },
      { label: 'Class/Type', value: 'Stout' },
      { label: 'Alcohol Content', value: 'ALC. 13.8% BY VOL.' },
      { label: 'Net Contents', value: '1 PT. 9.4 FL. OZ.' },
      { label: 'Container Size', value: '750' },
    ],
  },
]

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
      aria-label={`Copy ${value}`}
    >
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3" />
      )}
    </button>
  )
}

function DownloadableImage({ image }: { image: SampleImage }) {
  return (
    <a
      href={image.src}
      download={image.filename}
      className="group relative block overflow-hidden rounded-lg border border-border/60 bg-muted/30 transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[3/4]">
        <Image
          src={image.src}
          alt={`${image.label} label`}
          fill
          className="object-contain p-1"
          sizes="140px"
          unoptimized
        />
        {/* Download overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
            <Download className="size-3" />
            Save
          </div>
        </div>
      </div>
      <div className="border-t px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">
        {image.label}
      </div>
    </a>
  )
}

function HintCallout({ onDismiss }: { onDismiss: () => void }) {
  const prefersReducedMotion = useReducedMotion()

  // Auto-dismiss after 6s
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : {
              opacity: 1,
              y: [4, -2, 4],
              transition: {
                opacity: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
                y: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              },
            }
      }
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      className="pointer-events-none absolute -top-11 right-0 whitespace-nowrap"
    >
      <div className="rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background shadow-md">
        Need test data? Click here
      </div>
      {/* Caret */}
      <div className="absolute right-5 -bottom-1 size-2.5 rotate-45 bg-foreground" />
    </motion.div>
  )
}

export function SampleData() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [showHint, setShowHint] = useState(true)
  const prefersReducedMotion = useReducedMotion()
  const constraintsRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)

  const activeLabel = SAMPLE_LABELS[activeTab]

  const dismissHint = useCallback(() => setShowHint(false), [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <>
      {/* Drag constraints — inset from viewport edges */}
      <div
        ref={constraintsRef}
        className="pointer-events-none fixed inset-4 z-50"
      />

      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="panel"
            drag
            dragMomentum={false}
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96 }
            }
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ right: 24, bottom: 80 }}
            className="fixed z-50 w-[400px] rounded-xl border bg-popover shadow-xl"
          >
            {/* Drag handle + header */}
            <div className="flex cursor-grab items-center gap-2 border-b px-3 py-2 active:cursor-grabbing">
              <GripVertical className="size-3.5 text-muted-foreground/40" />
              <FlaskConical className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">
                Sample labels for testing
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
                className="ml-auto rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close sample data"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Beverage type tabs — stop drag propagation so clicks work */}
            <div
              className="flex gap-1 border-b px-3 py-1.5"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {SAMPLE_LABELS.map((label, i) => (
                <button
                  key={label.name}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                    i === activeTab
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label.beverageType}
                </button>
              ))}
            </div>

            {/* Content — stop drag propagation so scrolling/clicking works */}
            <div
              className="max-h-[70vh] space-y-3 overflow-y-auto px-3 py-3"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] font-semibold text-foreground">
                {activeLabel.name}
              </p>

              {/* Image thumbnails — downloadable */}
              <div>
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70">
                  <ImageIcon className="size-3" />
                  Save{' '}
                  {activeLabel.images.length === 1
                    ? 'this image'
                    : 'these images'}
                  , then drag into the upload area above
                </p>
                <div
                  className={cn(
                    'grid gap-2',
                    activeLabel.images.length === 1
                      ? 'max-w-[140px] grid-cols-1'
                      : 'grid-cols-2',
                  )}
                >
                  {activeLabel.images.map((image) => (
                    <DownloadableImage key={image.src} image={image} />
                  ))}
                </div>
              </div>

              {/* Form values — compact */}
              <div>
                <p className="mb-1 text-[10px] font-medium text-muted-foreground/70">
                  Or skip AI scan and fill manually with these values:
                </p>
                <div className="space-y-0.5">
                  {activeLabel.fields.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-center gap-2 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted/40"
                    >
                      <span className="w-24 shrink-0 text-muted-foreground/60">
                        {field.label}
                      </span>
                      <span className="min-w-0 truncate font-mono text-foreground">
                        {field.value}
                      </span>
                      <CopyButton value={field.value} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="trigger"
            drag
            dragMomentum={false}
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            onDragStart={() => {
              didDragRef.current = true
              dismissHint()
            }}
            initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.12 }}
            whileDrag={{ scale: 1.05 }}
            style={{ right: 24, bottom: 80 }}
            className="fixed z-50 cursor-grab active:cursor-grabbing"
          >
            {/* Hint callout */}
            <AnimatePresence>
              {showHint && !isOpen && <HintCallout onDismiss={dismissHint} />}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false
                  return
                }
                dismissHint()
                setIsOpen(true)
              }}
              className="flex items-center gap-1.5 rounded-full border bg-popover px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg transition-colors hover:text-foreground"
            >
              <FlaskConical className="size-3.5" />
              Sample Data
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
