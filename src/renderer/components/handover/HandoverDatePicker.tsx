import React from 'react'
import type { WeekInfo } from '../../types'

interface HandoverDatePickerProps {
  weekInfo: WeekInfo
  onPrevWeek: () => void
  onNextWeek: () => void
  isCurrentWeek: boolean
}

export function HandoverDatePicker({
  weekInfo,
  onPrevWeek,
  onNextWeek,
  isCurrentWeek
}: HandoverDatePickerProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrevWeek}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Previous week"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">{weekInfo.displayText}</h3>
        {isCurrentWeek && (
          <span className="text-xs text-primary-600 font-medium">Current Week</span>
        )}
      </div>

      <button
        onClick={onNextWeek}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Next week"
        disabled={isCurrentWeek}
      >
        <svg
          className={`w-5 h-5 ${isCurrentWeek ? 'text-gray-300' : 'text-gray-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
