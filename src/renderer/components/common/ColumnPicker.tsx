/**
 * Column Picker Component
 *
 * Allows users to customize which columns are visible in tables/lists.
 * Supports drag-and-drop reordering and persistence.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export interface ColumnDefinition {
  id: string
  label: string
  defaultVisible?: boolean
  required?: boolean // Cannot be hidden
  width?: number
  minWidth?: number
  maxWidth?: number
}

export interface ColumnConfig {
  id: string
  visible: boolean
  width?: number
  order: number
}

interface ColumnPickerProps {
  columns: ColumnDefinition[]
  config: ColumnConfig[]
  onChange: (config: ColumnConfig[]) => void
  storageKey?: string
}

export function ColumnPicker({
  columns,
  config,
  onChange,
  storageKey
}: ColumnPickerProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [localConfig, setLocalConfig] = useState<ColumnConfig[]>(config)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sync local config with props
  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  // Save to localStorage if storageKey provided
  useEffect(() => {
    if (storageKey && localConfig.length > 0) {
      localStorage.setItem(`column-config-${storageKey}`, JSON.stringify(localConfig))
    }
  }, [localConfig, storageKey])

  const handleToggleColumn = useCallback((columnId: string) => {
    const column = columns.find(c => c.id === columnId)
    if (column?.required) return

    const newConfig = localConfig.map(c =>
      c.id === columnId ? { ...c, visible: !c.visible } : c
    )
    setLocalConfig(newConfig)
    onChange(newConfig)
  }, [columns, localConfig, onChange])

  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedItem(columnId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) return

    const draggedIndex = localConfig.findIndex(c => c.id === draggedItem)
    const targetIndex = localConfig.findIndex(c => c.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newConfig = [...localConfig]
    const [removed] = newConfig.splice(draggedIndex, 1)
    newConfig.splice(targetIndex, 0, removed)

    // Update order values
    const reordered = newConfig.map((c, index) => ({ ...c, order: index }))
    setLocalConfig(reordered)
  }, [draggedItem, localConfig])

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
    onChange(localConfig)
  }, [localConfig, onChange])

  const handleReset = useCallback(() => {
    const defaultConfig = columns.map((col, index) => ({
      id: col.id,
      visible: col.defaultVisible !== false,
      order: index
    }))
    setLocalConfig(defaultConfig)
    onChange(defaultConfig)
  }, [columns, onChange])

  const handleShowAll = useCallback(() => {
    const newConfig = localConfig.map(c => ({ ...c, visible: true }))
    setLocalConfig(newConfig)
    onChange(newConfig)
  }, [localConfig, onChange])

  const handleHideAll = useCallback(() => {
    const newConfig = localConfig.map(c => {
      const column = columns.find(col => col.id === c.id)
      return { ...c, visible: column?.required || false }
    })
    setLocalConfig(newConfig)
    onChange(newConfig)
  }, [columns, localConfig, onChange])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Sort config by order
  const sortedConfig = [...localConfig].sort((a, b) => a.order - b.order)

  const visibleCount = localConfig.filter(c => c.visible).length
  const totalCount = columns.length

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span>{t('columns.title', 'Columns')}</span>
        <span className="text-xs text-gray-400">({visibleCount}/{totalCount})</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
          style={{
            top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 8 : 0,
            left: buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 0
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {t('columns.customize', 'Customize Columns')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('columns.dragToReorder', 'Drag to reorder')}
            </p>
          </div>

          {/* Quick actions */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex gap-2">
            <button
              type="button"
              onClick={handleShowAll}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              {t('columns.showAll', 'Show all')}
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              type="button"
              onClick={handleHideAll}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              {t('columns.hideAll', 'Hide all')}
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              {t('columns.reset', 'Reset')}
            </button>
          </div>

          {/* Column list */}
          <div className="max-h-80 overflow-y-auto py-2">
            {sortedConfig.map(colConfig => {
              const column = columns.find(c => c.id === colConfig.id)
              if (!column) return null

              return (
                <div
                  key={colConfig.id}
                  draggable={!column.required}
                  onDragStart={(e) => handleDragStart(e, colConfig.id)}
                  onDragOver={(e) => handleDragOver(e, colConfig.id)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center gap-3 px-4 py-2 cursor-grab
                    ${draggedItem === colConfig.id ? 'opacity-50 bg-gray-100 dark:bg-gray-700' : ''}
                    ${column.required ? 'cursor-not-allowed opacity-75' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                  `}
                >
                  {/* Drag handle */}
                  <svg
                    className={`w-4 h-4 flex-shrink-0 ${column.required ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={colConfig.visible}
                    onChange={() => handleToggleColumn(colConfig.id)}
                    disabled={column.required}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                  />

                  {/* Label */}
                  <span className={`flex-1 text-sm ${colConfig.visible ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {column.label}
                    {column.required && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({t('columns.required', 'required')})
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * Hook to manage column configuration with localStorage persistence
 */
export function useColumnConfig(
  columns: ColumnDefinition[],
  storageKey: string
): [ColumnConfig[], (config: ColumnConfig[]) => void] {
  const [config, setConfig] = useState<ColumnConfig[]>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem(`column-config-${storageKey}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Invalid JSON, use default
      }
    }

    // Generate default config
    return columns.map((col, index) => ({
      id: col.id,
      visible: col.defaultVisible !== false,
      order: index
    }))
  })

  const updateConfig = useCallback((newConfig: ColumnConfig[]) => {
    setConfig(newConfig)
    localStorage.setItem(`column-config-${storageKey}`, JSON.stringify(newConfig))
  }, [storageKey])

  return [config, updateConfig]
}

/**
 * Get visible columns in order
 */
export function getVisibleColumns(
  columns: ColumnDefinition[],
  config: ColumnConfig[]
): ColumnDefinition[] {
  const sortedConfig = [...config].sort((a, b) => a.order - b.order)

  return sortedConfig
    .filter(c => c.visible)
    .map(c => columns.find(col => col.id === c.id))
    .filter((col): col is ColumnDefinition => col !== undefined)
}

export default ColumnPicker
