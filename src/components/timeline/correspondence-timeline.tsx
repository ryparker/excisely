import type { TimelineEvent } from '@/lib/timeline/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TimelineEventItem } from '@/components/timeline/timeline-event-item'

interface CorrespondenceTimelineProps {
  events: TimelineEvent[]
}

export function CorrespondenceTimeline({
  events,
}: CorrespondenceTimelineProps) {
  if (events.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">
          Correspondence Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
