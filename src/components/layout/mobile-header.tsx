'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Monitor, Moon, Plus, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { UserMenu } from '@/components/auth/user-menu'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { APP_NAME, APP_TAGLINE } from '@/config/constants'
import { getNavItems } from '@/config/navigation'
import { cn } from '@/lib/utils'

interface MobileHeaderProps {
  userRole: 'specialist' | 'applicant'
  reviewCount?: number
  user: {
    name: string
    email: string
    role: string
  }
}

export function MobileHeader({
  userRole,
  reviewCount = 0,
  user,
}: MobileHeaderProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const navItems = getNavItems(userRole, reviewCount)
  const isApplicant = userRole === 'applicant'

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        {/* Left: logo */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt=""
            width={24}
            height={24}
            className="shrink-0"
          />
          <span className="font-heading text-base font-semibold text-sidebar-primary">
            {APP_NAME}
          </span>
        </div>

        {/* Right: hamburger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton
          className="flex w-72 flex-col bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b border-sidebar-border px-4 py-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt=""
                width={28}
                height={28}
                className="shrink-0"
              />
              <div>
                <SheetTitle className="font-heading text-lg font-semibold text-sidebar-primary">
                  {APP_NAME}
                </SheetTitle>
                <p className="text-[11px] text-sidebar-foreground/40">
                  {APP_TAGLINE}
                </p>
              </div>
            </div>
          </SheetHeader>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge
                      variant="default"
                      className="h-5 min-w-5 bg-sidebar-primary px-1.5 text-[10px] text-sidebar-primary-foreground"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* New Submission CTA — applicants only */}
          {isApplicant && (
            <div className="border-t border-sidebar-border p-3">
              <Button
                asChild
                className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                onClick={() => setOpen(false)}
              >
                <Link href="/submit">
                  <Plus className="size-4" />
                  New Submission
                </Link>
              </Button>
            </div>
          )}

          {/* Theme toggle */}
          <div className="border-t border-sidebar-border px-3 py-2">
            <div className="flex items-center gap-1 rounded-md bg-sidebar-accent/40 p-1">
              {(
                [
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'system', icon: Monitor, label: 'System' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                ] as const
              ).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors',
                    theme === value
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                      : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/70',
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User menu */}
          <div className="border-t border-sidebar-border p-3">
            <UserMenu
              fallbackName={user.name}
              fallbackRole={user.role}
              collapsed={false}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
