'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertCircle,
  BarChart3,
  Clock,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { APP_NAME, APP_TAGLINE } from '@/config/constants'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Validate Label', href: '/validate', icon: ShieldCheck },
  { label: 'History', href: '/history', icon: Clock },
  { label: 'Review Queue', href: '/review', icon: AlertCircle, badge: 0 },
  { label: 'Batch Upload', href: '/batch', icon: Upload },
  { label: 'Applicants', href: '/applicants', icon: Users },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Admin Dashboard', href: '/admin', icon: Shield, adminOnly: true },
  { label: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
]

interface AppSidebarProps {
  userRole: 'admin' | 'specialist'
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || userRole === 'admin',
  )

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-6">
        <span className="font-heading text-lg font-semibold text-sidebar-primary">
          {APP_NAME}
        </span>
      </div>
      <p className="px-6 pb-4 text-xs text-sidebar-foreground/60">
        {APP_TAGLINE}
      </p>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
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
    </aside>
  )
}
