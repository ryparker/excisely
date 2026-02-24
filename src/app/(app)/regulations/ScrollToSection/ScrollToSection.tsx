'use client'

import { useEffect } from 'react'

/**
 * Ensures the browser scrolls to the hash fragment after Next.js
 * client-side navigation. Native hash scrolling doesn't always fire
 * when the target element renders after the navigation completes.
 *
 * Uses getElementById instead of querySelector because section IDs
 * contain dots (e.g. "5.63") which are invalid in CSS selectors.
 */
export function ScrollToSection() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    // Strip the leading "#"
    const id = hash.slice(1)

    // Small delay to ensure the RSC content has rendered
    const timer = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  return null
}
