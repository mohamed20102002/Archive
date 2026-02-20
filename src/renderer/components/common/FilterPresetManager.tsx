/**
 * Filter Preset Manager Component
 *
 * Allows users to save, load, and manage filter presets for list views.
 * Can be integrated into any list component with filters.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

type EntityType = 'topics' | 'records' | 'letters' | 'moms' | 'issues' | 'contacts' | 'authorities' | 'attendance'

interface FilterPreset {
  id: string
  user_id: string
  entity_type: EntityType
  name: string
  filters: Record<string, unknown>
  is_default: boolean
  is_shared: boolean
  created_at: string
  updated_at: string
}

interface FilterPresetManagerProps {
  entityType: EntityType
  currentFilters: Record<string, unknown>
  onApplyPreset: (filters: Record<string, unknown>) => void
  className?: string
}

export function FilterPresetManager({
  entityType,
  currentFilters,
  onApplyPreset,
  className = ''
}: FilterPresetManagerProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Fetch presets
  const fetchPresets = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const results = await window.electronAPI.filterPresets.getAll(user.id, entityType)
      setPresets(results as FilterPreset[])

      // Set selected to default preset if exists
      const defaultPreset = results.find((p: any) => p.is_default)
      if (defaultPreset) {
        setSelectedPresetId((defaultPreset as FilterPreset).id)
      }
    } catch (error) {
      console.error('Error fetching presets:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, entityType])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  // Load default preset on mount
  useEffect(() => {
    if (!user?.id) return

    window.electronAPI.filterPresets.getDefault(user.id, entityType)
      .then((preset: any) => {
        if (preset) {
          onApplyPreset(preset.filters)
          setSelectedPresetId(preset.id)
        }
      })
      .catch(console.error)
  }, [user?.id, entityType]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePreset = async () => {
    if (!user?.id || !newPresetName.trim()) return

    try {
      const result = await window.electronAPI.filterPresets.create(
        user.id,
        entityType,
        newPresetName.trim(),
        currentFilters,
        isDefault,
        isShared
      )

      if (result.success) {
        showToast(t('presets.saved', 'Preset saved successfully'), 'success')
        setShowSaveDialog(false)
        setNewPresetName('')
        setIsDefault(false)
        setIsShared(false)
        fetchPresets()
      } else {
        showToast(result.error || t('presets.saveFailed', 'Failed to save preset'), 'error')
      }
    } catch (error) {
      console.error('Error saving preset:', error)
      showToast(t('presets.saveFailed', 'Failed to save preset'), 'error')
    }
  }

  const handleApplyPreset = (preset: FilterPreset) => {
    setSelectedPresetId(preset.id)
    onApplyPreset(preset.filters)
    setShowDropdown(false)
  }

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) return

    try {
      const result = await window.electronAPI.filterPresets.delete(id, user.id)
      if (result.success) {
        showToast(t('presets.deleted', 'Preset deleted'), 'success')
        fetchPresets()
        if (selectedPresetId === id) {
          setSelectedPresetId('')
        }
      }
    } catch (error) {
      console.error('Error deleting preset:', error)
    }
  }

  const handleSetDefault = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) return

    try {
      await window.electronAPI.filterPresets.setDefault(id, user.id, entityType)
      fetchPresets()
    } catch (error) {
      console.error('Error setting default:', error)
    }
  }

  const selectedPreset = presets.find(p => p.id === selectedPresetId)

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Preset Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">
              {selectedPreset ? selectedPreset.name : t('presets.selectPreset', 'Select Preset')}
            </span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loading ? (
                <div className="px-4 py-3 text-sm text-gray-500">{t('common.loading')}...</div>
              ) : presets.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  {t('presets.noPresets', 'No saved presets')}
                </div>
              ) : (
                <ul className="max-h-48 overflow-y-auto">
                  {presets.map((preset) => (
                    <li
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`
                        flex items-center justify-between px-4 py-2 text-sm cursor-pointer
                        hover:bg-gray-50 dark:hover:bg-gray-700/50
                        ${selectedPresetId === preset.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {preset.is_default && (
                          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        )}
                        {preset.is_shared && (
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        )}
                        <span className="text-gray-700 dark:text-gray-300 truncate">
                          {preset.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!preset.is_default && (
                          <button
                            onClick={(e) => handleSetDefault(preset.id, e)}
                            title={t('presets.setAsDefault', 'Set as default')}
                            className="p-1 text-gray-400 hover:text-yellow-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          title={t('common.delete')}
                          className="p-1 text-gray-400 hover:text-red-500"
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

              {/* Clear selection */}
              {selectedPresetId && (
                <button
                  onClick={() => {
                    setSelectedPresetId('')
                    setShowDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-gray-500 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  {t('presets.clearSelection', 'Clear selection')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Save Current Filters */}
        <button
          onClick={() => setShowSaveDialog(true)}
          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={t('presets.saveCurrentFilters', 'Save current filters')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('presets.savePreset', 'Save Filter Preset')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('presets.presetName', 'Preset Name')}
                </label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder={t('presets.enterName', 'Enter preset name...')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  {t('presets.setAsDefault', 'Set as default preset')}
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  {t('presets.shareWithTeam', 'Share with team')}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setNewPresetName('')
                  setIsDefault(false)
                  setIsShared(false)
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside handler for dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}

export default FilterPresetManager
