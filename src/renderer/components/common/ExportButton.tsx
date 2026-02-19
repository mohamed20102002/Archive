import React, { useState, useRef, useEffect } from 'react'

export type ExportType = 'topics' | 'letters' | 'moms' | 'issues' | 'attendance' | 'searchResults' | 'recordsByTopic' | 'custom'

interface ExportButtonProps {
  exportType: ExportType
  // For attendance export
  year?: number
  month?: number
  // For recordsByTopic
  topicId?: string
  // For search results
  results?: any[]
  // For custom export
  customData?: any[]
  customSheetName?: string
  customFilename?: string
  // Styling
  className?: string
  size?: 'sm' | 'md'
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function ExportButton({
  exportType,
  year,
  month,
  topicId,
  results,
  customData,
  customSheetName,
  customFilename,
  className = '',
  size = 'md',
  variant = 'secondary'
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async () => {
    setIsExporting(true)
    setShowDropdown(false)

    try {
      let result: { success: boolean; filePath?: string; error?: string }

      switch (exportType) {
        case 'topics':
          result = await window.electronAPI.export.topics()
          break
        case 'letters':
          result = await window.electronAPI.export.letters()
          break
        case 'moms':
          result = await window.electronAPI.export.moms()
          break
        case 'issues':
          result = await window.electronAPI.export.issues()
          break
        case 'attendance':
          result = await window.electronAPI.export.attendance(year || new Date().getFullYear(), month)
          break
        case 'searchResults':
          result = await window.electronAPI.export.searchResults(results || [])
          break
        case 'recordsByTopic':
          result = await window.electronAPI.export.recordsByTopic(topicId || '')
          break
        case 'custom':
          result = await window.electronAPI.export.customData(
            customData || [],
            customSheetName || 'Data',
            customFilename || 'Export'
          )
          break
        default:
          result = { success: false, error: 'Unknown export type' }
      }

      if (result.success) {
        window.electronAPI.app.showNotification(
          'Export Successful',
          `File saved to ${result.filePath}`
        )
      } else if (result.error && result.error !== 'Export canceled') {
        window.electronAPI.dialog.showMessage({
          type: 'error',
          title: 'Export Failed',
          message: result.error
        })
      }
    } catch (error) {
      console.error('Export error:', error)
      window.electronAPI.dialog.showMessage({
        type: 'error',
        title: 'Export Failed',
        message: 'An unexpected error occurred during export'
      })
    } finally {
      setIsExporting(false)
    }
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2'
  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
    secondary: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700',
    ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`
          inline-flex items-center gap-2 rounded-lg font-medium transition-colors
          ${sizeClasses}
          ${variantClasses[variant]}
          ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
      >
        {isExporting ? (
          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        Export
      </button>
    </div>
  )
}

// A more flexible export dropdown for pages that support multiple export formats
interface ExportDropdownProps {
  options: Array<{
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }>
  className?: string
  size?: 'sm' | 'md'
}

export function ExportDropdown({ options, className = '', size = 'md' }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={`
          inline-flex items-center gap-2 rounded-lg font-medium transition-colors
          bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700
          ${sizeClasses}
          ${className}
        `}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <ul className="py-1">
            {options.map((option, idx) => (
              <li key={idx}>
                <button
                  onClick={() => {
                    option.onClick()
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  {option.icon}
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
