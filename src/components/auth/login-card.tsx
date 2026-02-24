'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

import { LoginForm } from '@/components/auth/login-form'
import { APP_NAME, APP_TAGLINE } from '@/config/constants'
import { routes } from '@/config/routes'

type TransitionPhase = 'idle' | 'success' | 'exiting'

const EXIT_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1] // ease-out-quint

export function LoginCard() {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion() ?? false
  const [phase, setPhase] = useState<TransitionPhase>('idle')

  const isSuccess = phase === 'success' || phase === 'exiting'

  const handleSuccess = useCallback(() => {
    // Prefetch dashboard RSC payload immediately so it loads in parallel with animation
    router.prefetch(routes.home())

    if (shouldReduceMotion) {
      router.push(routes.home())
      return
    }

    // Phase 1: Show success state (button green, icon flip)
    setPhase('success')

    // Phase 2: Start card exit while prefetch completes in background
    setTimeout(() => {
      setPhase('exiting')
    }, 200)

    // Phase 3: Navigate mid-exit — card is ~70% faded, dashboard data is prefetched
    setTimeout(() => {
      router.push(routes.home())
    }, 450)
  }, [router, shouldReduceMotion])

  return (
    <div className="relative z-10 w-full max-w-[400px]">
      {/* Soft glow behind card */}
      <motion.div
        className="absolute -inset-12 rounded-full bg-gold/5 blur-3xl"
        animate={
          phase === 'exiting'
            ? { opacity: 0, scale: 1.1 }
            : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.3, ease: EXIT_EASE }}
      />

      {/* Card */}
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card shadow-2xl shadow-black/20"
        initial={
          shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }
        }
        animate={
          phase === 'exiting'
            ? {
                opacity: 0,
                y: -20,
                scale: 0.95,
                filter: 'blur(8px)',
              }
            : {
                opacity: 1,
                y: 0,
                scale: 1,
                filter: 'blur(0px)',
              }
        }
        transition={
          phase === 'exiting'
            ? { duration: 0.3, ease: EXIT_EASE }
            : { duration: 0.5, ease: EXIT_EASE, delay: 0.05 }
        }
      >
        {/* Gold accent stripe */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />

        {/* Warm gradient wash behind brand area */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gold/[0.03] to-transparent" />

        <div className="relative px-10 pt-10 pb-10">
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="relative">
              {/* Icon glow — CSS transition for color, no Motion needed */}
              <div
                className={`absolute -inset-2 rounded-3xl blur-xl transition-colors duration-300 ${
                  isSuccess ? 'bg-emerald-500/15' : 'bg-gold/10'
                }`}
              />
              <div
                className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-1 shadow-navy/40 transition-[background-color,ring-color] duration-300 ${
                  isSuccess
                    ? 'bg-emerald-900 ring-emerald-500/35'
                    : 'bg-navy ring-gold/25'
                }`}
              >
                <motion.div
                  initial={false}
                  animate={isSuccess ? { rotateY: 180 } : { rotateY: 0 }}
                  transition={{ duration: 0.3, ease: EXIT_EASE }}
                  style={{ perspective: 600, transformStyle: 'preserve-3d' }}
                >
                  {isSuccess ? (
                    <Check
                      className="h-7 w-7 text-emerald-400"
                      strokeWidth={2.5}
                      style={{ transform: 'rotateY(180deg)' }}
                    />
                  ) : (
                    <img src="/icon.svg" alt="" className="h-7 w-7" />
                  )}
                </motion.div>
              </div>
            </div>
            <div className="text-center">
              <h1 className="font-heading text-[26px] font-bold tracking-tight">
                {APP_NAME}
              </h1>
              <p
                className={`mt-1.5 text-[13px] transition-colors duration-300 ${
                  isSuccess ? 'text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                {isSuccess ? 'Welcome back' : APP_TAGLINE}
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="mb-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <LoginForm
            onSuccess={handleSuccess}
            isTransitioning={phase !== 'idle'}
          />

          <div className="mt-10 flex items-center justify-center gap-2">
            <div className="h-px w-6 bg-gradient-to-r from-transparent to-border" />
            <p className="text-center text-[10px] tracking-widest text-muted-foreground/40 uppercase">
              Authorized TTB personnel only
            </p>
            <div className="h-px w-6 bg-gradient-to-l from-transparent to-border" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
