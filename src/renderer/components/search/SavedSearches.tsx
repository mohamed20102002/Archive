import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'

interface SavedSearch {
  id: string
  name: string
  filters: string
  created_at: string
  updated_at: string
}

interface SavedSearchesProps {
  onLoadSearch: (filters: any) => void
  currentFilters: any
}

export function SavedSearches({ onLoadSearch, currentFilters }: SavedSearchesProps) {
  const { user } = useAuth()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSearches()
  }, [user?.id])

  async function loadSearches() {
    if (!user?.id) return
    try {
      const result = await window.electronAPI.advancedSearch.getSaved(user.id)
      setSearches(result as SavedSearch[])
    } catch (error) {
      console.error('Error loading saved searches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSearch = async () => {
    if (!saveName.trim() || !user?.id) return

    setSaving(true)
    try {
      const result = await window.electronAPI.advancedSearch.createSaved(
        user.id,
        saveName.trim(),
        currentFilters
      )
      if (result.success) {
        await loadSearches()
        setShowSaveDialog(false)
        setSaveName('')
      }
    } catch (error) {
      console.error('Error saving search:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSearch = async (id: string) => {
    const confirmed = await window.electronAPI.dialog.showMessage({
      type: 'question',
      title: 'Delete Saved Search',
      message: 'Are you sure you want to delete this saved search?',
      buttons: ['Cancel', 'Delete']
    })

    if (confirmed.response === 1) {
      try {
        await window.electronAPI.advancedSearch.deleteSaved(id)
        await loadSearches()
      } catch (error) {
        console.error('Error deleting search:', error)
      }
    }
  }

  const handleLoadSearch = (search: SavedSearch) => {
    try {
      const filters = JSON.parse(search.filters)
      onLoadSearch(filters)
    } catch (error) {
      console.error('Error parsing saved search filters:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Saved Searches</h3>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Save Current
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Enter search name..."
            className="input w-full mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveSearch}
              disabled={saving || !saveName.trim()}
              className="btn btn-primary btn-sm flex-1"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false)
                setSaveName('')
              }}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved Searches List */}
      {loading ? (
        <div className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          Loading...
        </div>
      ) : searches.length === 0 ? (
        <div className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          No saved searches yet
        </div>
      ) : (
        <ul className="space-y-2">
          {searches.map(search => (
            <li
              key={search.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group"
            >
              <button
                onClick={() => handleLoadSearch(search)}
                className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200 truncate"
              >
                {search.name}
              </button>
              <button
                onClick={() => handleDeleteSearch(search.id)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
