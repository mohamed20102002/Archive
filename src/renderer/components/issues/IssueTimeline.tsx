import React, { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { IssueHistory, IssueHistoryAction, CommentEdit } from '../../types'

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

type LinkSearchResult = { id: string; title: string; topic_title: string; topic_id: string; type: string; subcategory_title: string | null; created_at: string }

export function IssueTimeline({ history, onHistoryChanged }: IssueTimelineProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

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
        alert(result.error || 'Failed to update comment')
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
        alert(result.error || 'Failed to add linked records')
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
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No history entries yet</p>
      </div>
    )
  }

  const isCommentEntry = (action: string) => action === 'comment' || action === 'closure_note'

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gray-200" />

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
                <span className="text-sm font-medium text-gray-900">
                  {entry.creator_name || 'System'}
                </span>
                <span className="text-sm text-gray-600">
                  {getActionDescription(entry)}
                </span>

                {/* Action buttons for comment entries */}
                {isCommentEntry(entry.action) && !isEditing && !isAddingLinks && (
                  <span className="inline-flex gap-1 opacity-0 group-hover/entry:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(entry)}
                      className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit comment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => startAddLinks(entry.id)}
                      className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Link records"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                {formatTimestamp(entry.created_at)}
                {isCommentEntry(entry.action) && (entry.edit_count ?? 0) > 0 && (
                  <span className="relative">
                    <button
                      onClick={() => openEditHistory(entry.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      title="View edit history"
                    >
                      (edited)
                    </button>
                    {editHistoryId === entry.id && (
                      <div
                        ref={popoverRef}
                        className="absolute left-0 top-full mt-1 z-30 w-80 max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                      >
                        <div className="px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-700">
                          Edit History
                        </div>
                        {editHistoryLoading ? (
                          <div className="px-3 py-4 text-xs text-gray-400 text-center">Loading...</div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {(editHistoryCache[entry.id] || []).map(edit => (
                              <div key={edit.id} className="px-3 py-2">
                                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                  <span className="font-medium text-gray-700">{edit.editor_name || 'Unknown'}</span>
                                  <span>edited on</span>
                                  <span>{formatTimestamp(edit.edited_at)}</span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">
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
                <div className="mt-1 text-xs text-gray-500">
                  <span className="line-through text-red-400">{entry.old_value || '(empty)'}</span>
                  {' → '}
                  <span className="text-green-600">{entry.new_value || '(empty)'}</span>
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
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
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
                        className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="text-[10px] text-gray-400">Ctrl+Enter to save, Esc to cancel</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                    {entry.comment}
                  </div>
                )
              )}

              {/* Show linked records */}
              {entry.linked_records && entry.linked_records.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-400">Linked:</span>
                  {entry.linked_records.map(lr => (
                    <span
                      key={lr.record_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => lr.topic_id && navigate(`/topics/${lr.topic_id}?recordId=${lr.record_id}`)}
                      title="Go to record"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      <span className="text-blue-400">{lr.topic_title} /</span> {lr.record_title}
                    </span>
                  ))}
                </div>
              )}

              {/* Inline add-linked-records UI */}
              {isAddingLinks && (
                <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-2">
                  {/* Pending links chips */}
                  {pendingLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pendingLinks.map(r => (
                        <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          <span className="inline-flex px-1 py-0.5 rounded bg-blue-200 text-blue-600 text-[10px] font-semibold leading-none uppercase">{r.type}</span>
                          <span className="text-blue-400">{r.topic_title}:</span> {r.title}
                          <button
                            onClick={() => setPendingLinks(prev => prev.filter(l => l.id !== r.id))}
                            className="ml-0.5 text-blue-400 hover:text-blue-600"
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
                      className="w-full px-3 py-1.5 border border-blue-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      autoFocus
                    />
                    {linkResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-auto">
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
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold leading-none uppercase flex-shrink-0">{r.type}</span>
                              <span className="text-gray-400">{r.topic_title} / {r.subcategory_title || '\u2014'} /</span>
                              <span className="font-medium text-gray-700 truncate">{r.title}</span>
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
                      className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
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
  )
}
