import React, { useState, useEffect, useCallback } from 'react'
import { parseISO, differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import { useUndoRedo } from '../../context/UndoRedoContext'
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
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  medium: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
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
  const toast = useToast()
  const navigate = useNavigate()
  const { formatDate } = useSettings()
  const { recordOperation } = useUndoRedo()
  const [issue, setIssue] = useState<Issue>(initialIssue)
  const [history, setHistory] = useState<IssueHistory[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closureNote, setClosureNote] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Linked records for comments
  const [linkedRecords, setLinkedRecords] = useState<{ id: string; title: string; topic_title: string; topic_id: string; type: string; subcategory_title: string | null }[]>([])
  const [recordSearch, setRecordSearch] = useState('')
  const [recordResults, setRecordResults] = useState<{ id: string; title: string; topic_title: string; topic_id: string; type: string; subcategory_title: string | null; created_at: string }[]>([])
  const [showRecordPicker, setShowRecordPicker] = useState(false)
  const [pickerTopics, setPickerTopics] = useState<{ id: string; title: string }[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState('')

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

  // Load topics when picker opens
  useEffect(() => {
    if (showRecordPicker && pickerTopics.length === 0) {
      window.electronAPI.topics.getAll({}).then((result) => {
        const topicsData = (result as { data: { id: string; title: string }[] }).data || result
        setPickerTopics((topicsData as { id: string; title: string }[]).map(t => ({ id: t.id, title: t.title })))
      }).catch(() => {})
    }
  }, [showRecordPicker, pickerTopics.length])

  // Search records for linking (with UUID paste-to-resolve)
  useEffect(() => {
    if (!recordSearch.trim()) {
      setRecordResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const trimmed = recordSearch.trim()
        // Detect if input looks like a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed) ||
          (trimmed.length === 36 && /^[0-9a-f-]+$/i.test(trimmed))

        if (isUuid) {
          const record = await window.electronAPI.issues.getRecordForLinking(trimmed)
          if (record && !linkedRecords.some(lr => lr.id === record.id)) {
            setRecordResults([record])
            return
          }
        }

        const results = await window.electronAPI.issues.searchRecordsForLinking(
          trimmed,
          selectedTopicId || undefined
        )
        setRecordResults(results.filter(r => !linkedRecords.some(lr => lr.id === r.id)))
      } catch (err) {
        console.error('Error searching records for linking:', err)
        setRecordResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [recordSearch, linkedRecords, selectedTopicId])

  const handleUpdate = async (data: CreateIssueData | UpdateIssueData) => {
    if (!user) return
    setSubmitting(true)
    try {
      // Capture before state for undo
      const beforeData = await window.electronAPI.history.getEntity('issue', issue.id)

      const result = await window.electronAPI.issues.update(issue.id, data, user.id)
      if (result.success) {
        // Capture after state for undo/redo
        const afterData = await window.electronAPI.history.getEntity('issue', issue.id)

        // Record operation for undo/redo
        if (beforeData) {
          recordOperation({
            operation: 'update',
            entityType: 'issue',
            entityId: issue.id,
            description: `Update issue "${(data as UpdateIssueData).title || issue.title}"`,
            beforeState: {
              entityType: 'issue',
              entityId: issue.id,
              data: beforeData
            },
            afterState: afterData ? {
              entityType: 'issue',
              entityId: issue.id,
              data: afterData
            } : null,
            userId: user.id
          })
        }

        setIsEditing(false)
        await loadIssue()
        await loadHistory()
        onUpdated()
        notifyReminderDataChanged()
      } else {
        toast.error('Error', result.error || 'Failed to update issue')
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
        toast.error('Error', result.error || 'Failed to close issue')
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
        toast.error('Error', result.error || 'Failed to reopen issue')
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
      const recordIds = linkedRecords.map(r => r.id)
      const result = await window.electronAPI.issues.addComment(issue.id, comment.trim(), user.id, recordIds.length ? recordIds : undefined)
      if (result.success) {
        setComment('')
        setLinkedRecords([])
        setRecordSearch('')
        setShowRecordPicker(false)
        await loadHistory()
      } else {
        toast.error('Error', result.error || 'Failed to add comment')
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Issue</h3>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{issue.title}</h3>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${badgeStyle}`}>
                {issue.importance}
              </span>
              <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                issue.status === 'open' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {issue.status}
              </span>
              {issue.status === 'open' && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
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
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{issue.description}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {issue.topic_title && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Topic:</span>{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{issue.topic_title}</span>
            {issue.subcategory_title && (
              <span className="text-gray-500 dark:text-gray-400"> / {issue.subcategory_title}</span>
            )}
          </div>
        )}
        <div>
          <span className="text-gray-500 dark:text-gray-400">Created by:</span>{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">{issue.creator_name || 'Unknown'}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Created:</span>{' '}
          <span className="text-gray-700 dark:text-gray-300">
            {formatDate(issue.created_at, 'withTime')}
          </span>
        </div>
        {issue.reminder_date && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Reminder:</span>{' '}
            <span className={`font-medium ${new Date(issue.reminder_date) < new Date() ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {formatDate(issue.reminder_date, 'withTime')}
            </span>
          </div>
        )}
        {issue.status === 'completed' && issue.completer_name && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Completed by:</span>{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{issue.completer_name}</span>
          </div>
        )}
        {issue.status === 'completed' && issue.completed_at && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Completed:</span>{' '}
            <span className="text-gray-700 dark:text-gray-300">
              {formatDate(issue.completed_at, 'withTime')}
            </span>
          </div>
        )}
      </div>

      {/* Closure note */}
      {issue.closure_note && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Closure Note</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{issue.closure_note}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsEditing(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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
        <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Close Issue</h4>
          <textarea
            value={closureNote}
            onChange={(e) => setClosureNote(e.target.value)}
            placeholder="Optional closure note..."
            rows={2}
            className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
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
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add comment */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Comment</h4>
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="Write a comment... (Ctrl+Enter to submit)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />

            {/* Linked records chips */}
            {linkedRecords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {linkedRecords.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs">
                    <span
                      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
                      onClick={() => r.topic_id && navigate(`/topics/${r.topic_id}?recordId=${r.id}`)}
                      title="Go to record"
                    >
                      <span className="inline-flex px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 text-[10px] font-semibold leading-none uppercase">{r.type}</span>
                      <span className="text-blue-400 font-medium">{r.topic_title}{r.subcategory_title ? ` / ${r.subcategory_title}` : ''}:</span> {r.title}
                    </span>
                    <button onClick={() => setLinkedRecords(prev => prev.filter(lr => lr.id !== r.id))} className="ml-0.5 text-blue-400 hover:text-blue-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Link records toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowRecordPicker(!showRecordPicker)}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {showRecordPicker ? 'Hide record picker' : 'Link to records'}
              </button>

              {showRecordPicker && (
                <div className="mt-1.5 space-y-1.5">
                  <select
                    value={selectedTopicId}
                    onChange={(e) => { setSelectedTopicId(e.target.value); setRecordSearch(''); setRecordResults([]) }}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">All Topics</option>
                    {pickerTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="text"
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      placeholder="Search records by title..."
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                    {recordResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-auto">
                        {recordResults.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setLinkedRecords(prev => [...prev, { id: r.id, title: r.title, topic_title: r.topic_title, topic_id: r.topic_id, type: r.type, subcategory_title: r.subcategory_title }])
                              setRecordSearch('')
                              setRecordResults([])
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-semibold leading-none uppercase flex-shrink-0">{r.type}</span>
                              <span className="text-gray-400">{r.topic_title} / {r.subcategory_title || '\u2014'} /</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{r.title}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 ml-[calc(1.5rem+6px)]">
                              {formatDate(r.created_at)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
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
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">History</h4>
        <IssueTimeline history={history} onHistoryChanged={loadHistory} />
      </div>
    </div>
  )
}
