import { requireSpecialist } from '@/lib/auth/require-role'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { BatchUploadForm } from '@/components/batch/batch-upload-form'

export const metadata = {
  title: 'Batch Upload',
}

export default async function BatchPage() {
  await requireSpecialist()

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Batch Upload"
        description="Upload multiple label images with shared application data for batch validation."
      />
      <BatchUploadForm />
    </PageShell>
  )
}
