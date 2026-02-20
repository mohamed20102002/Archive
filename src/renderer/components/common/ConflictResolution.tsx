/**
 * Conflict Resolution Component
 *
 * Displays and resolves conflicts when concurrent edits are detected.
 * Provides visual diff view and merge strategies.
 */

import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface FieldConflict {
  field: string
  local_value: unknown
  server_value: unknown
  original_value: unknown
}

interface ConflictInfo {
  entity_type: string
  entity_id: string
  local_version: number
  local_updated_at: string
  local_updated_by: string | null
  server_version: number
  server_updated_at: string
  server_updated_by: string | null
  field_conflicts: FieldConflict[]
}

type MergeStrategy = 'keep_local' | 'keep_server' | 'keep_newer' | 'manual'

interface ConflictResolutionProps {
  /** Conflict information */
  conflict: ConflictInfo
  /** Called when conflict is resolved */
  onResolve: (strategy: MergeStrategy, manualResolutions?: Record<string, unknown>) => void
  /** Called when user cancels */
  onCancel: () => void
  /** Field labels for display */
  fieldLabels?: Record<string, string>
  /** Whether resolution is in progress */
  isResolving?: boolean
}

export function ConflictResolution({
  conflict,
  onResolve,
  onCancel,
  fieldLabels = {},
  isResolving = false
}: ConflictResolutionProps) {
  const { t } = useTranslation()
  const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>('keep_newer')
  const [manualResolutions, setManualResolutions] = useState<Record<string, 'local' | 'server'>>({})

  const getFieldLabel = (field: string) => {
    return fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  const handleManualSelection = (field: string, choice: 'local' | 'server') => {
    setManualResolutions(prev => ({ ...prev, [field]: choice }))
  }

  const handleResolve = useCallback(() => {
    if (selectedStrategy === 'manual') {
      // Check all conflicts are resolved
      const unresolvedCount = conflict.field_conflicts.filter(
        fc => !manualResolutions[fc.field]
      ).length

      if (unresolvedCount > 0) {
        return // Don't resolve if not all conflicts are addressed
      }

      const resolutions: Record<string, unknown> = {}
      for (const fc of conflict.field_conflicts) {
        resolutions[fc.field] = manualResolutions[fc.field] === 'local'
          ? fc.local_value
          : fc.server_value
      }
      onResolve('manual', resolutions)
    } else {
      onResolve(selectedStrategy)
    }
  }, [selectedStrategy, manualResolutions, conflict, onResolve])

  const allResolved = selectedStrategy !== 'manual' ||
    conflict.field_conflicts.every(fc => manualResolutions[fc.field])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-800/50 rounded-lg">
            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('conflict.title', 'Conflict Detected')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('conflict.description', 'This item was modified by another user while you were editing.')}
            </p>
          </div>
        </div>

        {/* Version info */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-500 dark:text-gray-400">
                {t('conflict.yourVersion', 'Your version')}: v{conflict.local_version}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(conflict.local_updated_at)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-500 dark:text-gray-400">
                {t('conflict.serverVersion', 'Server version')}: v{conflict.server_version}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(conflict.server_updated_at)}
                {conflict.server_updated_by && ` by ${conflict.server_updated_by}`}
              </span>
            </div>
          </div>
        </div>

        {/* Strategy selection */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('conflict.chooseStrategy', 'Choose how to resolve:')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(['keep_newer', 'keep_local', 'keep_server', 'manual'] as MergeStrategy[]).map(strategy => (
              <button
                key={strategy}
                onClick={() => setSelectedStrategy(strategy)}
                className={`
                  px-3 py-1.5 text-sm rounded-lg border transition-colors
                  ${selectedStrategy === strategy
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                `}
              >
                {strategy === 'keep_newer' && t('conflict.keepNewer', 'Keep Newer')}
                {strategy === 'keep_local' && t('conflict.keepMine', 'Keep My Changes')}
                {strategy === 'keep_server' && t('conflict.keepTheirs', 'Keep Their Changes')}
                {strategy === 'manual' && t('conflict.resolveManually', 'Resolve Manually')}
              </button>
            ))}
          </div>
        </div>

        {/* Conflicts list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('conflict.fieldsConflict', '{{count}} field(s) have conflicting changes:', { count: conflict.field_conflicts.length })}
          </p>

          <div className="space-y-4">
            {conflict.field_conflicts.map((fc, index) => (
              <div
                key={fc.field}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {getFieldLabel(fc.field)}
                  </span>
                  {selectedStrategy === 'manual' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleManualSelection(fc.field, 'local')}
                        className={`
                          px-2 py-0.5 text-xs rounded
                          ${manualResolutions[fc.field] === 'local'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          }
                        `}
                      >
                        {t('conflict.useMine', 'Use Mine')}
                      </button>
                      <button
                        onClick={() => handleManualSelection(fc.field, 'server')}
                        className={`
                          px-2 py-0.5 text-xs rounded
                          ${manualResolutions[fc.field] === 'server'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                          }
                        `}
                      >
                        {t('conflict.useTheirs', 'Use Theirs')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                  <div className={`p-3 ${selectedStrategy === 'keep_local' || (selectedStrategy === 'manual' && manualResolutions[fc.field] === 'local') ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                      {t('conflict.myValue', 'My Value')}
                    </p>
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono bg-gray-100 dark:bg-gray-800 rounded p-2">
                      {formatValue(fc.local_value)}
                    </pre>
                  </div>
                  <div className={`p-3 ${selectedStrategy === 'keep_server' || (selectedStrategy === 'manual' && manualResolutions[fc.field] === 'server') ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                      {t('conflict.theirValue', 'Their Value')}
                    </p>
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono bg-gray-100 dark:bg-gray-800 rounded p-2">
                      {formatValue(fc.server_value)}
                    </pre>
                  </div>
                </div>
                {fc.original_value !== undefined && (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('conflict.originalValue', 'Original')}: {formatValue(fc.original_value)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onCancel}
            disabled={isResolving}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleResolve}
            disabled={isResolving || !allResolved}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResolving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('conflict.resolving', 'Resolving...')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('conflict.resolve', 'Resolve Conflict')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Conflict badge indicator
 */
export function ConflictBadge({
  count,
  onClick,
  className = ''
}: {
  count: number
  onClick?: () => void
  className?: string
}) {
  const { t } = useTranslation()

  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400
        hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors
        ${className}
      `}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      {t('conflict.badge', '{{count}} conflict(s)', { count })}
    </button>
  )
}

export default ConflictResolution
