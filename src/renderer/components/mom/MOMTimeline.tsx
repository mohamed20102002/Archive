import React from 'react'
import { format, parseISO } from 'date-fns'
import type { MomHistory, MomHistoryAction } from '../../types'

interface MOMTimelineProps {
  history: MomHistory[]
}

function getActionIcon(action: MomHistoryAction): React.ReactNode {
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
    case 'action_created':
    case 'action_updated':
      return (
        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    case 'action_resolved':
      return (
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'action_reopened':
      return (
        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    case 'action_reminder_change':
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
    case 'topic_linked':
    case 'record_linked':
    case 'letter_linked':
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    case 'topic_unlinked':
    case 'record_unlinked':
    case 'letter_unlinked':
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )
    case 'file_uploaded':
    case 'draft_added':
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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

function getActionBgColor(action: MomHistoryAction): string {
  switch (action) {
    case 'created': return 'bg-green-100'
    case 'field_edit': return 'bg-blue-100'
    case 'action_created':
    case 'action_updated': return 'bg-indigo-100'
    case 'action_resolved': return 'bg-emerald-100'
    case 'action_reopened': return 'bg-yellow-100'
    case 'action_reminder_change': return 'bg-purple-100'
    case 'status_change': return 'bg-emerald-100'
    case 'topic_linked':
    case 'record_linked':
    case 'letter_linked': return 'bg-blue-100'
    case 'topic_unlinked':
    case 'record_unlinked':
    case 'letter_unlinked': return 'bg-red-50'
    case 'file_uploaded':
    case 'draft_added': return 'bg-gray-100'
    default: return 'bg-gray-100'
  }
}

function getActionDescription(entry: MomHistory): string {
  switch (entry.action) {
    case 'created': return 'created this MOM'
    case 'field_edit': return `changed ${entry.field_name || 'a field'}${entry.old_value && entry.new_value ? '' : ''}`
    case 'action_created': return 'added an action'
    case 'action_updated': return `updated action ${entry.field_name || ''}`
    case 'action_resolved': return 'resolved an action'
    case 'action_reopened': return 'reopened an action'
    case 'action_reminder_change': return 'changed action reminder'
    case 'draft_added': return `added draft v${entry.new_value || ''}`
    case 'status_change':
      if (entry.new_value === 'closed') return 'closed this MOM'
      return 'reopened this MOM'
    case 'topic_linked': return 'linked a topic'
    case 'topic_unlinked': return 'unlinked a topic'
    case 'record_linked': return 'linked a record'
    case 'record_unlinked': return 'unlinked a record'
    case 'letter_linked': return 'linked a letter'
    case 'letter_unlinked': return 'unlinked a letter'
    case 'file_uploaded': return 'uploaded a file'
    default: return entry.action
  }
}

function formatTimestamp(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return dateStr
  }
}

export function MOMTimeline({ history }: MOMTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No history entries yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {history.map((entry) => (
          <div key={entry.id} className="relative flex gap-4">
            <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${getActionBgColor(entry.action)} flex items-center justify-center`}>
              {getActionIcon(entry.action)}
            </div>

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
              {entry.action === 'field_edit' && (entry.old_value || entry.new_value) && (
                <div className="mt-1 text-xs text-gray-500">
                  <span className="line-through text-red-400">{entry.old_value || '(empty)'}</span>
                  {' → '}
                  <span className="text-green-600">{entry.new_value || '(empty)'}</span>
                </div>
              )}

              {/* Show details for actions and drafts */}
              {entry.details && (
                <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 line-clamp-2">
                  {entry.details}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
