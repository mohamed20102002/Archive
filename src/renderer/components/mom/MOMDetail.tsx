import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { useSettings } from '../../context/SettingsContext'
import { useUndoRedo } from '../../context/UndoRedoContext'
import { MOMForm } from './MOMForm'
import { MOMActions } from './MOMActions'
import { MOMDrafts } from './MOMDrafts'
import { MOMTopicLinks } from './MOMTopicLinks'
import { MOMTimeline } from './MOMTimeline'
import type { Mom, MomHistory, UpdateMomData } from '../../types'

interface MOMDetailProps {
  mom: Mom
  onClose: () => void
  onUpdated: () => void
}

type DetailTab = 'actions' | 'drafts' | 'links' | 'history'

export function MOMDetail({ mom, onClose, onUpdated }: MOMDetailProps) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { formatDate } = useSettings()
  const { recordOperation } = useUndoRedo()
  const [currentMom, setCurrentMom] = useState<Mom>(mom)
  const [activeTab, setActiveTab] = useState<DetailTab>('actions')
  const [isEditing, setIsEditing] = useState(false)
  const [history, setHistory] = useState<MomHistory[]>([])
  const [copied, setCopied] = useState(false)

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(currentMom.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const refreshMom = useCallback(async () => {
    try {
      const result = await window.electronAPI.moms.getById(mom.id)
      if (result) {
        setCurrentMom(result as Mom)
      }
    } catch (err) {
      console.error('Error refreshing MOM:', err)
    }
  }, [mom.id])

  const loadHistory = useCallback(async () => {
    try {
      const result = await window.electronAPI.moms.getHistory(mom.id)
      setHistory(result as MomHistory[])
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }, [mom.id])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleUpdate = async (data: UpdateMomData) => {
    if (!user) return
    try {
      // Capture before state for undo
      const beforeData = await window.electronAPI.history.getEntity('mom', currentMom.id)

      const result = await window.electronAPI.moms.update(currentMom.id, data, user.id)
      if (result.success) {
        // Save tags if provided
        if (data.tag_ids !== undefined) {
          await window.electronAPI.tags.setMomTags(currentMom.id, data.tag_ids || [], user.id)
        }

        // Capture after state for undo/redo
        const afterData = await window.electronAPI.history.getEntity('mom', currentMom.id)

        // Record operation for undo/redo
        if (beforeData) {
          recordOperation({
            operation: 'update',
            entityType: 'mom',
            entityId: currentMom.id,
            description: `Update MOM "${data.title || currentMom.title}"`,
            beforeState: {
              entityType: 'mom',
              entityId: currentMom.id,
              data: beforeData
            },
            afterState: afterData ? {
              entityType: 'mom',
              entityId: currentMom.id,
              data: afterData
            } : null,
            userId: user.id
          })
        }

        setIsEditing(false)
        refreshMom()
        loadHistory()
        onUpdated()
      } else {
        toast.error('Failed to update MOM', result.error)
      }
    } catch (err) {
      console.error('Error updating MOM:', err)
    }
  }

  const handleClose = async () => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Close MOM',
      message: 'Close this MOM?',
      confirmText: 'Close'
    })
    if (!confirmed) return
    try {
      const result = await window.electronAPI.moms.close(currentMom.id, user.id)
      if (result.success) {
        refreshMom()
        loadHistory()
        onUpdated()
      } else {
        toast.error('Failed to close MOM', result.error)
      }
    } catch (err) {
      console.error('Error closing MOM:', err)
    }
  }

  const handleReopen = async () => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.reopen(currentMom.id, user.id)
      if (result.success) {
        refreshMom()
        loadHistory()
        onUpdated()
      } else {
        toast.error('Failed to reopen MOM', result.error)
      }
    } catch (err) {
      console.error('Error reopening MOM:', err)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete MOM',
      message: `Delete MOM "${currentMom.mom_id || currentMom.title}"? This action is irreversible.`,
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return
    try {
      // Capture before state for undo
      const beforeData = await window.electronAPI.history.getEntity('mom', currentMom.id)

      const result = await window.electronAPI.moms.delete(currentMom.id, user.id)
      if (result.success) {
        // Record operation for undo/redo
        if (beforeData) {
          recordOperation({
            operation: 'delete',
            entityType: 'mom',
            entityId: currentMom.id,
            description: `Delete MOM "${currentMom.mom_id || currentMom.title}"`,
            beforeState: {
              entityType: 'mom',
              entityId: currentMom.id,
              data: beforeData
            },
            afterState: null,
            userId: user.id
          })
        }

        onUpdated()
        onClose()
      } else {
        toast.error('Failed to delete MOM', result.error)
      }
    } catch (err) {
      console.error('Error deleting MOM:', err)
    }
  }

  const handleFileUpload = async () => {
    if (!user) return
    try {
      const result = await window.electronAPI.dialog.openFile({
        title: 'Select MOM File',
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })

      if (!result || result.canceled || !result.files?.length) return

      const file = result.files[0]
      const uploadResult = await window.electronAPI.moms.saveFile(
        currentMom.id, file.buffer, file.filename, user.id
      )

      if (uploadResult.success) {
        refreshMom()
        loadHistory()
        onUpdated()
      } else {
        toast.error('Failed to upload file', uploadResult.error)
      }
    } catch (err) {
      console.error('Error uploading file:', err)
    }
  }

  const handleOpenFile = async () => {
    try {
      const filePath = await window.electronAPI.moms.getFilePath(currentMom.id)
      if (filePath) {
        await window.electronAPI.file.openExternal(filePath)
      }
    } catch (err) {
      console.error('Error opening file:', err)
    }
  }

  const handleActionsChanged = () => {
    refreshMom()
    loadHistory()
    onUpdated()
  }

  if (isEditing) {
    return (
      <MOMForm
        mom={currentMom}
        onSubmit={(data) => handleUpdate(data as UpdateMomData)}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  const isOpen = currentMom.status === 'open'
  const actionTotal = currentMom.action_total || 0
  const actionResolved = currentMom.action_resolved || 0
  const actionOverdue = currentMom.action_overdue || 0
  const actionOpen = actionTotal - actionResolved

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
              {currentMom.id.slice(0, 8)}
              <button
                onClick={handleCopyId}
                className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
                title="Copy MOM ID"
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </span>
            {currentMom.mom_id && (
              <span className="inline-flex px-2 py-0.5 text-xs font-mono font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {currentMom.mom_id}
              </span>
            )}
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
              isOpen ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {currentMom.status}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentMom.title}</h2>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isOpen ? (
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          ) : (
            <button
              onClick={handleReopen}
              className="px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
            >
              Reopen
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {currentMom.subject && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Subject</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{currentMom.subject}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Meeting Date</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
            {currentMom.meeting_date ? formatDate(currentMom.meeting_date) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Location</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{currentMom.location_name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Creator</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{currentMom.creator_name || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">File</p>
          {currentMom.original_filename ? (
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={handleOpenFile}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1 min-w-0"
                title={currentMom.original_filename}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="truncate max-w-[150px]">{currentMom.original_filename}</span>
              </button>
              <button
                onClick={() => window.electronAPI.moms.showInFolder(currentMom.id)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Open folder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={handleFileUpload}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-0.5"
            >
              Upload file
            </button>
          )}
        </div>
      </div>

      {/* Action Summary */}
      {actionTotal > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{actionTotal}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2 text-center">
            <p className="text-xs text-green-600 dark:text-green-400">Resolved</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{actionResolved}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400">Open</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{actionOpen}</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${actionOverdue > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
            <p className={`text-xs ${actionOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Overdue</p>
            <p className={`text-lg font-bold ${actionOverdue > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'}`}>{actionOverdue}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1">
          {(['actions', 'drafts', 'links', 'history'] as DetailTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === 'actions' && (
          <MOMActions
            momInternalId={currentMom.id}
            momId={currentMom.mom_id}
            onActionsChanged={handleActionsChanged}
          />
        )}
        {activeTab === 'drafts' && (
          <MOMDrafts
            momInternalId={currentMom.id}
            onDraftChanged={() => { refreshMom(); loadHistory() }}
          />
        )}
        {activeTab === 'links' && (
          <MOMTopicLinks
            momInternalId={currentMom.id}
            onLinksChanged={() => { refreshMom(); loadHistory(); onUpdated() }}
          />
        )}
        {activeTab === 'history' && (
          <MOMTimeline history={history} />
        )}
      </div>
    </div>
  )
}
