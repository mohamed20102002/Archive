import React, { useState } from 'react'
import { format } from 'date-fns'
import type { AuditEntry as AuditEntryType } from '../../types'

interface AuditEntryProps {
  entry: AuditEntryType
}

const actionIcons: Record<string, React.ReactNode> = {
  USER_LOGIN: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  ),
  USER_LOGOUT: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  USER_CREATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  TOPIC_CREATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  TOPIC_UPDATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  TOPIC_DELETE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  SUBCATEGORY_CREATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  SUBCATEGORY_UPDATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  SUBCATEGORY_DELETE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  RECORD_CREATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  EMAIL_ARCHIVE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  REMINDER_CREATE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  REMINDER_COMPLETE: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  SYSTEM_STARTUP: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  SYSTEM_SHUTDOWN: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
    </svg>
  )
}

const actionColors: Record<string, string> = {
  USER_LOGIN: 'bg-green-100 text-green-700',
  USER_LOGOUT: 'bg-gray-100 text-gray-700',
  USER_CREATE: 'bg-blue-100 text-blue-700',
  USER_UPDATE: 'bg-blue-100 text-blue-700',
  USER_LOGIN_FAILED: 'bg-red-100 text-red-700',
  TOPIC_CREATE: 'bg-purple-100 text-purple-700',
  TOPIC_UPDATE: 'bg-purple-100 text-purple-700',
  TOPIC_DELETE: 'bg-red-100 text-red-700',
  SUBCATEGORY_CREATE: 'bg-violet-100 text-violet-700',
  SUBCATEGORY_UPDATE: 'bg-violet-100 text-violet-700',
  SUBCATEGORY_DELETE: 'bg-red-100 text-red-700',
  RECORD_CREATE: 'bg-teal-100 text-teal-700',
  RECORD_UPDATE: 'bg-teal-100 text-teal-700',
  RECORD_DELETE: 'bg-red-100 text-red-700',
  EMAIL_ARCHIVE: 'bg-indigo-100 text-indigo-700',
  EMAIL_DELETE: 'bg-red-100 text-red-700',
  REMINDER_CREATE: 'bg-orange-100 text-orange-700',
  REMINDER_UPDATE: 'bg-orange-100 text-orange-700',
  REMINDER_COMPLETE: 'bg-green-100 text-green-700',
  REMINDER_DELETE: 'bg-red-100 text-red-700',
  SYSTEM_STARTUP: 'bg-green-100 text-green-700',
  SYSTEM_SHUTDOWN: 'bg-gray-100 text-gray-700'
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

// Format the details into a human-readable summary
function formatDetailsSummary(action: string, details: any): string | null {
  if (!details) return null

  switch (action) {
    case 'TOPIC_CREATE':
      return `Created topic "${details.title}"${details.priority ? ` with ${details.priority} priority` : ''}`

    case 'TOPIC_UPDATE':
      if (details.changes) {
        const changesList = Object.entries(details.changes)
          .map(([field, change]: [string, any]) => {
            if (field === 'title') return `title from "${change.from}" to "${change.to}"`
            if (field === 'status') return `status from "${change.from}" to "${change.to}"`
            if (field === 'priority') return `priority from "${change.from}" to "${change.to}"`
            if (field === 'description') return `description`
            return field
          })
          .join(', ')
        return `Updated ${details.topic_title || 'topic'}: changed ${changesList}`
      }
      return details.topic_title ? `Updated topic "${details.topic_title}"` : null

    case 'TOPIC_DELETE':
      return `Deleted topic "${details.topic_title}"`

    case 'SUBCATEGORY_CREATE':
      return `Created subcategory "${details.title}"${details.topic_title ? ` in "${details.topic_title}"` : ''}`

    case 'SUBCATEGORY_UPDATE':
      if (details.changes) {
        const changesList = Object.entries(details.changes)
          .map(([field, change]: [string, any]) => {
            if (field === 'title') return `title from "${change.from}" to "${change.to}"`
            if (field === 'description') return `description`
            return field
          })
          .join(', ')
        return `Updated subcategory "${details.subcategory_title}": changed ${changesList}`
      }
      return details.subcategory_title ? `Updated subcategory "${details.subcategory_title}"` : null

    case 'SUBCATEGORY_DELETE':
      return `Deleted subcategory "${details.subcategory_title}"`

    case 'RECORD_CREATE':
      let location = details.topic_title ? ` in "${details.topic_title}"` : ''
      if (details.subcategory_title) {
        location = ` in "${details.topic_title} / ${details.subcategory_title}"`
      }
      return `Created ${details.type || 'record'} "${details.title}"${location}`

    case 'RECORD_UPDATE':
      if (details.changes) {
        const changesList = Object.entries(details.changes)
          .map(([field, change]: [string, any]) => {
            if (field === 'title') return `title from "${change.from}" to "${change.to}"`
            if (field === 'content') return `content`
            if (field === 'type') return `type from "${change.from}" to "${change.to}"`
            if (field === 'subcategory_id') {
              if (!change.from && change.to) return `moved to subcategory`
              if (change.from && !change.to) return `moved to General`
              return `subcategory`
            }
            return field
          })
          .join(', ')
        return `Updated record "${details.record_title}": changed ${changesList}`
      }
      return details.record_title ? `Updated record "${details.record_title}"` : null

    case 'RECORD_DELETE':
      return `Deleted record "${details.record_title}"`

    case 'EMAIL_ARCHIVE':
      return `Archived email "${details.subject}" from ${details.sender}${details.has_attachments ? ' (with attachments)' : ''}`

    case 'REMINDER_CREATE':
      return `Created reminder "${details.title}" due ${details.due_date ? new Date(details.due_date).toLocaleDateString() : 'unknown'}${details.priority ? ` (${details.priority} priority)` : ''}`

    case 'REMINDER_COMPLETE':
      return `Completed reminder "${details.reminder_title}"`

    case 'REMINDER_DELETE':
      return `Deleted reminder "${details.reminder_title}"`

    case 'USER_CREATE':
      return `Created user "${details.username}" (${details.display_name})${details.role ? ` as ${details.role}` : ''}`

    case 'USER_UPDATE':
      if (details.changes) {
        const changesList = Object.entries(details.changes)
          .map(([field]: [string, any]) => field)
          .join(', ')
        return `Updated user "${details.username}": changed ${changesList}`
      }
      return details.username ? `Updated user "${details.username}"` : null

    case 'USER_LOGIN':
      return null // Just show the username which is already displayed

    case 'USER_LOGOUT':
      return null

    case 'USER_LOGIN_FAILED':
      return details.reason ? `Login failed: ${details.reason}` : 'Login attempt failed'

    default:
      return null
  }
}

export function AuditEntry({ entry }: AuditEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const details = entry.details ? JSON.parse(entry.details) : null
  const summary = formatDetailsSummary(entry.action, details)

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${actionColors[entry.action] || 'bg-gray-100 text-gray-700'}`}>
          {actionIcons[entry.action] || (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[entry.action] || 'bg-gray-100 text-gray-700'}`}>
              {formatAction(entry.action)}
            </span>
            {entry.entity_type && (
              <span className="text-xs text-gray-400">
                {entry.entity_type}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm">
            {entry.username ? (
              <span className="text-gray-900 font-medium">@{entry.username}</span>
            ) : (
              <span className="text-gray-500">System</span>
            )}
            <span className="text-gray-400">-</span>
            <span className="text-gray-500">
              {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm:ss a')}
            </span>
          </div>

          {/* Human-readable summary */}
          {summary && (
            <p className="mt-2 text-sm text-gray-700">
              {summary}
            </p>
          )}

          {/* Details toggle */}
          {details && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              {isExpanded ? 'Hide raw details' : 'Show raw details'}
              <svg
                className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Expanded Details */}
          {isExpanded && details && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Checksum indicator */}
        <div className="flex-shrink-0" title={`Checksum: ${entry.checksum.substring(0, 16)}...`}>
          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
