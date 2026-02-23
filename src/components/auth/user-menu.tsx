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
} from '@/components/ui/dropdown-menu'
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
    await signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center rounded-md text-sm transition-colors outline-none hover:bg-sidebar-accent/50',
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
        className="w-48"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
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
