import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isPast, isToday, parseISO } from 'date-fns'
import type { Reminder, Issue } from '../../types'

// Unified type for items shown in the badge dropdown
interface BadgeItem {
  id: string
  title: string
  due_date: string
  is_overdue: boolean
  topic_title?: string
  source: 'reminder' | 'issue'
}

// Dispatch this event from any component after mutating reminder or issue data
// so the badge refreshes immediately.
export function notifyReminderDataChanged(): void {
  window.dispatchEvent(new CustomEvent('reminder-data-changed'))
}

export function ReminderBadge() {
  const [items, setItems] = useState<BadgeItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const loadAll = useCallback(async () => {
    try {
      // Fetch regular reminders and issue reminders in parallel
      const [overdue, upcoming, issueReminders] = await Promise.all([
        window.electronAPI.reminders.getOverdue(),
        window.electronAPI.reminders.getUpcoming(3), // Next 3 days
        window.electronAPI.issues.getWithReminders(3) // All open issues with reminders (overdue + next 3 days)
      ])

      // Build unified list from regular reminders
      const remindersCombined = [...(overdue as Reminder[]), ...(upcoming as Reminder[])]
      const uniqueReminders = remindersCombined.filter((r, idx, arr) =>
        arr.findIndex(x => x.id === r.id) === idx
      )

      const reminderItems: BadgeItem[] = uniqueReminders.map(r => ({
        id: r.id,
        title: r.title,
        due_date: r.due_date,
        is_overdue: !!r.is_overdue,
        topic_title: r.topic_title,
        source: 'reminder'
      }))

      // Build unified list from issue reminders (both overdue and upcoming)
      const now = new Date()
      const issueItems: BadgeItem[] = (issueReminders as Issue[])
        .filter(i => i.reminder_date)
        .map(i => ({
          id: `issue-${i.id}`,
          title: i.title,
          due_date: i.reminder_date!,
          is_overdue: new Date(i.reminder_date!) < now,
          topic_title: i.topic_title,
          source: 'issue'
        }))

      // Merge, sort by due date, cap at 8
      const all = [...reminderItems, ...issueItems]
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 8)

      setItems(all)
    } catch (err) {
      console.error('Error loading reminders:', err)
    }
  }, [])

  useEffect(() => {
    loadAll()

    // Poll every 30 seconds
    const interval = setInterval(loadAll, 30000)

    // Also listen for immediate refresh events
    const handleDataChanged = () => loadAll()
    window.addEventListener('reminder-data-changed', handleDataChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('reminder-data-changed', handleDataChanged)
    }
  }, [loadAll])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const overdueCount = items.filter(r => r.is_overdue).length
  const totalCount = items.length

  const formatDueText = (item: BadgeItem): { text: string; urgent: boolean } => {
    try {
      const date = parseISO(item.due_date)

      if (isPast(date) && !isToday(date)) {
        return { text: 'Overdue', urgent: true }
      }

      if (isToday(date)) {
        return { text: `Today ${format(date, 'h:mm a')}`, urgent: true }
      }

      return { text: format(date, 'EEE h:mm a'), urgent: false }
    } catch {
      return { text: item.due_date, urgent: false }
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Reminders"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge */}
        {totalCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full ${
            overdueCount > 0
              ? 'bg-red-500 text-white'
              : 'bg-primary-500 text-white'
          }`}>
            {totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-fade-in">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Reminders</h3>
              {overdueCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                  {overdueCount} overdue
                </span>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">No upcoming reminders</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((item) => {
                const dueInfo = formatDueText(item)

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false)
                      navigate(item.source === 'issue' ? '/issues' : '/reminders')
                    }}
                    className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                        dueInfo.urgent ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.title}
                          </p>
                          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0 rounded font-medium ${
                            item.source === 'issue'
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {item.source === 'issue' ? 'Issue' : 'Reminder'}
                          </span>
                        </div>
                        <p className={`text-xs ${dueInfo.urgent ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {dueInfo.text}
                        </p>
                        {item.topic_title && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {item.topic_title}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/reminders')
              }}
              className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all reminders
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
