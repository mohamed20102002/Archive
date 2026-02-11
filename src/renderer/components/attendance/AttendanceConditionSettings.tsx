import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { AttendanceCondition, Shift } from '../../types'

interface AttendanceConditionSettingsProps {
  isOpen: boolean
  onClose: () => void
  onConditionsChanged: () => void
  onShiftsChanged: () => void
}

export function AttendanceConditionSettings({
  isOpen,
  onClose,
  onConditionsChanged,
  onShiftsChanged
}: AttendanceConditionSettingsProps) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [conditions, setConditions] = useState<AttendanceCondition[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6B7280')
  const [newDisplayNumber, setNewDisplayNumber] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editDisplayNumber, setEditDisplayNumber] = useState('')
  const [editIsIgnored, setEditIsIgnored] = useState(false)
  const [saving, setSaving] = useState(false)

  // Shift state
  const [newShiftName, setNewShiftName] = useState('')
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [editShiftName, setEditShiftName] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    const [conds, allShifts] = await Promise.all([
      window.electronAPI.attendance.getConditions(),
      window.electronAPI.attendance.getShifts()
    ])
    setConditions(conds as AttendanceCondition[])
    setShifts(allShifts as Shift[])
  }

  // ===== Conditions =====

  const handleAddCondition = async () => {
    if (!newName.trim() || !user) return
    setSaving(true)
    const data: any = { name: newName.trim(), color: newColor }
    if (newDisplayNumber) data.display_number = parseInt(newDisplayNumber)
    const result = await window.electronAPI.attendance.createCondition(data, user.id)
    if (result.success) {
      setNewName('')
      setNewColor('#6B7280')
      setNewDisplayNumber('')
      await loadData()
      onConditionsChanged()
    }
    setSaving(false)
  }

  const handleUpdateCondition = async (id: string) => {
    if (!editName.trim() || !user) return
    setSaving(true)
    const data: any = { name: editName.trim(), color: editColor, is_ignored: editIsIgnored }
    if (editDisplayNumber) data.display_number = parseInt(editDisplayNumber)
    const result = await window.electronAPI.attendance.updateCondition(id, data, user.id)
    if (result.success) {
      setEditingId(null)
      await loadData()
      onConditionsChanged()
    }
    setSaving(false)
  }

  const handleDeleteCondition = async (id: string) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Condition',
      message: 'Delete this condition? Historical data will be preserved.',
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return
    const result = await window.electronAPI.attendance.deleteCondition(id, user.id)
    if (result.success) {
      await loadData()
      onConditionsChanged()
    }
  }

  const startEdit = (cond: AttendanceCondition) => {
    setEditingId(cond.id)
    setEditName(cond.name)
    setEditColor(cond.color)
    setEditDisplayNumber(String(cond.display_number))
    setEditIsIgnored(cond.is_ignored)
  }

  // ===== Shifts =====

  const handleAddShift = async () => {
    if (!newShiftName.trim() || !user) return
    setSaving(true)
    const result = await window.electronAPI.attendance.createShift(
      { name: newShiftName.trim() },
      user.id
    )
    if (result.success) {
      setNewShiftName('')
      await loadData()
      onShiftsChanged()
    }
    setSaving(false)
  }

  const handleUpdateShift = async (id: string) => {
    if (!editShiftName.trim() || !user) return
    setSaving(true)
    const result = await window.electronAPI.attendance.updateShift(
      id,
      { name: editShiftName.trim() },
      user.id
    )
    if (result.success) {
      setEditingShiftId(null)
      await loadData()
      onShiftsChanged()
    }
    setSaving(false)
  }

  const handleDeleteShift = async (id: string) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Shift',
      message: 'Delete this shift? Users assigned to it must be reassigned first.',
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return
    const result = await window.electronAPI.attendance.deleteShift(id, user.id)
    if (result.success) {
      await loadData()
      onShiftsChanged()
    } else if (result.error) {
      toast.error('Error', result.error)
    }
  }

  const startEditShift = (shift: Shift) => {
    setEditingShiftId(shift.id)
    setEditShiftName(shift.name)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Attendance Settings</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage conditions and shifts
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
          {/* Conditions Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Conditions</h4>
            <div className="space-y-2">
              {conditions.map(cond => (
                <div key={cond.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  {editingId === cond.id ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={e => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded"
                        onKeyDown={e => e.key === 'Enter' && handleUpdateCondition(cond.id)}
                      />
                      <input
                        type="number"
                        value={editDisplayNumber}
                        onChange={e => setEditDisplayNumber(e.target.value)}
                        className="w-14 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded text-center"
                        title="Display Number"
                        min="1"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title="Exclude from statistics and legend">
                        <input
                          type="checkbox"
                          checked={editIsIgnored}
                          onChange={e => setEditIsIgnored(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        Ignore
                      </label>
                      <button
                        onClick={() => handleUpdateCondition(cond.id)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="w-6 h-6 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: cond.color }}
                      />
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{cond.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{cond.display_number}</span>
                      {cond.is_ignored && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded">
                          Ignored
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(cond)}
                        className="text-xs text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCondition(cond.id)}
                        className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new condition */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New condition name..."
                className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded"
                onKeyDown={e => e.key === 'Enter' && handleAddCondition()}
              />
              <input
                type="number"
                value={newDisplayNumber}
                onChange={e => setNewDisplayNumber(e.target.value)}
                placeholder="#"
                className="w-14 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded text-center"
                title="Display Number (auto-assigned if empty)"
                min="1"
              />
              <button
                onClick={handleAddCondition}
                disabled={!newName.trim() || saving}
                className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Shifts Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Shifts</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Manage shifts that users can be assigned to.
            </p>
            <div className="space-y-2">
              {shifts.map(shift => (
                <div key={shift.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  {editingShiftId === shift.id ? (
                    <>
                      <input
                        type="text"
                        value={editShiftName}
                        onChange={e => setEditShiftName(e.target.value)}
                        className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded"
                        onKeyDown={e => e.key === 'Enter' && handleUpdateShift(shift.id)}
                      />
                      <button
                        onClick={() => handleUpdateShift(shift.id)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingShiftId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{shift.name}</span>
                      <button
                        onClick={() => startEditShift(shift)}
                        className="text-xs text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteShift(shift.id)}
                        className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new shift */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={newShiftName}
                onChange={e => setNewShiftName(e.target.value)}
                placeholder="New shift name..."
                className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded"
                onKeyDown={e => e.key === 'Enter' && handleAddShift()}
              />
              <button
                onClick={handleAddShift}
                disabled={!newShiftName.trim() || saving}
                className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
