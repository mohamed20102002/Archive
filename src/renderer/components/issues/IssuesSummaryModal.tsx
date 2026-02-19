import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { Modal } from '../common/Modal'
import type { Issue, IssueHistory } from '../../types'

interface IssueSummary {
  issue: Issue
  latestUpdate: IssueHistory | null
}

interface IssuesSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  onViewIssue: (issue: Issue) => void
}

const importanceBadgeStyles: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
}

const actionLabels: Record<string, string> = {
  created: 'Created',
  field_edit: 'Field Updated',
  importance_change: 'Importance Changed',
  reminder_change: 'Reminder Changed',
  status_change: 'Status Changed',
  comment: 'Comment',
  closure_note: 'Closure Note'
}

export function IssuesSummaryModal({ isOpen, onClose, onViewIssue }: IssuesSummaryModalProps) {
  const navigate = useNavigate()
  const { formatDate } = useSettings()
  const [summaries, setSummaries] = useState<IssueSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null)
  const [fullHistory, setFullHistory] = useState<Record<string, IssueHistory[]>>({})
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null)

  const loadSummaries = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.issues.getOpenSummary()
      setSummaries(result as IssueSummary[])
    } catch (err) {
      console.error('Error loading issue summaries:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadSummaries()
      setExpandedIssueId(null)
      setFullHistory({})
    }
  }, [isOpen, loadSummaries])

  const handleViewFullHistory = async (issueId: string) => {
    if (expandedIssueId === issueId) {
      setExpandedIssueId(null)
      return
    }

    setExpandedIssueId(issueId)

    if (!fullHistory[issueId]) {
      setLoadingHistory(issueId)
      try {
        const history = await window.electronAPI.issues.getHistory(issueId)
        setFullHistory(prev => ({ ...prev, [issueId]: (history as IssueHistory[]).reverse() }))
      } catch (err) {
        console.error('Error loading issue history:', err)
      } finally {
        setLoadingHistory(null)
      }
    }
  }

  const handleNavigateToRecord = (topicId: string | null, recordId: string) => {
    if (topicId) {
      onClose()
      navigate(`/topics/${topicId}?recordId=${recordId}`)
    }
  }

  const renderHistoryEntry = (entry: IssueHistory, isLatest: boolean = false) => {
    return (
      <div className={`${isLatest ? '' : 'pl-4 border-l-2 border-gray-200'}`}>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span className="font-medium text-gray-700">{entry.creator_name || 'Unknown'}</span>
          <span className="text-gray-400">-</span>
          <span>{formatDate(entry.created_at, 'withTime')}</span>
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
            {actionLabels[entry.action] || entry.action}
          </span>
          {entry.edit_count > 0 && (
            <span className="text-gray-400 italic">(edited {entry.edit_count}x)</span>
          )}
        </div>

        {/* Field change */}
        {entry.action === 'field_edit' && entry.field_name && (
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">{entry.field_name}:</span>{' '}
            <span className="line-through text-gray-400">{entry.old_value || '(empty)'}</span>{' '}
            <span className="text-gray-600">→</span>{' '}
            <span>{entry.new_value || '(empty)'}</span>
          </div>
        )}

        {/* Importance change */}
        {entry.action === 'importance_change' && (
          <div className="text-sm text-gray-600 mb-2">
            <span className={`inline-block px-2 py-0.5 rounded text-xs ${importanceBadgeStyles[entry.old_value || 'low']}`}>
              {entry.old_value}
            </span>
            <span className="mx-2">→</span>
            <span className={`inline-block px-2 py-0.5 rounded text-xs ${importanceBadgeStyles[entry.new_value || 'low']}`}>
              {entry.new_value}
            </span>
          </div>
        )}

        {/* Status change */}
        {entry.action === 'status_change' && (
          <div className="text-sm text-gray-600 mb-2">
            Status: <span className="capitalize">{entry.old_value}</span>
            <span className="mx-2">→</span>
            <span className="capitalize font-medium">{entry.new_value}</span>
          </div>
        )}

        {/* Comment or closure note */}
        {(entry.action === 'comment' || entry.action === 'closure_note') && entry.comment && (
          <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 mb-2 whitespace-pre-wrap">
            {entry.comment}
          </div>
        )}

        {/* Linked records */}
        {entry.linked_records && entry.linked_records.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Linked Records:</p>
            <div className="flex flex-wrap gap-1">
              {entry.linked_records.map(record => (
                <button
                  key={record.record_id}
                  onClick={() => handleNavigateToRecord(record.topic_id, record.record_id)}
                  disabled={!!record.deleted_reason}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    record.deleted_reason
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                  }`}
                  title={record.deleted_reason ? `Record ${record.deleted_reason === 'topic_deleted' ? 'topic was deleted' : 'was deleted'}` : `Open record in ${record.topic_title}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {record.record_title || record.record_id.slice(0, 8)}
                  {record.deleted_reason && (
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Open Issues Summary"
      size="xl"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No open issues</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {summaries.map(({ issue, latestUpdate }) => (
              <div key={issue.id} className="py-4 first:pt-0 last:pb-0">
                {/* Issue Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${importanceBadgeStyles[issue.importance]}`}>
                        {issue.importance}
                      </span>
                      <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                    </div>
                    {issue.topic_title && (
                      <p className="text-xs text-gray-500 mt-1">
                        Topic: {issue.topic_title}
                        {issue.subcategory_title && ` / ${issue.subcategory_title}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Created {formatDate(issue.created_at, 'withDay')} by {issue.creator_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewFullHistory(issue.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      title="View full history"
                    >
                      <svg className={`w-4 h-4 transition-transform ${expandedIssueId === issue.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      History
                    </button>
                    <button
                      onClick={() => onViewIssue(issue)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                      title="Open issue details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open
                    </button>
                  </div>
                </div>

                {/* Issue Description */}
                {issue.description && (
                  <div className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-lg p-2">
                    {issue.description}
                  </div>
                )}

                {/* Latest Update */}
                {latestUpdate ? (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-800 mb-2">Latest Update:</p>
                    {renderHistoryEntry(latestUpdate, true)}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 text-center text-sm text-gray-500">
                    No updates yet
                  </div>
                )}

                {/* Expanded Full History */}
                {expandedIssueId === issue.id && (
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Full History:</p>
                    {loadingHistory === issue.id ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
                      </div>
                    ) : fullHistory[issue.id]?.length ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {fullHistory[issue.id].map((entry, index) => (
                          <div key={entry.id} className={index > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                            {renderHistoryEntry(entry)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-2">No history entries</p>
                    )}
                  </div>
                )}

                {/* Reminder indicator */}
                {issue.reminder_date && (
                  <div className={`mt-2 flex items-center gap-1 text-xs ${
                    new Date(issue.reminder_date) < new Date() ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Reminder: {formatDate(issue.reminder_date, 'withDay')}
                    {new Date(issue.reminder_date) < new Date() && ' (overdue)'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {summaries.length} open issue{summaries.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
