import React, { useState } from 'react'
import { Modal } from '../common/Modal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { Subcategory } from '../../types'

interface SubcategoryManagerProps {
  topicId: string
  subcategories: Subcategory[]
  onClose: () => void
  onUpdate: () => void
}

export function SubcategoryManager({ topicId, subcategories, onClose, onUpdate }: SubcategoryManagerProps) {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newTitle.trim()) return

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.subcategories.create(
        {
          topic_id: topicId,
          title: newTitle.trim(),
          description: newDescription.trim() || undefined
        },
        user.id
      )

      if (result.success) {
        success('Subcategory created')
        setNewTitle('')
        setNewDescription('')
        onUpdate()
      } else {
        error('Failed to create subcategory', result.error)
      }
    } catch (err: any) {
      error('Failed to create subcategory', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!user || !editTitle.trim()) return

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.subcategories.update(
        id,
        {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined
        },
        user.id
      )

      if (result.success) {
        success('Subcategory updated')
        setEditingId(null)
        onUpdate()
      } else {
        error('Failed to update subcategory', result.error)
      }
    } catch (err: any) {
      error('Failed to update subcategory', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (subcategory: Subcategory) => {
    if (!user) return

    const recordCount = subcategory.record_count || 0
    const confirmMessage = recordCount > 0
      ? `Are you sure you want to delete "${subcategory.title}"? ${recordCount} record(s) will be moved to General.`
      : `Are you sure you want to delete "${subcategory.title}"?`

    if (!confirm(confirmMessage)) return

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.subcategories.delete(subcategory.id, user.id)

      if (result.success) {
        success('Subcategory deleted', recordCount > 0 ? `${recordCount} record(s) moved to General` : undefined)
        onUpdate()
      } else {
        error('Failed to delete subcategory', result.error)
      }
    } catch (err: any) {
      error('Failed to delete subcategory', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEditing = (subcategory: Subcategory) => {
    setEditingId(subcategory.id)
    setEditTitle(subcategory.title)
    setEditDescription(subcategory.description || '')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditTitle('')
    setEditDescription('')
  }

  return (
    <Modal title="Manage Subcategories" onClose={onClose} size="md">
      <div className="space-y-6">
        {/* Create New Subcategory */}
        <form onSubmit={handleCreate} className="space-y-4 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Add New Subcategory</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Subcategory title"
                className="input"
                disabled={isSubmitting}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !newTitle.trim()}
            >
              Add
            </button>
          </div>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="input"
            disabled={isSubmitting}
          />
        </form>

        {/* Existing Subcategories */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Existing Subcategories ({subcategories.length})
          </h3>

          {subcategories.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No subcategories yet. Add one above to organize records within this topic.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {subcategories.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 bg-gray-50 rounded-lg"
                >
                  {editingId === sub.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="input"
                        disabled={isSubmitting}
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description (optional)"
                        className="input"
                        disabled={isSubmitting}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdate(sub.id)}
                          className="btn-primary text-sm"
                          disabled={isSubmitting || !editTitle.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="btn-secondary text-sm"
                          disabled={isSubmitting}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{sub.title}</h4>
                          {sub.record_count !== undefined && sub.record_count > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                              {sub.record_count} record{sub.record_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {sub.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{sub.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditing(sub)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                          title="Edit"
                          disabled={isSubmitting}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sub)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                          disabled={isSubmitting}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
