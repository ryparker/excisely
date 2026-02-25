import type { Metadata } from 'next'

import { requireAuth } from '@/lib/auth/require-role'
import { getSession } from '@/lib/auth/get-session'
import { getAllApplicants } from '@/db/queries/applicants'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { SubmitPageTabs } from '@/components/submit/SubmitPageTabs'

export const metadata: Metadata = {
  title: 'Submit Application',
}

export default async function SubmitPage() {
  await requireAuth()
  const session = await getSession()
  const isSpecialist = session?.user?.role !== 'applicant'

  // Specialists need the applicant list for the selector
  const applicants = isSpecialist ? await getAllApplicants() : []

  return (
    <PageShell>
      <Section>
        <SubmitPageTabs
          isSpecialist={isSpecialist}
          applicants={applicants}
        />
      </Section>
    </PageShell>
  )
}
