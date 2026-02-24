'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import {
  ChevronsLeft,
  ChevronsRight,
  Monitor,
  Moon,
  Plus,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { routes } from '@/config/routes'
import { UserMenu } from '@/components/auth/UserMenu'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { APP_NAME, APP_TAGLINE } from '@/config/constants'
import { getNavItems, type NavItem } from '@/config/navigation'
import {
  STATUS_DOT_COLORS,
  STATUS_LABELS,
  type SLAStatus,
} from '@/lib/sla/status'
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
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration detection requires mount effect
  useEffect(() => setMounted(true), [])

  // Listen for sign-out exit animation
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
    window.dispatchEvent(new Event(SIDEBAR_EVENT))
  }, [])

  const isApplicant = userRole === 'applicant'
  const navItems = getNavItems(userRole, reviewCount)

  // ease-out-quad for user-initiated interaction, 200ms for drawer-size element
  const collapseTransition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: 'tween' as const,
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      }

  // Entrance uses ease-out-quint for a stronger deceleration
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
            {slaHealth && !isApplicant && (
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <motion.span
                    className={cn(
                      'size-2 shrink-0 cursor-default rounded-full',
                      STATUS_DOT_COLORS[slaHealth],
                    )}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 20,
                    }}
                    aria-label={`SLA health: ${STATUS_LABELS[slaHealth]}`}
                  />
                </HoverCardTrigger>
                <HoverCardContent
                  side="right"
                  sideOffset={8}
                  align="start"
                  className="w-56"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        STATUS_DOT_COLORS[slaHealth],
                      )}
                    />
                    <p className="text-sm font-semibold">SLA Health</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {STATUS_LABELS[slaHealth]}
                  </p>
                  <div className="mt-2.5 space-y-1 border-t pt-2.5 text-xs text-muted-foreground/80">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-green-500" />
                      <span>All metrics on target</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      <span>Approaching limits</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-red-500" />
                      <span>Exceeding targets</span>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
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
          {navItems.map(renderItem)}
        </nav>

        {/* CTA button — applicants only (specialists review, they don't submit) */}
        {isApplicant && (
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

        {/* Theme toggle — deferred until mount to avoid hydration mismatch (theme is undefined on server) */}
        <div
          className={cn(
            'border-t border-sidebar-border',
            collapsed ? 'p-2' : 'px-3 py-2',
          )}
        >
          {!mounted ? (
            // Stable placeholder matching collapsed/expanded height
            collapsed ? (
              <div className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/50">
                <Monitor className="size-4" />
              </div>
            ) : (
              <div className="flex items-center gap-1 rounded-md bg-sidebar-accent/40 p-1">
                {['Light', 'System', 'Dark'].map((label) => (
                  <div
                    key={label}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-sidebar-foreground/50"
                  >
                    {label === 'Light' && <Sun className="size-3.5" />}
                    {label === 'System' && <Monitor className="size-3.5" />}
                    {label === 'Dark' && <Moon className="size-3.5" />}
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )
          ) : collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    setTheme(
                      theme === 'light'
                        ? 'dark'
                        : theme === 'dark'
                          ? 'system'
                          : 'light',
                    )
                  }
                  className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  aria-label={`Theme: ${theme ?? 'system'}`}
                >
                  {theme === 'dark' ? (
                    <Moon className="size-4" />
                  ) : theme === 'light' ? (
                    <Sun className="size-4" />
                  ) : (
                    <Monitor className="size-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Theme:{' '}
                {theme === 'dark'
                  ? 'Dark'
                  : theme === 'light'
                    ? 'Light'
                    : 'System'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-1 rounded-md bg-sidebar-accent/40 p-1">
              {(
                [
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'system', icon: Monitor, label: 'System' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                ] as const
              ).map(({ value, icon: Icon, label }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors',
                        theme === value
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/70',
                      )}
                      aria-label={`${label} theme`}
                      aria-pressed={theme === value}
                    >
                      <Icon className="size-3.5" />
                      <span>{label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    {label} theme
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>

        {/* User menu — overflow-visible to prevent clipping of dropdown trigger ring */}
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
