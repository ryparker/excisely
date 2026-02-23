import { requireSpecialist } from '@/lib/auth/require-role'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { LabelUploadForm } from '@/components/validation/label-upload-form'

export const metadata = {
  title: 'Validate Label',
}

export default async function ValidatePage() {
  await requireSpecialist()

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Validate Label"
        description="Upload a label image and enter application data to verify compliance."
      />
      <LabelUploadForm />
    </PageShell>
  )
}
