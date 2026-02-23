import type { TimelineEmail } from './types'

// ---------------------------------------------------------------------------
// Field display names (shared with report-message.tsx)
// ---------------------------------------------------------------------------

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

function fieldName(name: string): string {
  return FIELD_DISPLAY_NAMES[name] ?? name.replace(/_/g, ' ')
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

// ---------------------------------------------------------------------------
// Status label map
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  approved: 'APPROVED',
  conditionally_approved: 'CONDITIONALLY APPROVED',
  needs_correction: 'NEEDS CORRECTION',
  rejected: 'REJECTED',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailAppData {
  serialNumber: string | null
  brandName: string | null
}

interface EmailApplicant {
  companyName: string
  contactName: string | null
  contactEmail: string | null
}

interface EmailValidationItem {
  fieldName: string
  status: string
  expectedValue: string
  extractedValue: string
}

interface EmailOverride {
  previousStatus: string
  newStatus: string
  justification: string
  specialistName: string | null
}

// ---------------------------------------------------------------------------
// Initial status email
// ---------------------------------------------------------------------------

export function generateStatusEmail(
  status: string,
  appData: EmailAppData | null,
  applicant: EmailApplicant | null,
  validationItems: EmailValidationItem[],
  correctionDeadline: Date | null,
): TimelineEmail {
  const brandName = appData?.brandName ?? 'Unknown'
  const serialNumber = appData?.serialNumber ?? null
  const contactName =
    applicant?.contactName ?? applicant?.companyName ?? 'Applicant'
  const contactEmail = applicant?.contactEmail ?? 'applicant@example.com'
  const statusLabel = STATUS_LABELS[status] ?? status.toUpperCase()
  const serialSuffix = serialNumber ? ` — ${serialNumber}` : ''

  const to = `${contactName} <${contactEmail}>`
  const from = 'TTB Label Compliance <noreply@ttb.gov>'

  const issues = validationItems.filter(
    (i) =>
      i.status === 'mismatch' ||
      i.status === 'not_found' ||
      i.status === 'needs_correction',
  )
  const fieldIssues = issues.map((i) => ({
    displayName: fieldName(i.fieldName),
    expected: i.expectedValue,
    found: i.status === 'not_found' ? 'Not found on label' : i.extractedValue,
    status: i.status,
  }))

  let subject: string
  let body: string

  switch (status) {
    case 'approved':
      subject = `Label Application Approved${serialSuffix}`
      body = [
        `Dear ${contactName},`,
        '',
        `Your label application for "${brandName}" ${serialNumber ? `(Serial Number: ${serialNumber})` : ''} has been reviewed and approved by the Alcohol and Tobacco Tax and Trade Bureau.`,
        '',
        `All label fields have been verified against your submitted Form 5100.31 application data and meet TTB labeling requirements.`,
        '',
        `No further action is required. This approval is effective immediately.`,
        '',
        `Sincerely,`,
        `TTB Label Compliance Division`,
        `Alcohol and Tobacco Tax and Trade Bureau`,
      ].join('\n')
      break

    case 'conditionally_approved': {
      const deadline = correctionDeadline
        ? formatDate(correctionDeadline)
        : '7 days from this notice'
      subject = `Label Application Conditionally Approved${serialSuffix}`
      body = [
        `Dear ${contactName},`,
        '',
        `Your label application for "${brandName}" ${serialNumber ? `(Serial Number: ${serialNumber})` : ''} has been conditionally approved. Minor discrepancies were identified during review that require correction.`,
        '',
        `You must submit corrected labels by ${deadline}.`,
        '',
        ...(issues.length > 0
          ? [
              `The following fields require attention:`,
              '',
              ...issues.map(
                (i) =>
                  `  \u2022 ${fieldName(i.fieldName)}: Expected "${i.expectedValue}", found "${i.status === 'not_found' ? 'not present on label' : i.extractedValue}"`,
              ),
              '',
            ]
          : []),
        `Failure to submit corrections by the deadline may result in a status change to "Needs Correction."`,
        '',
        `Sincerely,`,
        `TTB Label Compliance Division`,
        `Alcohol and Tobacco Tax and Trade Bureau`,
      ].join('\n')
      break
    }

    case 'needs_correction': {
      const deadline = correctionDeadline
        ? formatDate(correctionDeadline)
        : '30 days from this notice'
      subject = `Label Application Requires Correction${serialSuffix}`
      body = [
        `Dear ${contactName},`,
        '',
        `Your label application for "${brandName}" ${serialNumber ? `(Serial Number: ${serialNumber})` : ''} has been reviewed and requires corrections before approval can be granted.`,
        '',
        `You have until ${deadline} to submit corrected labels addressing the issues below.`,
        '',
        ...(issues.length > 0
          ? [
              `Non-compliant fields:`,
              '',
              ...issues.map((i) => {
                if (i.status === 'not_found') {
                  return `  \u2022 ${fieldName(i.fieldName)}: MISSING \u2014 Required field "${i.expectedValue}" was not found on the label`
                }
                return `  \u2022 ${fieldName(i.fieldName)}: Expected "${i.expectedValue}", found "${i.extractedValue}"`
              }),
              '',
            ]
          : []),
        `Failure to submit corrections before the deadline will result in rejection of this application.`,
        '',
        `Sincerely,`,
        `TTB Label Compliance Division`,
        `Alcohol and Tobacco Tax and Trade Bureau`,
      ].join('\n')
      break
    }

    default:
      // rejected or other
      subject = `Label Application ${statusLabel}${serialSuffix}`
      body = [
        `Dear ${contactName},`,
        '',
        `Your label application for "${brandName}" ${serialNumber ? `(Serial Number: ${serialNumber})` : ''} has been reviewed and ${status === 'rejected' ? 'rejected' : 'processed'}.`,
        '',
        `The label does not comply with TTB labeling requirements.`,
        '',
        ...(issues.length > 0
          ? [
              `Non-compliant fields:`,
              '',
              ...issues.map((i) => {
                if (i.status === 'not_found') {
                  return `  \u2022 ${fieldName(i.fieldName)}: MISSING \u2014 Required field "${i.expectedValue}" not found on label`
                }
                return `  \u2022 ${fieldName(i.fieldName)}: Expected "${i.expectedValue}", found "${i.extractedValue}"`
              }),
              '',
            ]
          : []),
        `You may submit a new application with corrected labels at any time.`,
        '',
        `Sincerely,`,
        `TTB Label Compliance Division`,
        `Alcohol and Tobacco Tax and Trade Bureau`,
      ].join('\n')
  }

  return {
    from,
    to,
    subject,
    body,
    fieldIssues: fieldIssues.length > 0 ? fieldIssues : undefined,
  }
}

// ---------------------------------------------------------------------------
// Override notification email
// ---------------------------------------------------------------------------

export function generateOverrideEmail(
  override: EmailOverride,
  appData: EmailAppData | null,
  applicant: EmailApplicant | null,
  correctionDeadline: Date | null,
): TimelineEmail {
  const brandName = appData?.brandName ?? 'Unknown'
  const serialNumber = appData?.serialNumber ?? null
  const contactName =
    applicant?.contactName ?? applicant?.companyName ?? 'Applicant'
  const contactEmail = applicant?.contactEmail ?? 'applicant@example.com'
  const serialSuffix = serialNumber ? ` — ${serialNumber}` : ''

  const newStatusLabel =
    STATUS_LABELS[override.newStatus] ?? override.newStatus.toUpperCase()
  const prevStatusLabel =
    STATUS_LABELS[override.previousStatus] ??
    override.previousStatus.toUpperCase()

  const from = 'TTB Label Compliance <noreply@ttb.gov>'
  const to = `${contactName} <${contactEmail}>`
  const subject = `Label Application Status Updated to ${newStatusLabel}${serialSuffix}`

  const deadlineNote =
    correctionDeadline &&
    (override.newStatus === 'needs_correction' ||
      override.newStatus === 'conditionally_approved')
      ? `\n\nYour updated deadline for corrections is ${formatDate(correctionDeadline)}.`
      : ''

  const body = [
    `Dear ${contactName},`,
    '',
    `The status of your label application for "${brandName}" ${serialNumber ? `(Serial Number: ${serialNumber})` : ''} has been updated by a TTB Labeling Specialist.`,
    '',
    `Previous status: ${prevStatusLabel}`,
    `Updated status: ${newStatusLabel}`,
    '',
    `Reason for update: ${override.justification}`,
    deadlineNote,
    '',
    `If you have questions regarding this change, please contact the TTB Label Compliance Division.`,
    '',
    `Sincerely,`,
    `TTB Label Compliance Division`,
    `Alcohol and Tobacco Tax and Trade Bureau`,
  ]
    .filter(Boolean)
    .join('\n')

  return { from, to, subject, body }
}
