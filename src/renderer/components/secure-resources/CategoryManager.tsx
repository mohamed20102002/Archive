import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { ResourceCategory } from '../../types'

type CategoryType = 'credential' | 'reference'

interface CategoryManagerProps {
  type: CategoryType
  onClose: () => void
  onCategoriesUpdated: () => void
}

export function CategoryManager({ type, onClose, onCategoriesUpdated }: CategoryManagerProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('')

  const loadCategories = async () => {
    try {
      setLoading(true)
      const result = await window.electronAPI.categories.getByType(type)
      setCategories(result as ResourceCategory[])
    } catch (err) {
      console.error('Error loading categories:', err)
      toast.error('Error', 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [type])

  const handleCreateCategory = async () => {
    if (!user || !newCategoryName.trim()) return

    try {
      const result = await window.electronAPI.categories.create(
        { name: newCategoryName.trim(), type },
        user.id
      )
      if (result.success) {
        setNewCategoryName('')
        loadCategories()
        onCategoriesUpdated()
        toast.success('Success', 'Category created')
      } else {
        toast.error('Error', result.error || 'Failed to create category')
      }
    } catch (err) {
      console.error('Error creating category:', err)
      toast.error('Error', 'Failed to create category')
    }
  }

  const handleStartEdit = (category: ResourceCategory) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleSaveEdit = async () => {
    if (!user || !editingId || !editingName.trim()) return

    try {
      const result = await window.electronAPI.categories.update(
        editingId,
        { name: editingName.trim() },
        user.id
      )
      if (result.success) {
        setEditingId(null)
        setEditingName('')
        loadCategories()
        onCategoriesUpdated()
        toast.success('Success', 'Category updated')
      } else {
        toast.error('Error', result.error || 'Failed to update category')
      }
    } catch (err) {
      console.error('Error updating category:', err)
      toast.error('Error', 'Failed to update category')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleStartDelete = (categoryId: string) => {
    setDeletingId(categoryId)
    // Set default reassign target to first category that isn't being deleted
    const defaultTarget = categories.find(c => c.id !== categoryId)
    if (defaultTarget) setReassignTo(defaultTarget.id)
  }

  const handleConfirmDelete = async () => {
    if (!user || !deletingId || !reassignTo) return

    try {
      const result = await window.electronAPI.categories.delete(deletingId, reassignTo, user.id)
      if (result.success) {
        setDeletingId(null)
        setReassignTo('')
        loadCategories()
        onCategoriesUpdated()
        toast.success('Success', 'Category deleted and resources reassigned')
      } else {
        toast.error('Error', result.error || 'Failed to delete category')
      }
    } catch (err) {
      console.error('Error deleting category:', err)
      toast.error('Error', 'Failed to delete category')
    }
  }

  const handleCancelDelete = () => {
    setDeletingId(null)
    setReassignTo('')
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0 || !user) return
    const newOrder = [...categories]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp

    try {
      const result = await window.electronAPI.categories.reorder(
        newOrder.map(c => c.id),
        user.id
      )
      if (result.success) {
        loadCategories()
        onCategoriesUpdated()
      }
    } catch (err) {
      console.error('Error reordering categories:', err)
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index === categories.length - 1 || !user) return
    const newOrder = [...categories]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp

    try {
      const result = await window.electronAPI.categories.reorder(
        newOrder.map(c => c.id),
        user.id
      )
      if (result.success) {
        loadCategories()
        onCategoriesUpdated()
      }
    } catch (err) {
      console.error('Error reordering categories:', err)
    }
  }

  const typeLabel = type === 'credential' ? 'Credential' : 'Reference'

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Manage {typeLabel.toLowerCase()} categories. Categories are used to organize your {typeLabel.toLowerCase()}s.
      </p>

      {/* Add new category */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder={`New ${typeLabel.toLowerCase()} category...`}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateCategory()
          }}
        />
        <button
          onClick={handleCreateCategory}
          disabled={!newCategoryName.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {/* Category list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No categories found. Add one above.
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {categories.map((category, index) => (
            <div
              key={category.id}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === categories.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Category name */}
              <div className="flex-1">
                {editingId === category.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-2 py-1 border border-primary-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    autoFocus
                  />
                ) : deletingId === category.id ? (
                  <div className="text-sm">
                    <span className="text-red-600 font-medium">Delete "{category.name}"?</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Reassign to:</span>
                      <select
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-300 rounded"
                      >
                        {categories.filter(c => c.id !== category.id).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                )}
              </div>

              {/* Action buttons */}
              {editingId === category.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                    title="Save"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                    title="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : deletingId === category.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={categories.length <= 1}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Confirm delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                    title="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleStartEdit(category)}
                    className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleStartDelete(category.id)}
                    disabled={categories.length <= 1}
                    className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={categories.length <= 1 ? 'Cannot delete last category' : 'Delete'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Close button */}
      <div className="flex justify-end pt-2 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
