import React, { useState } from 'react'
import { format } from 'date-fns'
import { BackupComparison } from '../../types'

interface Props {
  comparison: BackupComparison
  onConfirm: () => void
  onCancel: () => void
}

const moduleLabels: Record<string, string> = {
  topics: 'Topics',
  records: 'Records',
  emails: 'Emails',
  letters: 'Letters',
  moms: 'Minutes of Meeting',
  issues: 'Issues',
  attendance_entries: 'Attendance Entries',
  handovers: 'Handovers',
  reminders: 'Reminders',
  authorities: 'Authorities',
  credentials: 'Credentials',
  secure_references: 'Secure References',
  users: 'Users'
}

export function RestoreComparisonModal({ comparison, onConfirm, onCancel }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const isConfirmValid = confirmText === 'CONFIRM'

  const backupDate = (() => {
    try {
      return format(new Date(comparison.backup.backup_date), 'MMM d, yyyy h:mm a')
    } catch {
      return comparison.backup.backup_date
    }
  })()

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Restore Comparison</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review the differences before restoring from backup
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Backup info cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">Backup Date</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{backupDate}</p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">Created By</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                {comparison.backup.backup_by_display_name}
              </p>
            </div>
          </div>

          {/* Emails inclusion notice */}
          {comparison.backup.includes_emails && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                This backup includes archived emails. They will be restored as well.
              </p>
            </div>
          )}

          {/* Older backup warning */}
          {comparison.is_backup_older && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    This backup is older than the current data
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    Restoring will replace your current data with older data. Some changes may be lost.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Comparison table */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Module</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Backup</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Current</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Diff</th>
                </tr>
              </thead>
              <tbody>
                {comparison.differences.map((diff) => (
                  <tr key={diff.module} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {moduleLabels[diff.module] || diff.module}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {diff.backup_count}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {diff.current_count}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${
                      diff.diff > 0 ? 'text-green-600 dark:text-green-400' :
                      diff.diff < 0 ? 'text-red-600 dark:text-red-400' :
                      'text-gray-400'
                    }`}>
                      {diff.diff > 0 ? `+${diff.diff}` : diff.diff === 0 ? '-' : diff.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm input */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400">CONFIRM</span> to enable restore
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CONFIRM"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmValid}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Restore Backup
          </button>
        </div>
      </div>
    </div>
  )
}
