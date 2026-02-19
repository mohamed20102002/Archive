import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { useSettings } from '../../context/SettingsContext'
import type { MomDraft } from '../../types'

interface MOMDraftsProps {
  momInternalId: string
  onDraftChanged?: () => void
}

export function MOMDrafts({ momInternalId, onDraftChanged }: MOMDraftsProps) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { formatDate } = useSettings()
  const [drafts, setDrafts] = useState<MomDraft[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadDrafts = useCallback(async () => {
    try {
      const result = await window.electronAPI.momDrafts.getByMom(momInternalId)
      setDrafts(result as MomDraft[])
    } catch (err) {
      console.error('Error loading drafts:', err)
    } finally {
      setLoading(false)
    }
  }, [momInternalId])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return

    setSubmitting(true)
    try {
      const result = await window.electronAPI.momDrafts.create({
        mom_internal_id: momInternalId,
        title: title.trim(),
        description: description.trim() || undefined
      }, user.id)
      if (result.success) {
        setTitle('')
        setDescription('')
        setShowForm(false)
        loadDrafts()
        onDraftChanged?.()
      } else {
        toast.error('Failed to create draft', result.error)
      }
    } catch (err) {
      console.error('Error creating draft:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileUpload = async (draftId: string) => {
    if (!user) return

    try {
      const result = await window.electronAPI.dialog.openFile({
        title: 'Select Draft File',
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })

      if (!result || result.canceled || !result.files?.length) return

      const file = result.files[0]
      const uploadResult = await window.electronAPI.momDrafts.saveFile(
        draftId, file.buffer, file.filename, user.id
      )

      if (uploadResult.success) {
        loadDrafts()
      } else {
        toast.error('Failed to upload file', uploadResult.error)
      }
    } catch (err) {
      console.error('Error uploading draft file:', err)
    }
  }

  const handleOpenFile = async (draftId: string) => {
    try {
      const filePath = await window.electronAPI.momDrafts.getFilePath(draftId)
      if (filePath) {
        await window.electronAPI.file.openExternal(filePath)
      }
    } catch (err) {
      console.error('Error opening file:', err)
    }
  }

  const handleDelete = async (draft: MomDraft) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Draft',
      message: `Delete draft v${draft.version}: "${draft.title}"?`,
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.momDrafts.delete(draft.id, user.id)
      if (result.success) {
        loadDrafts()
        onDraftChanged?.()
      } else {
        toast.error('Failed to delete draft', result.error)
      }
    } catch (err) {
      console.error('Error deleting draft:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add Draft */}
      {showForm ? (
        <form onSubmit={handleCreate} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Draft title"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Add Draft'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setTitle(''); setDescription('') }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Draft
        </button>
      )}

      {/* Drafts List */}
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No drafts yet</p>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <div key={draft.id} className="p-3 bg-white rounded-lg border border-gray-200 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-100 text-indigo-700">
                      v{draft.version}
                    </span>
                    <h4 className="text-sm font-medium text-gray-900 truncate">{draft.title}</h4>
                  </div>
                  {draft.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-1">{draft.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{draft.creator_name || 'Unknown'}</span>
                    <span>{formatDate(draft.created_at)}</span>
                    {draft.original_filename && (
                      <>
                        <span className="inline-flex items-center gap-1 text-blue-600 cursor-pointer hover:text-blue-700"
                          onClick={() => handleOpenFile(draft.id)}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {draft.original_filename}
                        </span>
                        <button
                          onClick={() => window.electronAPI.momDrafts.showInFolder(draft.id)}
                          className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                          title="Open folder"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!draft.original_filename && (
                    <button
                      onClick={() => handleFileUpload(draft.id)}
                      className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Upload file"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(draft)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete draft"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
