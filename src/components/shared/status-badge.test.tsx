import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/shared/status-badge'

describe('StatusBadge', () => {
  it('renders "Approved" for approved status', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Approved')).toBeDefined()
  })

  it('renders "Rejected" for rejected status', () => {
    render(<StatusBadge status="rejected" />)
    expect(screen.getByText('Rejected')).toBeDefined()
  })

  it.each([
    ['approved', 'Approved'],
    ['conditionally_approved', 'Conditionally Approved'],
    ['needs_correction', 'Needs Correction'],
    ['rejected', 'Rejected'],
    ['pending_review', 'Pending Review'],
    ['processing', 'Processing'],
    ['pending', 'Pending'],
  ] as const)('renders correct label for %s', (status, expectedLabel) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(expectedLabel)).toBeDefined()
  })

  it('falls back to "Pending" for unknown statuses', () => {
    render(<StatusBadge status="unknown_status" />)
    expect(screen.getByText('Pending')).toBeDefined()
  })

  it('applies custom className', () => {
    render(<StatusBadge status="approved" className="my-custom-class" />)
    const badge = screen.getByText('Approved')
    expect(badge.className).toContain('my-custom-class')
  })
})
