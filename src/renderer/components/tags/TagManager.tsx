import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { TagBadge } from './TagBadge'

interface Tag {
  id: string
  name: string
  color: string
  description: string | null
  created_at: string
}

export function TagManager() {
  const { user } = useAuth()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [formData, setFormData] = useState({ name: '', color: '#6B7280', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    try {
      const result = await window.electronAPI.tags.getAll()
      setTags(result as Tag[])
    } catch (err) {
      console.error('Error loading tags:', err)
    } finally {
      setLoading(false)
    }
  }

  const tagColors = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
    '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7', '#E11D48', '#64748B'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Tag name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingTag) {
        const result = await window.electronAPI.tags.update(editingTag.id, {
          name: formData.name,
          color: formData.color,
          description: formData.description || undefined
        }, user!.id)
        if (!result.success) {
          setError(result.error || 'Failed to update tag')
          return
        }
      } else {
        const result = await window.electronAPI.tags.create({
          name: formData.name,
          color: formData.color,
          description: formData.description || undefined
        }, user!.id)
        if (!result.success) {
          setError(result.error || 'Failed to create tag')
          return
        }
      }

      await loadTags()
      setShowForm(false)
      setEditingTag(null)
      setFormData({ name: '', color: '#6B7280', description: '' })
    } catch (err) {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (tag: Tag) => {
    const confirmed = await window.electronAPI.dialog.showMessage({
      type: 'question',
      title: 'Delete Tag',
      message: `Are you sure you want to delete the tag "${tag.name}"?`,
      detail: 'This will remove the tag from all associated items.',
      buttons: ['Cancel', 'Delete']
    })

    if (confirmed.response === 1) {
      try {
        await window.electronAPI.tags.delete(tag.id, user!.id)
        await loadTags()
      } catch (err) {
        console.error('Error deleting tag:', err)
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingTag(null)
    setFormData({ name: '', color: '#6B7280', description: '' })
    setError('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tag Manager</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create and manage tags for records, issues, and letters</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tag
        </button>
      </div>

      {showForm && (
        <div className="card p-4">
          <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
            {editingTag ? 'Edit Tag' : 'Create New Tag'}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="Enter tag name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {tagColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full"
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
              <div className="ml-auto">
                <span className="text-sm text-gray-500 dark:text-gray-400">Preview:</span>
                <span className="ml-2">
                  <TagBadge tag={{ id: 'preview', name: formData.name || 'Tag Name', color: formData.color }} />
                </span>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">All Tags ({tags.length})</h3>
        </div>
        {tags.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No tags created yet. Click "Add Tag" to create your first tag.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {tags.map(tag => (
              <li key={tag.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-4">
                  <TagBadge tag={tag} size="md" />
                  {tag.description && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{tag.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
