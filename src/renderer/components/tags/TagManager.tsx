import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { TagBadge } from './TagBadge'

interface Tag {
  id: string
  name: string
  color: string
  description: string | null
  created_by: string
  created_at: string
}

interface TagWithStats extends Tag {
  record_count: number
  letter_count: number
  issue_count: number
  mom_count: number
  total_count: number
  creator_name?: string
}

export function TagManager() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [tags, setTags] = useState<TagWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<TagWithStats | null>(null)
  const [formData, setFormData] = useState({ name: '', color: '#6B7280', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    try {
      setLoading(true)
      const result = await window.electronAPI.tags.getAll() as Tag[]

      // Get usage counts for each tag
      const tagsWithStats: TagWithStats[] = await Promise.all(
        result.map(async (tag) => {
          const [records, letters, issues, moms] = await Promise.all([
            window.electronAPI.tags.getRecordsByTag(tag.id).catch(() => []),
            window.electronAPI.tags.getLettersByTag(tag.id).catch(() => []),
            window.electronAPI.tags.getIssuesByTag(tag.id).catch(() => []),
            window.electronAPI.tags.getMomsByTag(tag.id).catch(() => [])
          ])

          // Try to get creator name
          let creatorName = 'Unknown'
          if (tag.created_by) {
            try {
              const creator = await window.electronAPI.auth.getUserById(tag.created_by)
              if (creator) {
                creatorName = creator.display_name || creator.username || 'Unknown'
              }
            } catch (e) {
              console.error('Error fetching creator:', e)
            }
          }

          return {
            ...tag,
            record_count: (records as any[]).length,
            letter_count: (letters as any[]).length,
            issue_count: (issues as any[]).length,
            mom_count: (moms as any[]).length,
            total_count: (records as any[]).length + (letters as any[]).length + (issues as any[]).length + (moms as any[]).length,
            creator_name: creatorName
          }
        })
      )

      // Sort by total usage (most used first), then by name
      tagsWithStats.sort((a, b) => {
        if (b.total_count !== a.total_count) {
          return b.total_count - a.total_count
        }
        return a.name.localeCompare(b.name)
      })

      setTags(tagsWithStats)
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

    if (!user) {
      setError('No user logged in')
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
        }, user.id)
        if (!result.success) {
          setError(result.error || 'Failed to update tag')
          setSaving(false)
          return
        }
        toast.success('Tag updated successfully')
      } else {
        const result = await window.electronAPI.tags.create({
          name: formData.name,
          color: formData.color,
          description: formData.description || undefined
        }, user.id)
        if (!result.success) {
          setError(result.error || 'Failed to create tag')
          setSaving(false)
          return
        }
        toast.success('Tag created successfully')
      }

      await loadTags()
      setShowForm(false)
      setEditingTag(null)
      setFormData({ name: '', color: '#6B7280', description: '' })
    } catch (err) {
      setError('An error occurred: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (tag: TagWithStats) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (tag: TagWithStats) => {
    const message = tag.total_count > 0
      ? `This tag is used by ${tag.total_count} item(s). This will remove the tag from all associated items.`
      : `This action cannot be undone.`

    const confirmed = await confirm({
      title: 'Delete Tag',
      message: `Are you sure you want to delete "${tag.name}"?`,
      description: message,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    })

    if (confirmed) {
      try {
        await window.electronAPI.tags.delete(tag.id, user!.id)
        toast.success('Tag deleted successfully')
        await loadTags()
      } catch (err) {
        console.error('Error deleting tag:', err)
        toast.error('Failed to delete tag')
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingTag(null)
    setFormData({ name: '', color: '#6B7280', description: '' })
    setError('')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tags.length} tag{tags.length !== 1 ? 's' : ''} total
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tag
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
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
                autoFocus
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

      {tags.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          No tags created yet. Click "Add Tag" to create your first tag.
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tag
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Letters
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issues
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MOMs
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {tags.map(tag => (
                <tr key={tag.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TagBadge tag={tag} size="md" />
                      {tag.description && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[150px]" title={tag.description}>
                          {tag.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-medium ${
                      tag.record_count > 0
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                    }`}>
                      {tag.record_count}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-medium ${
                      tag.letter_count > 0
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                    }`}>
                      {tag.letter_count}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-medium ${
                      tag.issue_count > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                    }`}>
                      {tag.issue_count}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full text-xs font-medium ${
                      tag.mom_count > 0
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                    }`}>
                      {tag.mom_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {tag.creator_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(tag.created_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(tag)}
                        className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(tag)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
