import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import type { IssueHistory, IssueHistoryAction, CommentEdit } from '../../types'

type HistoryLayout = 'timeline' | 'compact'

interface IssueTimelineProps {
  history: IssueHistory[]
  onHistoryChanged?: () => void
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
    case 'created': return 'bg-green-100 dark:bg-green-900/50'
    case 'field_edit': return 'bg-blue-100 dark:bg-blue-900/50'
    case 'importance_change': return 'bg-orange-100 dark:bg-orange-900/50'
    case 'reminder_change': return 'bg-purple-100 dark:bg-purple-900/50'
    case 'status_change': return 'bg-emerald-100 dark:bg-emerald-900/50'
    case 'comment': return 'bg-gray-100 dark:bg-gray-700'
    case 'closure_note': return 'bg-gray-100 dark:bg-gray-700'
    default: return 'bg-gray-100 dark:bg-gray-700'
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

type LinkSearchResult = { id: string; title: string; topic_title: string; topic_id: string; type: string; subcategory_title: string | null; created_at: string }

export function IssueTimeline({ history, onHistoryChanged }: IssueTimelineProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const { formatDate } = useSettings()

  // Layout toggle - persisted in localStorage
  const [layout, setLayout] = useState<HistoryLayout>(() => {
    const saved = localStorage.getItem('issueHistoryLayout')
    return (saved === 'compact' || saved === 'timeline') ? saved : 'timeline'
  })

  const toggleLayout = () => {
    const newLayout = layout === 'timeline' ? 'compact' : 'timeline'
    setLayout(newLayout)
    localStorage.setItem('issueHistoryLayout', newLayout)
  }

  const formatTimestamp = (dateStr: string): string => {
    return formatDate(dateStr, 'withTime')
  }

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Inline link-add state
  const [addingLinksId, setAddingLinksId] = useState<string | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<LinkSearchResult[]>([])
  const [pendingLinks, setPendingLinks] = useState<LinkSearchResult[]>([])
  const [linkSubmitting, setLinkSubmitting] = useState(false)

  // Comment edit history popover state
  const [editHistoryId, setEditHistoryId] = useState<string | null>(null)
  const [editHistoryCache, setEditHistoryCache] = useState<Record<string, CommentEdit[]>>({})
  const [editHistoryLoading, setEditHistoryLoading] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const openEditHistory = useCallback(async (historyId: string) => {
    if (editHistoryId === historyId) {
      setEditHistoryId(null)
      return
    }
    setEditHistoryId(historyId)
    if (!editHistoryCache[historyId]) {
      setEditHistoryLoading(true)
      try {
        const edits = await window.electronAPI.issues.getCommentEdits(historyId)
        setEditHistoryCache(prev => ({ ...prev, [historyId]: edits }))
      } catch (err) {
        console.error('Error loading edit history:', err)
      } finally {
        setEditHistoryLoading(false)
      }
    }
  }, [editHistoryId, editHistoryCache])

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!editHistoryId) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setEditHistoryId(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditHistoryId(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [editHistoryId])

  // Search for records when linking
  useEffect(() => {
    if (!addingLinksId || !linkSearch.trim()) {
      setLinkResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const trimmed = linkSearch.trim()
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed) ||
          (trimmed.length === 36 && /^[0-9a-f-]+$/i.test(trimmed))

        if (isUuid) {
          const record = await window.electronAPI.issues.getRecordForLinking(trimmed)
          if (record) {
            setLinkResults([record])
            return
          }
        }

        const results = await window.electronAPI.issues.searchRecordsForLinking(trimmed)
        setLinkResults(results)
      } catch { setLinkResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [linkSearch, addingLinksId])

  const startEdit = (entry: IssueHistory) => {
    setEditingId(entry.id)
    setEditText(entry.comment || '')
    // Close link-adding if open
    cancelAddLinks()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async () => {
    if (!user || !editingId || !editText.trim()) return
    setEditSubmitting(true)
    try {
      const result = await window.electronAPI.issues.updateComment(editingId, editText.trim(), user.id)
      if (result.success) {
        // Invalidate cached edit history so popover refetches
        setEditHistoryCache(prev => {
          const next = { ...prev }
          delete next[editingId]
          return next
        })
        cancelEdit()
        onHistoryChanged?.()
      } else {
        toast.error('Error', result.error || 'Failed to update comment')
      }
    } catch (err) {
      console.error('Error updating comment:', err)
    } finally {
      setEditSubmitting(false)
    }
  }

  const startAddLinks = (entryId: string) => {
    setAddingLinksId(entryId)
    setLinkSearch('')
    setLinkResults([])
    setPendingLinks([])
    // Close editing if open
    cancelEdit()
  }

  const cancelAddLinks = () => {
    setAddingLinksId(null)
    setLinkSearch('')
    setLinkResults([])
    setPendingLinks([])
  }

  const saveLinks = async () => {
    if (!user || !addingLinksId || pendingLinks.length === 0) return
    setLinkSubmitting(true)
    try {
      const result = await window.electronAPI.issues.addLinkedRecords(
        addingLinksId,
        pendingLinks.map(l => l.id),
        user.id
      )
      if (result.success) {
        cancelAddLinks()
        onHistoryChanged?.()
      } else {
        toast.error('Error', result.error || 'Failed to add linked records')
      }
    } catch (err) {
      console.error('Error adding linked records:', err)
    } finally {
      setLinkSubmitting(false)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      saveEdit()
    }
    if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">No history entries yet</p>
      </div>
    )
  }

  const isCommentEntry = (action: string) => action === 'comment' || action === 'closure_note'

  // Layout toggle button component
  const LayoutToggle = () => (
    <div className="flex items-center justify-end mb-3">
      <button
        onClick={toggleLayout}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title={`Switch to ${layout === 'timeline' ? 'compact' : 'timeline'} view`}
      >
        {layout === 'timeline' ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Compact
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Timeline
          </>
        )}
      </button>
    </div>
  )

  // Compact view - cleaner chat-like layout
  if (layout === 'compact') {
    return (
      <div>
        <LayoutToggle />
        <div className="space-y-2">
          {history.map((entry) => {
            const isEditing = editingId === entry.id
            const isAddingLinks = addingLinksId === entry.id
            const existingLinkIds = new Set(entry.linked_records?.map(lr => lr.record_id) || [])

            return (
              <div key={entry.id} className="group/entry">
                {/* Non-comment entries - minimal inline style */}
                {!isCommentEntry(entry.action) && (
                  <div className="flex items-center gap-2 py-1.5 px-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-700/50 rounded">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{entry.creator_name || 'System'}</span>
                    <span>{getActionDescription(entry)}</span>
                    {entry.action === 'field_edit' && entry.field_name !== 'description' && (
                      <span className="text-gray-400">
                        (<span className="line-through">{entry.old_value || 'empty'}</span> → {entry.new_value || 'empty'})
                      </span>
                    )}
                    <span className="text-gray-400 ml-auto">{formatTimestamp(entry.created_at)}</span>
                  </div>
                )}

                {/* Comment entries - chat bubble style */}
                {isCommentEntry(entry.action) && (
                  <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                            {(entry.creator_name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.creator_name || 'Unknown'}</span>
                        <span className="text-xs text-gray-400">{formatTimestamp(entry.created_at)}</span>
                        {(entry.edit_count ?? 0) > 0 && (
                          <button
                            onClick={() => openEditHistory(entry.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            (edited)
                          </button>
                        )}
                      </div>
                      {!isEditing && !isAddingLinks && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/entry:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => startAddLinks(entry.id)}
                            className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            title="Link records"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Comment body */}
                    <div className="px-3 py-2">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            rows={3}
                            className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={editSubmitting || !editText.trim()}
                              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {editSubmitting ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={cancelEdit} className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{entry.comment}</p>
                      )}
                    </div>

                    {/* Linked records */}
                    {entry.linked_records && entry.linked_records.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex flex-wrap gap-1.5">
                          {entry.linked_records.map(lr => (
                            lr.deleted_reason ? (
                              <span
                                key={lr.record_id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded text-xs line-through"
                              >
                                {lr.record_title || 'Deleted'}
                              </span>
                            ) : (
                              <button
                                key={lr.record_id}
                                onClick={() => lr.topic_id && navigate(`/topics/${lr.topic_id}?recordId=${lr.record_id}`)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {lr.topic_title} / {lr.record_title}
                              </button>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add links UI */}
                    {isAddingLinks && (
                      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800 space-y-2">
                        {pendingLinks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {pendingLinks.map(r => (
                              <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                                {r.topic_title}: {r.title}
                                <button onClick={() => setPendingLinks(prev => prev.filter(l => l.id !== r.id))} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <input
                            type="text"
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            placeholder="Search records..."
                            className="w-full px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            autoFocus
                          />
                          {linkResults.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-44 overflow-auto">
                              {linkResults.filter(r => !existingLinkIds.has(r.id) && !pendingLinks.some(p => p.id === r.id)).map(r => (
                                <button
                                  key={r.id}
                                  onClick={() => { setPendingLinks(prev => [...prev, r]); setLinkSearch(''); setLinkResults([]) }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                                >
                                  <span className="text-gray-400">{r.topic_title} /</span> {r.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveLinks}
                            disabled={linkSubmitting || pendingLinks.length === 0}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {linkSubmitting ? 'Saving...' : `Link ${pendingLinks.length}`}
                          </button>
                          <button onClick={cancelAddLinks} className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit history popover */}
                {editHistoryId === entry.id && (
                  <div ref={popoverRef} className="mt-1 ml-8 w-80 max-h-64 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">Edit History</div>
                    {editHistoryLoading ? (
                      <div className="px-3 py-4 text-xs text-gray-400 text-center">Loading...</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {(editHistoryCache[entry.id] || []).map(edit => (
                          <div key={edit.id} className="px-3 py-2">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{edit.editor_name || 'Unknown'}</span> - {formatTimestamp(edit.edited_at)}
                            </div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5 whitespace-pre-wrap">{edit.old_comment}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Timeline view - original layout
  return (
    <div>
      <LayoutToggle />
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-4">
          {history.map((entry) => {
          const isEditing = editingId === entry.id
          const isAddingLinks = addingLinksId === entry.id
          const existingLinkIds = new Set(entry.linked_records?.map(lr => lr.record_id) || [])

          return (
          <div key={entry.id} className="relative flex gap-4 group/entry">
            {/* Icon */}
            <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${getActionBgColor(entry.action as IssueHistoryAction)} flex items-center justify-center`}>
              {getActionIcon(entry.action as IssueHistoryAction)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {entry.creator_name || 'System'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {getActionDescription(entry)}
                </span>

                {/* Action buttons for comment entries */}
                {isCommentEntry(entry.action) && !isEditing && !isAddingLinks && (
                  <span className="inline-flex gap-1 opacity-0 group-hover/entry:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(entry)}
                      className="p-0.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      title="Edit comment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => startAddLinks(entry.id)}
                      className="p-0.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      title="Link records"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5">
                {formatTimestamp(entry.created_at)}
                {isCommentEntry(entry.action) && (entry.edit_count ?? 0) > 0 && (
                  <span className="relative">
                    <button
                      onClick={() => openEditHistory(entry.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                      title="View edit history"
                    >
                      (edited)
                    </button>
                    {editHistoryId === entry.id && (
                      <div
                        ref={popoverRef}
                        className="absolute left-0 top-full mt-1 z-30 w-80 max-h-64 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
                      >
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">
                          Edit History
                        </div>
                        {editHistoryLoading ? (
                          <div className="px-3 py-4 text-xs text-gray-400 text-center">Loading...</div>
                        ) : (
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(editHistoryCache[entry.id] || []).map(edit => (
                              <div key={edit.id} className="px-3 py-2">
                                <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{edit.editor_name || 'Unknown'}</span>
                                  <span>edited on</span>
                                  <span>{formatTimestamp(edit.edited_at)}</span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5 whitespace-pre-wrap">
                                  {edit.old_comment}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </span>
                )}
              </p>

              {/* Show old/new values for field edits */}
              {entry.action === 'field_edit' && entry.field_name !== 'description' && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="line-through text-red-400 dark:text-red-500">{entry.old_value || '(empty)'}</span>
                  {' → '}
                  <span className="text-green-600 dark:text-green-400">{entry.new_value || '(empty)'}</span>
                </div>
              )}

              {/* Comment text -- editable or static */}
              {isCommentEntry(entry.action) && entry.comment && (
                isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      rows={3}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={editSubmitting || !editText.trim()}
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {editSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="text-[10px] text-gray-400">Ctrl+Enter to save, Esc to cancel</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {entry.comment}
                  </div>
                )
              )}

              {/* Show linked records */}
              {entry.linked_records && entry.linked_records.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Linked:</span>
                  {entry.linked_records.map(lr => (
                    lr.deleted_reason ? (
                      // Deleted/broken link
                      <span
                        key={lr.record_id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded text-xs line-through cursor-not-allowed"
                        title={lr.deleted_reason === 'topic_deleted' ? 'Topic was deleted' : 'Record was deleted'}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        <span>{lr.record_title || 'Deleted record'}</span>
                        <span className="text-[10px] text-gray-400 ml-1">
                          ({lr.deleted_reason === 'topic_deleted' ? 'topic deleted' : 'record deleted'})
                        </span>
                      </span>
                    ) : (
                      // Active link
                      <span
                        key={lr.record_id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        onClick={() => lr.topic_id && navigate(`/topics/${lr.topic_id}?recordId=${lr.record_id}`)}
                        title="Go to record"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        <span className="text-blue-400 dark:text-blue-400">{lr.topic_title} /</span> {lr.record_title}
                      </span>
                    )
                  ))}
                </div>
              )}

              {/* Inline add-linked-records UI */}
              {isAddingLinks && (
                <div className="mt-2 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                  {/* Pending links chips */}
                  {pendingLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pendingLinks.map(r => (
                        <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                          <span className="inline-flex px-1 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-600 dark:text-blue-300 text-[10px] font-semibold leading-none uppercase">{r.type}</span>
                          <span className="text-blue-400">{r.topic_title}:</span> {r.title}
                          <button
                            onClick={() => setPendingLinks(prev => prev.filter(l => l.id !== r.id))}
                            className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Search input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={linkSearch}
                      onChange={(e) => setLinkSearch(e.target.value)}
                      placeholder="Search records by title or paste UUID..."
                      className="w-full px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      autoFocus
                    />
                    {linkResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-44 overflow-auto">
                        {linkResults
                          .filter(r => !existingLinkIds.has(r.id) && !pendingLinks.some(p => p.id === r.id))
                          .map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setPendingLinks(prev => [...prev, r])
                              setLinkSearch('')
                              setLinkResults([])
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[10px] font-semibold leading-none uppercase flex-shrink-0">{r.type}</span>
                              <span className="text-gray-400">{r.topic_title} / {r.subcategory_title || '\u2014'} /</span>
                              <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{r.title}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Save / Cancel */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveLinks}
                      disabled={linkSubmitting || pendingLinks.length === 0}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {linkSubmitting ? 'Saving...' : `Link ${pendingLinks.length} record${pendingLinks.length !== 1 ? 's' : ''}`}
                    </button>
                    <button
                      onClick={cancelAddLinks}
                      className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )
          })}
        </div>
      </div>
    </div>
  )
}
