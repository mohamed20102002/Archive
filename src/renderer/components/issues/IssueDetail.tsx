import React, { useState, useEffect, useCallback } from 'react'
import { parseISO, differenceInDays, format } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { IssueTimeline } from './IssueTimeline'
import { IssueForm } from './IssueForm'
import { notifyReminderDataChanged } from '../reminders/ReminderBadge'
import type { Issue, IssueHistory, CreateIssueData, UpdateIssueData } from '../../types'

interface IssueDetailProps {
  issue: Issue
  onClose: () => void
  onUpdated: () => void
}

const importanceBadgeStyles: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
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

export function IssueDetail({ issue: initialIssue, onClose, onUpdated }: IssueDetailProps) {
  const { user } = useAuth()
  const [issue, setIssue] = useState<Issue>(initialIssue)
  const [history, setHistory] = useState<IssueHistory[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closureNote, setClosureNote] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadIssue = useCallback(async () => {
    try {
      const result = await window.electronAPI.issues.getById(issue.id)
      if (result) {
        setIssue(result as Issue)
      }
    } catch (err) {
      console.error('Error loading issue:', err)
    }
  }, [issue.id])

  const loadHistory = useCallback(async () => {
    try {
      const result = await window.electronAPI.issues.getHistory(issue.id)
      setHistory(result as IssueHistory[])
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }, [issue.id])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleUpdate = async (data: CreateIssueData | UpdateIssueData) => {
    if (!user) return
    setSubmitting(true)
    try {
      const result = await window.electronAPI.issues.update(issue.id, data, user.id)
      if (result.success) {
        setIsEditing(false)
        await loadIssue()
        await loadHistory()
        onUpdated()
        notifyReminderDataChanged()
      } else {
        alert(result.error || 'Failed to update issue')
      }
    } catch (err) {
      console.error('Error updating issue:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const result = await window.electronAPI.issues.close(issue.id, closureNote.trim() || null, user.id)
      if (result.success) {
        setShowCloseDialog(false)
        setClosureNote('')
        await loadIssue()
        await loadHistory()
        onUpdated()
        notifyReminderDataChanged()
      } else {
        alert(result.error || 'Failed to close issue')
      }
    } catch (err) {
      console.error('Error closing issue:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopen = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const result = await window.electronAPI.issues.reopen(issue.id, user.id)
      if (result.success) {
        await loadIssue()
        await loadHistory()
        onUpdated()
        notifyReminderDataChanged()
      } else {
        alert(result.error || 'Failed to reopen issue')
      }
    } catch (err) {
      console.error('Error reopening issue:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddComment = async () => {
    if (!user || !comment.trim()) return
    setSubmitting(true)
    try {
      const result = await window.electronAPI.issues.addComment(issue.id, comment.trim(), user.id)
      if (result.success) {
        setComment('')
        await loadHistory()
      } else {
        alert(result.error || 'Failed to add comment')
      }
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAddComment()
    }
  }

  if (isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Issue</h3>
        </div>
        <IssueForm
          issue={issue}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  const badgeStyle = importanceBadgeStyles[issue.importance] || importanceBadgeStyles.medium

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{issue.title}</h3>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${badgeStyle}`}>
                {issue.importance}
              </span>
              <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                issue.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {issue.status}
              </span>
              {issue.status === 'open' && (
                <span className="text-xs text-gray-500">
                  {getAgingText(issue.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      {issue.description && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{issue.description}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {issue.topic_title && (
          <div>
            <span className="text-gray-500">Topic:</span>{' '}
            <span className="font-medium text-gray-900">{issue.topic_title}</span>
            {issue.subcategory_title && (
              <span className="text-gray-500"> / {issue.subcategory_title}</span>
            )}
          </div>
        )}
        <div>
          <span className="text-gray-500">Created by:</span>{' '}
          <span className="font-medium text-gray-900">{issue.creator_name || 'Unknown'}</span>
        </div>
        <div>
          <span className="text-gray-500">Created:</span>{' '}
          <span className="text-gray-700">
            {(() => { try { return format(parseISO(issue.created_at), 'MMM d, yyyy h:mm a') } catch { return issue.created_at } })()}
          </span>
        </div>
        {issue.reminder_date && (
          <div>
            <span className="text-gray-500">Reminder:</span>{' '}
            <span className={`font-medium ${new Date(issue.reminder_date) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
              {(() => { try { return format(parseISO(issue.reminder_date), 'MMM d, yyyy h:mm a') } catch { return issue.reminder_date } })()}
            </span>
          </div>
        )}
        {issue.status === 'completed' && issue.completer_name && (
          <div>
            <span className="text-gray-500">Completed by:</span>{' '}
            <span className="font-medium text-gray-900">{issue.completer_name}</span>
          </div>
        )}
        {issue.status === 'completed' && issue.completed_at && (
          <div>
            <span className="text-gray-500">Completed:</span>{' '}
            <span className="text-gray-700">
              {(() => { try { return format(parseISO(issue.completed_at), 'MMM d, yyyy h:mm a') } catch { return issue.completed_at } })()}
            </span>
          </div>
        )}
      </div>

      {/* Closure note */}
      {issue.closure_note && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Closure Note</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.closure_note}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => setIsEditing(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Edit
        </button>
        {issue.status === 'open' ? (
          <button
            onClick={() => setShowCloseDialog(true)}
            disabled={submitting}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Close Issue
          </button>
        ) : (
          <button
            onClick={handleReopen}
            disabled={submitting}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Reopen
          </button>
        )}
      </div>

      {/* Close dialog */}
      {showCloseDialog && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-medium text-green-800 mb-2">Close Issue</h4>
          <textarea
            value={closureNote}
            onChange={(e) => setClosureNote(e.target.value)}
            placeholder="Optional closure note..."
            rows={2}
            className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Confirm Close
            </button>
            <button
              onClick={() => { setShowCloseDialog(false); setClosureNote('') }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add comment */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Add Comment</h4>
        <div className="flex gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleCommentKeyDown}
            placeholder="Write a comment... (Ctrl+Enter to submit)"
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <button
            onClick={handleAddComment}
            disabled={!comment.trim() || submitting}
            className="self-end px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">History</h4>
        <IssueTimeline history={history} />
      </div>
    </div>
  )
}
