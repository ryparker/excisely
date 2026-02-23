export interface SeedUser {
  name: string
  email: string
  role: 'admin' | 'specialist' | 'applicant'
  password: string
}

export const SEED_USERS: SeedUser[] = [
  // Staff
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@ttb.gov',
    role: 'admin',
    password: 'admin123',
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
  {
    name: 'Marcus Williams',
    email: 'marcus.williams@ttb.gov',
    role: 'specialist',
    password: 'specialist123',
  },
  {
    name: 'Janet Torres',
    email: 'janet.torres@ttb.gov',
    role: 'specialist',
    password: 'specialist123',
  },
  {
    name: 'Robert Kim',
    email: 'robert.kim@ttb.gov',
    role: 'specialist',
    password: 'specialist123',
  },
  {
    name: 'Lisa Chen',
    email: 'lisa.chen@ttb.gov',
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
