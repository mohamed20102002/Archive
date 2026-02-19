import React, { useState } from 'react'
import { AttendanceCondition, Shift } from '../../types'
import { useConfirm } from '../common/ConfirmDialog'

interface BulkEntryDialogProps {
  isOpen: boolean
  shifts: Shift[]
  conditions: AttendanceCondition[]
  onSave: (shiftId: string, date: string, conditionIds: string[], note: string, signInTime: string, signOutTime: string) => void
  onDelete: (shiftId: string, date: string) => Promise<void>
  onClose: () => void
}

export function BulkEntryDialog({
  isOpen,
  shifts,
  conditions,
  onSave,
  onDelete,
  onClose
}: BulkEntryDialogProps) {
  const confirm = useConfirm()
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [signInTime, setSignInTime] = useState('')
  const [signOutTime, setSignOutTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!isOpen) return null

  const toggleCondition = (condId: string) => {
    setSelectedConditions(prev =>
      prev.includes(condId) ? prev.filter(id => id !== condId) : [...prev, condId]
    )
  }

  const handleSave = async () => {
    if (!selectedShiftId || selectedConditions.length === 0) return
    setSaving(true)
    await onSave(selectedShiftId, date, selectedConditions, note, signInTime, signOutTime)
    setSaving(false)
    // Reset
    setSelectedConditions([])
    setNote('')
    setSignInTime('')
    setSignOutTime('')
  }

  const handleDelete = async () => {
    if (!selectedShiftId) return
    const shiftName = shifts.find(s => s.id === selectedShiftId)?.name || 'selected shift'
    const confirmed = await confirm({
      title: 'Delete All Entries',
      message: `Are you sure you want to delete all attendance entries for "${shiftName}" on ${date}?`,
      confirmText: 'Delete All',
      danger: true
    })
    if (!confirmed) return

    setDeleting(true)
    await onDelete(selectedShiftId, date)
    setDeleting(false)
  }

  const handleClose = () => {
    setSelectedConditions([])
    setNote('')
    setSignInTime('')
    setSignOutTime('')
    setSelectedShiftId('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bulk Entry</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set attendance for all users in a shift at once
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Shift selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift</label>
            <select
              value={selectedShiftId}
              onChange={e => setSelectedShiftId(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a shift...</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Time entries */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sign In Time</label>
              <input
                type="time"
                value={signInTime}
                onChange={e => setSignInTime(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sign Out Time</label>
              <input
                type="time"
                value={signOutTime}
                onChange={e => setSignOutTime(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conditions</label>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
              {conditions.map(cond => (
                <label
                  key={cond.id}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedConditions.includes(cond.id)}
                    onChange={() => toggleCondition(cond.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: cond.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {cond.display_number} - {cond.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Optional note for all entries..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <button
            onClick={handleDelete}
            disabled={!selectedShiftId || deleting || saving}
            className="text-sm px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Delete all entries for this shift on the selected date"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleting ? 'Deleting...' : 'Delete All'}
          </button>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedShiftId || selectedConditions.length === 0 || saving || deleting}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Apply to Shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
