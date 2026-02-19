import React from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns'

interface CalendarEvent {
  id: string
  type: 'reminder' | 'issue' | 'mom' | 'letter' | 'action'
  title: string
  date: string
  color: string
}

interface CalendarGridProps {
  currentDate: Date
  events: CalendarEvent[]
  onDayClick: (date: Date, events: CalendarEvent[]) => void
}

export function CalendarGrid({ currentDate, events, onDayClick }: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(event => event.date === dateStr)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {weekDays.map(day => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isCurrentDay = isToday(day)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day, dayEvents)}
              className={`
                min-h-24 p-2 border-b border-r border-gray-200 dark:border-gray-700
                cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                ${idx % 7 === 0 ? 'border-l' : ''}
                ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900' : ''}
              `}
            >
              <div className={`
                inline-flex items-center justify-center w-7 h-7 rounded-full text-sm mb-1
                ${isCurrentDay
                  ? 'bg-primary-600 text-white'
                  : isCurrentMonth
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-600'
                }
              `}>
                {format(day, 'd')}
              </div>

              {/* Event indicators */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={`${event.type}-${event.id}`}
                    className="flex items-center gap-1 text-xs truncate"
                    title={event.title}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <span className="truncate text-gray-700 dark:text-gray-300">
                      {event.title}
                    </span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 pl-3">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
