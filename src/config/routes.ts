export const routes = {
  // Auth
  login: () => '/login' as const,

  // Dashboard / Home
  home: () => '/' as const,

  // Labels (specialist)
  labels: () => '/labels' as const,
  label: (id: string) => `/labels/${id}` as const,

  // Submissions (applicant)
  submissions: () => '/submissions' as const,
  submission: (id: string) => `/submissions/${id}` as const,
  submit: () => '/submit' as const,

  // Applicants (specialist)
  applicants: () => '/applicants' as const,
  applicant: (id: string) => `/applicants/${id}` as const,

  // Review (specialist)
  review: () => '/review' as const,
  reviewLabel: (id: string) => `/review/${id}` as const,

  // Other pages
  aiErrors: () => '/ai-errors' as const,
  regulations: () => '/regulations' as const,
  settings: () => '/settings' as const,

  // API
  apiAuth: () => '/api/auth' as const,
} as const
