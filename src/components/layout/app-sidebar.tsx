'use client'

import { useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Plus,
  Send,
  Settings,
  Users,
} from 'lucide-react'

import { UserMenu } from '@/components/auth/user-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { APP_NAME, APP_TAGLINE } from '@/config/constants'
import { STATUS_DOT_COLORS, type SLAStatus } from '@/lib/sla/status'
import { cn } from '@/lib/utils'

const EXPANDED_WIDTH = 256
const COLLAPSED_WIDTH = 64
const STORAGE_KEY = 'sidebar-collapsed'

// Custom event to notify across tabs/components
const SIDEBAR_EVENT = 'sidebar-collapsed-change'

function subscribeToSidebar(callback: () => void) {
  window.addEventListener(SIDEBAR_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function getSidebarSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function getSidebarServerSnapshot() {
  return false // Always expanded on server
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface AppSidebarProps {
  userRole: 'specialist' | 'applicant'
  reviewCount?: number
  slaHealth?: SLAStatus
  user: {
    name: string
    email: string
    role: string
  }
}

export function AppSidebar({
  userRole,
  reviewCount = 0,
  slaHealth,
  user,
}: AppSidebarProps) {
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()
  const collapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  )

  const toggle = useCallback(() => {
    const next = !getSidebarSnapshot()
    localStorage.setItem(STORAGE_KEY, String(next))
    window.dispatchEvent(new Event(SIDEBAR_EVENT))
  }, [])

  const isApplicant = userRole === 'applicant'

  const staffItems: NavItem[] = [
    { label: 'Labels', href: '/', icon: FileText, badge: reviewCount },
    { label: 'Applicants', href: '/applicants', icon: Users },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]

  const applicantItems: NavItem[] = [
    { label: 'Submit Label', href: '/submit', icon: Send },
    { label: 'My Submissions', href: '/submissions', icon: FileText },
  ]

  // ease-out-quad for user-initiated interaction, 200ms for drawer-size element
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: 'tween' as const,
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      }

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const isActive =
      pathname === item.href ||
      (item.href !== '/' && pathname.startsWith(item.href))

    const linkClasses = cn(
      'relative flex items-center rounded-md text-sm font-medium transition-colors',
      collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
      isActive
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
    )

    const linkContent = (
      <>
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <Badge
            variant="default"
            className="h-5 min-w-5 bg-sidebar-primary px-1.5 text-[10px] text-sidebar-primary-foreground"
          >
            {item.badge}
          </Badge>
        )}
        {collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-sidebar-primary" />
        )}
      </>
    )

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <Link href={item.href} className={linkClasses}>
              {linkContent}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
            {item.badge !== undefined && item.badge > 0
              ? ` (${item.badge})`
              : ''}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link key={item.href} href={item.href} className={linkClasses}>
        {linkContent}
      </Link>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        className="flex h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={transition}
      >
        {/* Header */}
        <div
          className={cn(
            'flex shrink-0 items-center',
            collapsed
              ? 'h-14 justify-center px-2'
              : 'h-14 justify-between px-4',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2.5',
              collapsed && 'justify-center',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              width={28}
              height={28}
              className="shrink-0"
            />
            {!collapsed && (
              <span className="font-heading text-lg font-semibold whitespace-nowrap text-sidebar-primary">
                {APP_NAME}
              </span>
            )}
            {slaHealth && (
              <motion.span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  STATUS_DOT_COLORS[slaHealth],
                )}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            )}
          </div>
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  aria-label="Collapse sidebar"
                >
                  <ChevronsLeft className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={4}>
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Tagline */}
        {!collapsed && (
          <p className="px-5 pb-4 text-[11px] whitespace-nowrap text-sidebar-foreground/40">
            {APP_TAGLINE}
          </p>
        )}

        {/* Navigation */}
        <nav
          className={cn(
            'flex-1 space-y-1 overflow-y-auto',
            collapsed ? 'px-2' : 'px-3',
          )}
        >
          {isApplicant
            ? applicantItems.map(renderItem)
            : staffItems.map(renderItem)}
        </nav>

        {/* New Validation */}
        {!isApplicant && (
          <div
            className={cn(
              'border-t border-sidebar-border',
              collapsed ? 'p-2' : 'p-3',
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild size="icon" className="w-full">
                    <Link href="/validate">
                      <Plus className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  New Validation
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                asChild
                className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
              >
                <Link href="/validate">
                  <Plus className="size-4" />
                  <span className="whitespace-nowrap">New Validation</span>
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* User menu */}
        <div
          className={cn(
            'border-t border-sidebar-border',
            collapsed ? 'p-2' : 'p-3',
          )}
        >
          <UserMenu
            fallbackName={user.name}
            fallbackRole={user.role}
            collapsed={collapsed}
          />
        </div>

        {/* Expand toggle — collapsed only */}
        {collapsed && (
          <div className="border-t border-sidebar-border p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  aria-label="Expand sidebar"
                >
                  <ChevronsRight className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </motion.aside>
    </TooltipProvider>
  )
}
