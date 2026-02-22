import type { Metadata } from 'next'

import { LoginForm } from '@/components/auth/login-form'
import { APP_NAME } from '@/config/constants'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            TTB Label Verification System
          </p>
        </div>

        <p className="mb-6 text-center text-sm font-medium">
          Sign in to your account
        </p>

        <LoginForm />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          For authorized TTB personnel only
        </p>
      </div>
    </div>
  )
}
