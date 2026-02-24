import type { Metadata } from 'next'

import { requireApplicant } from '@/lib/auth/require-role'
import { PageShell } from '@/components/layout/page-shell'
import { SubmitPageTabs } from '@/components/submit/submit-page-tabs'

export const metadata: Metadata = {
  title: 'Submit Application',
}

export default async function SubmitPage() {
  await requireApplicant()

  return (
    <PageShell>
      <SubmitPageTabs />
    </PageShell>
  )
}
