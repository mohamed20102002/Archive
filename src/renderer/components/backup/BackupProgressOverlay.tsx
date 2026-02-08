import React from 'react'
import { BackupProgress } from '../../types'

interface Props {
  progress: BackupProgress
}

const phaseLabels: Record<string, string> = {
  preparing: 'Preparing',
  checkpointing: 'Checkpointing Databases',
  closing_db: 'Closing Database Connections',
  archiving: 'Creating Archive',
  finalizing: 'Finalizing Archive',
  reopening_db: 'Reopening Database Connections',
  creating_rollback: 'Creating Rollback Backup',
  extracting: 'Extracting Backup Files',
  replacing: 'Replacing Data Files',
  verifying: 'Verifying Restored Data',
  complete: 'Complete',
  error: 'Error'
}

export function BackupProgressOverlay({ progress }: Props) {
  const isComplete = progress.phase === 'complete'
  const isError = progress.phase === 'error'

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {isComplete ? (
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : isError ? (
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Phase label */}
        <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100 mb-2">
          {phaseLabels[progress.phase] || progress.phase}
        </h3>

        {/* Message */}
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-4">
          {progress.message}
        </p>

        {/* Current file */}
        {progress.currentFile && !isComplete && !isError && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mb-4 truncate">
            {progress.currentFile}
          </p>
        )}

        {/* Progress bar */}
        {!isComplete && !isError && (
          <>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
              <div
                className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-center font-medium text-gray-700 dark:text-gray-300">
              {progress.percentage}%
            </p>
          </>
        )}

        {/* Warning */}
        {!isComplete && !isError && (
          <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
              Do not close the application during this operation
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
