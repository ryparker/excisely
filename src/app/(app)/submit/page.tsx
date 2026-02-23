import { redirect } from 'next/navigation'

import { LabelUploadForm } from '@/components/validation/label-upload-form'
import { PageHeader } from '@/components/layout/page-header'
import { getSession } from '@/lib/auth/get-session'

export default async function SubmitPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  if (session.user.role !== 'applicant') {
    redirect('/')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit COLA Application"
        description="Submit a label image with your Form 5100.31 application data for automated verification."
      />
      <LabelUploadForm mode="submit" />
    </div>
  )
}
