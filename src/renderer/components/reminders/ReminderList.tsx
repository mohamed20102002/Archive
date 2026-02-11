import React, { useState, useEffect } from 'react'
import { format, isPast, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { ReminderForm } from './ReminderForm'
import { notifyReminderDataChanged } from './ReminderBadge'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import type { Reminder, Issue, MomAction } from '../../types'

type FilterType = 'all' | 'pending' | 'overdue' | 'completed'
type ViewMode = 'card' | 'table'

// Unified item for displaying both reminders and issue reminders
interface DisplayItem {
  id: string
  originalId: string // The actual ID (without prefix) for navigation
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  is_overdue: boolean
  priority: string
  topic_title?: string
  record_title?: string
  completed_at?: string | null
  source: 'reminder' | 'issue' | 'mom-action'
  mom_internal_id?: string
  topic_id?: string | null
}

export function ReminderList() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [issueReminders, setIssueReminders] = useState<Issue[]>([])
  const [momActionReminders, setMomActionReminders] = useState<MomAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [filter, setFilter] = useState<FilterType>('pending')
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  const { success, error } = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const navigate = useNavigate()

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

  // Build unified display items from both regular reminders and issue reminders
  const now = new Date()
  const allItems: DisplayItem[] = [
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
      source: 'mom-action',
      mom_internal_id: a.mom_internal_id
    }))
  ]

  const filteredReminders = allItems.filter(item => {
    switch (filter) {
      case 'pending':
        return !item.is_completed
      case 'overdue':
        return !item.is_completed && item.is_overdue
      case 'completed':
        return item.is_completed
      default:
        return true
    }
  })

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

  const formatDueDate = (dateStr: string): { text: string; className: string } => {
    const date = parseISO(dateStr)
    const now = new Date()

    if (isPast(date) && !isToday(date)) {
      return { text: `Overdue (${format(date, 'MMM d')})`, className: 'text-red-600 font-medium' }
    }

    if (isToday(date)) {
      return { text: `Today at ${format(date, 'h:mm a')}`, className: 'text-orange-600 font-medium' }
    }

    if (isTomorrow(date)) {
      return { text: `Tomorrow at ${format(date, 'h:mm a')}`, className: 'text-blue-600' }
    }

    if (isThisWeek(date)) {
      return { text: format(date, 'EEEE h:mm a'), className: 'text-gray-700' }
    }

    return { text: format(date, 'MMM d, yyyy h:mm a'), className: 'text-gray-600' }
  }

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const pendingCount = allItems.filter(r => !r.is_completed).length
  const overdueCount = allItems.filter(r => !r.is_completed && r.is_overdue).length

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Filter Tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[
                { value: 'pending', label: 'Pending', count: pendingCount },
                { value: 'overdue', label: 'Overdue', count: overdueCount },
                { value: 'completed', label: 'Completed' },
                { value: 'all', label: 'All' }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value as FilterType)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    filter === tab.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                      filter === tab.value
                        ? 'bg-primary-500 text-white'
                        : tab.value === 'overdue'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Card View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Table View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
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
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Reminders List */}
        {filteredReminders.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No reminders found</h3>
            <p className="text-gray-500">
              {filter === 'pending'
                ? 'All caught up! No pending reminders.'
                : filter === 'overdue'
                  ? 'No overdue reminders.'
                  : filter === 'completed'
                    ? 'No completed reminders yet.'
                    : 'Create your first reminder to get started.'
              }
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="space-y-3">
            {filteredReminders.map((item) => {
              const dueInfo = formatDueDate(item.due_date)
              const isIssue = item.source === 'issue'
              const isMomAction = item.source === 'mom-action'
              const isClickable = isIssue || isMomAction

              const handleRowClick = () => {
                if (isIssue) navigate(`/issues?issueId=${item.originalId}`)
                else if (isMomAction && item.mom_internal_id) navigate(`/mom?momId=${item.mom_internal_id}`)
              }

              return (
                <div
                  key={item.id}
                  onClick={isClickable ? handleRowClick : undefined}
                  className={`card-hover flex items-start gap-4 ${
                    item.is_completed ? 'opacity-60' : ''
                  } ${isClickable ? 'cursor-pointer' : ''}`}
                >
                  {/* Checkbox / Issue icon / MOM Action icon */}
                  {isMomAction ? (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                  ) : isIssue ? (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => !item.is_completed && handleComplete(item.id)}
                      disabled={item.is_completed}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        item.is_completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-primary-500'
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
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className={`font-medium ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {item.title}
                          </h4>
                          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0 rounded font-medium ${
                            isMomAction
                              ? 'bg-purple-100 text-purple-600'
                              : isIssue
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-blue-100 text-blue-600'
                          }`}>
                            {isMomAction ? 'MOM Action' : isIssue ? 'Issue' : 'Reminder'}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                        )}
                      </div>

                      {/* Actions — only for regular reminders */}
                      {!isIssue && !isMomAction && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
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
                    <div className="flex items-center gap-3 mt-2">
                      {/* Due Date */}
                      <span className={`text-sm ${dueInfo.className}`}>
                        {item.is_completed ? (
                          <span className="text-gray-400">
                            Completed {item.completed_at && format(new Date(item.completed_at), 'MMM d')}
                          </span>
                        ) : (
                          dueInfo.text
                        )}
                      </span>

                      {/* Priority */}
                      {!item.is_completed && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[item.priority] || priorityColors.normal}`}>
                          {item.priority}
                        </span>
                      )}

                      {/* Topic */}
                      {item.topic_title && (
                        <span
                          className="text-xs text-gray-400 flex items-center gap-1 hover:text-primary-600 cursor-pointer"
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
                        <span className="text-xs text-gray-400 flex items-center gap-1">
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReminders.map((item) => {
                  const dueInfo = formatDueDate(item.due_date)
                  const isIssue = item.source === 'issue'
                  const isMomAction = item.source === 'mom-action'
                  const isClickable = isIssue || isMomAction

                  const handleRowClick = () => {
                    if (isIssue) navigate(`/issues?issueId=${item.originalId}`)
                    else if (isMomAction && item.mom_internal_id) navigate(`/mom?momId=${item.mom_internal_id}`)
                  }

                  return (
                    <tr
                      key={item.id}
                      onClick={isClickable ? handleRowClick : undefined}
                      className={`hover:bg-gray-50 ${item.is_completed ? 'opacity-60' : ''} ${isClickable ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {isMomAction ? (
                          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                        ) : isIssue ? (
                          <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        ) : (
                          <button
                            onClick={() => !item.is_completed && handleComplete(item.id)}
                            disabled={item.is_completed}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              item.is_completed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-primary-500'
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
                        <span className={`font-medium ${item.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {item.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isMomAction
                            ? 'bg-purple-100 text-purple-600'
                            : isIssue
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-blue-100 text-blue-600'
                        }`}>
                          {isMomAction ? 'MOM Action' : isIssue ? 'Issue' : 'Reminder'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                          {item.description || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${item.is_completed ? 'text-gray-400' : dueInfo.className}`}>
                          {item.is_completed
                            ? `Done ${item.completed_at ? format(new Date(item.completed_at), 'MMM d') : ''}`
                            : dueInfo.text
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!item.is_completed && (
                          <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[item.priority] || priorityColors.normal}`}>
                            {item.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {item.topic_title && (
                            <span
                              className="text-sm text-gray-600 hover:text-primary-600 cursor-pointer"
                              onClick={(e) => {
                                if (item.topic_id) {
                                  e.stopPropagation()
                                  navigate(`/topics/${item.topic_id}`)
                                }
                              }}
                            >
                              {item.topic_title}
                            </span>
                          )}
                          {item.record_title && (
                            <span className="text-xs text-gray-400">{item.record_title}</span>
                          )}
                          {!item.topic_title && !item.record_title && '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isIssue && !isMomAction && (
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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
