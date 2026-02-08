import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { User, AttendanceCondition, AttendanceEntry, AttendanceSummary as AttendanceSummaryType, Shift } from '../../types'
import { AttendanceToolbar } from './AttendanceToolbar'
import { AttendanceCalendar } from './AttendanceCalendar'
import { AttendanceSummary } from './AttendanceSummary'
import { AttendanceEntryDialog } from './AttendanceEntryDialog'
import { AttendanceConditionSettings } from './AttendanceConditionSettings'
import { BulkEntryDialog } from './BulkEntryDialog'

export function AttendancePage() {
  const { user } = useAuth()
  const toast = useToast()

  // Data state
  const [users, setUsers] = useState<User[]>([])
  const [conditions, setConditions] = useState<AttendanceCondition[]>([])
  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [summary, setSummary] = useState<AttendanceSummaryType | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [isEditable, setIsEditable] = useState(true)

  // Filter state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [shiftFilter, setShiftFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')

  // UI state
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDate, setDialogDate] = useState('')
  const [dialogEntry, setDialogEntry] = useState<AttendanceEntry | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  // Initial load
  useEffect(() => {
    loadInitialData()
  }, [])

  // Reload entries when user/year/filters change
  useEffect(() => {
    if (selectedUserId && selectedYear) {
      loadEntries()
      loadSummary()
      checkEditability()
    }
  }, [selectedUserId, selectedYear, shiftFilter, conditionFilter])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [allUsers, allConditions, years, allShifts] = await Promise.all([
        window.electronAPI.auth.getAllUsers(),
        window.electronAPI.attendance.getConditions(),
        window.electronAPI.attendance.getAvailableYears(),
        window.electronAPI.attendance.getShifts()
      ])

      const activeUsers = (allUsers as User[]).filter(u => u.is_active)
      setUsers(activeUsers)
      setConditions(allConditions as AttendanceCondition[])
      setAvailableYears(years)
      setShifts(allShifts as Shift[])

      // Default to current user
      if (user && activeUsers.find(u => u.id === user.id)) {
        setSelectedUserId(user.id)
      } else if (activeUsers.length > 0) {
        setSelectedUserId(activeUsers[0].id)
      }
    } catch (err: any) {
      console.error('Error loading attendance data:', err)
      toast.error('Load error', err.message || 'Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }

  const loadEntries = async () => {
    if (!selectedUserId) return
    try {
      const filters: any = {
        user_id: selectedUserId,
        year: selectedYear
      }
      if (shiftFilter) filters.shift_id = shiftFilter
      if (conditionFilter) filters.condition_id = conditionFilter

      const result = await window.electronAPI.attendance.getEntriesForYear(filters)
      setEntries(result as AttendanceEntry[])
    } catch (err: any) {
      console.error('Error loading entries:', err)
    }
  }

  const loadSummary = async () => {
    if (!selectedUserId) return
    try {
      const result = await window.electronAPI.attendance.getSummary(selectedUserId, selectedYear)
      setSummary(result as AttendanceSummaryType)
    } catch (err: any) {
      console.error('Error loading summary:', err)
    }
  }

  const checkEditability = async () => {
    const editable = await window.electronAPI.attendance.isYearEditable(selectedYear)
    setIsEditable(editable)
  }

  const handleCellClick = useCallback(async (date: string) => {
    if (!isEditable) return
    // Load the specific entry for this date
    const entry = await window.electronAPI.attendance.getEntry(selectedUserId, date)
    setDialogDate(date)
    setDialogEntry(entry as AttendanceEntry | null)
    setDialogOpen(true)
  }, [selectedUserId, isEditable])

  const handleSaveEntry = async (conditionIds: string[], note: string) => {
    if (!user) return
    try {
      // Fetch fresh user data from DB to get current shift_id
      const allUsers = await window.electronAPI.auth.getAllUsers()
      const freshUser = (allUsers as User[]).find(u => u.id === selectedUserId)
      const shiftId = freshUser?.shift_id || shifts[0]?.id || ''

      const result = await window.electronAPI.attendance.saveEntry(
        {
          user_id: selectedUserId,
          entry_date: dialogDate,
          shift_id: shiftId,
          condition_ids: conditionIds,
          note: note || undefined
        },
        user.id
      )

      if (result.success) {
        setDialogOpen(false)
        await loadEntries()
        await loadSummary()
      } else {
        toast.error('Save failed', result.error || 'Could not save entry')
      }
    } catch (err: any) {
      toast.error('Save failed', err.message)
    }
  }

  const handleDeleteEntry = async () => {
    if (!user || !dialogEntry) return
    try {
      const result = await window.electronAPI.attendance.deleteEntry(dialogEntry.id, user.id)
      if (result.success) {
        setDialogOpen(false)
        await loadEntries()
        await loadSummary()
      } else {
        toast.error('Delete failed', result.error || 'Could not delete entry')
      }
    } catch (err: any) {
      toast.error('Delete failed', err.message)
    }
  }

  const handleExportPdf = async () => {
    if (!user) return
    setExporting(true)
    try {
      const result = await window.electronAPI.attendance.exportUserPdfDialog(selectedUserId, selectedYear, user.id)
      if (result.success && result.filePath) {
        toast.success('PDF exported', `File saved to ${result.filePath}`)
      } else if (result.error && result.error !== 'Export canceled') {
        toast.error('Export failed', result.error || 'Could not export PDF')
      }
    } catch (err: any) {
      toast.error('Export failed', err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleConditionsChanged = async () => {
    const allConditions = await window.electronAPI.attendance.getConditions()
    setConditions(allConditions as AttendanceCondition[])
    await loadEntries()
    await loadSummary()
  }

  const handleShiftsChanged = async () => {
    const allShifts = await window.electronAPI.attendance.getShifts()
    setShifts(allShifts as Shift[])
  }

  const handleBulkSave = async (shiftId: string, date: string, conditionIds: string[], note: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.attendance.saveBulkEntries(
        {
          shift_id: shiftId,
          entry_date: date,
          condition_ids: conditionIds,
          note: note || undefined
        },
        user.id
      )
      if (result.success) {
        setBulkDialogOpen(false)
        toast.success('Bulk entry saved', `Applied to ${result.count} user(s)`)
        await loadEntries()
        await loadSummary()
      } else {
        toast.error('Bulk save failed', result.error || 'Could not save entries')
      }
    } catch (err: any) {
      toast.error('Bulk save failed', err.message)
    }
  }

  const reloadUsers = async () => {
    const allUsers = await window.electronAPI.auth.getAllUsers()
    const activeUsers = (allUsers as User[]).filter(u => u.is_active)
    setUsers(activeUsers)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading attendance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar */}
      <AttendanceToolbar
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
        availableYears={availableYears}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        shiftFilter={shiftFilter}
        onShiftFilterChange={setShiftFilter}
        conditionFilter={conditionFilter}
        onConditionFilterChange={setConditionFilter}
        conditions={conditions}
        shifts={shifts}
        isEditable={isEditable}
        onSettingsClick={() => setSettingsOpen(true)}
        onExportClick={handleExportPdf}
        exporting={exporting}
        onBulkEntryClick={() => setBulkDialogOpen(true)}
      />

      {/* Main content: Calendar + Summary side by side */}
      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-1 card dark:bg-gray-800 dark:border-gray-700 p-4 overflow-hidden">
          {conditions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">No Conditions Configured</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                Add attendance conditions (e.g., Attended, Vacation, Sick) to start tracking.
              </p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="btn-primary text-sm"
              >
                Open Settings
              </button>
            </div>
          ) : (
            <AttendanceCalendar
              year={selectedYear}
              entries={entries}
              conditions={conditions}
              isEditable={isEditable}
              onCellClick={handleCellClick}
            />
          )}

          {/* Legend */}
          {conditions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Legend</div>
              <div className="flex flex-col gap-1.5">
                {conditions.filter(c => !c.is_ignored).map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span>{c.display_number} - {c.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-gray-200 dark:bg-gray-600" />
                  <span>N/A - No entry</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0 ring-2 ring-blue-500" />
                  <span>Today</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary panel */}
        <div className="w-64 flex-shrink-0">
          <AttendanceSummary summary={summary} conditions={conditions} shifts={shifts} />
        </div>
      </div>

      {/* Entry Dialog */}
      <AttendanceEntryDialog
        isOpen={dialogOpen}
        date={dialogDate}
        entry={dialogEntry}
        conditions={conditions}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        onClose={() => setDialogOpen(false)}
      />

      {/* Bulk Entry Dialog */}
      <BulkEntryDialog
        isOpen={bulkDialogOpen}
        shifts={shifts}
        conditions={conditions}
        onSave={handleBulkSave}
        onClose={() => setBulkDialogOpen(false)}
      />

      {/* Condition Settings Modal */}
      <AttendanceConditionSettings
        isOpen={settingsOpen}
        onClose={() => { setSettingsOpen(false); reloadUsers() }}
        onConditionsChanged={handleConditionsChanged}
        onShiftsChanged={handleShiftsChanged}
      />
    </div>
  )
}
