import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import { notifyReminderDataChanged } from '../reminders/ReminderBadge'
import type { MomAction } from '../../types'

interface MOMActionsProps {
  momInternalId: string
  momId: string
  onActionsChanged?: () => void
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

export function MOMActions({ momInternalId, momId, onActionsChanged }: MOMActionsProps) {
  const { user } = useAuth()
  const toast = useToast()
  const { formatDate } = useSettings()
  const [actions, setActions] = useState<MomAction[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newResponsible, setNewResponsible] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newReminder, setNewReminder] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editResponsible, setEditResponsible] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editReminder, setEditReminder] = useState('')

  // Resolve state
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [resolving, setResolving] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  const loadActions = useCallback(async () => {
    try {
      const result = await window.electronAPI.momActions.getByMom(momInternalId)
      setActions(result as MomAction[])
    } catch (err) {
      console.error('Error loading actions:', err)
    } finally {
      setLoading(false)
    }
  }, [momInternalId])

  useEffect(() => {
    loadActions()
  }, [loadActions])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newDescription.trim()) return

    setCreating(true)
    try {
      const result = await window.electronAPI.momActions.create({
        mom_internal_id: momInternalId,
        description: newDescription.trim(),
        responsible_party: newResponsible.trim() || undefined,
        deadline: newDeadline || undefined,
        reminder_date: newReminder || undefined
      }, user.id)
      if (result.success) {
        setNewDescription('')
        setNewResponsible('')
        setNewDeadline('')
        setNewReminder('')
        setShowCreateForm(false)
        loadActions()
        onActionsChanged?.()
        notifyReminderDataChanged()
      } else {
        toast.error('Failed to create action', result.error)
      }
    } catch (err) {
      console.error('Error creating action:', err)
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (action: MomAction) => {
    setEditingId(action.id)
    setEditDescription(action.description)
    setEditResponsible(action.responsible_party || '')
    setEditDeadline(action.deadline || '')
    setEditReminder(action.reminder_date || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDescription('')
    setEditResponsible('')
    setEditDeadline('')
    setEditReminder('')
  }

  const handleSaveEdit = async (actionId: string) => {
    if (!user) return

    try {
      const result = await window.electronAPI.momActions.update(actionId, {
        description: editDescription.trim(),
        responsible_party: editResponsible.trim() || undefined,
        deadline: editDeadline || undefined,
        reminder_date: editReminder || undefined
      }, user.id)
      if (result.success) {
        cancelEdit()
        loadActions()
        onActionsChanged?.()
        notifyReminderDataChanged()
      } else {
        toast.error('Failed to update action', result.error)
      }
    } catch (err) {
      console.error('Error updating action:', err)
    }
  }

  const handleResolve = async () => {
    if (!user || !resolvingId || !resolveNote.trim()) return

    setResolving(true)
    try {
      const result = await window.electronAPI.momActions.resolve(resolvingId, {
        resolution_note: resolveNote.trim()
      }, user.id)
      if (result.success) {
        setResolvingId(null)
        setResolveNote('')
        loadActions()
        onActionsChanged?.()
        notifyReminderDataChanged()
      } else {
        toast.error('Failed to resolve action', result.error)
      }
    } catch (err) {
      console.error('Error resolving action:', err)
    } finally {
      setResolving(false)
    }
  }

  const handleReopen = async (actionId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.momActions.reopen(actionId, user.id)
      if (result.success) {
        loadActions()
        onActionsChanged?.()
        notifyReminderDataChanged()
      } else {
        toast.error('Failed to reopen action', result.error)
      }
    } catch (err) {
      console.error('Error reopening action:', err)
    }
  }

  const handleResolutionFileUpload = async (actionId: string) => {
    if (!user) return

    try {
      const result = await window.electronAPI.dialog.openFile({
        title: 'Select Resolution File',
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })

      if (!result || result.canceled || !result.files?.length) return

      const file = result.files[0]
      const uploadResult = await window.electronAPI.momActions.saveResolutionFile(
        actionId, file.buffer, file.filename, user.id
      )

      if (uploadResult.success) {
        loadActions()
      } else {
        toast.error('Failed to upload file', uploadResult.error)
      }
    } catch (err) {
      console.error('Error uploading resolution file:', err)
    }
  }

  const handleSetReminder = async (actionId: string, daysFromNow: number | null) => {
    if (!user) return

    const reminderDate = daysFromNow !== null
      ? new Date(Date.now() + daysFromNow * 86400000).toISOString().split('T')[0]
      : undefined

    try {
      const result = await window.electronAPI.momActions.update(actionId, {
        reminder_date: reminderDate
      }, user.id)
      if (result.success) {
        loadActions()
        onActionsChanged?.()
        notifyReminderDataChanged()
      }
    } catch (err) {
      console.error('Error setting reminder:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Create Action Form */}
      {showCreateForm ? (
        <form onSubmit={handleCreate} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Action description"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Responsible Party</label>
              <input
                type="text"
                value={newResponsible}
                onChange={(e) => setNewResponsible(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Who is responsible?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder Date</label>
            <input
              type="date"
              value={newReminder}
              onChange={(e) => setNewReminder(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating || !newDescription.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Add Action'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/50 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Action
        </button>
      )}

      {/* Search Box */}
      {actions.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Actions List */}
      {(() => {
        const filteredActions = actions.filter(action => {
          if (!searchQuery.trim()) return true
          const query = searchQuery.toLowerCase()
          return (
            action.description.toLowerCase().includes(query) ||
            action.responsible_party?.toLowerCase().includes(query) ||
            action.resolution_note?.toLowerCase().includes(query) ||
            action.status.toLowerCase().includes(query)
          )
        })

        if (loading) {
          return (
            <div className="flex justify-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
            </div>
          )
        }

        if (actions.length === 0) {
          return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No actions yet</p>
        }

        if (filteredActions.length === 0) {
          return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No actions match "{searchQuery}"</p>
        }

        return (
          <div className="space-y-2">
            {filteredActions.map((action) => {
            const isEditing = editingId === action.id
            const isResolving = resolvingId === action.id
            const overdue = action.status === 'open' && isOverdue(action.deadline)

            return (
              <div
                key={action.id}
                className={`p-3 rounded-lg border ${
                  overdue ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                } group`}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editResponsible}
                        onChange={(e) => setEditResponsible(e.target.value)}
                        placeholder="Responsible party"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <input
                      type="date"
                      value={editReminder}
                      onChange={(e) => setEditReminder(e.target.value)}
                      placeholder="Reminder"
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdit(action.id)}
                        disabled={!editDescription.trim()}
                        className="px-3 py-1 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isResolving ? (
                  /* Resolve mode */
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{action.description}</p>
                    <textarea
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Resolution note (required)"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResolve}
                        disabled={resolving || !resolveNote.trim()}
                        className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {resolving ? 'Resolving...' : 'Resolve'}
                      </button>
                      <button
                        onClick={() => handleResolutionFileUpload(action.id)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      >
                        Attach File
                      </button>
                      <button
                        onClick={() => { setResolvingId(null); setResolveNote('') }}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${action.status === 'resolved' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                          {action.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {/* Status pill */}
                          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            action.status === 'resolved'
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                              : overdue
                                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          }`}>
                            {action.status === 'resolved' ? 'Resolved' : overdue ? 'Overdue' : 'Open'}
                          </span>
                          {action.responsible_party && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              <svg className="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {action.responsible_party}
                            </span>
                          )}
                          {action.deadline && (
                            <span className={`text-xs ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                              Due: {formatDate(action.deadline)}
                            </span>
                          )}
                          {action.reminder_date && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-purple-600 dark:text-purple-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatDate(action.reminder_date, 'short')}
                            </span>
                          )}
                        </div>
                        {/* Resolution */}
                        {action.resolution_note && (
                          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300">
                            <span className="font-medium">Resolution:</span> {action.resolution_note}
                            {action.resolver_name && (
                              <span className="text-green-500 dark:text-green-400"> — {action.resolver_name}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {action.status === 'open' && (
                          <>
                            <button
                              onClick={() => startEdit(action)}
                              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setResolvingId(action.id); setResolveNote('') }}
                              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                              title="Resolve"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            {/* Reminder quick-set buttons */}
                            <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => handleSetReminder(action.id, 1)}
                                className="px-1 py-0.5 text-[10px] rounded text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                                title="Remind in 1 day"
                              >
                                +1d
                              </button>
                              <button
                                onClick={() => handleSetReminder(action.id, 7)}
                                className="px-1 py-0.5 text-[10px] rounded text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                                title="Remind in 1 week"
                              >
                                +1w
                              </button>
                              {action.reminder_date && (
                                <button
                                  onClick={() => handleSetReminder(action.id, null)}
                                  className="px-1 py-0.5 text-[10px] rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                  title="Clear reminder"
                                >
                                  CLR
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        {action.status === 'resolved' && (
                          <button
                            onClick={() => handleReopen(action.id)}
                            className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors"
                            title="Reopen"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
          </div>
        )
      })()}
    </div>
  )
}
