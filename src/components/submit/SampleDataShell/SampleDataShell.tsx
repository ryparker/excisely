'use client'

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useSyncExternalStore,
} from 'react'
import { FlaskConical, X } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

// ---------------------------------------------------------------------------
// Hint callout (auto-dismisses after 6s)
// ---------------------------------------------------------------------------

function HintCallout({ onDismiss }: { onDismiss: () => void }) {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : {
              opacity: 1,
              y: [4, -2, 4],
              transition: {
                opacity: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
                y: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              },
            }
      }
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      className="pointer-events-none absolute -top-11 right-0 whitespace-nowrap"
    >
      <div className="rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background shadow-md">
        Need test data? Click here
      </div>
      {/* Caret */}
      <div className="absolute right-5 -bottom-1 size-2.5 rotate-45 bg-foreground" />
    </motion.div>
  )
}

// Stable subscribe ref for useSyncExternalStore hydration guard
const emptySubscribe = () => () => {}

// ---------------------------------------------------------------------------
// Context — lets children dismiss the panel (e.g. after applying sample data)
// ---------------------------------------------------------------------------

const SampleDataShellContext = createContext<{ close: () => void }>({
  close: () => {},
})

export function useSampleDataShell() {
  return useContext(SampleDataShellContext)
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface SampleDataShellProps {
  /** Title shown in the panel header */
  title: string
  /** Panel width class (e.g. "w-[400px]") */
  panelWidth?: string
  /** Panel body content */
  children: React.ReactNode
}

export function SampleDataShell({
  title,
  panelWidth = 'w-[400px]',
  children,
}: SampleDataShellProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const prefersReducedMotion = useReducedMotion()

  const dismissHint = useCallback(() => setShowHint(false), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  if (!mounted) return null

  return (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.div
          key="panel"
          initial={
            prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
          }
          animate={{ opacity: 1, scale: 1 }}
          exit={
            prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
          }
          transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`fixed right-6 bottom-14 z-50 ${panelWidth} rounded-xl border bg-popover shadow-xl`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <FlaskConical className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">{title}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="ml-auto rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close sample data"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
            <SampleDataShellContext.Provider value={{ close }}>
              {children}
            </SampleDataShellContext.Provider>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              Demo only &mdash; this panel is included for evaluation purposes
              and would not appear in the production application.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="trigger"
          initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed right-6 bottom-14 z-50"
        >
          {/* Hint callout */}
          <AnimatePresence>
            {showHint && !isOpen && <HintCallout onDismiss={dismissHint} />}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => {
              dismissHint()
              setIsOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-full border bg-popover px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg transition-colors hover:text-foreground"
          >
            <FlaskConical className="size-3.5" />
            Sample Data
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
