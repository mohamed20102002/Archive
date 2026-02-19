import React, { useState, useEffect } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { CalendarGrid } from './CalendarGrid'
import { CalendarDayModal } from './CalendarDayModal'

interface CalendarEvent {
  id: string
  type: 'reminder' | 'issue' | 'mom' | 'letter' | 'action'
  title: string
  date: string
  time?: string
  status?: string
  priority?: string
  entity_id: string
  topic_id?: string
  topic_title?: string
  color: string
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<{ date: Date; events: CalendarEvent[] } | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    loadEvents()
  }, [currentDate])

  async function loadEvents() {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const result = await window.electronAPI.calendar.getEvents(year, month)
      setEvents(result as CalendarEvent[])
    } catch (error) {
      console.error('Error loading calendar events:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const handleToday = () => setCurrentDate(new Date())

  const handleDayClick = (date: Date, dayEvents: CalendarEvent[]) => {
    setSelectedDay({ date, events: dayEvents })
  }

  const filteredEvents = filterType === 'all'
    ? events
    : events.filter(e => e.type === filterType)

  const eventTypes = [
    { value: 'all', label: 'All Events', color: '#6B7280' },
    { value: 'reminder', label: 'Reminders', color: '#3B82F6' },
    { value: 'issue', label: 'Issues', color: '#EF4444' },
    { value: 'mom', label: 'Meetings', color: '#8B5CF6' },
    { value: 'letter', label: 'Letters', color: '#10B981' },
    { value: 'action', label: 'Actions', color: '#F59E0B' }
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="text-gray-500 dark:text-gray-400">View deadlines, meetings, and reminders</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Event type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input py-2"
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <button onClick={handleToday} className="btn btn-secondary">
            Today
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 min-w-48 text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4">
          {eventTypes.slice(1).map(type => (
            <div key={type.value} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{type.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <CalendarGrid
          currentDate={currentDate}
          events={filteredEvents}
          onDayClick={handleDayClick}
        />
      )}

      {/* Day Modal */}
      {selectedDay && (
        <CalendarDayModal
          date={selectedDay.date}
          events={selectedDay.events}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
