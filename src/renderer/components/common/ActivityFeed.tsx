/**
 * Activity Feed Component
 *
 * Displays recent audit log entries in a timeline format.
 * Supports filtering by entity type, user, and action.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { formatRelativeTime } from '../../utils/formatters'

interface AuditEntry {
  id: number
  timestamp: string
  user_id: string | null
  username: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: string | null
}

interface ActivityFeedProps {
  /** Maximum number of entries to show */
  limit?: number
  /** Filter by entity type */
  entityType?: string
  /** Filter by entity ID */
  entityId?: string
  /** Filter by user ID */
  userId?: string
  /** Show filters UI */
  showFilters?: boolean
  /** Compact mode for sidebar */
  compact?: boolean
  /** Additional class names */
  className?: string
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number
}

// Action categories for grouping and icons
const actionCategories: Record<string, { icon: string; color: string; category: string }> = {
  // User actions
  USER_LOGIN: { icon: '🔑', color: 'green', category: 'auth' },
  USER_LOGOUT: { icon: '🚪', color: 'gray', category: 'auth' },
  USER_LOGIN_FAILED: { icon: '🔒', color: 'red', category: 'auth' },
  USER_CREATE: { icon: '👤', color: 'blue', category: 'user' },
  USER_UPDATE: { icon: '✏️', color: 'yellow', category: 'user' },
  USER_DELETE: { icon: '🗑️', color: 'red', category: 'user' },

  // Data actions
  TOPIC_CREATE: { icon: '📁', color: 'green', category: 'data' },
  TOPIC_UPDATE: { icon: '📁', color: 'yellow', category: 'data' },
  TOPIC_DELETE: { icon: '📁', color: 'red', category: 'data' },
  RECORD_CREATE: { icon: '📄', color: 'green', category: 'data' },
  RECORD_UPDATE: { icon: '📄', color: 'yellow', category: 'data' },
  RECORD_DELETE: { icon: '📄', color: 'red', category: 'data' },
  LETTER_CREATE: { icon: '✉️', color: 'green', category: 'data' },
  LETTER_UPDATE: { icon: '✉️', color: 'yellow', category: 'data' },
  LETTER_DELETE: { icon: '✉️', color: 'red', category: 'data' },
  MOM_CREATE: { icon: '📋', color: 'green', category: 'data' },
  MOM_UPDATE: { icon: '📋', color: 'yellow', category: 'data' },
  MOM_DELETE: { icon: '📋', color: 'red', category: 'data' },
  ISSUE_CREATE: { icon: '⚠️', color: 'green', category: 'data' },
  ISSUE_UPDATE: { icon: '⚠️', color: 'yellow', category: 'data' },
  ISSUE_CLOSE: { icon: '✅', color: 'green', category: 'data' },
  ISSUE_REOPEN: { icon: '🔄', color: 'yellow', category: 'data' },

  // System actions
  BACKUP_CREATE: { icon: '💾', color: 'blue', category: 'system' },
  BACKUP_RESTORE: { icon: '🔄', color: 'purple', category: 'system' },
  SETTINGS_UPDATE: { icon: '⚙️', color: 'gray', category: 'system' }
}

export function ActivityFeed({
  limit = 20,
  entityType,
  entityId,
  userId,
  showFilters = false,
  compact = false,
  className = '',
  refreshInterval = 0
}: ActivityFeedProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filterAction, setFilterAction] = useState<string>('')
  const [filterUser, setFilterUser] = useState<string>('')
  const [filterEntity, setFilterEntity] = useState<string>(entityType || '')

  const loadEntries = useCallback(async () => {
    try {
      const filters: Record<string, unknown> = { limit }

      if (filterAction) filters.action = filterAction
      if (filterUser || userId) filters.userId = filterUser || userId
      if (filterEntity || entityType) filters.entityType = filterEntity || entityType
      if (entityId) filters.entityId = entityId

      const result = await window.electronAPI.audit.getLog(filters)
      setEntries(result.entries || [])
      setError(null)
    } catch (err) {
      console.error('Failed to load activity feed:', err)
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [limit, filterAction, filterUser, filterEntity, entityType, entityId, userId])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return

    const interval = setInterval(loadEntries, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval, loadEntries])

  const getActionInfo = (action: string) => {
    return actionCategories[action] || { icon: '📝', color: 'gray', category: 'other' }
  }

  const getActionLabel = (action: string) => {
    // Convert ACTION_NAME to readable format
    return action
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    }
    return colors[color] || colors.gray
  }

  const handleEntityClick = (entry: AuditEntry) => {
    if (!entry.entity_type || !entry.entity_id) return

    const routes: Record<string, string> = {
      topic: `/topics/${entry.entity_id}`,
      record: `/topics`, // Would need topic ID
      letter: '/letters',
      mom: '/mom',
      issue: '/issues',
      user: '/settings'
    }

    const route = routes[entry.entity_type]
    if (route) {
      navigate(route, { state: { highlightId: entry.entity_id } })
    }
  }

  const parseDetails = (details: string | null): Record<string, unknown> | null => {
    if (!details) return null
    try {
      return JSON.parse(details)
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          onClick={loadEntries}
          className="mt-2 text-sm text-primary-600 hover:text-primary-700"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            <option value="">{t('activity.allActions', 'All Actions')}</option>
            <optgroup label={t('activity.auth', 'Authentication')}>
              <option value="USER_LOGIN">Login</option>
              <option value="USER_LOGOUT">Logout</option>
            </optgroup>
            <optgroup label={t('activity.data', 'Data Changes')}>
              <option value="TOPIC_CREATE">Topic Created</option>
              <option value="RECORD_CREATE">Record Created</option>
              <option value="LETTER_CREATE">Letter Created</option>
              <option value="ISSUE_CREATE">Issue Created</option>
            </optgroup>
            <optgroup label={t('activity.system', 'System')}>
              <option value="BACKUP_CREATE">Backup Created</option>
              <option value="BACKUP_RESTORE">Backup Restored</option>
            </optgroup>
          </select>

          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            <option value="">{t('activity.allEntities', 'All Entities')}</option>
            <option value="topic">Topics</option>
            <option value="record">Records</option>
            <option value="letter">Letters</option>
            <option value="mom">MOMs</option>
            <option value="issue">Issues</option>
            <option value="user">Users</option>
          </select>

          <button
            onClick={() => {
              setFilterAction('')
              setFilterUser('')
              setFilterEntity('')
            }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {t('common.clearAll', 'Clear all')}
          </button>
        </div>
      )}

      {/* Activity list */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('activity.noActivity', 'No activity yet')}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, index) => {
            const actionInfo = getActionInfo(entry.action)
            const details = parseDetails(entry.details)

            return (
              <div
                key={entry.id}
                className={`
                  flex gap-3 p-2 rounded-lg
                  hover:bg-gray-50 dark:hover:bg-gray-700/50
                  transition-colors
                  ${entry.entity_id ? 'cursor-pointer' : ''}
                `}
                onClick={() => handleEntityClick(entry)}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${getColorClasses(actionInfo.color)}`}>
                  {actionInfo.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{entry.username || t('activity.system', 'System')}</span>
                        {' '}
                        <span className="text-gray-600 dark:text-gray-400">
                          {getActionLabel(entry.action).toLowerCase()}
                        </span>
                        {entry.entity_type && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {' '}{entry.entity_type}
                          </span>
                        )}
                      </p>
                      {!compact && details && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {details.title || details.name || details.subject || ''}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more */}
      {entries.length >= limit && (
        <button
          onClick={() => navigate('/audit')}
          className="w-full mt-4 py-2 text-sm text-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          {t('activity.viewAll', 'View all activity')} →
        </button>
      )}
    </div>
  )
}

/**
 * Compact activity widget for dashboard
 */
export function ActivityWidget({ className = '' }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t('activity.recentActivity', 'Recent Activity')}
        </h3>
      </div>
      <div className="p-4">
        <ActivityFeed
          limit={10}
          compact
          refreshInterval={60000}
        />
      </div>
    </div>
  )
}

export default ActivityFeed
