import React, { useState, useEffect } from 'react'
import { parseISO, differenceInDays } from 'date-fns'
import { PinButton } from '../common/PinButton'
import { TagBadge } from '../tags/TagBadge'
import type { Issue, Tag } from '../../types'

interface IssueCardProps {
  issue: Issue
  onClick: () => void
  highlighted?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
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

export function IssueCard({ issue, onClick, highlighted, isPinned = false, onTogglePin }: IssueCardProps) {
  const styles = importanceStyles[issue.importance] || importanceStyles.medium
  const reminderOverdue = issue.status === 'open' && isReminderOverdue(issue.reminder_date)
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    window.electronAPI.tags.getIssueTags(issue.id).then(t => {
      setTags(t as Tag[])
    }).catch(err => {
      console.error('[IssueCard] Error fetching tags:', err)
    })
  }, [issue.id])

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-l-4 ${styles.border} p-4 hover:shadow-md dark:hover:shadow-gray-900/50 transition-all cursor-pointer group flex flex-col h-full ${
        highlighted
          ? 'border-primary-500 ring-2 ring-primary-500 ring-opacity-50 shadow-lg'
          : 'border-gray-200 dark:border-gray-700'
      } ${isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-600 bg-amber-50/30 dark:bg-amber-900/20' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isPinned && (
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{issue.title}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onTogglePin && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              <PinButton isPinned={isPinned} onToggle={onTogglePin} />
            </span>
          )}
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${styles.badge}`}>
            {issue.importance}
          </span>
        </div>
      </div>

      {/* Description preview */}
      {issue.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{issue.description}</p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-grow">
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

      {/* Tags - always reserve space for consistent card height */}
      <div className="min-h-[24px] flex flex-wrap items-center gap-2 mb-3">
        {tags.slice(0, 5).map(tag => (
          <TagBadge key={tag.id} tag={tag} size="sm" />
        ))}
        {tags.length > 5 && (
          <span className="text-xs text-gray-400">+{tags.length - 5}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{issue.status === 'open' ? getAgingText(issue.created_at) : `Completed`}</span>
        <span>{issue.creator_name || 'Unknown'}</span>
      </div>
    </div>
  )
}
