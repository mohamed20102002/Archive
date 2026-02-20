import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { AuditEntry } from './AuditEntry'
import { useToast } from '../../context/ToastContext'
import type { AuditEntry as AuditEntryType, AuditAction } from '../../types'

const actionFilters: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_LOGOUT', label: 'User Logout' },
  { value: 'USER_CREATE', label: 'User Created' },
  { value: 'USER_UPDATE', label: 'User Updated' },
  { value: 'TOPIC_CREATE', label: 'Topic Created' },
  { value: 'TOPIC_UPDATE', label: 'Topic Updated' },
  { value: 'TOPIC_DELETE', label: 'Topic Deleted' },
  { value: 'RECORD_CREATE', label: 'Record Created' },
  { value: 'RECORD_UPDATE', label: 'Record Updated' },
  { value: 'RECORD_DELETE', label: 'Record Deleted' },
  { value: 'EMAIL_ARCHIVE', label: 'Email Archived' },
  { value: 'REMINDER_CREATE', label: 'Reminder Created' },
  { value: 'REMINDER_COMPLETE', label: 'Reminder Completed' },
  { value: 'SYSTEM_STARTUP', label: 'System Startup' },
  { value: 'SYSTEM_SHUTDOWN', label: 'System Shutdown' }
]

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntryType[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [integrityStatus, setIntegrityStatus] = useState<{
    checked: boolean
    valid: boolean
    errors: string[]
    checkedCount: number
  } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const { success, error, warning } = useToast()
  const pageSize = 25

  const loadAuditLog = async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.audit.getLog({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        action: actionFilter || undefined
      })

      setEntries(result.entries as AuditEntryType[])
      setTotal(result.total)
    } catch (err) {
      console.error('Error loading audit log:', err)
      error('Failed to load audit log')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAuditLog()
  }, [page, actionFilter])

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true)
    try {
      const result = await window.electronAPI.audit.verifyIntegrity()
      setIntegrityStatus({
        checked: true,
        valid: result.valid,
        errors: result.errors,
        checkedCount: result.checkedCount
      })

      if (result.valid) {
        success('Audit log verified', `${result.checkedCount} entries verified successfully`)
      } else {
        warning('Integrity issues found', `${result.errors.length} issue(s) detected`)
      }
    } catch (err) {
      error('Verification failed', 'Could not verify audit log integrity')
    } finally {
      setIsVerifying(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light dark:bg-gray-900 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Log</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Immutable record of all system activities
            </p>
          </div>

          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="btn-secondary flex items-center gap-2"
          >
            {isVerifying ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Verify Integrity</span>
              </>
            )}
          </button>
        </div>

        {/* Integrity Status */}
        {integrityStatus?.checked && (
          <div className={`p-4 rounded-lg border ${
            integrityStatus.valid
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-3">
              {integrityStatus.valid ? (
                <svg className="w-5 h-5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div>
                <h4 className={`font-medium ${integrityStatus.valid ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                  {integrityStatus.valid
                    ? 'Audit log integrity verified'
                    : 'Integrity issues detected'
                  }
                </h4>
                <p className={`text-sm mt-1 ${integrityStatus.valid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {integrityStatus.checkedCount} entries checked
                  {integrityStatus.errors.length > 0 && ` - ${integrityStatus.errors.length} issue(s) found`}
                </p>
                {integrityStatus.errors.length > 0 && (
                  <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                    {integrityStatus.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {integrityStatus.errors.length > 5 && (
                      <li>...and {integrityStatus.errors.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className="input w-auto"
          >
            {actionFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {total} total entries
          </span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Audit Entries */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No audit entries found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {actionFilter ? 'Try changing the filter' : 'Audit log is empty'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((entry) => (
                  <AuditEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-sm"
                  >
                    Previous
                  </button>

                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
