/**
 * Skip Links Component
 *
 * Provides skip navigation links for keyboard users to bypass repetitive content.
 * Links are visually hidden until focused.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'

interface SkipLink {
  /** Target element ID (without #) */
  targetId: string
  /** Label for the skip link */
  label: string
}

interface SkipLinksProps {
  /** Custom skip links */
  links?: SkipLink[]
  /** Additional class names */
  className?: string
}

export function SkipLinks({ links, className = '' }: SkipLinksProps) {
  const { t } = useTranslation()

  // Default skip links
  const defaultLinks: SkipLink[] = [
    { targetId: 'main-content', label: t('accessibility.skipToMain', 'Skip to main content') },
    { targetId: 'main-navigation', label: t('accessibility.skipToNav', 'Skip to navigation') },
    { targetId: 'search-input', label: t('accessibility.skipToSearch', 'Skip to search') }
  ]

  const skipLinks = links || defaultLinks

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      // Make target focusable if it isn't
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1')
      }
      target.focus()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav
      aria-label={t('accessibility.skipLinks', 'Skip links')}
      className={`skip-links ${className}`}
    >
      {skipLinks.map((link, index) => (
        <a
          key={link.targetId}
          href={`#${link.targetId}`}
          onClick={(e) => handleClick(e, link.targetId)}
          className="
            sr-only focus:not-sr-only
            focus:fixed focus:top-4 focus:left-4 focus:z-[100]
            focus:px-4 focus:py-2
            focus:bg-primary-600 focus:text-white
            focus:rounded-lg focus:shadow-lg
            focus:outline-none focus:ring-2 focus:ring-white
            transition-all
          "
          style={{ '--skip-link-index': index } as React.CSSProperties}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}

/**
 * Landmark regions for screen readers
 */
export function MainContent({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main
      id="main-content"
      role="main"
      aria-label="Main content"
      className={className}
      tabIndex={-1}
    >
      {children}
    </main>
  )
}

export function Navigation({
  children,
  className = '',
  label
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  const { t } = useTranslation()

  return (
    <nav
      id="main-navigation"
      role="navigation"
      aria-label={label || t('accessibility.mainNav', 'Main navigation')}
      className={className}
    >
      {children}
    </nav>
  )
}

export function SearchRegion({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <search
      role="search"
      aria-label={t('accessibility.search', 'Search')}
      className={className}
    >
      {children}
    </search>
  )
}

export function ComplementaryRegion({
  children,
  className = '',
  label
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  const { t } = useTranslation()

  return (
    <aside
      role="complementary"
      aria-label={label || t('accessibility.sidebar', 'Sidebar')}
      className={className}
    >
      {children}
    </aside>
  )
}

export default SkipLinks
