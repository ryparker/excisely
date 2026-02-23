import { redirect } from 'next/navigation'

export default function ReviewQueuePage() {
  redirect('/?status=pending_review')
}
