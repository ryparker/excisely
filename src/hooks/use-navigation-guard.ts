'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface UseNavigationGuardOptions {
  shouldBlock: boolean
}

export function useNavigationGuard({ shouldBlock }: UseNavigationGuardOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const [showDialog, setShowDialog] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const shouldBlockRef = useRef(shouldBlock)

  // Keep ref in sync so event listeners always see the latest value
  useEffect(() => {
    shouldBlockRef.current = shouldBlock
  }, [shouldBlock])

  // Browser-level navigation (tab close, refresh, address bar)
  useEffect(() => {
    if (!shouldBlock) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlock])

  // Client-side link clicks (sidebar, any <a> in the app)
  useEffect(() => {
    if (!shouldBlock) return

    function handleClick(e: MouseEvent) {
      if (!shouldBlockRef.current) return

      const target = e.target as HTMLElement | null
      if (!target?.closest) return

      // Find closest anchor from click target
      const anchor = target.closest('a[href]')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Skip links that open in a new tab/window
      const anchorTarget = anchor.getAttribute('target')
      if (anchorTarget && anchorTarget !== '_self') return

      // Skip links inside Radix portals (dialogs, popovers, dropdowns)
      if (anchor.closest('[data-radix-portal]')) return

      // Skip external links
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        // Skip same-page navigation
        if (url.pathname === pathname) return
      } catch {
        return
      }

      // Skip modified clicks (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      e.preventDefault()
      e.stopPropagation()
      setPendingHref(href)
      setShowDialog(true)
    }

    // Capture phase to intercept before any other handler
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [shouldBlock, pathname])

  const confirmNavigation = useCallback(() => {
    const href = pendingHref
    setShowDialog(false)
    setPendingHref(null)
    if (href) {
      router.push(href)
    }
  }, [pendingHref, router])

  const cancelNavigation = useCallback(() => {
    setShowDialog(false)
    setPendingHref(null)
  }, [])

  return { showDialog, pendingHref, confirmNavigation, cancelNavigation }
}
