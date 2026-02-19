import React from 'react'
import { useSettings } from '../../context/SettingsContext'
import type { EmailSchedule } from '../../types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface ScheduledEmailCardProps {
  schedule: EmailSchedule
  onEdit: (schedule: EmailSchedule) => void
  onDelete: (id: string) => void
  onToggleActive: (schedule: EmailSchedule) => void
  onViewHistory: (schedule: EmailSchedule) => void
  onComposePreview: (schedule: EmailSchedule) => void
}

export function ScheduledEmailCard({
  schedule,
  onEdit,
  onDelete,
  onToggleActive,
  onViewHistory,
  onComposePreview
}: ScheduledEmailCardProps) {
  const { formatDate } = useSettings()

  const getFrequencyText = (): string => {
    switch (schedule.frequency_type) {
      case 'daily':
        return 'Every day'
      case 'weekly': {
        if (!schedule.frequency_days) return 'Weekly'
        const days = JSON.parse(schedule.frequency_days) as number[]
        if (days.length === 7) return 'Every day'
        if (days.length === 0) return 'No days selected'
        return days.map(d => DAY_NAMES[d]).join(', ')
      }
      case 'monthly': {
        if (!schedule.frequency_days) return 'Monthly'
        const days = JSON.parse(schedule.frequency_days) as number[]
        if (days.length === 0) return 'No days selected'
        return `Day ${days.join(', ')} of each month`
      }
      default:
        return schedule.frequency_type
    }
  }

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const isArabic = schedule.language === 'ar'

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
      !schedule.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`p-3 rounded-xl flex-shrink-0 ${
              schedule.is_active ? 'bg-primary-100' : 'bg-gray-100'
            }`}>
              <svg className={`w-6 h-6 ${
                schedule.is_active ? 'text-primary-600' : 'text-gray-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-base">{schedule.name}</h3>
              {schedule.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{schedule.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatTime(schedule.send_time)}
                </span>
                <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {getFrequencyText()}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  isArabic
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {isArabic ? 'Arabic' : 'English'}
                </span>
              </div>
            </div>
          </div>
          {/* Toggle Active */}
          <button
            onClick={() => onToggleActive(schedule)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              schedule.is_active ? 'bg-primary-600' : 'bg-gray-300'
            }`}
            title={schedule.is_active ? 'Disable schedule' : 'Enable schedule'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                schedule.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Recipients */}
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 font-medium flex-shrink-0 w-8">To:</span>
            <span className="text-gray-700 break-all">{schedule.to_emails}</span>
          </div>
          {schedule.cc_emails && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 font-medium flex-shrink-0 w-8">CC:</span>
              <span className="text-gray-700 break-all">{schedule.cc_emails}</span>
            </div>
          )}
        </div>

        {/* Subject Preview - RTL for Arabic content */}
        <div className="mt-4 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 font-medium flex-shrink-0">Subject:</span>
            <span
              className="text-gray-800 font-medium flex-1"
              dir={isArabic ? 'rtl' : 'ltr'}
              style={{ textAlign: isArabic ? 'right' : 'left' }}
            >
              {schedule.subject_template}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-400">
            Created {formatDate(schedule.created_at, 'withTime')}
            {schedule.created_by_name && ` by ${schedule.created_by_name}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onComposePreview(schedule)}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Preview in Outlook"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => onViewHistory(schedule)}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="View History"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => onEdit(schedule)}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Edit"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(schedule.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
