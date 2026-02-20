/**
 * Accessibility Hooks
 *
 * Custom hooks for focus management, keyboard navigation, and screen reader announcements.
 */

import { useRef, useEffect, useCallback, useState } from 'react'

/**
 * Hook for managing focus when a modal/dialog opens and closes
 */
export function useFocusOnMount(shouldFocus: boolean = true) {
  const elementRef = useRef<HTMLElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (shouldFocus) {
      // Store currently focused element
      previouslyFocusedRef.current = document.activeElement as HTMLElement

      // Focus the target element
      if (elementRef.current) {
        elementRef.current.focus()
      }
    }

    return () => {
      // Return focus to previous element on unmount
      if (shouldFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus()
      }
    }
  }, [shouldFocus])

  return elementRef
}

/**
 * Hook for roving tabindex pattern (arrow key navigation within a group)
 */
export function useRovingTabindex<T extends HTMLElement>(
  itemCount: number,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both'
    loop?: boolean
    onSelect?: (index: number) => void
  } = {}
) {
  const { orientation = 'vertical', loop = true, onSelect } = options
  const [activeIndex, setActiveIndex] = useState(0)
  const itemRefs = useRef<(T | null)[]>([])

  const setItemRef = useCallback((index: number) => (el: T | null) => {
    itemRefs.current[index] = el
  }, [])

  const focusItem = useCallback((index: number) => {
    const item = itemRefs.current[index]
    if (item) {
      item.focus()
      setActiveIndex(index)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newIndex = activeIndex

    const isVertical = orientation === 'vertical' || orientation === 'both'
    const isHorizontal = orientation === 'horizontal' || orientation === 'both'

    switch (e.key) {
      case 'ArrowDown':
        if (isVertical) {
          e.preventDefault()
          newIndex = loop
            ? (activeIndex + 1) % itemCount
            : Math.min(activeIndex + 1, itemCount - 1)
        }
        break
      case 'ArrowUp':
        if (isVertical) {
          e.preventDefault()
          newIndex = loop
            ? (activeIndex - 1 + itemCount) % itemCount
            : Math.max(activeIndex - 1, 0)
        }
        break
      case 'ArrowRight':
        if (isHorizontal) {
          e.preventDefault()
          newIndex = loop
            ? (activeIndex + 1) % itemCount
            : Math.min(activeIndex + 1, itemCount - 1)
        }
        break
      case 'ArrowLeft':
        if (isHorizontal) {
          e.preventDefault()
          newIndex = loop
            ? (activeIndex - 1 + itemCount) % itemCount
            : Math.max(activeIndex - 1, 0)
        }
        break
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
      case 'End':
        e.preventDefault()
        newIndex = itemCount - 1
        break
      case 'Enter':
      case ' ':
        if (onSelect) {
          e.preventDefault()
          onSelect(activeIndex)
        }
        break
    }

    if (newIndex !== activeIndex) {
      focusItem(newIndex)
    }
  }, [activeIndex, itemCount, orientation, loop, onSelect, focusItem])

  const getItemProps = useCallback((index: number) => ({
    ref: setItemRef(index),
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown: handleKeyDown,
    onFocus: () => setActiveIndex(index)
  }), [activeIndex, handleKeyDown, setItemRef])

  return {
    activeIndex,
    setActiveIndex,
    focusItem,
    getItemProps,
    handleKeyDown
  }
}

/**
 * Hook for live announcements to screen readers
 */
export function useAnnounce() {
  const [announcement, setAnnouncement] = useState('')
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite')

  const announce = useCallback((message: string, level: 'polite' | 'assertive' = 'polite') => {
    // Clear first to ensure re-announcement of same message
    setAnnouncement('')
    setPoliteness(level)

    // Use requestAnimationFrame to ensure the clear has taken effect
    requestAnimationFrame(() => {
      setAnnouncement(message)
    })
  }, [])

  const announcePolite = useCallback((message: string) => {
    announce(message, 'polite')
  }, [announce])

  const announceAssertive = useCallback((message: string) => {
    announce(message, 'assertive')
  }, [announce])

  // Component to render for announcements
  const AnnouncementRegion = useCallback(() => (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  ), [announcement, politeness])

  return {
    announce,
    announcePolite,
    announceAssertive,
    AnnouncementRegion,
    currentAnnouncement: announcement
  }
}

/**
 * Hook for detecting user's preference for reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

/**
 * Hook for detecting user's preference for color scheme
 */
export function usePrefersColorScheme(): 'light' | 'dark' {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    setColorScheme(mediaQuery.matches ? 'dark' : 'light')

    const handler = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return colorScheme
}

/**
 * Hook for managing focus visible state (keyboard vs mouse focus)
 */
export function useFocusVisible() {
  const [focusVisible, setFocusVisible] = useState(false)
  const hadKeyboardEventRef = useRef(false)

  useEffect(() => {
    const onKeyDown = () => {
      hadKeyboardEventRef.current = true
    }

    const onPointerDown = () => {
      hadKeyboardEventRef.current = false
    }

    const onFocus = () => {
      if (hadKeyboardEventRef.current) {
        setFocusVisible(true)
      }
    }

    const onBlur = () => {
      setFocusVisible(false)
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('focusout', onBlur, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('focusout', onBlur, true)
    }
  }, [])

  return focusVisible
}

/**
 * Hook for escape key handler
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [callback, enabled])
}

/**
 * Hook for click outside handler
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void,
  enabled: boolean = true
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!enabled) return

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [callback, enabled])

  return ref
}

/**
 * Hook for managing aria-expanded state
 */
export function useExpanded(initialState: boolean = false) {
  const [expanded, setExpanded] = useState(initialState)

  const toggle = useCallback(() => setExpanded(prev => !prev), [])
  const expand = useCallback(() => setExpanded(true), [])
  const collapse = useCallback(() => setExpanded(false), [])

  const getButtonProps = useCallback(() => ({
    'aria-expanded': expanded,
    onClick: toggle
  }), [expanded, toggle])

  const getPanelProps = useCallback(() => ({
    hidden: !expanded,
    'aria-hidden': !expanded
  }), [expanded])

  return {
    expanded,
    setExpanded,
    toggle,
    expand,
    collapse,
    getButtonProps,
    getPanelProps
  }
}

export default {
  useFocusOnMount,
  useRovingTabindex,
  useAnnounce,
  usePrefersReducedMotion,
  usePrefersColorScheme,
  useFocusVisible,
  useEscapeKey,
  useClickOutside,
  useExpanded
}
