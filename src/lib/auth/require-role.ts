import { redirect } from 'next/navigation'

import { getSession } from './get-session'

/**
 * Require an authenticated session. Redirects to /login if not authenticated.
 */
export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/**
 * Require an authenticated specialist. Redirects applicants to /submissions.
 */
export async function requireSpecialist() {
  const session = await requireAuth()
  if (session.user.role === 'applicant') redirect('/submissions')
  return session
}

/**
 * Require an authenticated applicant. Redirects specialists to /.
 */
export async function requireApplicant() {
  const session = await requireAuth()
  if (session.user.role !== 'applicant') redirect('/')
  return session
}
