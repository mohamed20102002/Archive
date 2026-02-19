import React, { useState, useEffect, useMemo, useRef } from 'react'
import { isPast, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO, addDays } from 'date-fns'
import { useNavigate, useLocation } from 'react-router-dom'
import { ReminderForm } from './ReminderForm'
import { notifyReminderDataChanged } from './ReminderBadge'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import type { Reminder, Issue, MomAction } from '../../types'

// Filter and sort types
type TimeRangeFilter = 'all' | 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'this-month'
type StatusFilter = 'pending' | 'completed' | 'all'
type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal' | 'low'
type SortOption = 'due-date-asc' | 'due-date-desc' | 'priority' | 'created' | 'title'
type ViewMode = 'card' | 'table'

// Storage keys for persistence
const STORAGE_KEYS = {
  timeRange: 'reminder_filter_time_range',
  status: 'reminder_filter_status',
  priority: 'reminder_filter_priority',
  sort: 'reminder_sort',
  viewMode: 'reminder_view_mode'
}

// Unified item for displaying both reminders and issue reminders
interface DisplayItem {
  id: string
  originalId: string
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  is_overdue: boolean
  priority: string
  topic_title?: string
  record_title?: string
  completed_at?: string | null
  created_at?: string
  source: 'reminder' | 'issue' | 'mom-action'
  mom_internal_id?: string
  topic_id?: string | null
}

// Priority sort order (higher = more important)
const priorityOrder: Record<string, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1
}

export function ReminderList() {
  const { formatDate } = useSettings()
  const location = useLocation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedReminderId, setHighlightedReminderId] = useState<string | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [issueReminders, setIssueReminders] = useState<Issue[]>([])
  const [momActionReminders, setMomActionReminders] = useState<MomAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  // Filters with persistence
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>(() =>
    (localStorage.getItem(STORAGE_KEYS.timeRange) as TimeRangeFilter) || 'this-week'
  )
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    (localStorage.getItem(STORAGE_KEYS.status) as StatusFilter) || 'pending'
  )
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(() =>
    (localStorage.getItem(STORAGE_KEYS.priority) as PriorityFilter) || 'all'
  )
  const [sortBy, setSortBy] = useState<SortOption>(() =>
    (localStorage.getItem(STORAGE_KEYS.sort) as SortOption) || 'due-date-asc'
  )
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem(STORAGE_KEYS.viewMode) as ViewMode) || 'card'
  )

  const { success, error } = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Persist filter changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.timeRange, timeRange)
  }, [timeRange])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.status, statusFilter)
  }, [statusFilter])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.priority, priorityFilter)
  }, [priorityFilter])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sort, sortBy)
  }, [sortBy])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.viewMode, viewMode)
  }, [viewMode])

  const loadReminders = async () => {
    try {
      const [data, issueData, momActionData] = await Promise.all([
        window.electronAPI.reminders.getAll(),
        window.electronAPI.issues.getWithReminders(),
        window.electronAPI.momActions.getWithDeadlines()
      ])
      setReminders(data as Reminder[])
      setIssueReminders((issueData as Issue[]).filter(i => i.reminder_date))
      setMomActionReminders(momActionData as MomAction[])
    } catch (err) {
      console.error('Error loading reminders:', err)
      error('Failed to load reminders')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReminders()

    const handleDataChanged = () => loadReminders()
    window.addEventListener('reminder-data-changed', handleDataChanged)
    return () => window.removeEventListener('reminder-data-changed', handleDataChanged)
  }, [])

  // Handle search highlight from global search
  useEffect(() => {
    const state = location.state as any
    if (state?.highlightType === 'reminder' && state?.highlightId) {
      const reminderId = state.highlightId
      setHighlightedReminderId(reminderId)

      // Scroll to the reminder after a short delay
      setTimeout(() => {
        const el = scrollContainerRef.current?.querySelector(`[data-reminder-id="${reminderId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)

      // Clear highlight after 5 seconds
      const timer = setTimeout(() => setHighlightedReminderId(null), 5000)

      // Clear the location state
      window.history.replaceState({}, document.title)

      return () => clearTimeout(timer)
    }
  }, [location.state])

  // Build unified display items
  const now = new Date()
  const allItems: DisplayItem[] = useMemo(() => [
    ...reminders.map((r): DisplayItem => ({
      id: r.id,
      originalId: r.id,
      title: r.title,
      description: r.description || null,
      due_date: r.due_date,
      is_completed: !!r.is_completed,
      is_overdue: !!r.is_overdue,
      priority: r.priority || 'normal',
      topic_title: r.topic_title,
      record_title: r.record_title,
      completed_at: r.completed_at,
      created_at: r.created_at,
      source: 'reminder',
      topic_id: r.topic_id
    })),
    ...issueReminders.map((i): DisplayItem => ({
      id: `issue-${i.id}`,
      originalId: i.id,
      title: i.title,
      description: i.description || null,
      due_date: i.reminder_date!,
      is_completed: false,
      is_overdue: new Date(i.reminder_date!) < now,
      priority: i.importance === 'critical' ? 'urgent' : i.importance === 'high' ? 'high' : 'normal',
      topic_title: i.topic_title,
      completed_at: null,
      created_at: i.created_at,
      source: 'issue'
    })),
    ...momActionReminders.map((a): DisplayItem => ({
      id: `mom-action-${a.id}`,
      originalId: a.mom_internal_id,
      title: a.description,
      description: a.mom_title || null,
      due_date: a.deadline!,
      is_completed: false,
      is_overdue: new Date(a.deadline!) < now,
      priority: 'normal',
      topic_title: undefined,
      completed_at: null,
      created_at: a.created_at,
      source: 'mom-action',
      mom_internal_id: a.mom_internal_id
    }))
  ], [reminders, issueReminders, momActionReminders])

  // Apply filters and sorting
  const filteredReminders = useMemo(() => {
    let items = [...allItems]

    // Status filter
    switch (statusFilter) {
      case 'pending':
        items = items.filter(item => !item.is_completed)
        break
      case 'completed':
        items = items.filter(item => item.is_completed)
        break
    }

    // Time range filter (only for pending items)
    if (statusFilter !== 'completed') {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)
      const tomorrowEnd = addDays(todayEnd, 1)
      const weekEnd = addDays(todayEnd, 7)
      const monthEnd = addDays(todayEnd, 30)

      switch (timeRange) {
        case 'overdue':
          items = items.filter(item => {
            const dueDate = parseISO(item.due_date)
            return isPast(dueDate) && !isToday(dueDate)
          })
          break
        case 'today':
          items = items.filter(item => isToday(parseISO(item.due_date)))
          break
        case 'tomorrow':
          items = items.filter(item => isTomorrow(parseISO(item.due_date)))
          break
        case 'this-week':
          items = items.filter(item => {
            const dueDate = parseISO(item.due_date)
            return dueDate <= weekEnd || isPast(dueDate) // Include overdue in this-week
          })
          break
        case 'this-month':
          items = items.filter(item => {
            const dueDate = parseISO(item.due_date)
            return dueDate <= monthEnd || isPast(dueDate)
          })
          break
      }
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      items = items.filter(item => item.priority === priorityFilter)
    }

    // Sorting
    items.sort((a, b) => {
      switch (sortBy) {
        case 'due-date-asc':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        case 'due-date-desc':
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
        case 'priority':
          return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2)
        case 'created':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    return items
  }, [allItems, statusFilter, timeRange, priorityFilter, sortBy])

  // Calculate counts for badges
  const counts = useMemo(() => {
    const pending = allItems.filter(r => !r.is_completed)
    const overdue = pending.filter(r => {
      const dueDate = parseISO(r.due_date)
      return isPast(dueDate) && !isToday(dueDate)
    })
    const dueToday = pending.filter(r => isToday(parseISO(r.due_date)))
    const dueTomorrow = pending.filter(r => isTomorrow(parseISO(r.due_date)))
    const dueThisWeek = pending.filter(r => {
      const dueDate = parseISO(r.due_date)
      const weekEnd = addDays(new Date(), 7)
      return dueDate <= weekEnd || isPast(dueDate)
    })
    const dueThisMonth = pending.filter(r => {
      const dueDate = parseISO(r.due_date)
      const monthEnd = addDays(new Date(), 30)
      return dueDate <= monthEnd || isPast(dueDate)
    })

    return {
      all: allItems.length,
      pending: pending.length,
      completed: allItems.filter(r => r.is_completed).length,
      overdue: overdue.length,
      today: dueToday.length,
      tomorrow: dueTomorrow.length,
      thisWeek: dueThisWeek.length,
      thisMonth: dueThisMonth.length
    }
  }, [allItems])

  const handleCreate = async (data: { title: string; description?: string; due_date: string; priority?: string; topic_id?: string }) => {
    if (!user) return

    const result = await window.electronAPI.reminders.create(data, user.id)
    if (result.success) {
      success('Reminder created')
      setShowForm(false)
      loadReminders()
      notifyReminderDataChanged()
    } else {
      error('Failed to create reminder', result.error)
    }
  }

  const handleComplete = async (id: string) => {
    if (!user) return

    const result = await window.electronAPI.reminders.complete(id, user.id)
    if (result.success) {
      success('Reminder completed')
      loadReminders()
      notifyReminderDataChanged()
    } else {
      error('Failed to complete reminder', result.error)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!user) return

    const confirmed = await confirm({
      title: 'Delete Reminder',
      message: `Are you sure you want to delete "${title}"?`,
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    const result = await window.electronAPI.reminders.delete(id, user.id)
    if (result.success) {
      success('Reminder deleted')
      loadReminders()
      notifyReminderDataChanged()
    } else {
      error('Failed to delete reminder', result.error)
    }
  }

  const formatDueDate = (dateStr: string, isCompleted: boolean): { text: string; className: string; badgeClass?: string } => {
    if (isCompleted) {
      return { text: 'Completed', className: 'text-gray-400' }
    }

    const date = parseISO(dateStr)

    if (isPast(date) && !isToday(date)) {
      return {
        text: `Overdue (${formatDate(date, 'short')})`,
        className: 'text-red-600 font-medium',
        badgeClass: 'bg-red-100 text-red-700 border-red-200'
      }
    }

    if (isToday(date)) {
      return {
        text: `Today at ${formatDate(date, 'withTime').split(' ').slice(-2).join(' ')}`,
        className: 'text-orange-600 font-medium',
        badgeClass: 'bg-orange-100 text-orange-700 border-orange-200'
      }
    }

    if (isTomorrow(date)) {
      return {
        text: `Tomorrow at ${formatDate(date, 'withTime').split(' ').slice(-2).join(' ')}`,
        className: 'text-yellow-600 font-medium',
        badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200'
      }
    }

    if (isThisWeek(date)) {
      return { text: formatDate(date, 'withDay'), className: 'text-blue-600' }
    }

    return { text: formatDate(date, 'withTime'), className: 'text-gray-600' }
  }

  const priorityConfig: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
    normal: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    urgent: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light dark:bg-gray-900 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        {/* Top Row: Status Filter and Actions */}
        <div className="flex items-center justify-between mb-4">
          {/* Status Tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            {[
              { value: 'pending', label: 'Pending', count: counts.pending },
              { value: 'completed', label: 'Completed', count: counts.completed },
              { value: 'all', label: 'All', count: counts.all }
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value as StatusFilter)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    statusFilter === tab.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Reminder
          </button>
        </div>

        {/* Second Row: Time Range, Priority, Sort, and View */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Time Range Filter (only show for pending) */}
            {statusFilter !== 'completed' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Time:</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRangeFilter)}
                  className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="overdue">Overdue ({counts.overdue})</option>
                  <option value="today">Due Today ({counts.today})</option>
                  <option value="tomorrow">Due Tomorrow ({counts.tomorrow})</option>
                  <option value="this-week">This Week ({counts.thisWeek})</option>
                  <option value="this-month">This Month ({counts.thisMonth})</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            )}

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500"
              >
                <option value="due-date-asc">Due Date (Soonest)</option>
                <option value="due-date-desc">Due Date (Latest)</option>
                <option value="priority">Priority (High → Low)</option>
                <option value="created">Recently Created</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title="Card View"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title="Table View"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        {statusFilter === 'pending' && (counts.overdue > 0 || counts.today > 0) && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {counts.overdue > 0 && (
              <button
                onClick={() => setTimeRange('overdue')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  timeRange === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {counts.overdue} Overdue
              </button>
            )}
            {counts.today > 0 && (
              <button
                onClick={() => setTimeRange('today')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  timeRange === 'today'
                    ? 'bg-orange-600 text-white'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {counts.today} Due Today
              </button>
            )}
            {counts.tomorrow > 0 && (
              <button
                onClick={() => setTimeRange('tomorrow')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  timeRange === 'tomorrow'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                {counts.tomorrow} Due Tomorrow
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto px-6 py-6">
        {/* Reminders List */}
        {filteredReminders.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No reminders found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {statusFilter === 'pending' && timeRange === 'this-week'
                ? 'No reminders due this week. You\'re all caught up!'
                : statusFilter === 'completed'
                  ? 'No completed reminders yet.'
                  : 'No reminders match your current filters.'
              }
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="space-y-3">
            {filteredReminders.map((item) => {
              const dueInfo = formatDueDate(item.due_date, item.is_completed)
              const isIssue = item.source === 'issue'
              const isMomAction = item.source === 'mom-action'
              const isClickable = isIssue || isMomAction
              const pConfig = priorityConfig[item.priority] || priorityConfig.normal

              const handleRowClick = () => {
                if (isIssue) navigate(`/issues?issueId=${item.originalId}`)
                else if (isMomAction && item.mom_internal_id) navigate(`/mom?momId=${item.mom_internal_id}`)
              }

              return (
                <div
                  key={item.id}
                  data-reminder-id={item.id}
                  onClick={isClickable ? handleRowClick : undefined}
                  className={`card-hover flex items-start gap-4 transition-colors duration-700 ${
                    item.is_completed ? 'opacity-60' : ''
                  } ${isClickable ? 'cursor-pointer' : ''} ${
                    !item.is_completed && item.is_overdue ? 'border-l-4 border-l-red-500' : ''
                  } ${highlightedReminderId === item.id ? 'ring-2 ring-primary-400 bg-primary-50 dark:bg-primary-900/20' : ''}`}
                >
                  {/* Checkbox / Issue icon / MOM Action icon */}
                  {isMomAction ? (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                  ) : isIssue ? (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!item.is_completed) handleComplete(item.id)
                      }}
                      disabled={item.is_completed}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        item.is_completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-primary-500'
                      }`}
                    >
                      {item.is_completed && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-medium ${item.is_completed ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                            {item.title}
                          </h4>
                          {/* Source Badge */}
                          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0 rounded font-medium ${
                            isMomAction
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                              : isIssue
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          }`}>
                            {isMomAction ? 'MOM Action' : isIssue ? 'Issue' : 'Reminder'}
                          </span>
                          {/* Priority Badge */}
                          {!item.is_completed && (
                            <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${pConfig.bg} ${pConfig.text}`}>
                              {item.priority}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>

                      {/* Actions — only for regular reminders */}
                      {!isIssue && !isMomAction && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(item.id, item.title)
                            }}
                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete reminder"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {/* Due Date with color-coded badge */}
                      {dueInfo.badgeClass ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${dueInfo.badgeClass}`}>
                          {dueInfo.text}
                        </span>
                      ) : (
                        <span className={`text-sm ${dueInfo.className}`}>
                          {item.is_completed && item.completed_at
                            ? `Completed ${formatDate(item.completed_at, 'short')}`
                            : dueInfo.text
                          }
                        </span>
                      )}

                      {/* Topic */}
                      {item.topic_title && (
                        <span
                          className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 hover:text-primary-600 cursor-pointer"
                          onClick={(e) => {
                            if (item.topic_id) {
                              e.stopPropagation()
                              navigate(`/topics/${item.topic_id}`)
                            }
                          }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          {item.topic_title}
                        </span>
                      )}

                      {/* Record */}
                      {item.record_title && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {item.record_title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topic</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredReminders.map((item) => {
                  const dueInfo = formatDueDate(item.due_date, item.is_completed)
                  const isIssue = item.source === 'issue'
                  const isMomAction = item.source === 'mom-action'
                  const isClickable = isIssue || isMomAction
                  const pConfig = priorityConfig[item.priority] || priorityConfig.normal

                  const handleRowClick = () => {
                    if (isIssue) navigate(`/issues?issueId=${item.originalId}`)
                    else if (isMomAction && item.mom_internal_id) navigate(`/mom?momId=${item.mom_internal_id}`)
                  }

                  return (
                    <tr
                      key={item.id}
                      data-reminder-id={item.id}
                      onClick={isClickable ? handleRowClick : undefined}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-700 ${item.is_completed ? 'opacity-60' : ''} ${isClickable ? 'cursor-pointer' : ''} ${highlightedReminderId === item.id ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-300 ring-inset' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {isMomAction ? (
                          <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                        ) : isIssue ? (
                          <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <svg className="w-3 h-3 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!item.is_completed) handleComplete(item.id)
                            }}
                            disabled={item.is_completed}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              item.is_completed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-primary-500'
                            }`}
                          >
                            {item.is_completed && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${item.is_completed ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                          {item.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isMomAction
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : isIssue
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {isMomAction ? 'MOM Action' : isIssue ? 'Issue' : 'Reminder'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {dueInfo.badgeClass ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${dueInfo.badgeClass}`}>
                            {dueInfo.text}
                          </span>
                        ) : (
                          <span className={`text-sm ${item.is_completed ? 'text-gray-400' : dueInfo.className}`}>
                            {item.is_completed && item.completed_at
                              ? `Done ${formatDate(item.completed_at, 'short')}`
                              : dueInfo.text
                            }
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!item.is_completed && (
                          <span className={`text-xs px-2 py-1 rounded-full ${pConfig.bg} ${pConfig.text}`}>
                            {item.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.topic_title ? (
                          <span
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 cursor-pointer"
                            onClick={(e) => {
                              if (item.topic_id) {
                                e.stopPropagation()
                                navigate(`/topics/${item.topic_id}`)
                              }
                            }}
                          >
                            {item.topic_title}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isIssue && !isMomAction && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(item.id, item.title)
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reminder Form Modal */}
      {showForm && (
        <ReminderForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
