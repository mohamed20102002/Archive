/**
 * Version History Component
 *
 * Displays document version history and allows version comparison and restoration.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatRelativeTime, formatFileSize } from '../../utils/formatters'

interface DocumentVersion {
  id: string
  document_type: string
  document_id: string
  version_number: number
  file_path: string
  file_name: string
  file_size: number
  file_hash: string
  mime_type: string
  created_by: string | null
  created_at: string
  change_summary: string | null
  is_current: boolean
}

interface VersionHistoryProps {
  /** Document type */
  documentType: 'letter_attachment' | 'record_attachment' | 'mom_draft' | 'letter_draft'
  /** Document ID */
  documentId: string
  /** Current user ID for permissions */
  currentUserId: string
  /** Called when version is restored */
  onRestore?: (version: DocumentVersion) => void
  /** Called when version is previewed */
  onPreview?: (version: DocumentVersion) => void
  /** Additional class names */
  className?: string
}

export function VersionHistory({
  documentType,
  documentId,
  currentUserId,
  onRestore,
  onPreview,
  className = ''
}: VersionHistoryProps) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [isComparing, setIsComparing] = useState(false)
  const [comparison, setComparison] = useState<{
    older: DocumentVersion
    newer: DocumentVersion
    sizeChange: number
    sizeChangePercent: number
    timeBetween: number
  } | null>(null)

  useEffect(() => {
    loadVersions()
  }, [documentType, documentId])

  const loadVersions = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.documentVersions.getVersions(documentType, documentId)
      setVersions(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (version: DocumentVersion) => {
    try {
      await window.electronAPI.documentVersions.restore(version.id, currentUserId)
      loadVersions()
      if (onRestore) {
        onRestore(version)
      }
    } catch (err) {
      console.error('Failed to restore version:', err)
    }
  }

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) return

    setIsComparing(true)
    try {
      const result = await window.electronAPI.documentVersions.compare(
        selectedVersions[0],
        selectedVersions[1]
      )
      setComparison(result)
    } catch (err) {
      console.error('Failed to compare versions:', err)
    } finally {
      setIsComparing(false)
    }
  }

  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId)
      }
      if (prev.length >= 2) {
        return [prev[1], versionId]
      }
      return [...prev, versionId]
    })
  }

  const formatTimeBetween = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return t('versions.daysApart', '{{count}} day(s) apart', { count: days })
    }
    if (hours > 0) {
      return t('versions.hoursApart', '{{count}} hour(s) apart', { count: hours })
    }
    return t('versions.lessThanHour', 'Less than an hour apart')
  }

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          onClick={loadVersions}
          className="mt-2 text-sm text-primary-600 hover:text-primary-700"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('versions.noVersions', 'No version history available')}
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Compare toolbar */}
      {selectedVersions.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 mb-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <span className="text-sm text-primary-700 dark:text-primary-300">
            {selectedVersions.length === 1
              ? t('versions.selectOneMore', 'Select one more version to compare')
              : t('versions.twoSelected', '2 versions selected')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedVersions([])}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
            >
              {t('common.clear', 'Clear')}
            </button>
            {selectedVersions.length === 2 && (
              <button
                onClick={handleCompare}
                disabled={isComparing}
                className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
              >
                {isComparing ? t('versions.comparing', 'Comparing...') : t('versions.compare', 'Compare')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Comparison result */}
      {comparison && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {t('versions.comparisonResult', 'Comparison Result')}
            </h4>
            <button
              onClick={() => setComparison(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('versions.olderVersion', 'Older Version')}
              </p>
              <p className="font-medium">v{comparison.older.version_number}</p>
              <p className="text-xs text-gray-400">
                {formatRelativeTime(comparison.older.created_at)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('versions.newerVersion', 'Newer Version')}
              </p>
              <p className="font-medium">v{comparison.newer.version_number}</p>
              <p className="text-xs text-gray-400">
                {formatRelativeTime(comparison.newer.created_at)}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {t('versions.sizeChange', 'Size change')}:
              </span>
              <span className={`ml-1 font-medium ${
                comparison.sizeChange > 0
                  ? 'text-green-600 dark:text-green-400'
                  : comparison.sizeChange < 0
                  ? 'text-red-600 dark:text-red-400'
                  : ''
              }`}>
                {comparison.sizeChange > 0 ? '+' : ''}
                {formatFileSize(Math.abs(comparison.sizeChange))}
                {' '}({comparison.sizeChangePercent > 0 ? '+' : ''}{comparison.sizeChangePercent}%)
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {t('versions.timeBetween', 'Time between')}:
              </span>
              <span className="ml-1 font-medium">
                {formatTimeBetween(comparison.timeBetween)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Version list */}
      <div className="space-y-2">
        {versions.map((version, index) => (
          <div
            key={version.id}
            className={`
              relative flex items-start gap-3 p-3 rounded-lg border transition-colors
              ${version.is_current
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : selectedVersions.includes(version.id)
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            {/* Selection checkbox */}
            <button
              onClick={() => toggleVersionSelection(version.id)}
              className={`
                mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                ${selectedVersions.includes(version.id)
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-gray-300 dark:border-gray-600'
                }
              `}
            >
              {selectedVersions.includes(version.id) && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Timeline connector */}
            {index < versions.length - 1 && (
              <div className="absolute left-[1.625rem] top-12 w-0.5 h-4 bg-gray-200 dark:bg-gray-700" />
            )}

            {/* Version info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  v{version.version_number}
                </span>
                {version.is_current && (
                  <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                    {t('versions.current', 'Current')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span>{formatRelativeTime(version.created_at)}</span>
                <span>•</span>
                <span>{formatFileSize(version.file_size)}</span>
                {version.created_by && (
                  <>
                    <span>•</span>
                    <span>{version.created_by}</span>
                  </>
                )}
              </div>

              {version.change_summary && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {version.change_summary}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {onPreview && (
                <button
                  onClick={() => onPreview(version)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title={t('versions.preview', 'Preview')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              )}
              {!version.is_current && onRestore && (
                <button
                  onClick={() => handleRestore(version)}
                  className="p-1.5 text-gray-400 hover:text-primary-600"
                  title={t('versions.restore', 'Restore this version')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Compact version badge
 */
export function VersionBadge({
  count,
  onClick,
  className = ''
}: {
  count: number
  onClick?: () => void
  className?: string
}) {
  const { t } = useTranslation()

  if (count <= 1) return null

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
        bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300
        hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
        ${className}
      `}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {t('versions.count', '{{count}} versions', { count })}
    </button>
  )
}

export default VersionHistory
