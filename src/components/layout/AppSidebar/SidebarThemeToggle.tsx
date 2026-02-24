'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'

const THEME_OPTIONS = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
] as const

interface SidebarThemeToggleProps {
  collapsed: boolean
}

export function SidebarThemeToggle({ collapsed }: SidebarThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration detection requires mount effect
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    if (collapsed) {
      return (
        <div className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/50">
          <Monitor className="size-4" />
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 rounded-md bg-sidebar-accent/40 p-1">
        {THEME_OPTIONS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-sidebar-foreground/50"
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    )
  }

  if (collapsed) {
    return (
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
          {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-md bg-sidebar-accent/40 p-1">
      {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
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
  )
}
