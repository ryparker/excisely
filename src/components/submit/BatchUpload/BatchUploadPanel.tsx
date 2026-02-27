'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, FileSpreadsheet, Images, Sparkles } from 'lucide-react'

import { routes } from '@/config/routes'
import { useBatchUploadStore } from '@/stores/useBatchUploadStore'

import { BatchSampleData } from './BatchSampleData'
import { CsvDropzone } from './CsvDropzone'
import { BatchImageUploader } from './BatchImageUploader'
import { CsvPreviewTable } from './CsvPreviewTable'
import { BatchProgressDialog } from './BatchProgressDialog'
import { BatchResultsSummary } from './BatchResultsSummary'

const phaseInitial = { opacity: 0, y: 20 }
const phaseAnimate = { opacity: 1, y: 0 }
const phaseExit = { opacity: 0, y: -10 }
const phaseTransition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}

export function BatchUploadPanel() {
  const phase = useBatchUploadStore((s) => s.phase)
  const hasRows = useBatchUploadStore((s) => s.rows.length > 0)

  return (
    <>
      <div className="mb-8">
        <Link
          href={routes.submit()}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to single submission
        </Link>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">
          Batch Upload
        </h1>
        <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
          Upload a CSV file with application data and matching label images to
          submit up to 50 labels at once.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'upload' && (
          <motion.div
            key="upload"
            initial={phaseInitial}
            animate={phaseAnimate}
            exit={phaseExit}
            transition={phaseTransition}
            className="space-y-6"
          >
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
              <div className="grid md:grid-cols-2 md:divide-x">
                <div className="p-5">
                  <CsvDropzone />
                </div>
                <div className="border-t p-5 md:border-t-0">
                  <BatchImageUploader />
                </div>
              </div>

              {/* Hint footer — only when empty */}
              {!hasRows && (
                <div className="border-t px-5 py-3">
                  <p className="text-center text-[12px] text-muted-foreground">
                    Image filenames must match the{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      images
                    </code>{' '}
                    column in your CSV. Use semicolons for multiple images per
                    label.
                  </p>
                </div>
              )}
            </div>

            {/* Inline preview table — visible once CSV is parsed */}
            {hasRows && <CsvPreviewTable />}

            {/* How it works — only when no data loaded */}
            {!hasRows && (
              <div className="grid gap-5 pt-2 sm:grid-cols-3">
                {(
                  [
                    {
                      icon: FileSpreadsheet,
                      title: 'Prepare your CSV',
                      desc: 'Download the template and fill in your application data — one row per label with all required fields.',
                    },
                    {
                      icon: Images,
                      title: 'Add label images',
                      desc: 'Upload JPG, PNG, or WebP images. Filenames must match the images column in your CSV.',
                    },
                    {
                      icon: Sparkles,
                      title: 'Submit for review',
                      desc: 'Review the preview table, then submit. Each label is processed through our AI verification pipeline.',
                    },
                  ] as const
                ).map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                      <item.icon className="size-4 text-muted-foreground/70" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{item.title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={phaseInitial}
            animate={phaseAnimate}
            exit={phaseExit}
            transition={phaseTransition}
          >
            <BatchProgressDialog />
          </motion.div>
        )}

        {phase === 'results' && (
          <motion.div
            key="results"
            initial={phaseInitial}
            animate={phaseAnimate}
            exit={phaseExit}
            transition={phaseTransition}
          >
            <BatchResultsSummary />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sample data floating widget — only during upload phase */}
      {phase === 'upload' && (
        <div className="hidden md:block">
          <BatchSampleData />
        </div>
      )}
    </>
  )
}
