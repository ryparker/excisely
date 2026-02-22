import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyReportButton } from '@/components/communication/copy-report-button'

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning Statement',
  name_and_address: 'Name and Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation of Origin',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Declaration',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distillation',
  standards_of_fill: 'Standards of Fill',
}

interface ReportLabel {
  status: string
  correctionDeadline: Date | null
  applicationData: {
    brandName: string | null
    serialNumber: string | null
  } | null
  applicant: {
    companyName: string
  } | null
}

interface ReportValidationItem {
  fieldName: string
  status: string
  expectedValue: string
  extractedValue: string
}

interface ReportMessageProps {
  label: ReportLabel
  validationItems: ReportValidationItem[]
}

function formatFieldName(name: string): string {
  return FIELD_DISPLAY_NAMES[name] ?? name.replace(/_/g, ' ')
}

function formatDeadline(deadline: Date | null): string {
  if (!deadline) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(deadline)
}

function generateReport(
  label: ReportLabel,
  validationItems: ReportValidationItem[],
): string {
  const brandName = label.applicationData?.brandName ?? 'Unknown'
  const serialNumber = label.applicationData?.serialNumber ?? 'N/A'
  const applicant = label.applicant?.companyName ?? 'Unknown Applicant'

  const header = [
    `COLA Label Verification Report`,
    `Serial Number: ${serialNumber}`,
    `Brand Name: ${brandName}`,
    `Applicant: ${applicant}`,
    `Date: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date())}`,
    '',
  ].join('\n')

  const mismatches = validationItems.filter(
    (item) => item.status === 'mismatch',
  )
  const notFound = validationItems.filter((item) => item.status === 'not_found')
  const needsCorrection = validationItems.filter(
    (item) => item.status === 'needs_correction',
  )

  if (label.status === 'approved') {
    return [
      header,
      `Status: APPROVED`,
      '',
      `Your label application for "${brandName}" (Serial Number: ${serialNumber}) has been verified and meets all TTB requirements. All label fields match the submitted COLA application data.`,
      '',
      `No further action is required.`,
    ].join('\n')
  }

  if (label.status === 'conditionally_approved') {
    const deadline = formatDeadline(label.correctionDeadline)
    const discrepancies = [...needsCorrection, ...mismatches]

    return [
      header,
      `Status: CONDITIONALLY APPROVED`,
      '',
      `Your label application for "${brandName}" (Serial Number: ${serialNumber}) has been conditionally approved. Minor discrepancies were identified that require correction within 7 days${deadline ? ` (by ${deadline})` : ''}.`,
      '',
      `Discrepancies:`,
      ...discrepancies.map(
        (item) =>
          `  - ${formatFieldName(item.fieldName)}: Expected "${item.expectedValue}", Found "${item.extractedValue}"`,
      ),
      '',
      `Please submit corrected labels addressing the above discrepancies before the deadline.`,
    ].join('\n')
  }

  if (label.status === 'needs_correction') {
    const deadline = formatDeadline(label.correctionDeadline)
    const issues = [...mismatches, ...needsCorrection, ...notFound]

    return [
      header,
      `Status: NEEDS CORRECTION`,
      '',
      `Your label application for "${brandName}" (Serial Number: ${serialNumber}) requires corrections. The following fields do not match the submitted COLA application data or are missing from the label. You have 30 days${deadline ? ` (until ${deadline})` : ''} to submit corrected labels.`,
      '',
      `Issues:`,
      ...issues.map((item) => {
        if (item.status === 'not_found') {
          return `  - ${formatFieldName(item.fieldName)}: MISSING — Expected "${item.expectedValue}", not found on label`
        }
        return `  - ${formatFieldName(item.fieldName)}: Expected "${item.expectedValue}", Found "${item.extractedValue}"`
      }),
      '',
      `Failure to submit corrections before the deadline will result in rejection.`,
    ].join('\n')
  }

  // Rejected
  const allIssues = [...mismatches, ...needsCorrection, ...notFound]

  return [
    header,
    `Status: REJECTED`,
    '',
    `Your label application for "${brandName}" (Serial Number: ${serialNumber}) has been rejected. The label does not comply with TTB labeling requirements.`,
    '',
    `Non-compliant fields:`,
    ...allIssues.map((item) => {
      if (item.status === 'not_found') {
        return `  - ${formatFieldName(item.fieldName)}: MISSING — Required field "${item.expectedValue}" not found on label`
      }
      return `  - ${formatFieldName(item.fieldName)}: Expected "${item.expectedValue}", Found "${item.extractedValue}"`
    }),
    '',
    `You may submit a new application with corrected labels.`,
  ].join('\n')
}

export function ReportMessage({ label, validationItems }: ReportMessageProps) {
  const reportText = generateReport(label, validationItems)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-heading text-lg">
          Communication Report
        </CardTitle>
        <CopyReportButton text={reportText} />
      </CardHeader>
      <CardContent>
        <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {reportText}
        </pre>
      </CardContent>
    </Card>
  )
}
