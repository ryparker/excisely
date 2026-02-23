import type { TimelineEvent } from '@/lib/timeline/types'
import { TimelineEventItem } from '@/components/timeline/timeline-event-item'

interface CorrespondenceTimelineProps {
  events: TimelineEvent[]
}

export function CorrespondenceTimeline({
  events,
}: CorrespondenceTimelineProps) {
  if (events.length === 0) return null

  return (
    <section>
      <div className="mb-4 border-t pt-5">
        <h2 className="font-heading text-sm font-semibold tracking-wide text-muted-foreground/70 uppercase">
          Timeline
        </h2>
      </div>
      <div className="relative">
        {events.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            index={index}
            isLast={index === events.length - 1}
          />
        ))}
      </div>
    </section>
  )
}
