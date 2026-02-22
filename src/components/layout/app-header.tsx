import { UserMenu } from '@/components/auth/user-menu'

interface AppHeaderProps {
  user: {
    name: string
    email: string
    role: string
  }
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
      <div>{/* Breadcrumbs placeholder */}</div>
      <div>
        <UserMenu fallbackName={user.name} fallbackRole={user.role} />
      </div>
    </header>
  )
}
