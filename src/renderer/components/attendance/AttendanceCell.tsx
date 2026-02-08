import React, { useState } from 'react'
import { AttendanceEntry, AttendanceCondition } from '../../types'
import { format } from 'date-fns'

interface AttendanceCellProps {
  day: number
  month: number
  year: number
  exists: boolean
  isToday: boolean
  entry: AttendanceEntry | null
  conditions: AttendanceCondition[]
  isEditable: boolean
  onClick: () => void
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Darken a hex color for better text visibility
function darkenColor(hex: string, percent: number = 40): string {
  hex = hex.replace('#', '')
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.floor(r * (100 - percent) / 100)
  g = Math.floor(g * (100 - percent) / 100)
  b = Math.floor(b * (100 - percent) / 100)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function AttendanceCell({
  day,
  month,
  year,
  exists,
  isToday,
  entry,
  conditions: allConditions,
  isEditable,
  onClick
}: AttendanceCellProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!exists) {
    return (
      <td className="w-10 h-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
    )
  }

  // Build condition map for quick lookup of current colors
  const conditionMap = new Map(allConditions.map(c => [c.id, c]))

  // Get entry conditions with current colors from conditions prop
  const entryConditions = (entry?.conditions || []).map(ec => {
    const current = conditionMap.get(ec.id)
    return current || ec // Use current condition data if available, fallback to entry data
  })

  const hasEntry = entry && entryConditions.length > 0

  const handleClick = () => {
    if (isEditable) onClick()
  }

  // Format date for tooltip
  const date = new Date(year, month - 1, day)
  const dayName = DAY_NAMES[date.getDay()]
  const formattedDate = format(date, 'dd/MM/yyyy')

  // Cell background
  let bgStyle: React.CSSProperties = {}

  if (hasEntry && entryConditions.length === 1) {
    bgStyle = { backgroundColor: entryConditions[0].color + '40' }
  } else if (hasEntry && entryConditions.length >= 2) {
    const stops = entryConditions.map((c, i) => {
      const start = (i / entryConditions.length) * 100
      const end = ((i + 1) / entryConditions.length) * 100
      return `${c.color}40 ${start}%, ${c.color}40 ${end}%`
    }).join(', ')
    bgStyle = { background: `linear-gradient(to bottom, ${stops})` }
  }

  // Determine tooltip position - show below for top rows (Jan-Apr), above for others
  const showBelow = month <= 4

  return (
    <td
      className={`w-10 h-10 min-w-[2.5rem] border border-gray-200 dark:border-gray-700 text-center relative
        ${isEditable ? 'cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-inset' : ''}
        ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
      style={bgStyle}
      onClick={handleClick}
      onMouseEnter={() => hasEntry && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Display numbers stacked vertically with darkened colors for visibility */}
      {hasEntry && (
        <div className="flex flex-col items-center justify-center h-full gap-0 leading-none">
          {entryConditions.map(c => (
            <span
              key={c.id}
              className="text-[9px] font-bold leading-tight"
              style={{ color: darkenColor(c.color, 30) }}
            >
              {c.display_number}
            </span>
          ))}
        </div>
      )}

      {/* Custom Tooltip - only for entries */}
      {showTooltip && hasEntry && (
        <div className={`absolute z-50 left-1/2 -translate-x-1/2 pointer-events-none ${
          showBelow ? 'top-full mt-2' : 'bottom-full mb-2'
        }`}>
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg p-3 min-w-[180px] max-w-[240px]">
            {/* Date Header */}
            <div className="font-semibold text-sm border-b border-gray-700 dark:border-gray-600 pb-2 mb-2">
              {dayName}, {formattedDate}
            </div>

            <div className="space-y-2">
              {/* Conditions */}
              <div>
                <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Conditions</div>
                <div className="space-y-1">
                  {entryConditions.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              {entry?.note && (
                <div>
                  <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Note</div>
                  <div className="text-gray-200 italic">{entry.note}</div>
                </div>
              )}

              {/* Edited by */}
              {entry?.created_by_name && (
                <div className="text-gray-400 text-[10px] pt-1 border-t border-gray-700 dark:border-gray-600">
                  Edited by: {entry.created_by_name}
                </div>
              )}
            </div>

            {/* Tooltip arrow */}
            {showBelow ? (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
            ) : (
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
            )}
          </div>
        </div>
      )}
    </td>
  )
}
