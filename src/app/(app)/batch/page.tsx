import { PageHeader } from '@/components/layout/page-header'
import { BatchUploadForm } from '@/components/batch/batch-upload-form'

export const metadata = {
  title: 'Batch Upload',
}

export default function BatchPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Upload"
        description="Upload multiple label images with shared application data for batch validation."
      />
      <BatchUploadForm />
    </div>
  )
}
