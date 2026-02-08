import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isPast, isToday, parseISO } from 'date-fns'
import type { Reminder, Issue, MomAction } from '../../types'

// Unified type for items shown in the badge dropdown
interface BadgeItem {
  id: string
  originalId: string // The actual ID (without prefix) for navigation
  title: string
  due_date: string
  is_overdue: boolean
  topic_title?: string
  record_title?: string
  source: 'reminder' | 'issue' | 'mom-action'
}

// Dispatch this event from any component after mutating reminder or issue data
// so the badge refreshes immediately.
export function notifyReminderDataChanged(): void {
  window.dispatchEvent(new CustomEvent('reminder-data-changed'))
}

export function ReminderBadge() {
  const [items, setItems] = useState<BadgeItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const loadAll = useCallback(async () => {
    try {
      // Fetch ALL reminders, issue reminders, and MOM actions with reminders/deadlines
      const [allReminders, allIssueReminders, momActionsWithReminders, momActionsWithDeadlines] = await Promise.all([
        window.electronAPI.reminders.getAll(),
        window.electronAPI.issues.getWithReminders(365),
        window.electronAPI.momActions.getWithReminders(),
        window.electronAPI.momActions.getWithDeadlines()
      ])

      const now = new Date()

      // Filter to only pending (non-completed) reminders
      const pendingReminders = (allReminders as Reminder[]).filter(r => !r.is_completed)

      const reminderItems: BadgeItem[] = pendingReminders.map(r => ({
        id: r.id,
        originalId: r.id,
        title: r.title,
        due_date: r.due_date,
        is_overdue: !!r.is_overdue,
        topic_title: r.topic_title,
        record_title: r.record_title,
        source: 'reminder'
      }))

      // Build unified list from issue reminders
      const issueItems: BadgeItem[] = (allIssueReminders as Issue[])
        .filter(i => i.reminder_date)
        .map(i => ({
          id: `issue-${i.id}`,
          originalId: i.id,
          title: i.title,
          due_date: i.reminder_date!,
          is_overdue: new Date(i.reminder_date!) < now,
          topic_title: i.topic_title,
          source: 'issue'
        }))

      // Build unified list from MOM actions (combine reminders and deadlines, dedupe by id)
      const momActionsMap = new Map<string, MomAction & { mom_title?: string }>()

      // Add actions with reminders
      for (const action of (momActionsWithReminders as MomAction[])) {
        if (action.status !== 'resolved' && action.reminder_date) {
          momActionsMap.set(action.id, action)
        }
      }

      // Add actions with deadlines (if not already added)
      for (const action of (momActionsWithDeadlines as (MomAction & { mom_title?: string })[])) {
        if (action.status !== 'resolved' && action.deadline && !momActionsMap.has(action.id)) {
          momActionsMap.set(action.id, action)
        }
      }

      const momActionItems: BadgeItem[] = Array.from(momActionsMap.values()).map(a => {
        const dueDate = a.reminder_date || a.deadline!
        return {
          id: `mom-action-${a.id}`,
          originalId: a.mom_internal_id,
          title: a.description.length > 50 ? a.description.substring(0, 50) + '...' : a.description,
          due_date: dueDate,
          is_overdue: new Date(dueDate) < now,
          topic_title: (a as any).mom_title,
          source: 'mom-action'
        }
      })

      // Merge and sort by due date
      const all = [...reminderItems, ...issueItems, ...momActionItems]
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

      // Count totals BEFORE slicing
      setTotalCount(all.length)
      setOverdueCount(all.filter(item => item.is_overdue).length)

      // Cap display at 8 items (show most urgent first)
      setItems(all.slice(0, 8))
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
                      if (item.source === 'issue') {
                        navigate(`/issues?issueId=${item.originalId}`)
                      } else if (item.source === 'mom-action') {
                        navigate(`/mom?momId=${item.originalId}`)
                      } else {
                        navigate('/reminders')
                      }
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
                              : item.source === 'mom-action'
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {item.source === 'issue' ? 'Issue' : item.source === 'mom-action' ? 'MOM' : 'Reminder'}
                          </span>
                        </div>
                        <p className={`text-xs ${dueInfo.urgent ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {dueInfo.text}
                        </p>
                        {(item.topic_title || item.record_title) && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {item.topic_title}
                            {item.topic_title && item.record_title && ' / '}
                            {item.record_title}
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
              {totalCount > items.length
                ? `View all ${totalCount} reminders`
                : 'View all reminders'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
