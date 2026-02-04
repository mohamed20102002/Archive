import React from 'react'
import { AttendanceCell } from './AttendanceCell'
import { AttendanceEntry } from '../../types'

interface AttendanceCalendarProps {
  year: number
  entries: AttendanceEntry[]
  isEditable: boolean
  onCellClick: (date: string) => void
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function AttendanceCalendar({
  year,
  entries,
  isEditable,
  onCellClick
}: AttendanceCalendarProps) {
  // Build entry lookup map: "month-day" -> entry
  const entryMap = new Map<string, AttendanceEntry>()
  for (const entry of entries) {
    entryMap.set(`${entry.month}-${entry.day}`, entry)
  }

  // Compute today
  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1
  const todayDay = now.getDate()

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              Month
            </th>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <th
                key={day}
                className="px-0 py-1.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 w-10 min-w-[2.5rem]"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const daysInMonth = getDaysInMonth(year, month)

            return (
              <tr key={month}>
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                  {MONTH_NAMES[month - 1]}
                </td>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                  const exists = day <= daysInMonth
                  const isToday = exists && year === todayYear && month === todayMonth && day === todayDay
                  const entry = entryMap.get(`${month}-${day}`) || null

                  return (
                    <AttendanceCell
                      key={day}
                      day={day}
                      month={month}
                      year={year}
                      exists={exists}
                      isToday={isToday}
                      entry={entry}
                      isEditable={isEditable && exists}
                      onClick={() => onCellClick(formatDate(year, month, day))}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
