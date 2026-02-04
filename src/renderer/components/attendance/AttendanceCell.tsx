import React from 'react'
import { AttendanceEntry } from '../../types'

interface AttendanceCellProps {
  day: number
  month: number
  year: number
  exists: boolean
  isToday: boolean
  entry: AttendanceEntry | null
  isEditable: boolean
  onClick: () => void
}

export function AttendanceCell({
  day,
  month,
  year,
  exists,
  isToday,
  entry,
  isEditable,
  onClick
}: AttendanceCellProps) {
  if (!exists) {
    return (
      <td className="w-10 h-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
    )
  }

  const hasEntry = entry && entry.conditions.length > 0
  const conditions = entry?.conditions || []

  const handleClick = () => {
    if (isEditable) onClick()
  }

  // Build tooltip
  const tooltipParts: string[] = []
  if (hasEntry) {
    tooltipParts.push(conditions.map(c => c.name).join(', '))
    if (entry?.shift_name) tooltipParts.push(`Shift: ${entry.shift_name}`)
    if (entry?.note) tooltipParts.push(`Note: ${entry.note}`)
  }
  const tooltip = tooltipParts.join(' | ')

  // Cell background
  let bgStyle: React.CSSProperties = {}

  if (hasEntry && conditions.length === 1) {
    bgStyle = { backgroundColor: conditions[0].color + '40' }
  } else if (hasEntry && conditions.length >= 2) {
    const stops = conditions.map((c, i) => {
      const start = (i / conditions.length) * 100
      const end = ((i + 1) / conditions.length) * 100
      return `${c.color}40 ${start}%, ${c.color}40 ${end}%`
    }).join(', ')
    bgStyle = { background: `linear-gradient(to bottom, ${stops})` }
  }

  return (
    <td
      className={`w-10 h-10 min-w-[2.5rem] border border-gray-200 dark:border-gray-700 text-center relative group
        ${isEditable ? 'cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-inset' : ''}
        ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
      style={bgStyle}
      onClick={handleClick}
      title={tooltip}
    >
      {hasEntry && (
        <span className="text-[10px] leading-none font-medium text-gray-700 dark:text-gray-200">
          {conditions.map(c => c.display_number).join('')}
        </span>
      )}
    </td>
  )
}
