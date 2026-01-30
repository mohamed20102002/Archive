import React from 'react'
import { format, parseISO } from 'date-fns'
import type { IssueHistory, IssueHistoryAction } from '../../types'

interface IssueTimelineProps {
  history: IssueHistory[]
}

function getActionIcon(action: IssueHistoryAction): React.ReactNode {
  switch (action) {
    case 'created':
      return (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    case 'field_edit':
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    case 'importance_change':
      return (
        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      )
    case 'reminder_change':
      return (
        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'status_change':
      return (
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'comment':
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    case 'closure_note':
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    default:
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

function getActionBgColor(action: IssueHistoryAction): string {
  switch (action) {
    case 'created': return 'bg-green-100'
    case 'field_edit': return 'bg-blue-100'
    case 'importance_change': return 'bg-orange-100'
    case 'reminder_change': return 'bg-purple-100'
    case 'status_change': return 'bg-emerald-100'
    case 'comment': return 'bg-gray-100'
    case 'closure_note': return 'bg-gray-100'
    default: return 'bg-gray-100'
  }
}

function getActionDescription(entry: IssueHistory): string {
  switch (entry.action) {
    case 'created':
      return 'created this issue'
    case 'field_edit':
      return `changed ${formatFieldName(entry.field_name)}`
    case 'importance_change':
      return `changed importance from "${entry.old_value}" to "${entry.new_value}"`
    case 'reminder_change':
      if (!entry.new_value) return 'removed reminder'
      if (!entry.old_value) return 'set a reminder'
      return 'changed reminder date'
    case 'status_change':
      if (entry.new_value === 'completed') return 'closed this issue'
      return 'reopened this issue'
    case 'comment':
      return 'added a comment'
    case 'closure_note':
      return 'added a closure note'
    default:
      return entry.action
  }
}

function formatFieldName(fieldName: string | null): string {
  if (!fieldName) return 'a field'
  switch (fieldName) {
    case 'title': return 'title'
    case 'description': return 'description'
    case 'topic_id': return 'topic'
    case 'subcategory_id': return 'subcategory'
    case 'reminder_date': return 'reminder'
    default: return fieldName
  }
}

function formatTimestamp(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return dateStr
  }
}

export function IssueTimeline({ history }: IssueTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No history entries yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {history.map((entry) => (
          <div key={entry.id} className="relative flex gap-4">
            {/* Icon */}
            <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${getActionBgColor(entry.action as IssueHistoryAction)} flex items-center justify-center`}>
              {getActionIcon(entry.action as IssueHistoryAction)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">
                  {entry.creator_name || 'System'}
                </span>
                <span className="text-sm text-gray-600">
                  {getActionDescription(entry)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatTimestamp(entry.created_at)}
              </p>

              {/* Show old/new values for field edits */}
              {entry.action === 'field_edit' && entry.field_name !== 'description' && (
                <div className="mt-1 text-xs text-gray-500">
                  <span className="line-through text-red-400">{entry.old_value || '(empty)'}</span>
                  {' → '}
                  <span className="text-green-600">{entry.new_value || '(empty)'}</span>
                </div>
              )}

              {/* Show comment text */}
              {(entry.action === 'comment' || entry.action === 'closure_note') && entry.comment && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                  {entry.comment}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
