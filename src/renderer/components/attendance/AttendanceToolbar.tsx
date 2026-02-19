import React, { useState } from 'react'
import { User, AttendanceCondition, Shift } from '../../types'
import { useToast } from '../../context/ToastContext'
import { ExportButton } from '../common/ExportButton'

interface ReportInfo {
  exists: boolean
  path: string | null
  size: number | null
  createdAt: string | null
}

interface AttendanceToolbarProps {
  users: User[]
  selectedUserId: string
  onUserChange: (userId: string) => void
  availableYears: number[]
  selectedYear: number
  onYearChange: (year: number) => void
  shiftFilter: string
  onShiftFilterChange: (shiftId: string) => void
  conditionFilter: string
  onConditionFilterChange: (conditionId: string) => void
  conditions: AttendanceCondition[]
  shifts: Shift[]
  isEditable: boolean
  onSettingsClick: () => void
  onExportClick: () => void
  onDeptReportClick: (date: string) => void
  onEmailClick: (date: string) => void
  onEmailSettingsClick: () => void
  exporting: boolean
  onBulkEntryClick: () => void
}

export function AttendanceToolbar({
  users,
  selectedUserId,
  onUserChange,
  availableYears,
  selectedYear,
  onYearChange,
  shiftFilter,
  onShiftFilterChange,
  conditionFilter,
  onConditionFilterChange,
  conditions,
  shifts,
  isEditable,
  onSettingsClick,
  onExportClick,
  onDeptReportClick,
  onEmailClick,
  onEmailSettingsClick,
  exporting,
  onBulkEntryClick
}: AttendanceToolbarProps) {
  const toast = useToast()
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })

  // Archive search state
  const [archiveDate, setArchiveDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [archiveInfo, setArchiveInfo] = useState<ReportInfo | null>(null)
  const [searchingArchive, setSearchingArchive] = useState(false)

  const handleSearchArchive = async () => {
    if (!archiveDate) return
    setSearchingArchive(true)
    try {
      const info = await window.electronAPI.attendance.getDepartmentReportInfo(archiveDate)
      setArchiveInfo(info)
      if (!info.exists) {
        toast.info('Not Found', `No report found for ${archiveDate}`)
      }
    } catch (err: any) {
      toast.error('Search Error', err.message)
    } finally {
      setSearchingArchive(false)
    }
  }

  const handleOpenArchive = async () => {
    if (!archiveDate) return
    try {
      const result = await window.electronAPI.attendance.openDepartmentReport(archiveDate)
      if (!result.success) {
        toast.error('Open Error', result.error || 'Failed to open report')
      }
    } catch (err: any) {
      toast.error('Open Error', err.message)
    }
  }

  // Sort users by shift name, then by display name
  const sortedUsers = [...users].sort((a, b) => {
    const shiftA = shifts.find(s => s.id === a.shift_id)?.name || ''
    const shiftB = shifts.find(s => s.id === b.shift_id)?.name || ''
    if (shiftA !== shiftB) return shiftA.localeCompare(shiftB)
    return a.display_name.localeCompare(b.display_name)
  })

  const currentIndex = sortedUsers.findIndex(u => u.id === selectedUserId)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < sortedUsers.length - 1

  const handlePrev = () => {
    if (canGoPrev) onUserChange(sortedUsers[currentIndex - 1].id)
  }

  const handleNext = () => {
    if (canGoNext) onUserChange(sortedUsers[currentIndex + 1].id)
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* User select with prev/next */}
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-1">User:</label>
          <button
            onClick={handlePrev}
            disabled={!canGoPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous user"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <select
            value={selectedUserId}
            onChange={e => onUserChange(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {sortedUsers.map(u => {
              const shift = shifts.find(s => s.id === u.shift_id)
              return (
                <option key={u.id} value={u.id}>
                  {u.display_name}{shift ? ` (${shift.name})` : ''}
                </option>
              )
            })}
          </select>
          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next user"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Year select */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year:</label>
          <select
            value={selectedYear}
            onChange={e => onYearChange(Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Shift filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Shift:</label>
          <select
            value={shiftFilter}
            onChange={e => onShiftFilterChange(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Condition filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Condition:</label>
          <select
            value={conditionFilter}
            onChange={e => onConditionFilterChange(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            {conditions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Read-only badge */}
        {!isEditable && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full border border-amber-200 dark:border-amber-800">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Read Only
          </span>
        )}

        {/* Bulk entry button */}
        {isEditable && (
          <button
            onClick={onBulkEntryClick}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Bulk entry for all users in a shift"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Bulk Entry
          </button>
        )}

        {/* Export Excel button */}
        <ExportButton exportType="attendance" year={selectedYear} size="sm" variant="ghost" />

        {/* Export user PDF button */}
        <button
          onClick={onExportClick}
          disabled={exporting}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          title="Export selected user's yearly attendance as PDF"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        {/* Settings button */}
        <button
          onClick={onSettingsClick}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg"
          title="Attendance Settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Row 2: Department Reports */}
      <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-100 dark:border-gray-700">
        {/* Generate Department Report */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Generate Report:</span>
          <div className="flex items-center">
            <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-l-lg overflow-hidden">
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="text-sm px-2 py-1.5 border-0 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-0"
                title="Select date for new department report"
              />
              <button
                onClick={() => onDeptReportClick(reportDate)}
                disabled={exporting || !reportDate}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
                title="Generate and save department attendance report (Arabic PDF)"
              >
                {exporting ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                PDF
              </button>
            </div>
            <button
              onClick={() => onEmailClick(reportDate)}
              disabled={exporting || !reportDate}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-1.5 disabled:opacity-50 border-l border-blue-700"
              title="Create report and compose Outlook email with attachment"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </button>
            <button
              onClick={onEmailSettingsClick}
              className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-600"
              title="Email Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Open Archived Report */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Archive:</span>
          <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <input
              type="date"
              value={archiveDate}
              onChange={e => { setArchiveDate(e.target.value); setArchiveInfo(null) }}
              className="text-sm px-2 py-1.5 border-0 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-0"
              title="Select date to find archived report"
            />
            <button
              onClick={handleSearchArchive}
              disabled={searchingArchive || !archiveDate}
              className="px-2 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 text-sm flex items-center gap-1 text-gray-700 dark:text-gray-200"
              title="Search for archived report"
            >
              {searchingArchive ? (
                <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Find
            </button>
            {archiveInfo?.exists && (
              <button
                onClick={handleOpenArchive}
                className="px-2 py-1.5 bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/50 text-sm flex items-center gap-1 text-green-700 dark:text-green-300 border-l border-gray-200 dark:border-gray-500"
                title={`Open report (${(archiveInfo.size! / 1024).toFixed(1)} KB)`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open
              </button>
            )}
          </div>
          {archiveInfo && !archiveInfo.exists && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Not found</span>
          )}
        </div>
      </div>
    </div>
  )
}
