import React from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

interface CalendarEvent {
  id: string
  type: 'reminder' | 'issue' | 'mom' | 'letter' | 'action'
  title: string
  date: string
  status?: string
  priority?: string
  entity_id: string
  topic_id?: string
  topic_title?: string
  color: string
}

interface CalendarDayModalProps {
  date: Date
  events: CalendarEvent[]
  onClose: () => void
}

const typeLabels: Record<string, string> = {
  reminder: 'Reminder',
  issue: 'Issue',
  mom: 'Meeting',
  letter: 'Letter',
  action: 'Action Item'
}

export function CalendarDayModal({ date, events, onClose }: CalendarDayModalProps) {
  const navigate = useNavigate()

  const handleEventClick = (event: CalendarEvent) => {
    // Build highlight state to pass to destination
    // For actions, we highlight the parent MOM
    const highlightType = event.type === 'action' ? 'mom_action' : event.type
    const highlightId = event.type === 'action' ? event.entity_id : event.id

    const highlightState = {
      highlightType,
      highlightId,
      highlightParentId: event.topic_id
    }

    switch (event.type) {
      case 'reminder':
        navigate('/reminders', { state: highlightState })
        break
      case 'issue':
        navigate('/issues', { state: highlightState })
        break
      case 'mom':
      case 'action':
        navigate('/mom', { state: highlightState })
        break
      case 'letter':
        navigate('/letters', { state: highlightState })
        break
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No events for this day
            </div>
          ) : (
            <ul className="space-y-3">
              {events.map((event) => (
                <li
                  key={`${event.type}-${event.id}`}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {typeLabels[event.type]}
                        </span>
                        {event.status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            event.status === 'completed' || event.status === 'closed' || event.status === 'resolved'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : event.status === 'open' || event.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {event.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.title}
                      </p>
                      {event.topic_title && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {event.topic_title}
                        </p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
