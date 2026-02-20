/**
 * Breadcrumbs Component
 *
 * Provides hierarchical navigation showing the current location.
 * Integrates with React Router for automatic path detection.
 */

import React from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface BreadcrumbItem {
  label: string
  path?: string
  icon?: React.ReactNode
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  className?: string
  showHome?: boolean
}

// Route to breadcrumb mapping
const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  'topics': 'Topics',
  'letters': 'Letters',
  'mom': 'Minutes of Meeting',
  'issues': 'Open Issues',
  'search': 'Search',
  'calendar': 'Calendar',
  'attendance': 'Attendance',
  'settings': 'Settings',
  'backup': 'Backup & Restore',
  'admin': 'Administration',
  'audit': 'Audit Log',
  'users': 'Users',
  'authorities': 'Authorities',
  'contacts': 'Contacts',
  'credentials': 'Credentials',
  'secure-resources': 'Secure Resources',
  'handover': 'Weekly Handover',
  'health': 'System Health'
}

export function Breadcrumbs({
  items,
  className = '',
  showHome = true
}: BreadcrumbsProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const params = useParams()

  // Generate breadcrumbs from current path if items not provided
  const breadcrumbs: BreadcrumbItem[] = items || generateBreadcrumbs(location.pathname, params, t)

  // Add home if enabled
  const allBreadcrumbs = showHome
    ? [{ label: t('nav.dashboard', 'Dashboard'), path: '/' }, ...breadcrumbs]
    : breadcrumbs

  if (allBreadcrumbs.length <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm ${className}`}
    >
      <ol className="flex items-center space-x-1">
        {allBreadcrumbs.map((item, index) => {
          const isLast = index === allBreadcrumbs.length - 1

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <svg
                  className="w-4 h-4 text-gray-400 mx-1 rtl:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}

              {isLast || !item.path ? (
                <span
                  className={`
                    flex items-center gap-1
                    ${isLast
                      ? 'text-gray-900 dark:text-gray-100 font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                    }
                  `}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {item.icon}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Generate breadcrumbs from pathname
 */
function generateBreadcrumbs(
  pathname: string,
  params: Record<string, string | undefined>,
  t: (key: string, fallback?: string) => string
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []
  let currentPath = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`

    // Check if segment is a dynamic param (UUID or ID)
    const isId = /^[0-9a-f-]{36}$|^\d+$/.test(segment)

    if (isId) {
      // Skip IDs in breadcrumb path but might show entity name
      // This would need async loading of entity names
      continue
    }

    // Get label for route segment
    const label = routeLabels[segment]
      ? t(`nav.${segment}`, routeLabels[segment])
      : segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')

    breadcrumbs.push({
      label,
      path: i < segments.length - 1 ? currentPath : undefined
    })
  }

  return breadcrumbs
}

/**
 * Breadcrumb with dynamic entity name loading
 */
interface DynamicBreadcrumbsProps {
  entityType?: 'topic' | 'letter' | 'mom' | 'issue'
  entityId?: string
  entityTitle?: string
  className?: string
}

export function DynamicBreadcrumbs({
  entityType,
  entityId,
  entityTitle,
  className = ''
}: DynamicBreadcrumbsProps) {
  const { t } = useTranslation()
  const location = useLocation()

  // Build breadcrumb items
  const items: BreadcrumbItem[] = []

  // Add parent route based on entity type
  if (entityType) {
    const parentRoutes: Record<string, { path: string; label: string }> = {
      topic: { path: '/topics', label: t('nav.topics', 'Topics') },
      letter: { path: '/letters', label: t('nav.letters', 'Letters') },
      mom: { path: '/mom', label: t('nav.moms', 'MOMs') },
      issue: { path: '/issues', label: t('nav.issues', 'Issues') }
    }

    const parent = parentRoutes[entityType]
    if (parent) {
      items.push({ label: parent.label, path: parent.path })
    }
  }

  // Add entity title if provided
  if (entityTitle) {
    items.push({ label: entityTitle })
  }

  return <Breadcrumbs items={items} className={className} />
}

/**
 * Compact breadcrumb for mobile
 */
export function CompactBreadcrumbs({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const location = useLocation()

  // Get parent path
  const segments = location.pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return null

  const parentSegment = segments[segments.length - 2]
  const parentPath = '/' + segments.slice(0, -1).join('/')
  const parentLabel = routeLabels[parentSegment] || parentSegment

  return (
    <Link
      to={parentPath}
      className={`inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 ${className}`}
    >
      <svg
        className="w-4 h-4 rtl:rotate-180"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      <span>{t(`nav.${parentSegment}`, parentLabel)}</span>
    </Link>
  )
}

export default Breadcrumbs
