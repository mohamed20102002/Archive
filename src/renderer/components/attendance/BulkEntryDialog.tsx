import React, { useState } from 'react'
import { AttendanceCondition, Shift } from '../../types'

interface BulkEntryDialogProps {
  isOpen: boolean
  shifts: Shift[]
  conditions: AttendanceCondition[]
  onSave: (shiftId: string, date: string, conditionIds: string[], note: string) => void
  onClose: () => void
}

export function BulkEntryDialog({
  isOpen,
  shifts,
  conditions,
  onSave,
  onClose
}: BulkEntryDialogProps) {
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const toggleCondition = (condId: string) => {
    setSelectedConditions(prev =>
      prev.includes(condId) ? prev.filter(id => id !== condId) : [...prev, condId]
    )
  }

  const handleSave = async () => {
    if (!selectedShiftId || selectedConditions.length === 0) return
    setSaving(true)
    await onSave(selectedShiftId, date, selectedConditions, note)
    setSaving(false)
    // Reset
    setSelectedConditions([])
    setNote('')
  }

  const handleClose = () => {
    setSelectedConditions([])
    setNote('')
    setSelectedShiftId('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bulk Entry</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set attendance for all users in a shift at once
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
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

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conditions</label>
            <div className="space-y-2">
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
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Applies to all users in the selected shift. You can edit individual entries afterward.
          </p>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <button onClick={handleClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedShiftId || selectedConditions.length === 0 || saving}
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
