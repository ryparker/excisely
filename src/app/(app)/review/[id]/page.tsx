import { redirect } from 'next/navigation'

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({
  params,
}: ReviewDetailPageProps) {
  const { id } = await params
  redirect(`/labels/${id}`)
}
