import React, { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import type { EmailSchedule, EmailScheduleInstance } from '../../types'

interface ScheduledEmailHistoryProps {
  schedule: EmailSchedule
  onClose: () => void
  onMarkSent: (instanceId: string) => void
  onDismiss: (instanceId: string, notes?: string) => void
  onReset: (instanceId: string) => void
}

export function ScheduledEmailHistory({
  schedule,
  onClose,
  onMarkSent,
  onDismiss,
  onReset
}: ScheduledEmailHistoryProps) {
  const { formatDate } = useSettings()
  const [instances, setInstances] = useState<EmailScheduleInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [schedule.id])

  const loadHistory = async () => {
    try {
      const history = await window.electronAPI.scheduledEmails.getHistory(schedule.id)
      setInstances(history as EmailScheduleInstance[])
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Sent
          </span>
        )
      case 'dismissed':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Dismissed
          </span>
        )
      case 'overdue':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            Overdue
          </span>
        )
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            Pending
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        )
    }
  }

  const handleAction = async (action: 'markSent' | 'dismiss' | 'reset', instanceId: string) => {
    switch (action) {
      case 'markSent':
        await onMarkSent(instanceId)
        break
      case 'dismiss':
        await onDismiss(instanceId)
        break
      case 'reset':
        await onReset(instanceId)
        break
    }
    loadHistory()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Schedule History</h2>
            <p className="text-sm text-gray-500">{schedule.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No History</h3>
              <p className="text-gray-500">No emails have been scheduled yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((instance) => (
                <div
                  key={instance.id}
                  className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        instance.status === 'sent'
                          ? 'bg-green-100'
                          : instance.status === 'overdue'
                          ? 'bg-red-100'
                          : instance.status === 'pending'
                          ? 'bg-orange-100'
                          : 'bg-gray-100'
                      }`}>
                        <svg className={`w-4 h-4 ${
                          instance.status === 'sent'
                            ? 'text-green-600'
                            : instance.status === 'overdue'
                            ? 'text-red-600'
                            : instance.status === 'pending'
                            ? 'text-orange-600'
                            : 'text-gray-500'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {instance.status === 'sent' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          )}
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {formatDate(instance.scheduled_date, 'withDay')}
                          </span>
                          {getStatusBadge(instance.status)}
                        </div>
                        <p className="text-sm text-gray-500">
                          Scheduled for {instance.scheduled_time}
                          {instance.sent_at && (
                            <> - Sent at {formatDate(instance.sent_at, 'withTime')}</>
                          )}
                          {instance.dismissed_at && (
                            <> - Dismissed at {formatDate(instance.dismissed_at, 'withTime')}
                              {instance.dismissed_by_name && ` by ${instance.dismissed_by_name}`}
                            </>
                          )}
                        </p>
                        {instance.notes && (
                          <p className="text-sm text-gray-500 mt-1 italic">Note: {instance.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(instance.status === 'pending' || instance.status === 'overdue') && (
                        <>
                          <button
                            onClick={() => handleAction('markSent', instance.id)}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Mark Sent
                          </button>
                          <button
                            onClick={() => handleAction('dismiss', instance.id)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                      {(instance.status === 'sent' || instance.status === 'dismissed') && (
                        <button
                          onClick={() => handleAction('reset', instance.id)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                          title="Reset to Pending"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
