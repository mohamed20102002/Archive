/**
 * Focus Trap Component
 *
 * Traps focus within a container for modal dialogs and popups.
 * Ensures keyboard navigation stays within the component.
 */

import React, { useRef, useEffect, useCallback } from 'react'

interface FocusTrapProps {
  /** Whether the focus trap is active */
  active?: boolean
  /** Children to render inside the trap */
  children: React.ReactNode
  /** Called when user presses Escape */
  onEscape?: () => void
  /** Element to return focus to when trap is deactivated */
  returnFocusTo?: HTMLElement | null
  /** Auto-focus the first focusable element */
  autoFocus?: boolean
  /** Additional class names */
  className?: string
}

// Focusable element selectors
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',')

export function FocusTrap({
  active = true,
  children,
  onEscape,
  returnFocusTo,
  autoFocus = true,
  className = ''
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return []
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter(el => {
      // Filter out hidden elements
      return el.offsetParent !== null && !el.hasAttribute('aria-hidden')
    })
  }, [])

  // Focus the first focusable element
  const focusFirst = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[0].focus()
    }
  }, [getFocusableElements])

  // Focus the last focusable element
  const focusLast = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[elements.length - 1].focus()
    }
  }, [getFocusableElements])

  // Handle keydown for focus trapping
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!active) return

    if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      onEscape()
      return
    }

    if (e.key !== 'Tab') return

    const elements = getFocusableElements()
    if (elements.length === 0) return

    const firstElement = elements[0]
    const lastElement = elements[elements.length - 1]
    const activeElement = document.activeElement

    // Shift + Tab on first element -> focus last
    if (e.shiftKey && activeElement === firstElement) {
      e.preventDefault()
      lastElement.focus()
      return
    }

    // Tab on last element -> focus first
    if (!e.shiftKey && activeElement === lastElement) {
      e.preventDefault()
      firstElement.focus()
      return
    }

    // If focus is outside the trap, bring it back
    if (!containerRef.current?.contains(activeElement)) {
      e.preventDefault()
      if (e.shiftKey) {
        lastElement.focus()
      } else {
        firstElement.focus()
      }
    }
  }, [active, getFocusableElements, onEscape])

  // Set up focus trap
  useEffect(() => {
    if (!active) return

    // Store previously focused element
    previouslyFocusedRef.current = returnFocusTo || document.activeElement as HTMLElement

    // Auto-focus first element
    if (autoFocus) {
      // Small delay to ensure content is rendered
      requestAnimationFrame(() => {
        focusFirst()
      })
    }

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      // Return focus to previous element
      if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
        previouslyFocusedRef.current.focus()
      }
    }
  }, [active, autoFocus, focusFirst, handleKeyDown, returnFocusTo])

  return (
    <div
      ref={containerRef}
      className={className}
      role="dialog"
      aria-modal={active}
    >
      {children}
    </div>
  )
}

/**
 * Hook for managing focus trap programmatically
 */
export function useFocusTrap(active: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return []
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter(el => el.offsetParent !== null)
  }, [])

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[0].focus()
    }
  }, [getFocusableElements])

  const focusLast = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[elements.length - 1].focus()
    }
  }, [getFocusableElements])

  const activate = useCallback(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement
    focusFirst()
  }, [focusFirst])

  const deactivate = useCallback(() => {
    if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
      previouslyFocusedRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (active) {
      activate()
    }
    return () => {
      if (active) {
        deactivate()
      }
    }
  }, [active, activate, deactivate])

  return {
    containerRef,
    focusFirst,
    focusLast,
    getFocusableElements
  }
}

export default FocusTrap
