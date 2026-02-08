import React from 'react'

interface Props {
  onSelectFile: () => void
  isOperationInProgress: boolean
}

export function RestoreSection({ onSelectFile, isOperationInProgress }: Props) {
  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restore from Backup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Import data from a backup ZIP file</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Select a previously created backup file to restore. A comparison summary will be shown before any changes are made.
      </p>

      {/* Warning */}
      <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-xs text-red-700 dark:text-red-400">
            Restoring from a backup will <strong>replace all current data</strong> (except secure resources). A rollback backup is created automatically before restore.
          </p>
        </div>
      </div>

      {/* Select button */}
      <button
        onClick={onSelectFile}
        disabled={isOperationInProgress}
        className="w-full px-4 py-3 text-base font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isOperationInProgress ? 'Operation in Progress...' : 'Select Backup File'}
      </button>
    </div>
  )
}
