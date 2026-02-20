/**
 * Inline Edit Components
 *
 * Provides inline editing capabilities for various field types.
 * Supports text, textarea, select, date, and status fields.
 * Saves on blur or Enter, cancels on Escape.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface InlineEditBaseProps {
  /** Current value */
  value: string
  /** Called when value is saved */
  onSave: (value: string) => Promise<void> | void
  /** Placeholder text */
  placeholder?: string
  /** Whether editing is disabled */
  disabled?: boolean
  /** Additional class names */
  className?: string
  /** Show loading indicator while saving */
  showLoading?: boolean
}

interface InlineTextEditProps extends InlineEditBaseProps {
  /** Input type */
  type?: 'text' | 'email' | 'url' | 'number'
  /** Maximum length */
  maxLength?: number
}

/**
 * Inline text edit component
 */
export function InlineTextEdit({
  value,
  onSave,
  placeholder = 'Click to edit...',
  disabled = false,
  className = '',
  showLoading = true,
  type = 'text',
  maxLength
}: InlineTextEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setEditValue(value) // Rollback
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, onSave])

  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
    setError(null)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  if (disabled) {
    return (
      <span className={`text-gray-500 dark:text-gray-400 ${className}`}>
        {value || placeholder}
      </span>
    )
  }

  if (isEditing) {
    return (
      <div className="relative inline-flex items-center gap-2">
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          disabled={isSaving}
          className={`
            px-2 py-1 text-sm border rounded-md
            bg-white dark:bg-gray-800
            border-primary-500 dark:border-primary-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:opacity-50
            ${className}
          `}
        />
        {showLoading && isSaving && (
          <div className="absolute right-2">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`
        inline-flex items-center gap-1 px-2 py-1 -mx-2 rounded-md
        hover:bg-gray-100 dark:hover:bg-gray-700/50
        transition-colors cursor-text text-left
        ${className}
      `}
    >
      <span className={value ? '' : 'text-gray-400 dark:text-gray-500 italic'}>
        {value || placeholder}
      </span>
      <svg
        className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  )
}

interface InlineTextareaEditProps extends InlineEditBaseProps {
  /** Number of rows */
  rows?: number
  /** Maximum length */
  maxLength?: number
}

/**
 * Inline textarea edit component
 */
export function InlineTextareaEdit({
  value,
  onSave,
  placeholder = 'Click to edit...',
  disabled = false,
  className = '',
  showLoading = true,
  rows = 3,
  maxLength
}: InlineTextareaEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setEditValue(value)
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, onSave])

  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
    setError(null)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
    // Ctrl+Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave, handleCancel])

  if (disabled) {
    return (
      <div className={`text-gray-500 dark:text-gray-400 whitespace-pre-wrap ${className}`}>
        {value || placeholder}
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={rows}
          maxLength={maxLength}
          disabled={isSaving}
          className={`
            w-full px-2 py-1 text-sm border rounded-md resize-none
            bg-white dark:bg-gray-800
            border-primary-500 dark:border-primary-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:opacity-50
            ${className}
          `}
        />
        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
          <span>Ctrl+Enter to save, Escape to cancel</span>
          {showLoading && isSaving && (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`
        block w-full px-2 py-1 -mx-2 rounded-md text-left
        hover:bg-gray-100 dark:hover:bg-gray-700/50
        transition-colors cursor-text whitespace-pre-wrap
        ${value ? '' : 'text-gray-400 dark:text-gray-500 italic'}
        ${className}
      `}
    >
      {value || placeholder}
    </button>
  )
}

interface InlineSelectEditProps extends InlineEditBaseProps {
  /** Available options */
  options: { value: string; label: string; color?: string }[]
}

/**
 * Inline select edit component
 */
export function InlineSelectEdit({
  value,
  onSave,
  options,
  disabled = false,
  className = '',
  showLoading = true
}: InlineSelectEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  const currentOption = options.find(o => o.value === value)

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus()
    }
  }, [isEditing])

  const handleChange = useCallback(async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(newValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [value, onSave])

  if (disabled) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${currentOption?.color || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} ${className}`}
      >
        {currentOption?.label || value}
      </span>
    )
  }

  if (isEditing) {
    return (
      <div className="relative inline-flex items-center gap-2">
        <select
          ref={selectRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          disabled={isSaving}
          className={`
            px-2 py-1 text-sm border rounded-md
            bg-white dark:bg-gray-800
            border-primary-500 dark:border-primary-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:opacity-50
            ${className}
          `}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {showLoading && isSaving && (
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        )}
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
        ${currentOption?.color || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}
        hover:ring-2 hover:ring-primary-500/20 transition-all cursor-pointer
        ${className}
      `}
    >
      {currentOption?.label || value}
      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

interface InlineDateEditProps extends InlineEditBaseProps {
  /** Date format for display */
  displayFormat?: (date: string) => string
}

/**
 * Inline date edit component
 */
export function InlineDateEdit({
  value,
  onSave,
  placeholder = 'Set date...',
  disabled = false,
  className = '',
  showLoading = true,
  displayFormat
}: InlineDateEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.showPicker?.()
    }
  }, [isEditing])

  const handleChange = useCallback(async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(newValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [value, onSave])

  const formatDate = (dateStr: string) => {
    if (displayFormat) return displayFormat(dateStr)
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  if (disabled) {
    return (
      <span className={`text-gray-500 dark:text-gray-400 ${className}`}>
        {value ? formatDate(value) : placeholder}
      </span>
    )
  }

  if (isEditing) {
    return (
      <div className="relative inline-flex items-center gap-2">
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          disabled={isSaving}
          className={`
            px-2 py-1 text-sm border rounded-md
            bg-white dark:bg-gray-800
            border-primary-500 dark:border-primary-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:opacity-50
            ${className}
          `}
        />
        {showLoading && isSaving && (
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        )}
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`
        inline-flex items-center gap-1 px-2 py-1 -mx-2 rounded-md
        hover:bg-gray-100 dark:hover:bg-gray-700/50
        transition-colors cursor-pointer
        ${className}
      `}
    >
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className={value ? '' : 'text-gray-400 dark:text-gray-500 italic'}>
        {value ? formatDate(value) : placeholder}
      </span>
    </button>
  )
}

/**
 * Status badge options for common use cases
 */
export const statusOptions = {
  record: [
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' }
  ],
  letter: [
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { value: 'processing', label: 'Processing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' }
  ],
  issue: [
    { value: 'open', label: 'Open', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' }
  ],
  priority: [
    { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
  ]
}

export default InlineTextEdit
