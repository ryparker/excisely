'use client'

import { motion } from 'motion/react'
import { ChevronsLeft } from 'lucide-react'

import { APP_NAME, APP_TAGLINE } from '@/config/constants'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import {
  STATUS_DOT_COLORS,
  STATUS_LABELS,
  type SLAStatus,
} from '@/lib/sla/status'
import { cn } from '@/lib/utils'

interface SidebarHeaderProps {
  collapsed: boolean
  slaHealth?: SLAStatus
  isApplicant: boolean
  onToggle: () => void
}

export function SidebarHeader({
  collapsed,
  slaHealth,
  isApplicant,
  onToggle,
}: SidebarHeaderProps) {
  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center',
          collapsed ? 'h-14 justify-center px-2' : 'h-14 justify-between px-4',
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
                onClick={onToggle}
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

      {!collapsed && (
        <p className="px-5 pb-4 text-[11px] whitespace-nowrap text-sidebar-foreground/40">
          {APP_TAGLINE}
        </p>
      )}
    </>
  )
}
