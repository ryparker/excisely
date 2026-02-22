import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/get-session'
import { getSettings } from '@/lib/settings/get-settings'
import { PageHeader } from '@/components/layout/page-header'
import { ConfidenceThreshold } from '@/components/settings/confidence-threshold'
import { FieldStrictness } from '@/components/settings/field-strictness'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) return null

  if (session.user.role !== 'admin') {
    redirect('/')
  }

  const { confidenceThreshold, fieldStrictness } = await getSettings()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure AI verification thresholds and field comparison rules."
      />

      <ConfidenceThreshold defaultValue={confidenceThreshold} />
      <FieldStrictness defaults={fieldStrictness} />
    </div>
  )
}
