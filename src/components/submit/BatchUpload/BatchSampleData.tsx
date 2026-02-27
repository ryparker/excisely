'use client'

import { useState } from 'react'
import {
  Download,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Wine,
  Beer,
  Martini,
} from 'lucide-react'
import Image from 'next/image'
import JSZip from 'jszip'

import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  SampleDataShell,
  useSampleDataShell,
} from '@/components/submit/SampleDataShell'
import { useBatchUploadStore } from '@/stores/useBatchUploadStore'

import { parseCsvFile } from './CsvParser'

// ---------------------------------------------------------------------------
// Sample label data — 5 labels across all beverage types
// ---------------------------------------------------------------------------

interface BatchSampleLabel {
  brandName: string
  beverageType: 'distilled_spirits' | 'wine' | 'malt_beverage'
  beverageLabel: string
  containerSizeMl: number
  imageFilenames: string[]
  imageSources: string[]
  fields: Record<string, string>
  icon: typeof Wine
}

const BATCH_SAMPLES: BatchSampleLabel[] = [
  {
    brandName: 'Willow Glen Winery',
    beverageType: 'wine',
    beverageLabel: 'Wine',
    containerSizeMl: 750,
    imageFilenames: ['willow-glen-front.png'],
    imageSources: ['/sample-labels/willow-glen-cabernet/front.png'],
    fields: {
      fanciful_name: 'Cabernet Sauvignon',
      class_type: 'Table Wine',
      alcohol_content: 'Alc. 14.5% By Vol.',
      net_contents: '750 ML',
      grape_varietal: 'Cabernet Sauvignon',
      appellation_of_origin: 'Napa Valley',
      qualifying_phrase: 'Produced and Bottled by',
      country_of_origin: 'Product of USA',
      sulfite_declaration: 'true',
    },
    icon: Wine,
  },
  {
    brandName: 'Blue Harbor Brewing Co.',
    beverageType: 'malt_beverage',
    beverageLabel: 'Malt',
    containerSizeMl: 355,
    imageFilenames: ['blue-harbor-front.png'],
    imageSources: ['/sample-labels/blue-harbor-lager/front.png'],
    fields: {
      fanciful_name: 'Classic Lager',
      class_type: 'Lager',
      alcohol_content: 'Alc. 5.2% By Vol.',
      net_contents: '12 FL. OZ (355 ML)',
      qualifying_phrase: 'Brewed and Packaged by',
      country_of_origin: 'Product of USA',
    },
    icon: Beer,
  },
  {
    brandName: 'Emerald Hill Vineyard',
    beverageType: 'wine',
    beverageLabel: 'Wine',
    containerSizeMl: 750,
    imageFilenames: ['emerald-hill-front.png'],
    imageSources: ['/sample-labels/emerald-hill/front.png'],
    fields: {
      class_type: 'Table Wine',
      alcohol_content: 'Alc. 13% by Vol.',
      net_contents: '750 mL',
      grape_varietal: 'Sauvignon Blanc',
      appellation_of_origin: 'Sonoma County',
      qualifying_phrase: 'Produced and Bottled by',
      country_of_origin: 'Product of USA',
    },
    icon: Wine,
  },
  {
    brandName: 'Hacienda Sol',
    beverageType: 'distilled_spirits',
    beverageLabel: 'Spirits',
    containerSizeMl: 750,
    imageFilenames: ['hacienda-sol-tequila-front.png'],
    imageSources: ['/sample-labels/hacienda-sol-tequila/front.png'],
    fields: {
      class_type: 'Tequila Blanco',
      alcohol_content: '38% Alc./Vol.',
      net_contents: '750 ML',
      country_of_origin: 'Hecho en Mexico',
    },
    icon: Martini,
  },
]

// ---------------------------------------------------------------------------
// CSV column ordering — must match csv-row-schema.ts CSV_COLUMNS
// ---------------------------------------------------------------------------

import { CSV_COLUMNS } from '@/lib/validators/csv-row-schema'

function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildSampleCsv(): string {
  const header = CSV_COLUMNS.join(',')
  const rows = BATCH_SAMPLES.map((sample) => {
    const row: Record<string, string> = {
      beverage_type: sample.beverageType,
      container_size_ml: String(sample.containerSizeMl),
      brand_name: sample.brandName,
      images: sample.imageFilenames.join(';'),
      ...sample.fields,
    }
    return CSV_COLUMNS.map((col) => escapeCell(row[col] ?? '')).join(',')
  })
  return [header, ...rows].join('\n')
}

async function fetchImageAsFile(src: string, filename: string): Promise<File> {
  const res = await fetch(src)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

function downloadSampleCsv() {
  const csv = buildSampleCsv()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'batch-sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadSampleImagesZip() {
  const zip = new JSZip()

  // Collect unique images (some samples reuse the same source)
  const seen = new Set<string>()
  const fetches: Promise<void>[] = []

  for (const sample of BATCH_SAMPLES) {
    for (let i = 0; i < sample.imageSources.length; i++) {
      const filename = sample.imageFilenames[i]
      if (seen.has(filename)) continue
      seen.add(filename)

      fetches.push(
        fetch(sample.imageSources[i])
          .then((res) => res.blob())
          .then((blob) => {
            zip.file(filename, blob)
          }),
      )
    }
  }

  await Promise.all(fetches)
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = 'batch-sample-images.zip'
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BatchSampleData() {
  return (
    <SampleDataShell title="Sample batch (5 labels)" panelWidth="w-[380px]">
      <BatchSampleDataContent />
    </SampleDataShell>
  )
}

function BatchSampleDataContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  const { setCsvData, addImageFiles } = useBatchUploadStore()
  const { close } = useSampleDataShell()

  async function handleLoadSample() {
    if (isLoading) return
    setIsLoading(true)

    try {
      // 1. Build CSV content and create File
      const csvContent = buildSampleCsv()
      const csvFile = new File([csvContent], 'batch-sample.csv', {
        type: 'text/csv',
      })

      // 2. Fetch all sample images concurrently
      const imagePromises: Promise<File>[] = []
      for (const sample of BATCH_SAMPLES) {
        for (let i = 0; i < sample.imageSources.length; i++) {
          imagePromises.push(
            fetchImageAsFile(sample.imageSources[i], sample.imageFilenames[i]),
          )
        }
      }
      const imageFiles = await Promise.all(imagePromises)

      // 3. Parse the CSV through the same pipeline
      const parseResult = await parseCsvFile(csvFile)

      // 4. Load into store
      addImageFiles(imageFiles)
      setCsvData({
        file: csvFile,
        rows: parseResult.rows,
        validCount: parseResult.validCount,
        invalidCount: parseResult.invalidCount,
        parseErrors: parseResult.parseErrors,
        duplicateImages: parseResult.duplicateImages,
      })
      close()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Auto-load button */}
      <button
        type="button"
        onClick={handleLoadSample}
        disabled={isLoading}
        className={cn(
          'flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-[background-color,transform,opacity] duration-150',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-50',
          'bg-primary text-primary-foreground shadow-sm',
          'hover:bg-primary/90 active:scale-[0.98]',
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Loading sample data...
          </>
        ) : (
          <>
            <Sparkles className="size-3.5" />
            Load all instantly
          </>
        )}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium text-muted-foreground">
          or download manually
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Manual download buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={downloadSampleCsv}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors',
            'border border-border bg-background hover:bg-muted/60',
          )}
        >
          <FileSpreadsheet className="size-3.5 text-muted-foreground" />
          CSV file
          <Download className="size-3 text-muted-foreground/60" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsDownloadingZip(true)
            downloadSampleImagesZip().finally(() => setIsDownloadingZip(false))
          }}
          disabled={isDownloadingZip}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors',
            'border border-border bg-background hover:bg-muted/60',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {isDownloadingZip ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <FileArchive className="size-3.5 text-muted-foreground" />
          )}
          Images (.zip)
          <Download className="size-3 text-muted-foreground/60" />
        </button>
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        Download the CSV and images, inspect them, then drag into the upload
        areas above
      </p>

      {/* Label list */}
      <div className="space-y-1">
        {BATCH_SAMPLES.map((sample, i) => {
          const Icon = sample.icon
          return (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] leading-tight font-medium">
                  {sample.brandName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {sample.fields.fanciful_name || sample.fields.class_type}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 px-1.5 py-0 text-[9px]"
              >
                {sample.beverageLabel}
              </Badge>
              <div className="flex gap-1">
                {sample.imageSources.map((src, j) => (
                  <div
                    key={j}
                    className="relative size-7 overflow-hidden rounded border border-border/60 bg-muted/30"
                  >
                    <Image
                      src={src}
                      alt={`${sample.brandName} label`}
                      fill
                      className="object-contain"
                      sizes="28px"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
