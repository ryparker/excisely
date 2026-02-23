export interface SeedUser {
  name: string
  email: string
  role: 'specialist' | 'applicant'
  password: string
}

export const SEED_USERS: SeedUser[] = [
  // Staff
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@ttb.gov',
    role: 'specialist',
    password: 'specialist123',
  },
  {
    name: 'Dave Morrison',
    email: 'dave.morrison@ttb.gov',
    role: 'specialist',
    password: 'specialist123',
  },
  {
    name: 'Jenny Park',
    email: 'jenny.park@ttb.gov',
    role: 'specialist',
    password: 'specialist123',
  },
  // Applicants — contactEmail in applicants table must match these emails
  {
    name: 'Thomas Blackwell',
    email: 'labeling@oldtomdistillery.com',
    role: 'applicant',
    password: 'applicant123',
  },
  {
    name: 'Catherine Moreau',
    email: 'legal@napavalleyestate.com',
    role: 'applicant',
    password: 'applicant123',
  },
  {
    name: 'Mike Olsen',
    email: 'labels@cascadehop.com',
    role: 'applicant',
    password: 'applicant123',
  },
]
