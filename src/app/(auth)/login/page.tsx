import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'

import { LoginForm } from '@/components/auth/login-form'
import { APP_NAME, APP_TAGLINE } from '@/config/constants'

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

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Soft glow behind card */}
        <div className="absolute -inset-12 rounded-full bg-gold/5 blur-3xl" />

        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card shadow-2xl shadow-black/20">
          {/* Gold accent stripe */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />

          {/* Warm gradient wash behind brand area */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gold/[0.03] to-transparent" />

          <div className="relative px-10 pt-10 pb-10">
            {/* Brand */}
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="relative">
                {/* Icon glow */}
                <div className="absolute -inset-2 rounded-3xl bg-gold/10 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-navy shadow-lg ring-1 shadow-navy/40 ring-gold/25">
                  <ShieldCheck
                    className="h-7 w-7 text-gold"
                    strokeWidth={1.75}
                  />
                </div>
              </div>
              <div className="text-center">
                <h1 className="font-heading text-[26px] font-bold tracking-tight">
                  {APP_NAME}
                </h1>
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  {APP_TAGLINE}
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="mb-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <LoginForm />

            <div className="mt-10 flex items-center justify-center gap-2">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-border" />
              <p className="text-center text-[10px] tracking-widest text-muted-foreground/40 uppercase">
                Authorized TTB personnel only
              </p>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-border" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
