'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut, useSession } from '@/lib/auth/auth-client'

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
}

export function UserMenu({ fallbackName, fallbackRole }: UserMenuProps) {
  const router = useRouter()
  const { data: session } = useSession()

  const name = session?.user.name ?? fallbackName
  const email = session?.user.email ?? ''
  const role = session?.user.role ?? fallbackRole
  const initials = getInitials(name)
  const roleName = role === 'admin' ? 'Admin' : 'Specialist'

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {initials}
        </div>
        <span className="hidden font-medium sm:inline-block">{name}</span>
        <Badge
          variant="secondary"
          className="hidden text-[10px] sm:inline-flex"
        >
          {roleName}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
