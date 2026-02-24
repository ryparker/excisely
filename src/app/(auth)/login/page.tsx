import type { Metadata } from 'next'

import { LoginCard } from '@/components/auth/LoginCard'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-4">
      {/* Subtle radial gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.04_265)_0%,transparent_60%)]" />
      {/* Faint grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-[length:64px_64px]" />

      <LoginCard />
    </div>
  )
}
