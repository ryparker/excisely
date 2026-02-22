import { redirect } from 'next/navigation'

import { AppHeader } from '@/components/layout/app-header'
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
  const userRole = user.role === 'admin' ? 'admin' : 'specialist'

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar userRole={userRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          user={{
            name: user.name,
            email: user.email,
            role: userRole,
          }}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
