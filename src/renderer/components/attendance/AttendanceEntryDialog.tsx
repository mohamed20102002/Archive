import React, { useState, useEffect } from 'react'
import { AttendanceCondition, AttendanceEntry } from '../../types'

interface AttendanceEntryDialogProps {
  isOpen: boolean
  date: string
  entry: AttendanceEntry | null
  conditions: AttendanceCondition[]
  onSave: (conditionIds: string[], note: string) => void
  onDelete: () => void
  onClose: () => void
}

export function AttendanceEntryDialog({
  isOpen,
  date,
  entry,
  conditions,
  onSave,
  onDelete,
  onClose
}: AttendanceEntryDialogProps) {
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (entry) {
      setSelectedConditions(new Set(entry.conditions.map(c => c.id)))
      setNote(entry.note || '')
    } else {
      setSelectedConditions(new Set())
      setNote('')
    }
  }, [entry, date])

  if (!isOpen) return null

  const toggleCondition = (id: string) => {
    const newSet = new Set(selectedConditions)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedConditions(newSet)
  }

  const handleSave = () => {
    if (selectedConditions.size === 0) return
    onSave(Array.from(selectedConditions), note)
  }

  // Format date for display
  const displayDate = (() => {
    try {
      const d = new Date(date + 'T00:00:00')
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return date
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {entry ? 'Edit' : 'Add'} Attendance Entry
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{displayDate}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {/* Conditions */}
          <div>
            <label className="label dark:text-gray-300">Conditions</label>
            <div className="space-y-2 mt-1 max-h-48 overflow-y-auto">
              {conditions.map(cond => (
                <label
                  key={cond.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedConditions.has(cond.id)}
                    onChange={() => toggleCondition(cond.id)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: cond.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{cond.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">#{cond.display_number}</span>
                </label>
              ))}
              {conditions.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
                  No conditions configured. Add conditions in Settings.
                </p>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label dark:text-gray-300">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 resize-none mt-1"
              placeholder="Add a note..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            {entry && (
              <button
                onClick={onDelete}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
              >
                Delete Entry
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selectedConditions.size === 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
