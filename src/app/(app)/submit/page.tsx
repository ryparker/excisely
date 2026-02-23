import { requireApplicant } from '@/lib/auth/require-role'
import { PageShell } from '@/components/layout/page-shell'
import { SubmitPageTabs } from '@/components/submit/submit-page-tabs'

export default async function SubmitPage() {
  await requireApplicant()

  return (
    <PageShell>
      <SubmitPageTabs />
    </PageShell>
  )
}
