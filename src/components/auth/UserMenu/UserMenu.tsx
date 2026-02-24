'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { routes } from '@/config/routes'
import { signOut, useSession } from '@/lib/auth/auth-client'
import { cn } from '@/lib/utils'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface UserMenuProps {
  fallbackName: string
  fallbackRole: string
  collapsed?: boolean
}

export function UserMenu({
  fallbackName,
  fallbackRole,
  collapsed = false,
}: UserMenuProps) {
  const router = useRouter()
  const { data: session } = useSession()

  const name = session?.user.name ?? fallbackName
  const email = session?.user.email ?? ''
  const role = session?.user.role ?? fallbackRole
  const initials = getInitials(name)
  const roleName = role === 'applicant' ? 'Applicant' : 'Specialist'

  async function handleSignOut() {
    // Kill session immediately — no delay for security
    signOut()

    // Prefetch login page so it's ready when we navigate
    router.prefetch(routes.login())

    // Dispatch exit event — sidebar and page content animate out
    window.dispatchEvent(new Event('app-exit'))

    // Navigate after exit animations complete
    setTimeout(() => {
      router.push(routes.login())
    }, 350)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center rounded-md text-sm ring-0 transition-colors outline-none hover:bg-sidebar-accent/50 focus-visible:ring-0 focus-visible:outline-none',
          collapsed
            ? 'w-full justify-center p-1.5'
            : 'w-full gap-2 px-2 py-1.5',
        )}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-medium text-sidebar-primary-foreground">
          {initials}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {name}
            </span>
            <span className="truncate text-[11px] text-sidebar-foreground/60">
              {roleName}
            </span>
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={collapsed ? 'right' : 'top'}
        className="max-w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex min-w-0 flex-col space-y-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
