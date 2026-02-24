'use client'

import { useState } from 'react'

import { AnnotatedImage } from '@/components/validation/annotated-image'
import { ImageTabs } from '@/components/validation/image-tabs'
import { ApplicationDataPanel } from '@/components/validation/application-data-panel'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LabelImageData {
  id: string
  imageUrl: string
  imageType: string
  sortOrder: number
}

interface ProcessingDetailPanelsProps {
  images: LabelImageData[]
  appData: Record<string, unknown> | null
  beverageType: string
  containerSizeMl?: number | null
}

export function ProcessingDetailPanels({
  images,
  appData,
  beverageType,
  containerSizeMl,
}: ProcessingDetailPanelsProps) {
  const [selectedImageId, setSelectedImageId] = useState<string>(
    images[0]?.id ?? '',
  )

  const selectedImage = images.find((img) => img.id === selectedImageId)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 310px)' }}>
      <ImageTabs
        images={images}
        selectedImageId={selectedImageId}
        onSelect={setSelectedImageId}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Left panel — image viewer (55% on desktop, full width on mobile) */}
        <div className="flex h-[50vh] shrink-0 flex-col overflow-hidden lg:h-auto lg:w-[55%]">
          <div className="min-h-0 flex-1">
            {selectedImage && (
              <AnnotatedImage
                imageUrl={selectedImage.imageUrl}
                validationItems={[]}
              />
            )}
          </div>
        </div>

        {/* Right panel — application data (45% on desktop) */}
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-4 pb-1 pl-1">
            {appData ? (
              <ApplicationDataPanel
                appData={appData}
                beverageType={beverageType}
                containerSizeMl={containerSizeMl}
              />
            ) : (
              <div className="flex items-center justify-center rounded-lg border py-12 text-sm text-muted-foreground">
                No application data available.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
