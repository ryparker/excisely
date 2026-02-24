export interface SeedApplicant {
  companyName: string
  contactEmail: string
  contactName: string | null
  notes: string | null
}

/**
 * Applicant companies seeded for the prototype.
 * Each entry corresponds to an applicant user in users.ts and is used by
 * the E2E label submission tests in e2e/label-data.ts.
 */
export const SEED_APPLICANTS: SeedApplicant[] = [
  {
    companyName: 'Old Tom Distillery',
    contactEmail: 'labeling@oldtomdistillery.com',
    contactName: 'Thomas Blackwell',
    notes: 'Kentucky bourbon producer — established 1892',
  },
  {
    companyName: 'Napa Valley Estate Wines',
    contactEmail: 'legal@napavalleyestate.com',
    contactName: 'Catherine Moreau',
    notes: 'Premium estate winery — Napa Valley AVA',
  },
  {
    companyName: 'Cascade Hop Brewing',
    contactEmail: 'labels@cascadehop.com',
    contactName: 'Mike Olsen',
    notes: 'Pacific Northwest brewery — IPA focused',
  },
]
