'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export function ScrollButtons({
  canScrollLeft,
  canScrollRight,
  onScrollCarousel,
  stopPropagation,
}: {
  canScrollLeft: boolean
  canScrollRight: boolean
  onScrollCarousel: (direction: 'left' | 'right') => void
  stopPropagation?: boolean
}) {
  const handleClick =
    (direction: 'left' | 'right') => (e: React.MouseEvent) => {
      if (stopPropagation) e.stopPropagation()
      onScrollCarousel(direction)
    }

  return (
    <>
      {canScrollLeft && (
        <button
          type="button"
          onClick={handleClick('left')}
          className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md transition-colors hover:bg-accent"
          aria-label="Scroll left"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={handleClick('right')}
          className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md transition-colors hover:bg-accent"
          aria-label="Scroll right"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </>
  )
}
