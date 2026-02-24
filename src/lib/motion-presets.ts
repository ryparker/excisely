import type { Transition } from 'motion/react'

// ---------------------------------------------------------------------------
// Shared stagger animation presets
//
// The "decelerate" easing and stagger-delay pattern is used across cards,
// timeline steps, and stepper components for cohesive entrance choreography.
// ---------------------------------------------------------------------------

/** Standard decelerate easing curve — fast start, gentle settle. */
const EASE_DECELERATE: [number, number, number, number] = [
  0.25, 0.46, 0.45, 0.94,
]

/**
 * Stagger transition for sequenced card/item entrances.
 *
 * Defaults match the most common pattern (duration 0.35s, 60ms stagger).
 * The "compact" variant (duration 0.3s, 50ms stagger, y: 8) is used for
 * mobile list items via `staggerItemCompact`.
 */
export function staggerTransition(
  index: number,
  opts?: { delay?: number; duration?: number },
): Transition {
  return {
    type: 'tween',
    duration: opts?.duration ?? 0.35,
    delay: index * (opts?.delay ?? 0.06),
    ease: EASE_DECELERATE,
  }
}

/** Instant transition for reduced-motion users. */
export const INSTANT_TRANSITION: Transition = { duration: 0 }

/**
 * Returns `false` to skip the initial animation when the user prefers
 * reduced motion, or the initial keyframe otherwise.
 */
export function staggerInitial(
  shouldReduceMotion: boolean | null,
): { opacity: number; y: number } | false {
  if (shouldReduceMotion) return false
  return { opacity: 0, y: 12 }
}

/**
 * Compact variant of `staggerInitial` — smaller y offset for tight lists
 * (mobile timeline steps, compact rows).
 */
export function staggerInitialCompact(
  shouldReduceMotion: boolean | null,
): { opacity: number; y: number } | false {
  if (shouldReduceMotion) return false
  return { opacity: 0, y: 8 }
}

/**
 * Full stagger transition respecting reduced-motion preference.
 *
 * Returns `INSTANT_TRANSITION` when the user prefers reduced motion,
 * otherwise returns the standard stagger transition for the given index.
 */
export function staggerTransitionSafe(
  shouldReduceMotion: boolean | null,
  index: number,
  opts?: { delay?: number; duration?: number },
): Transition {
  if (shouldReduceMotion) return INSTANT_TRANSITION
  return staggerTransition(index, opts)
}
