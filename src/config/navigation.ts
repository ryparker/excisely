import { FileText, Flag, Scale, Settings, Users } from 'lucide-react'

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
      { label: 'My Submissions', href: '/', icon: FileText },
      { label: 'Regulations', href: '/regulations', icon: Scale },
    ]
  }

  return [
    { label: 'Labels', href: '/', icon: FileText, badge: reviewCount },
    { label: 'Applicants', href: '/applicants', icon: Users },
    { label: 'AI Errors', href: '/ai-errors', icon: Flag },
    { label: 'Regulations', href: '/regulations', icon: Scale },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]
}
