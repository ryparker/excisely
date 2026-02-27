import type { Metadata } from 'next'

import { requireApplicant } from '@/lib/auth/require-role'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { BatchUploadPanel } from '@/components/submit/BatchUpload'

export const metadata: Metadata = {
  title: 'Batch Upload',
}

export default async function BatchUploadPage() {
  await requireApplicant()

  return (
    <PageShell>
      <Section>
        <BatchUploadPanel />
      </Section>
    </PageShell>
  )
}
