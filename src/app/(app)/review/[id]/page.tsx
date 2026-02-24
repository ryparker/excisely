import { redirect } from 'next/navigation'

import { routes } from '@/config/routes'

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({
  params,
}: ReviewDetailPageProps) {
  const { id } = await params
  redirect(routes.label(id))
}
