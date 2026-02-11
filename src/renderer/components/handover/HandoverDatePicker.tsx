import React from 'react'
import { format, parseISO } from 'date-fns'

interface HandoverDatePickerProps {
  startDate: string
  endDate: string
  weekNumber: number
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export function HandoverDatePicker({
  startDate,
  endDate,
  weekNumber,
  onStartDateChange,
  onEndDateChange
}: HandoverDatePickerProps) {
  // Format date for input (YYYY-MM-DD)
  const formatForInput = (isoDate: string) => {
    try {
      return format(parseISO(isoDate), 'yyyy-MM-dd')
    } catch {
      return ''
    }
  }

  return (
    <div className="flex items-center justify-between gap-6">
      {/* Week Number */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Week</span>
        <span className="text-xl font-bold text-primary-600">{weekNumber}</span>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={formatForInput(startDate)}
            onChange={(e) => {
              if (e.target.value) {
                const date = new Date(e.target.value)
                date.setHours(0, 0, 0, 0)
                onStartDateChange(date.toISOString())
              }
            }}
            className="input text-sm py-1 px-2 w-36"
          />
        </div>

        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={formatForInput(endDate)}
            onChange={(e) => {
              if (e.target.value) {
                const date = new Date(e.target.value)
                date.setHours(23, 59, 59, 999)
                onEndDateChange(date.toISOString())
              }
            }}
            className="input text-sm py-1 px-2 w-36"
          />
        </div>
      </div>

      {/* Spacer for balance */}
      <div className="w-20"></div>
    </div>
  )
}
