import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useConfirm } from '../common/ConfirmDialog'
import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from 'date-fns'
import type { EmailSchedule, EmailScheduleInstance } from '../../types'
import { ScheduledEmailForm } from './ScheduledEmailForm'
import { ScheduledEmailCard } from './ScheduledEmailCard'
import { ScheduledEmailHistory } from './ScheduledEmailHistory'
import { notifyScheduledEmailDataChanged } from './ScheduledEmailBadge'

type ViewMode = 'schedules' | 'today' | 'history'

export function ScheduledEmails() {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const confirm = useConfirm()
  const [viewMode, setViewMode] = useState<ViewMode>('schedules')
  const [schedules, setSchedules] = useState<EmailSchedule[]>([])
  const [todayInstances, setTodayInstances] = useState<EmailScheduleInstance[]>([])
  const [pendingCounts, setPendingCounts] = useState({ pending: 0, overdue: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EmailSchedule | null>(null)
  const [selectedScheduleForHistory, setSelectedScheduleForHistory] = useState<EmailSchedule | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const loadData = useCallback(async (notifyBadge = false) => {
    try {
      const [schedulesData, todayData, countsData] = await Promise.all([
        window.electronAPI.scheduledEmails.getAll(showInactive),
        window.electronAPI.scheduledEmails.getTodayInstances(),
        window.electronAPI.scheduledEmails.getPendingCounts()
      ])
      setSchedules(schedulesData as EmailSchedule[])
      setTodayInstances(todayData as EmailScheduleInstance[])
      setPendingCounts(countsData)

      // Notify badge to refresh when data changes
      if (notifyBadge) {
        notifyScheduledEmailDataChanged()
      }
    } catch (error) {
      console.error('Error loading scheduled emails:', error)
    } finally {
      setIsLoading(false)
    }
  }, [showInactive])

  useEffect(() => {
    loadData()
    // Generate instances for today on mount
    window.electronAPI.scheduledEmails.generateInstances(new Date().toISOString().split('T')[0])
  }, [loadData])

  const handleCreateSchedule = () => {
    setEditingSchedule(null)
    setShowForm(true)
  }

  const handleEditSchedule = (schedule: EmailSchedule) => {
    setEditingSchedule(schedule)
    setShowForm(true)
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!user) return

    const confirmed = await confirm({
      title: 'Delete Schedule',
      message: 'Are you sure you want to delete this email schedule? This action cannot be undone.',
      confirmText: 'Delete',
      danger: true
    })

    if (confirmed) {
      const result = await window.electronAPI.scheduledEmails.delete(id, user.id)
      if (result.success) {
        loadData(true) // Notify badge
      }
    }
  }

  const handleToggleActive = async (schedule: EmailSchedule) => {
    if (!user) return

    const result = await window.electronAPI.scheduledEmails.update(
      schedule.id,
      { is_active: !schedule.is_active },
      user.id
    )
    if (result.success) {
      loadData(true) // Notify badge
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingSchedule(null)
  }

  const handleFormSave = () => {
    loadData(true) // Notify badge
    setShowForm(false)
    setEditingSchedule(null)
  }

  const handleMarkSent = async (instanceId: string) => {
    if (!user) return
    const result = await window.electronAPI.scheduledEmails.markSent(instanceId, user.id)
    if (result.success) {
      loadData(true) // Notify badge
    }
  }

  const handleDismiss = async (instanceId: string, notes?: string) => {
    if (!user) return
    const result = await window.electronAPI.scheduledEmails.dismiss(instanceId, user.id, notes)
    if (result.success) {
      loadData(true) // Notify badge
    }
  }

  const handleReset = async (instanceId: string) => {
    if (!user) return
    const result = await window.electronAPI.scheduledEmails.reset(instanceId, user.id)
    if (result.success) {
      loadData(true) // Notify badge
    }
  }

  const handleComposeEmail = async (instanceId: string) => {
    if (!user) return

    const result = await window.electronAPI.scheduledEmails.composeEmail(instanceId, user.id)
    if (result.success && result.subject && result.body && result.to) {
      // Use Outlook to compose the email (just open it, don't mark as sent)
      const outlookResult = await window.electronAPI.outlook.composeAttendanceEmail(
        new Date().toISOString().split('T')[0],
        '', // No attachment
        result.to,
        result.cc,
        result.subject,
        result.body
      )

      if (!outlookResult.success) {
        await window.electronAPI.dialog.showMessage({
          type: 'error',
          title: 'Error',
          message: 'Failed to compose email',
          detail: outlookResult.error
        })
      }
      // Note: Don't auto-mark as sent - user must click "Mark Sent" after actually sending
    }
  }

  const handleViewHistory = (schedule: EmailSchedule) => {
    setSelectedScheduleForHistory(schedule)
  }

  const handleComposePreview = async (schedule: EmailSchedule) => {
    if (!user) return

    try {
      // Use today's date for preview
      const today = new Date().toISOString().split('T')[0]

      // Get filled subject and body using placeholders
      const [subject, body] = await Promise.all([
        window.electronAPI.scheduledEmails.previewPlaceholders(
          schedule.subject_template,
          today,
          schedule.language,
          user.id
        ),
        window.electronAPI.scheduledEmails.previewPlaceholders(
          schedule.body_template,
          today,
          schedule.language,
          user.id
        )
      ])

      // Open Outlook with the preview
      const outlookResult = await window.electronAPI.outlook.composeAttendanceEmail(
        today,
        '', // No attachment
        schedule.to_emails,
        schedule.cc_emails || undefined,
        subject,
        body
      )

      if (!outlookResult.success) {
        await window.electronAPI.dialog.showMessage({
          type: 'error',
          title: 'Error',
          message: 'Failed to open Outlook',
          detail: outlookResult.error
        })
      }
    } catch (error: any) {
      console.error('Error composing preview:', error)
      await window.electronAPI.dialog.showMessage({
        type: 'error',
        title: 'Error',
        message: 'Failed to compose preview',
        detail: error.message
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Scheduled Emails</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage automated email schedules and track their status
          </p>
        </div>
        <button
          onClick={handleCreateSchedule}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Schedule
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setViewMode('schedules')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            viewMode === 'schedules'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Schedules ({schedules.length})
        </button>
        <button
          onClick={() => setViewMode('today')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            viewMode === 'today'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Today's Emails
          {pendingCounts.total > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              pendingCounts.overdue > 0
                ? 'bg-red-100 text-red-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {pendingCounts.total}
            </span>
          )}
        </button>
      </div>

      {/* Schedules View */}
      {viewMode === 'schedules' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Show inactive schedules
            </label>
          </div>

          {/* Schedule Cards */}
          {schedules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Email Schedules</h3>
              <p className="text-gray-500 mb-4">Create your first automated email schedule</p>
              <button onClick={handleCreateSchedule} className="btn-primary">
                Create Schedule
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {schedules.map((schedule) => (
                <ScheduledEmailCard
                  key={schedule.id}
                  schedule={schedule}
                  onEdit={handleEditSchedule}
                  onDelete={handleDeleteSchedule}
                  onToggleActive={handleToggleActive}
                  onViewHistory={handleViewHistory}
                  onComposePreview={handleComposePreview}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's Emails View */}
      {viewMode === 'today' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">{pendingCounts.pending}</p>
                  <p className="text-sm text-gray-500">Pending Today</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">{pendingCounts.overdue}</p>
                  <p className="text-sm text-gray-500">Overdue</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">{pendingCounts.total}</p>
                  <p className="text-sm text-gray-500">Total Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Instance List */}
          {todayInstances.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <svg className="w-16 h-16 text-green-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">No emails pending for today</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {todayInstances.map((instance) => (
                  <div key={instance.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          instance.status === 'overdue'
                            ? 'bg-red-100'
                            : instance.status === 'pending'
                            ? 'bg-orange-100'
                            : 'bg-green-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            instance.status === 'overdue'
                              ? 'text-red-600'
                              : instance.status === 'pending'
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{instance.schedule_name}</h4>
                          <p className="text-sm text-gray-500">
                            {(() => {
                              // Format time to 12h format
                              const [hours, minutes] = instance.scheduled_time.split(':')
                              const h = parseInt(hours)
                              const ampm = h >= 12 ? 'PM' : 'AM'
                              const hour12 = h % 12 || 12
                              const formattedTime = `${hour12}:${minutes} ${ampm}`

                              if (instance.status === 'overdue') {
                                // Show when it was supposed to be sent
                                const scheduledDate = parseISO(instance.scheduled_date)
                                let dateStr = ''
                                if (isYesterday(scheduledDate)) {
                                  dateStr = 'Yesterday'
                                } else if (isToday(scheduledDate)) {
                                  dateStr = 'Today'
                                } else {
                                  dateStr = format(scheduledDate, 'MMM d')
                                }
                                return `Was due ${dateStr} at ${formattedTime}`
                              } else {
                                return `Scheduled for ${formattedTime}`
                              }
                            })()}
                            {' - '}
                            <span className={`font-medium ${
                              instance.status === 'overdue' ? 'text-red-600' : 'text-orange-600'
                            }`}>
                              {instance.status === 'overdue' ? 'Overdue' : 'Pending'}
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            To: {instance.to_emails}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleComposeEmail(instance.id)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                          title="Compose email in Outlook"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Compose
                        </button>
                        <button
                          onClick={() => handleMarkSent(instance.id)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                          title="Mark as sent"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Sent
                        </button>
                        <button
                          onClick={() => handleDismiss(instance.id)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          title="Dismiss without sending"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ScheduledEmailForm
          schedule={editingSchedule}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}

      {/* History Modal */}
      {selectedScheduleForHistory && (
        <ScheduledEmailHistory
          schedule={selectedScheduleForHistory}
          onClose={() => setSelectedScheduleForHistory(null)}
          onMarkSent={handleMarkSent}
          onDismiss={handleDismiss}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
