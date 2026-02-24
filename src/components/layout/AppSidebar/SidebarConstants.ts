export const EXPANDED_WIDTH = 256
export const COLLAPSED_WIDTH = 64
export const STORAGE_KEY = 'sidebar-collapsed'

const SIDEBAR_EVENT = 'sidebar-collapsed-change'

export function subscribeToSidebar(callback: () => void) {
  window.addEventListener(SIDEBAR_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function getSidebarSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function getSidebarServerSnapshot() {
  return false
}

export function dispatchSidebarChange() {
  window.dispatchEvent(new Event(SIDEBAR_EVENT))
}
