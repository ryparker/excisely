import type { Metadata } from 'next'

import { requireApplicant } from '@/lib/auth/require-role'
import { getSubmissionPipelineModel } from '@/db/queries/settings'
import { hasCloudApiKeys } from '@/lib/ai/cloud-available'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { SubmitPageTabs } from '@/components/submit/SubmitPageTabs'

export const metadata: Metadata = {
  title: 'Submit Application',
}

export default async function SubmitPage() {
  await requireApplicant()

  const pipelineModel = await getSubmissionPipelineModel()
  const cloudKeys = hasCloudApiKeys()
  const scanAvailable = pipelineModel === 'cloud' && cloudKeys

  return (
    <PageShell>
      <Section>
        <SubmitPageTabs scanAvailable={scanAvailable} />
      </Section>
    </PageShell>
  )
}
