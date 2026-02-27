'use client'

import { useState } from 'react'
import { Copy, Check, Download, Loader2, Sparkles } from 'lucide-react'
import Image from 'next/image'

import type { BeverageType } from '@/config/beverage-types'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import { cn } from '@/lib/utils'
import {
  SampleDataShell,
  useSampleDataShell,
} from '@/components/submit/SampleDataShell'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SampleImage {
  src: string
  label: string
  filename: string
}

interface SampleField {
  label: string
  value: string
  formKey: keyof ValidateLabelInput
}

export interface SampleLabel {
  name: string
  beverageType: string
  beverageTypeKey: BeverageType
  containerSizeMl: number
  images: SampleImage[]
  fields: SampleField[]
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const SAMPLE_LABELS: SampleLabel[] = [
  {
    name: 'Willow Glen Cabernet Sauvignon',
    beverageType: 'Wine',
    beverageTypeKey: 'wine',
    containerSizeMl: 750,
    images: [
      {
        src: '/sample-labels/willow-glen-cabernet/front.png',
        label: 'Front',
        filename: 'willow-glen-cabernet-front.png',
      },
    ],
    fields: [
      {
        label: 'Brand Name',
        value: 'Willow Glen Winery',
        formKey: 'brandName',
      },
      {
        label: 'Fanciful Name',
        value: 'Cabernet Sauvignon',
        formKey: 'fancifulName',
      },
      { label: 'Serial Number', value: '24109842', formKey: 'serialNumber' },
      {
        label: 'Class/Type Designation',
        value: 'Table Wine',
        formKey: 'classType',
      },
      { label: 'Bottle Capacity', value: '750', formKey: 'containerSizeMl' },
      {
        label: 'Alcohol Content',
        value: 'Alc. 14.5% By Vol.',
        formKey: 'alcoholContent',
      },
      { label: 'Net Contents', value: '750 ML', formKey: 'netContents' },
      {
        label: 'Name and Address',
        value: 'Willow Glen Winery',
        formKey: 'nameAndAddress',
      },
      {
        label: 'Qualifying Phrase',
        value: 'Produced and Bottled by',
        formKey: 'qualifyingPhrase',
      },
      {
        label: 'Country of Origin',
        value: 'Product of USA',
        formKey: 'countryOfOrigin',
      },
      {
        label: 'Grape Varietal',
        value: 'Cabernet Sauvignon',
        formKey: 'grapeVarietal',
      },
      {
        label: 'Appellation of Origin',
        value: 'Napa Valley',
        formKey: 'appellationOfOrigin',
      },
    ],
  },
  {
    name: 'Hacienda Sol Tequila Blanco',
    beverageType: 'Distilled Spirits',
    beverageTypeKey: 'distilled_spirits',
    containerSizeMl: 750,
    images: [
      {
        src: '/sample-labels/hacienda-sol-tequila/front.png',
        label: 'Front',
        filename: 'hacienda-sol-tequila-front.png',
      },
    ],
    fields: [
      { label: 'Brand Name', value: 'Hacienda Sol', formKey: 'brandName' },
      { label: 'Serial Number', value: '25041893', formKey: 'serialNumber' },
      {
        label: 'Class/Type Designation',
        value: 'Tequila Blanco',
        formKey: 'classType',
      },
      { label: 'Bottle Capacity', value: '750', formKey: 'containerSizeMl' },
      {
        label: 'Alcohol Content',
        value: '38% Alc./Vol.',
        formKey: 'alcoholContent',
      },
      { label: 'Net Contents', value: '750 ML', formKey: 'netContents' },
      {
        label: 'Country of Origin',
        value: 'Hecho en Mexico',
        formKey: 'countryOfOrigin',
      },
    ],
  },
  {
    name: 'Blue Harbor Classic Lager',
    beverageType: 'Malt Beverages',
    beverageTypeKey: 'malt_beverage',
    containerSizeMl: 355,
    images: [
      {
        src: '/sample-labels/blue-harbor-lager/front.png',
        label: 'Front',
        filename: 'blue-harbor-lager-front.png',
      },
    ],
    fields: [
      {
        label: 'Brand Name',
        value: 'Blue Harbor Brewing Co.',
        formKey: 'brandName',
      },
      {
        label: 'Fanciful Name',
        value: 'Classic Lager',
        formKey: 'fancifulName',
      },
      { label: 'Serial Number', value: '25003187', formKey: 'serialNumber' },
      { label: 'Class/Type Designation', value: 'Lager', formKey: 'classType' },
      { label: 'Bottle Capacity', value: '355', formKey: 'containerSizeMl' },
      {
        label: 'Alcohol Content',
        value: 'Alc. 5.2% By Vol.',
        formKey: 'alcoholContent',
      },
      {
        label: 'Net Contents',
        value: '12 FL. OZ (355 ML)',
        formKey: 'netContents',
      },
      {
        label: 'Name and Address',
        value: 'Blue Harbor Brewing Co.',
        formKey: 'nameAndAddress',
      },
      {
        label: 'Qualifying Phrase',
        value: 'Brewed and Packaged by',
        formKey: 'qualifyingPhrase',
      },
      {
        label: 'Country of Origin',
        value: 'Product of USA',
        formKey: 'countryOfOrigin',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyableRow({ label, value }: { label: string; value: string }) {
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
      className={cn(
        'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors',
        copied
          ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
          : 'hover:bg-muted/50 active:bg-muted/70',
      )}
    >
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-mono text-foreground">
        {value}
      </span>
      <span className="ml-auto shrink-0 text-muted-foreground/50">
        {copied ? (
          <Check className="size-3 text-emerald-500" />
        ) : (
          <Copy className="size-3" />
        )}
      </span>
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
          sizes="100px"
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
      <div className="border-t px-2 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
        {image.label}
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SampleDataProps {
  onApply?: (label: SampleLabel) => Promise<void>
}

export function SampleData({ onApply }: SampleDataProps) {
  return (
    <SampleDataShell title="Sample labels for testing">
      <SampleDataContent onApply={onApply} />
    </SampleDataShell>
  )
}

function SampleDataContent({ onApply }: SampleDataProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [isApplying, setIsApplying] = useState(false)
  const { close } = useSampleDataShell()

  const activeLabel = SAMPLE_LABELS[activeTab]

  async function handleApply() {
    if (!onApply || isApplying) return
    setIsApplying(true)
    try {
      await onApply(activeLabel)
      close()
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <>
      {/* Beverage type tabs */}
      <div className="-mx-3 -mt-3 mb-3 flex gap-1 border-b px-3 py-1.5">
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

      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-foreground">
          {activeLabel.name}
        </p>

        {/* Auto-fill button — primary action */}
        {onApply && (
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className={cn(
              'flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
              'disabled:pointer-events-none disabled:opacity-50',
              'bg-primary text-primary-foreground shadow-sm',
              'hover:bg-primary/90 active:scale-[0.98]',
            )}
          >
            {isApplying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Loading sample...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Use this sample
              </>
            )}
          </button>
        )}

        {/* Divider — "or fill manually" */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-medium text-muted-foreground">
            or fill manually
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Downloadable image thumbnails */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
            Save{' '}
            {activeLabel.images.length === 1 ? 'this image' : 'these images'},
            then drag into the upload area
          </p>
          <div
            className={cn(
              'grid gap-2',
              activeLabel.images.length === 1
                ? 'max-w-[100px] grid-cols-1'
                : 'max-w-[208px] grid-cols-2',
            )}
          >
            {activeLabel.images.map((image) => (
              <DownloadableImage key={image.src} image={image} />
            ))}
          </div>
        </div>

        {/* Copyable form values — click row to copy */}
        <div>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">
            Click a field to copy its value
          </p>
          <div className="space-y-0.5">
            {activeLabel.fields.map((field) => (
              <CopyableRow
                key={field.label}
                label={field.label}
                value={field.value}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
