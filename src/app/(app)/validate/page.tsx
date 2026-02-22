import { PageHeader } from '@/components/layout/page-header'
import { LabelUploadForm } from '@/components/validation/label-upload-form'

export const metadata = {
  title: 'Validate Label',
}

export default function ValidatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Validate Label"
        description="Upload a label image and enter application data to verify compliance."
      />
      <LabelUploadForm />
    </div>
  )
}
