/**
 * RTL (Right-to-Left) Support Hook
 *
 * Provides utilities for handling RTL languages like Arabic
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isRTL, getCurrentLanguage, supportedLanguages, SupportedLanguage } from '../i18n'

/**
 * Hook for RTL support
 */
export function useRTL() {
  const { i18n } = useTranslation()
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')

  useEffect(() => {
    const updateDirection = () => {
      const lang = i18n.language as SupportedLanguage
      const dir = supportedLanguages[lang]?.dir || 'ltr'
      setDirection(dir)

      // Update document direction
      document.documentElement.dir = dir
      document.documentElement.lang = lang

      // Update font family for Arabic
      if (lang === 'ar') {
        document.documentElement.classList.add('font-arabic')
      } else {
        document.documentElement.classList.remove('font-arabic')
      }
    }

    updateDirection()

    // Listen for language changes
    i18n.on('languageChanged', updateDirection)

    return () => {
      i18n.off('languageChanged', updateDirection)
    }
  }, [i18n])

  return {
    direction,
    isRTL: direction === 'rtl',
    isLTR: direction === 'ltr'
  }
}

/**
 * Get directional class names
 * Converts ltr/rtl specific classes to direction-aware ones
 *
 * @example
 * getDirectionalClasses('ml-4', 'mr-4') // Returns 'ms-4' which works for both RTL and LTR
 */
export function getDirectionalClasses(ltrClass: string, rtlClass?: string): string {
  const isRtl = isRTL()

  if (rtlClass) {
    return isRtl ? rtlClass : ltrClass
  }

  // Auto-convert common directional classes
  if (isRtl) {
    return ltrClass
      .replace(/\bml-/g, 'mr-')
      .replace(/\bmr-/g, 'ml-')
      .replace(/\bpl-/g, 'pr-')
      .replace(/\bpr-/g, 'pl-')
      .replace(/\bleft-/g, 'right-')
      .replace(/\bright-/g, 'left-')
      .replace(/\btext-left\b/g, 'text-right')
      .replace(/\btext-right\b/g, 'text-left')
      .replace(/\brounded-l-/g, 'rounded-r-')
      .replace(/\brounded-r-/g, 'rounded-l-')
      .replace(/\bborder-l-/g, 'border-r-')
      .replace(/\bborder-r-/g, 'border-l-')
  }

  return ltrClass
}

/**
 * RTL-aware spacing utilities
 */
export const rtlSpacing = {
  // Margin start (left in LTR, right in RTL)
  ms: (value: number | string) => `ms-${value}`,
  // Margin end (right in LTR, left in RTL)
  me: (value: number | string) => `me-${value}`,
  // Padding start
  ps: (value: number | string) => `ps-${value}`,
  // Padding end
  pe: (value: number | string) => `pe-${value}`,
  // Start position
  start: (value: number | string) => `start-${value}`,
  // End position
  end: (value: number | string) => `end-${value}`
}

/**
 * Get RTL-aware icon rotation
 * Some icons need to be flipped in RTL mode
 */
export function getIconRotation(): string {
  return isRTL() ? 'transform scale-x-[-1]' : ''
}

/**
 * RTL-aware flex direction
 */
export function getFlexDirection(reverse?: boolean): string {
  const baseDirection = reverse ? 'flex-row-reverse' : 'flex-row'
  return baseDirection
}

/**
 * Hook to handle text alignment based on direction
 */
export function useTextAlign() {
  const { isRTL } = useRTL()

  return {
    start: isRTL ? 'text-right' : 'text-left',
    end: isRTL ? 'text-left' : 'text-right',
    center: 'text-center'
  }
}

export default useRTL
