import type { Metadata } from 'next'

import { requireApplicant } from '@/lib/auth/require-role'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { SubmitPageTabs } from '@/components/submit/SubmitPageTabs'

export const metadata: Metadata = {
  title: 'Submit Application',
}

export default async function SubmitPage() {
  await requireApplicant()

  return (
    <PageShell>
      <Section>
        <SubmitPageTabs />
      </Section>
    </PageShell>
  )
}
