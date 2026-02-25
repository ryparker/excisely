'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronsRight, Plus } from 'lucide-react'

import { routes } from '@/config/routes'
import { UserMenu } from '@/components/auth/UserMenu'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import {
  getNavItems,
  getSettingsNavItem,
  type NavItem,
} from '@/config/navigation'
import { type SLAStatus } from '@/lib/sla/status'
import { cn } from '@/lib/utils'

import {
  COLLAPSED_WIDTH,
  dispatchSidebarChange,
  EXPANDED_WIDTH,
  getSidebarSnapshot,
  getSidebarServerSnapshot,
  STORAGE_KEY,
  subscribeToSidebar,
} from './SidebarConstants'
import { SidebarHeader } from './SidebarHeader'
import { SidebarThemeToggle } from './SidebarThemeToggle'

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
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const handler = () => setIsExiting(true)
    window.addEventListener('app-exit', handler)
    return () => window.removeEventListener('app-exit', handler)
  }, [])

  const collapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  )

  const toggle = useCallback(() => {
    const next = !getSidebarSnapshot()
    localStorage.setItem(STORAGE_KEY, String(next))
    dispatchSidebarChange()
  }, [])

  const isApplicant = userRole === 'applicant'
  const navItems = getNavItems(userRole, reviewCount)
  const settingsItem = !isApplicant ? getSettingsNavItem() : null

  const collapseTransition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: 'tween' as const,
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      }

  const entranceEase: [number, number, number, number] = [0.23, 1, 0.32, 1]

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
        className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-clip border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
        initial={shouldReduceMotion ? false : { x: -32, opacity: 0 }}
        animate={
          isExiting
            ? { x: -32, opacity: 0 }
            : {
                x: 0,
                opacity: 1,
                width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
              }
        }
        transition={
          isExiting
            ? {
                x: shouldReduceMotion
                  ? { duration: 0 }
                  : { type: 'tween', duration: 0.25, ease: entranceEase },
                opacity: shouldReduceMotion
                  ? { duration: 0 }
                  : { type: 'tween', duration: 0.2, ease: entranceEase },
              }
            : {
                x: shouldReduceMotion
                  ? { duration: 0 }
                  : { type: 'tween', duration: 0.4, ease: entranceEase },
                opacity: shouldReduceMotion
                  ? { duration: 0 }
                  : { type: 'tween', duration: 0.35, ease: entranceEase },
                width: collapseTransition,
              }
        }
      >
        <SidebarHeader
          collapsed={collapsed}
          slaHealth={slaHealth}
          isApplicant={isApplicant}
          onToggle={toggle}
        />

        {isApplicant && (
          <div
            className={cn(
              'border-b border-sidebar-border',
              collapsed ? 'p-2' : 'p-3',
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild size="icon" className="w-full">
                    <Link href={routes.submit()}>
                      <Plus className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  New Submission
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                asChild
                className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
              >
                <Link href={routes.submit()}>
                  <Plus className="size-4" />
                  <span className="whitespace-nowrap">New Submission</span>
                </Link>
              </Button>
            )}
          </div>
        )}

        <nav
          className={cn(
            'flex-1 space-y-1 overflow-y-auto',
            collapsed ? 'px-2 py-2' : 'px-3 py-2',
          )}
        >
          {navItems.map(renderItem)}
        </nav>

        {settingsItem && (
          <div
            className={cn(
              'border-t border-sidebar-border',
              collapsed ? 'px-2 py-2' : 'px-3 py-2',
            )}
          >
            {renderItem(settingsItem)}
          </div>
        )}

        <div
          className={cn(
            'border-t border-sidebar-border',
            collapsed ? 'p-2' : 'px-3 py-2',
          )}
        >
          <SidebarThemeToggle collapsed={collapsed} />
        </div>

        <div
          className={cn(
            'overflow-visible border-t border-sidebar-border',
            collapsed ? 'p-2' : 'p-3',
          )}
        >
          <UserMenu
            fallbackName={user.name}
            fallbackRole={user.role}
            collapsed={collapsed}
          />
        </div>

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
