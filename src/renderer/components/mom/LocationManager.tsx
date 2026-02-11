import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import type { MomLocation } from '../../types'

interface LocationManagerProps {
  onClose: () => void
  onLocationCreated?: (location: MomLocation) => void
}

export function LocationManager({ onClose, onLocationCreated }: LocationManagerProps) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [locations, setLocations] = useState<MomLocation[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const loadLocations = useCallback(async () => {
    try {
      const result = await window.electronAPI.momLocations.getAll()
      setLocations(result as MomLocation[])
    } catch (err) {
      console.error('Error loading locations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  const resetForm = () => {
    setName('')
    setDescription('')
    setSortOrder(0)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (loc: MomLocation) => {
    setEditingId(loc.id)
    setName(loc.name)
    setDescription(loc.description || '')
    setSortOrder(loc.sort_order)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return

    setSubmitting(true)
    try {
      if (editingId) {
        const result = await window.electronAPI.momLocations.update(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          sort_order: sortOrder
        }, user.id)
        if (!result.success) {
          toast.error('Failed to update location', result.error)
          return
        }
      } else {
        const result = await window.electronAPI.momLocations.create({
          name: name.trim(),
          description: description.trim() || undefined,
          sort_order: sortOrder
        }, user.id)
        if (result.success && result.location) {
          onLocationCreated?.(result.location as MomLocation)
        } else {
          toast.error('Failed to create location', result.error)
          return
        }
      }
      resetForm()
      loadLocations()
    } catch (err) {
      console.error('Error saving location:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (loc: MomLocation) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Location',
      message: `Delete location "${loc.name}"?`,
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.momLocations.delete(loc.id, user.id)
      if (!result.success) {
        toast.error('Failed to delete location', result.error)
        return
      }
      loadLocations()
    } catch (err) {
      console.error('Error deleting location:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Manage Locations</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={resetForm}
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
          Add Location
        </button>
      )}

      {/* Locations List */}
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : locations.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No locations yet</p>
      ) : (
        <div className="space-y-1">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                {loc.description && (
                  <p className="text-xs text-gray-500 truncate">{loc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(loc)}
                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(loc)}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
