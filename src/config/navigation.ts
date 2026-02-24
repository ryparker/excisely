import { FileText, Flag, Scale, Settings, Users } from 'lucide-react'

import { routes } from '@/config/routes'

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export function getNavItems(
  role: 'specialist' | 'applicant',
  reviewCount = 0,
): NavItem[] {
  if (role === 'applicant') {
    return [
      { label: 'My Submissions', href: routes.home(), icon: FileText },
      { label: 'Regulations', href: routes.regulations(), icon: Scale },
    ]
  }

  return [
    {
      label: 'Labels',
      href: routes.home(),
      icon: FileText,
      badge: reviewCount,
    },
    { label: 'Applicants', href: routes.applicants(), icon: Users },
    { label: 'AI Errors', href: routes.aiErrors(), icon: Flag },
    { label: 'Regulations', href: routes.regulations(), icon: Scale },
    { label: 'Settings', href: routes.settings(), icon: Settings },
  ]
}
