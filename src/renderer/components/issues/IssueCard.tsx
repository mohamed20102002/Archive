import React from 'react'
import { parseISO, differenceInDays } from 'date-fns'
import type { Issue } from '../../types'

interface IssueCardProps {
  issue: Issue
  onClick: () => void
  highlighted?: boolean
}

const importanceStyles: Record<string, { badge: string; border: string }> = {
  low: { badge: 'bg-gray-100 text-gray-600', border: 'border-l-gray-400' },
  medium: { badge: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400' },
  high: { badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400' },
  critical: { badge: 'bg-red-100 text-red-700', border: 'border-l-red-400' }
}

function getAgingText(createdAt: string): string {
  const days = differenceInDays(new Date(), parseISO(createdAt))
  if (days === 0) return 'Opened today'
  if (days === 1) return 'Open for 1 day'
  if (days < 30) return `Open for ${days} days`
  const months = Math.floor(days / 30)
  if (months === 1) return 'Open for 1 month'
  return `Open for ${months} months`
}

function isReminderOverdue(reminderDate: string | null): boolean {
  if (!reminderDate) return false
  return new Date(reminderDate) < new Date()
}

export function IssueCard({ issue, onClick, highlighted }: IssueCardProps) {
  const styles = importanceStyles[issue.importance] || importanceStyles.medium
  const reminderOverdue = issue.status === 'open' && isReminderOverdue(issue.reminder_date)

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-l-4 ${styles.border} p-4 hover:shadow-md transition-all cursor-pointer ${
        highlighted
          ? 'border-primary-500 ring-2 ring-primary-500 ring-opacity-50 shadow-lg'
          : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{issue.title}</h3>
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${styles.badge}`}>
          {issue.importance}
        </span>
      </div>

      {/* Description preview */}
      {issue.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{issue.description}</p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {issue.topic_title && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
            {issue.topic_title}
          </span>
        )}
        {issue.reminder_date && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
            reminderOverdue
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {reminderOverdue ? 'Overdue' : 'Reminder set'}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{issue.status === 'open' ? getAgingText(issue.created_at) : `Completed`}</span>
        <span>{issue.creator_name || 'Unknown'}</span>
      </div>
    </div>
  )
}
