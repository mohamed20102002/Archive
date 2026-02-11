import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ReferenceForm } from './ReferenceForm'
import type { SecureReference, SecureReferenceFile, UpdateReferenceData } from '../../types'

const categoryColors: Record<string, string> = {
  General: 'bg-gray-100 text-gray-600',
  Policy: 'bg-red-100 text-red-700',
  Procedure: 'bg-blue-100 text-blue-700',
  Template: 'bg-green-100 text-green-700',
  Guide: 'bg-purple-100 text-purple-700',
  Other: 'bg-orange-100 text-orange-700'
}

interface ReferenceDetailProps {
  reference: SecureReference
  onClose: () => void
  onUpdated: () => void
}

export function ReferenceDetail({ reference, onClose, onUpdated }: ReferenceDetailProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [files, setFiles] = useState<SecureReferenceFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    try {
      const result = await window.electronAPI.secureReferences.getFiles(reference.id)
      setFiles(result as SecureReferenceFile[])
    } catch (err) {
      console.error('Error loading files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }, [reference.id])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleUpdate = async (data: UpdateReferenceData) => {
    if (!user) return
    try {
      const result = await window.electronAPI.secureReferences.update(reference.id, data, user.id)
      if (result.success) {
        setEditing(false)
        onUpdated()
      } else {
        toast.error('Error', result.error || 'Failed to update reference')
      }
    } catch (err) {
      console.error('Error updating reference:', err)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    try {
      const result = await window.electronAPI.secureReferences.delete(reference.id, user.id)
      if (result.success) {
        onClose()
        onUpdated()
      } else {
        toast.error('Error', result.error || 'Failed to delete reference')
      }
    } catch (err) {
      console.error('Error deleting reference:', err)
    }
  }

  const handleAddFile = async () => {
    if (!user) return
    try {
      const dialogResult = await window.electronAPI.dialog.openFile({
        title: 'Add File to Reference',
        filters: [{ name: 'All Files', extensions: ['*'] }],
        multiple: true
      })

      if (dialogResult.canceled || !dialogResult.files) return

      for (const file of dialogResult.files) {
        await window.electronAPI.secureReferences.addFile(
          reference.id,
          file.buffer,
          file.filename,
          user.id
        )
      }

      loadFiles()
      onUpdated()
    } catch (err) {
      console.error('Error adding file:', err)
    }
  }

  const handleOpenFile = async (fileId: string) => {
    try {
      const filePath = await window.electronAPI.secureReferences.getFilePath(fileId)
      if (filePath) {
        await window.electronAPI.file.openExternal(filePath)
      }
    } catch (err) {
      console.error('Error opening file:', err)
    }
  }

  const handleShowInFolder = async (fileId: string) => {
    try {
      const filePath = await window.electronAPI.secureReferences.getFilePath(fileId)
      if (filePath) {
        await window.electronAPI.file.showInFolder(filePath)
      }
    } catch (err) {
      console.error('Error showing in folder:', err)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.secureReferences.deleteFile(fileId, user.id)
      if (result.success) {
        setDeletingFileId(null)
        loadFiles()
        onUpdated()
      } else {
        toast.error('Error', result.error || 'Failed to delete file')
      }
    } catch (err) {
      console.error('Error deleting file:', err)
    }
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (editing) {
    return (
      <ReferenceForm
        reference={reference}
        onSubmit={(data) => handleUpdate(data as UpdateReferenceData)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const colorClass = categoryColors[reference.category] || categoryColors.General

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{reference.name}</h3>
          {reference.description && (
            <p className="text-sm text-gray-500 mt-1">{reference.description}</p>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {reference.category}
        </span>
      </div>

      {/* Files section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">
            Files ({files.length})
          </h4>
          <button
            onClick={handleAddFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add File
          </button>
        </div>

        {loadingFiles ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500">No files attached</p>
            <button
              onClick={handleAddFile}
              className="mt-2 text-xs text-primary-600 hover:text-primary-700"
            >
              Add the first file
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{file.filename}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.file_size)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenFile(file.id)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                    title="Open file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleShowInFolder(file.id)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                    title="Show in folder"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                  {deletingFileId === file.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="px-2 py-0.5 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingFileId(null)}
                        className="px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingFileId(file.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
        {reference.creator_name && <span>Created by {reference.creator_name}</span>}
        <span>Created {new Date(reference.created_at).toLocaleDateString()}</span>
        <span>Updated {new Date(reference.updated_at).toLocaleDateString()}</span>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600">Delete this reference and all files?</span>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            Delete
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
