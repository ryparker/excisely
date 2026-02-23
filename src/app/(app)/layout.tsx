import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { labels } from '@/db/schema'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { getSession } from '@/lib/auth/get-session'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { user } = session
  const userRole = user.role as 'admin' | 'specialist' | 'applicant'

  // Pending review count for sidebar badge
  let reviewCount = 0
  if (userRole !== 'applicant') {
    const result = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(labels)
      .where(
        sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
      )
    reviewCount = result[0]?.total ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        userRole={userRole}
        reviewCount={reviewCount}
        user={{
          name: user.name,
          email: user.email,
          role: userRole,
        }}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
