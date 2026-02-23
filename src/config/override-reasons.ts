// ---------------------------------------------------------------------------
// Centralized preset override reasons — shared by UI and server actions
// ---------------------------------------------------------------------------

export interface OverrideReason {
  /** Stable snake_case identifier stored in DB */
  code: string
  /** Short label shown as pill in UI */
  label: string
  /** Full description that populates the justification textarea */
  description: string
}

export const OVERRIDE_REASONS: Record<string, OverrideReason[]> = {
  rejected: [
    {
      code: 'low_image_quality',
      label: 'Low image quality',
      description:
        'Label image too low quality to verify — resubmit with higher resolution',
    },
    {
      code: 'missing_health_warning',
      label: 'Missing health warning',
      description:
        'Mandatory GOVERNMENT WARNING statement missing or non-compliant',
    },
    {
      code: 'brand_name_mismatch',
      label: 'Brand name mismatch',
      description:
        'Brand name on label does not match Form 5100.31 application data',
    },
    {
      code: 'alcohol_content_conflict',
      label: 'Alcohol content conflict',
      description: 'Alcohol content on label conflicts with declared value',
    },
    {
      code: 'net_contents_format',
      label: 'Net contents format',
      description: 'Net contents not displayed in required format',
    },
    {
      code: 'prohibited_health_claim',
      label: 'Prohibited health claim',
      description: 'Misleading or prohibited health claim on label',
    },
  ],
  needs_correction: [
    {
      code: 'text_discrepancy',
      label: 'Text discrepancy',
      description:
        'Minor text discrepancy between label and application — correction needed',
    },
    {
      code: 'qualifying_phrase',
      label: 'Qualifying phrase',
      description:
        'Qualifying phrase missing or incorrect (e.g. "Bottled by", "Distilled by")',
    },
    {
      code: 'name_and_address',
      label: 'Name & address',
      description: 'Name and address formatting does not meet TTB requirements',
    },
    {
      code: 'class_type_mismatch',
      label: 'Class/type mismatch',
      description:
        'Class/type designation does not match declared product type',
    },
    {
      code: 'fanciful_name',
      label: 'Fanciful name',
      description: 'Fanciful name on label differs from application Item 7',
    },
  ],
  conditionally_approved: [
    {
      code: 'minor_formatting',
      label: 'Minor formatting',
      description: 'Approved pending correction of minor formatting issues',
    },
    {
      code: 'legibility_issue',
      label: 'Legibility issue',
      description: 'Approved pending updated label image with legible text',
    },
    {
      code: 'alcohol_content_confirmation',
      label: 'Alcohol content',
      description: 'Approved pending confirmation of alcohol content value',
    },
  ],
  approved: [
    {
      code: 'fields_verified',
      label: 'Fields verified',
      description: 'All fields verified — label matches application data',
    },
    {
      code: 'ai_incorrect',
      label: 'AI was incorrect',
      description: 'Manual verification confirms AI assessment was incorrect',
    },
    {
      code: 'discrepancies_resolved',
      label: 'Discrepancies resolved',
      description:
        'Discrepancies resolved after applicant provided clarification',
    },
  ],
}

/** Flat lookup: code → label (for display in tables, badges, timelines) */
export const REASON_CODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(OVERRIDE_REASONS)
    .flat()
    .map((r) => [r.code, r.label]),
)
