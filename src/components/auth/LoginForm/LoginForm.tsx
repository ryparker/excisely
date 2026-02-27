'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Loader2, ShieldCheck, User } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { signIn } from '@/lib/auth/auth-client'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSuccess?: () => void
  isTransitioning?: boolean
}

const TEST_USERS = [
  {
    name: 'Thomas Blackwell',
    email: 'labeling@oldtomdistillery.com',
    password: 'applicant123',
    role: 'applicant' as const,
  },
  {
    name: 'Catherine Moreau',
    email: 'legal@napavalleyestate.com',
    password: 'applicant123',
    role: 'applicant' as const,
  },
  {
    name: 'Mike Olsen',
    email: 'labels@cascadehop.com',
    password: 'applicant123',
    role: 'applicant' as const,
  },
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@ttb.gov',
    password: 'specialist123',
    role: 'specialist' as const,
  },
] as const

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function LoginForm({ onSuccess, isTransitioning }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [readyToSubmit, setReadyToSubmit] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectUser = useCallback(
    (user: (typeof TEST_USERS)[number]) => {
      setValue('email', user.email, { shouldValidate: true })
      setValue('password', user.password, { shouldValidate: true })
      setShowSuggestions(false)
      setActiveIndex(-1)
      // Both fields filled — focus submit so user can just hit Enter
      setReadyToSubmit(true)
      requestAnimationFrame(() => submitRef.current?.focus())
    },
    [setValue],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setShowSuggestions(true)
          setActiveIndex(0)
        } else if (e.key === 'Enter') {
          // Move to password instead of submitting the form
          e.preventDefault()
          setShowSuggestions(false)
          passwordRef.current?.focus()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, TEST_USERS.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0) {
            selectUser(TEST_USERS[activeIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowSuggestions(false)
          setActiveIndex(-1)
          break
      }
    },
    [showSuggestions, activeIndex, selectUser],
  )

  // Register with ref forwarding so we can manage focus
  const { ref: emailRegisterRef, ...emailRegisterProps } = register('email')
  const { ref: passwordRegisterRef, ...passwordRegisterProps } =
    register('password')

  async function onSubmit(data: LoginFormValues) {
    setError(null)

    const result = await signIn.email({
      email: data.email,
      password: data.password,
    })

    if (result.error) {
      setError(result.error.message ?? 'Invalid email or password')
      return
    }

    onSuccess?.()
  }

  const showSuccess = isTransitioning && !isSubmitting

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5" ref={wrapperRef}>
        <Label htmlFor="email" className="text-[13px]">
          Email
        </Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            placeholder="name@ttb.gov"
            autoComplete="off"
            data-1p-ignore
            className="h-10"
            disabled={isTransitioning}
            {...emailRegisterProps}
            ref={(el) => {
              emailRegisterRef(el)
              inputRef.current = el
            }}
            aria-invalid={!!errors.email}
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-activedescendant={
              activeIndex >= 0 ? `autofill-option-${activeIndex}` : undefined
            }
            role="combobox"
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
          />

          <AnimatePresence>
            {showSuggestions && !isTransitioning && (
              <motion.div
                className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg shadow-black/8"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{
                  duration: 0.15,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                role="listbox"
                aria-label="Test accounts"
              >
                <div className="px-2.5 pt-2 pb-1.5">
                  <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Demo accounts
                  </p>
                </div>
                <div className="px-1.5 pb-1.5">
                  {TEST_USERS.map((user, index) => (
                    <motion.button
                      key={user.email}
                      id={`autofill-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                        activeIndex === index
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50',
                      )}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.15,
                        delay: index * 0.03,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                      onClick={() => selectUser(user)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      {/* Avatar */}
                      <div
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                          user.role === 'specialist'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                        )}
                      >
                        {getInitials(user.name)}
                      </div>

                      {/* Name + email */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">
                          {user.name}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {user.email}
                        </div>
                      </div>

                      {/* Role badge */}
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          user.role === 'specialist'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                        )}
                      >
                        {user.role === 'specialist' ? (
                          <ShieldCheck className="size-2.5" />
                        ) : (
                          <User className="size-2.5" />
                        )}
                        {user.role === 'specialist'
                          ? 'Specialist'
                          : 'Applicant'}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[13px]">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          className="h-10"
          disabled={isTransitioning}
          {...passwordRegisterProps}
          ref={(el) => {
            passwordRegisterRef(el)
            passwordRef.current = el
          }}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <motion.div
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {error}
        </motion.div>
      )}

      <motion.div
        className="relative mt-1"
        initial={false}
        animate={
          readyToSubmit && !isSubmitting && !isTransitioning
            ? { scale: [1, 1.02, 1] }
            : { scale: 1 }
        }
        transition={
          readyToSubmit && !isSubmitting && !isTransitioning
            ? { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }
            : { duration: 0.15 }
        }
      >
        {/* Focus ring glow */}
        <div
          className={cn(
            'pointer-events-none absolute -inset-[3px] rounded-[10px] transition-opacity duration-300',
            readyToSubmit && !isSubmitting && !isTransitioning
              ? 'opacity-100'
              : 'opacity-0',
          )}
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.15))',
          }}
        />
        <Button
          ref={submitRef}
          type="submit"
          className={cn(
            'group relative h-11 w-full text-[13px] font-semibold tracking-wide transition-all hover:shadow-lg hover:shadow-primary/20 data-[success=true]:bg-emerald-600 data-[success=true]:text-white data-[success=true]:hover:bg-emerald-600',
            readyToSubmit &&
              !isSubmitting &&
              !isTransitioning &&
              'ring-2 ring-primary/60 ring-offset-2 ring-offset-background',
          )}
          disabled={isSubmitting || isTransitioning}
          data-success={showSuccess}
          onBlur={() => setReadyToSubmit(false)}
        >
          {showSuccess ? (
            <motion.span
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              Authenticated
            </motion.span>
          ) : isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </motion.div>
    </form>
  )
}
