/**
 * Keyboard Navigation Hook
 *
 * Provides keyboard navigation utilities for lists, dialogs, and forms.
 * Supports j/k navigation, Enter to select, Escape to close.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseKeyboardNavigationOptions {
  /** Total number of items */
  itemCount: number
  /** Callback when item is selected (Enter key) */
  onSelect?: (index: number) => void
  /** Callback when escape is pressed */
  onEscape?: () => void
  /** Whether navigation is enabled */
  enabled?: boolean
  /** Initial selected index */
  initialIndex?: number
  /** Whether to wrap around at boundaries */
  wrap?: boolean
  /** Custom key bindings */
  keys?: {
    up?: string[]
    down?: string[]
    select?: string[]
    escape?: string[]
  }
}

interface UseKeyboardNavigationReturn {
  /** Currently selected index */
  selectedIndex: number
  /** Set selected index manually */
  setSelectedIndex: (index: number) => void
  /** Move selection up */
  selectPrevious: () => void
  /** Move selection down */
  selectNext: () => void
  /** Props to spread on container element */
  containerProps: {
    tabIndex: number
    onKeyDown: (e: React.KeyboardEvent) => void
  }
  /** Check if index is selected */
  isSelected: (index: number) => boolean
}

const DEFAULT_KEYS = {
  up: ['ArrowUp', 'k'],
  down: ['ArrowDown', 'j'],
  select: ['Enter', ' '],
  escape: ['Escape']
}

/**
 * Hook for keyboard navigation in lists
 */
export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEscape,
  enabled = true,
  initialIndex = -1,
  wrap = true,
  keys = DEFAULT_KEYS
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)

  // Reset selection when item count changes
  useEffect(() => {
    if (selectedIndex >= itemCount) {
      setSelectedIndex(itemCount > 0 ? itemCount - 1 : -1)
    }
  }, [itemCount, selectedIndex])

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => {
      if (prev <= 0) {
        return wrap ? itemCount - 1 : 0
      }
      return prev - 1
    })
  }, [itemCount, wrap])

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => {
      if (prev >= itemCount - 1) {
        return wrap ? 0 : itemCount - 1
      }
      return prev + 1
    })
  }, [itemCount, wrap])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return

    const mergedKeys = { ...DEFAULT_KEYS, ...keys }

    if (mergedKeys.up.includes(e.key)) {
      e.preventDefault()
      selectPrevious()
    } else if (mergedKeys.down.includes(e.key)) {
      e.preventDefault()
      selectNext()
    } else if (mergedKeys.select.includes(e.key) && selectedIndex >= 0) {
      e.preventDefault()
      onSelect?.(selectedIndex)
    } else if (mergedKeys.escape.includes(e.key)) {
      e.preventDefault()
      onEscape?.()
    }
  }, [enabled, keys, selectedIndex, selectPrevious, selectNext, onSelect, onEscape])

  const isSelected = useCallback((index: number) => {
    return index === selectedIndex
  }, [selectedIndex])

  return {
    selectedIndex,
    setSelectedIndex,
    selectPrevious,
    selectNext,
    containerProps: {
      tabIndex: 0,
      onKeyDown: handleKeyDown
    },
    isSelected
  }
}

/**
 * Hook for focus trap in dialogs/modals
 */
export function useFocusTrap(enabled: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus first focusable element
    const container = containerRef.current
    if (container) {
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    }

    // Restore focus on cleanup
    return () => {
      previousFocusRef.current?.focus()
    }
  }, [enabled])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled || e.key !== 'Tab') return

    const container = containerRef.current
    if (!container) return

    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [enabled])

  return {
    containerRef,
    onKeyDown: handleKeyDown
  }
}

/**
 * Hook for global keyboard shortcuts
 */
interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: () => void
  description?: string
}

export function useGlobalShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

/**
 * Keyboard shortcuts overlay component data
 */
export interface ShortcutGroup {
  name: string
  shortcuts: {
    keys: string
    description: string
  }[]
}

export const defaultShortcuts: ShortcutGroup[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: 'G then D', description: 'Go to Dashboard' },
      { keys: 'G then T', description: 'Go to Topics' },
      { keys: 'G then L', description: 'Go to Letters' },
      { keys: 'G then M', description: 'Go to MOMs' },
      { keys: 'G then I', description: 'Go to Issues' },
      { keys: 'G then S', description: 'Go to Search' }
    ]
  },
  {
    name: 'Lists',
    shortcuts: [
      { keys: 'J / ↓', description: 'Move down' },
      { keys: 'K / ↑', description: 'Move up' },
      { keys: 'Enter', description: 'Open selected item' },
      { keys: 'Escape', description: 'Close dialog / Clear selection' }
    ]
  },
  {
    name: 'Actions',
    shortcuts: [
      { keys: 'Ctrl + K', description: 'Open Command Palette' },
      { keys: 'Ctrl + /', description: 'Show keyboard shortcuts' },
      { keys: 'Ctrl + S', description: 'Save (in forms)' }
    ]
  }
]

/**
 * Hook for "Go to" navigation (G then key)
 */
export function useGoToNavigation(navigate: (path: string) => void) {
  const [pendingGo, setPendingGo] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setPendingGo(true)
        // Clear pending state after timeout
        timeoutRef.current = setTimeout(() => setPendingGo(false), 1500)
        return
      }

      if (pendingGo) {
        clearTimeout(timeoutRef.current)
        setPendingGo(false)

        const routes: Record<string, string> = {
          d: '/',
          t: '/topics',
          l: '/letters',
          m: '/mom',
          i: '/issues',
          s: '/search',
          c: '/calendar',
          a: '/attendance',
          ',': '/settings'
        }

        const route = routes[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          navigate(route)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [pendingGo, navigate])

  return { pendingGo }
}

export default useKeyboardNavigation
