import { redirect } from 'next/navigation'

import { routes } from '@/config/routes'

export default function ReviewQueuePage() {
  redirect(`${routes.home()}?status=pending_review`)
}
