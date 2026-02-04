import React from 'react'
import { AttendanceCondition, AttendanceSummary as AttendanceSummaryType, Shift } from '../../types'

interface AttendanceSummaryProps {
  summary: AttendanceSummaryType | null
  conditions: AttendanceCondition[]
  shifts: Shift[]
}

export function AttendanceSummary({ summary, conditions, shifts }: AttendanceSummaryProps) {
  if (!summary || summary.total_entries === 0) {
    return (
      <div className="card dark:bg-gray-800 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Statistics</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">No data for the selected period.</p>
      </div>
    )
  }

  return (
    <div className="card dark:bg-gray-800 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Statistics</h3>

      {/* Condition breakdown */}
      <div className="space-y-2 mb-4">
        {conditions.map(cond => {
          const count = summary.condition_totals[cond.id] || 0
          if (count === 0) return null
          return (
            <div key={cond.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
                  style={{ backgroundColor: cond.color }}
                />
                <span className="text-gray-600 dark:text-gray-300">{cond.name}</span>
              </div>
              <span className="font-medium text-gray-800 dark:text-gray-200">{count} days</span>
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
        {/* Total */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Total Entries</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">{summary.total_entries}</span>
        </div>

        {/* Dynamic shift breakdown */}
        {shifts.map(shift => {
          const count = summary.shift_totals[shift.id] || 0
          return (
            <div key={shift.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{shift.name}</span>
              <span className="text-gray-700 dark:text-gray-300">{count} days</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
