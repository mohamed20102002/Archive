import React, { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { BackupStatusFile } from '../../types'

interface Props {
  onCreateBackup: (includeEmails: boolean) => void
  isOperationInProgress: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function BackupSection({ onCreateBackup, isOperationInProgress }: Props) {
  const [status, setStatus] = useState<BackupStatusFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [includeEmails, setIncludeEmails] = useState(false)
  const [emailsSize, setEmailsSize] = useState<{ totalBytes: number; fileCount: number } | null>(null)
  const { formatDate } = useSettings()

  useEffect(() => {
    loadStatus()
    loadEmailsSize()
  }, [])

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI.backup.getStatus()
      setStatus(result as BackupStatusFile | null)
    } catch (err) {
      console.error('Failed to load backup status:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEmailsSize = async () => {
    try {
      const result = await window.electronAPI.backup.getEmailsSize()
      setEmailsSize(result)
    } catch (err) {
      console.error('Failed to load emails size:', err)
    }
  }

  // Refresh status after backup completes
  useEffect(() => {
    if (!isOperationInProgress) {
      loadStatus()
    }
  }, [isOperationInProgress])

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Backup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Export all data to a ZIP file</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Creates a complete backup of all databases, documents, and files. Secure resources (credentials, encrypted files) are excluded.
      </p>

      {/* Last backup info */}
      {!loading && status && (
        <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Last Backup</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {formatDate(status.last_backup_date, 'withTime')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Created By</span>
            <span className="text-gray-900 dark:text-gray-100">{status.last_backup_user}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Size</span>
            <span className="text-gray-900 dark:text-gray-100">{formatBytes(status.last_backup_size_bytes)}</span>
          </div>
        </div>
      )}

      {!loading && !status && (
        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400">No backup has been created yet</p>
        </div>
      )}

      {/* Include Emails checkbox */}
      <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeEmails}
          onChange={(e) => setIncludeEmails(e.target.checked)}
          disabled={isOperationInProgress}
          className="mt-0.5 w-4 h-4 text-primary-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 focus:ring-2"
        />
        <div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Include Archived Emails</span>
          {emailsSize && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {emailsSize.fileCount} files ({formatBytes(emailsSize.totalBytes)})
              {emailsSize.totalBytes > 500 * 1024 * 1024 && (
                <span className="text-amber-600 dark:text-amber-400"> — large folder, backup will be slower</span>
              )}
            </p>
          )}
          {emailsSize && emailsSize.fileCount === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No archived emails found</p>
          )}
        </div>
      </label>

      {/* Create button */}
      <button
        onClick={() => onCreateBackup(includeEmails)}
        disabled={isOperationInProgress}
        className="w-full btn btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isOperationInProgress ? 'Operation in Progress...' : 'Create Backup'}
      </button>
    </div>
  )
}
