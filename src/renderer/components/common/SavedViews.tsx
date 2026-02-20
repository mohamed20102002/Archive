/**
 * Saved Views Component
 *
 * UI for managing saved views - selecting, creating, updating, and deleting views.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export interface ViewConfig {
  filters: any[]
  sorts: any[]
  columns?: any[]
  groupBy?: string
  pageSize?: number
  customSettings?: Record<string, any>
}

export interface SavedView {
  id: number
  name: string
  entity_type: string
  config: ViewConfig
  is_default: boolean
  is_shared: boolean
  created_by: number
  created_at: string
  updated_at: string
}

interface SavedViewsProps {
  entityType: string
  currentConfig: ViewConfig
  onApplyView: (config: ViewConfig) => void
  onConfigChange?: (config: ViewConfig) => void
}

export function SavedViews({
  entityType,
  currentConfig,
  onApplyView,
  onConfigChange
}: SavedViewsProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()

  const [views, setViews] = useState<SavedView[]>([])
  const [selectedView, setSelectedView] = useState<SavedView | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Load views
  const loadViews = useCallback(async () => {
    if (!user) return

    try {
      const result = await window.electronAPI.views.getViews(entityType, user.id)
      setViews(result)

      // Load default view if none selected
      if (!selectedView) {
        const defaultView = result.find(v => v.is_default)
        if (defaultView) {
          setSelectedView(defaultView)
          onApplyView(defaultView.config)
        }
      }
    } catch (err) {
      console.error('Failed to load views:', err)
    }
  }, [entityType, user, selectedView, onApplyView])

  useEffect(() => {
    loadViews()
  }, [loadViews])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const handleSelectView = useCallback((view: SavedView) => {
    setSelectedView(view)
    onApplyView(view.config)
    setIsDropdownOpen(false)
  }, [onApplyView])

  const handleSaveView = useCallback(async () => {
    if (!user || !newViewName.trim()) return

    setIsLoading(true)
    try {
      const newView = await window.electronAPI.views.createView({
        name: newViewName.trim(),
        entity_type: entityType,
        config: currentConfig,
        is_default: isDefault,
        is_shared: isShared,
        created_by: user.id
      })

      setViews(prev => [...prev, newView])
      setSelectedView(newView)
      setIsSaveDialogOpen(false)
      setNewViewName('')
      setIsDefault(false)
      setIsShared(false)
      showSuccess(t('views.saved', 'View saved successfully'))
    } catch (err) {
      showError(t('views.saveFailed', 'Failed to save view'))
    } finally {
      setIsLoading(false)
    }
  }, [user, newViewName, entityType, currentConfig, isDefault, isShared, showSuccess, showError, t])

  const handleUpdateView = useCallback(async () => {
    if (!user || !selectedView) return

    setIsLoading(true)
    try {
      const updated = await window.electronAPI.views.updateView(
        selectedView.id,
        { config: currentConfig },
        user.id
      )

      setViews(prev => prev.map(v => v.id === updated.id ? updated : v))
      setSelectedView(updated)
      showSuccess(t('views.updated', 'View updated'))
    } catch (err) {
      showError(t('views.updateFailed', 'Failed to update view'))
    } finally {
      setIsLoading(false)
    }
  }, [user, selectedView, currentConfig, showSuccess, showError, t])

  const handleDeleteView = useCallback(async (viewId: number) => {
    if (!user) return

    if (!window.confirm(t('views.confirmDelete', 'Are you sure you want to delete this view?'))) {
      return
    }

    try {
      await window.electronAPI.views.deleteView(viewId, user.id)
      setViews(prev => prev.filter(v => v.id !== viewId))
      if (selectedView?.id === viewId) {
        setSelectedView(null)
      }
      showSuccess(t('views.deleted', 'View deleted'))
    } catch (err) {
      showError(t('views.deleteFailed', 'Failed to delete view'))
    }
  }, [user, selectedView, showSuccess, showError, t])

  const handleSetDefault = useCallback(async (viewId: number) => {
    if (!user) return

    try {
      const updated = await window.electronAPI.views.updateView(
        viewId,
        { is_default: true },
        user.id
      )

      setViews(prev => prev.map(v => ({
        ...v,
        is_default: v.id === viewId
      })))
      showSuccess(t('views.setDefault', 'View set as default'))
    } catch (err) {
      showError(t('views.setDefaultFailed', 'Failed to set default view'))
    }
  }, [user, showSuccess, showError, t])

  const handleToggleShare = useCallback(async (view: SavedView) => {
    if (!user || view.created_by !== user.id) return

    try {
      const updated = await window.electronAPI.views.toggleShare(view.id, user.id)
      setViews(prev => prev.map(v => v.id === updated.id ? updated : v))
      showSuccess(updated.is_shared
        ? t('views.shared', 'View shared with team')
        : t('views.unshared', 'View is now private')
      )
    } catch (err) {
      showError(t('views.shareFailed', 'Failed to update sharing'))
    }
  }, [user, showSuccess, showError, t])

  const handleClearView = useCallback(() => {
    setSelectedView(null)
    onApplyView({
      filters: [],
      sorts: []
    })
  }, [onApplyView])

  return (
    <div className="relative flex items-center gap-2">
      {/* View selector */}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="text-gray-700 dark:text-gray-200">
            {selectedView ? selectedView.name : t('views.selectView', 'Select View')}
          </span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
            style={{
              top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 8 : 0,
              left: buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 0
            }}
          >
            {/* View list */}
            <div className="max-h-64 overflow-y-auto">
              {views.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('views.noViews', 'No saved views')}
                </div>
              ) : (
                views.map(view => (
                  <div
                    key={view.id}
                    className={`
                      flex items-center gap-2 px-3 py-2 cursor-pointer
                      ${selectedView?.id === view.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    `}
                    onClick={() => handleSelectView(view)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {view.name}
                        </span>
                        {view.is_default && (
                          <span className="text-xs px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                            {t('views.default', 'Default')}
                          </span>
                        )}
                        {view.is_shared && (
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {!view.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(view.id)}
                          className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                          title={t('views.setAsDefault', 'Set as default')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      {view.created_by === user?.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleShare(view)}
                            className={`p-1 ${view.is_shared ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-primary-600 dark:hover:text-primary-400'}`}
                            title={view.is_shared ? t('views.unshare', 'Make private') : t('views.share', 'Share with team')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteView(view.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title={t('common.delete', 'Delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false)
                  setIsSaveDialogOpen(true)
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('views.saveNew', 'Save as New')}
              </button>
              {selectedView && (
                <button
                  type="button"
                  onClick={handleClearView}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('views.clear', 'Clear')}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Update current view button */}
      {selectedView && selectedView.created_by === user?.id && (
        <button
          type="button"
          onClick={handleUpdateView}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title={t('views.updateCurrent', 'Update current view')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
      )}

      {/* Save dialog */}
      {isSaveDialogOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('views.saveView', 'Save View')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('views.viewName', 'View Name')}
                </label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder={t('views.enterName', 'Enter view name...')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('views.setAsDefault', 'Set as default')}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('views.shareWithTeam', 'Share with team')}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsSaveDialogOpen(false)
                  setNewViewName('')
                  setIsDefault(false)
                  setIsShared(false)
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveView}
                disabled={!newViewName.trim() || isLoading}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SavedViews
