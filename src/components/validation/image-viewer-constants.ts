export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.1

export const NEUTRAL_COLORS = {
  border: 'border-indigo-400/50',
  bg: '',
  hoverBorder: 'group-hover/box:border-indigo-500',
  hoverBg: 'group-hover/box:bg-indigo-500/10',
}

export const NEUTRAL_ACTIVE_COLORS = {
  border: 'border-indigo-500',
  bg: 'bg-indigo-500/20',
  shadow: '0 0 12px 2px rgba(99,102,241,0.5)',
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se'

export const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  w: 'ew-resize',
  e: 'ew-resize',
  sw: 'nesw-resize',
  s: 'ns-resize',
  se: 'nwse-resize',
}

export const HANDLE_POSITIONS: { handle: ResizeHandle; x: number; y: number }[] = [
  { handle: 'nw', x: 0, y: 0 },
  { handle: 'n', x: 0.5, y: 0 },
  { handle: 'ne', x: 1, y: 0 },
  { handle: 'w', x: 0, y: 0.5 },
  { handle: 'e', x: 1, y: 0.5 },
  { handle: 'sw', x: 0, y: 1 },
  { handle: 's', x: 0.5, y: 1 },
  { handle: 'se', x: 1, y: 1 },
]
