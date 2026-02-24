'use server'

import { getSession } from '@/lib/auth/get-session'

type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>

type GuardSuccess = {
  success: true
  session: SessionData & {
    user: NonNullable<SessionData['user']>
  }
}
type GuardFailure = { success: false; error: string }
type GuardResult = GuardSuccess | GuardFailure

export async function guardAuth(): Promise<GuardResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }
  return { success: true, session: session as GuardSuccess['session'] }
}

export async function guardSpecialist(): Promise<GuardResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }
  if (session.user.role === 'applicant') {
    return { success: false, error: 'Only specialists can perform this action' }
  }
  return { success: true, session: session as GuardSuccess['session'] }
}

export async function guardApplicant(): Promise<GuardResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }
  if (session.user.role !== 'applicant') {
    return { success: false, error: 'Only applicants can perform this action' }
  }
  return { success: true, session: session as GuardSuccess['session'] }
}
