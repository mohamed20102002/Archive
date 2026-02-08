import React from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import type { OutlookEmail } from '../../types'

interface EmailListProps {
  emails: OutlookEmail[]
  selectedEmail: OutlookEmail | null
  isLoading: boolean
  archivedEmailIds: Set<string>
  onSelectEmail: (email: OutlookEmail) => void
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr)

  if (isToday(date)) {
    return format(date, 'h:mm a')
  }

  if (isYesterday(date)) {
    return 'Yesterday'
  }

  return format(date, 'MMM d')
}

export function EmailList({ emails, selectedEmail, isLoading, archivedEmailIds, onSelectEmail }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading emails...</p>
        </div>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center">
        <div className="text-center px-4">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-500">Select a folder to view emails</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 h-full overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">
          Emails ({emails.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {emails.map((email) => {
          const isSelected = selectedEmail?.entryId === email.entryId
          const isArchived = archivedEmailIds.has(email.entryId)

          return (
            <button
              key={email.entryId}
              onClick={() => onSelectEmail(email)}
              className={`w-full text-left p-3 border-b border-gray-100 transition-colors ${
                isSelected
                  ? 'bg-primary-50 border-l-2 border-l-primary-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isArchived && (
                    <span className="flex-shrink-0 text-green-600" title="Archived to topic">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    </span>
                  )}
                  <span className={`text-sm truncate ${isSelected ? 'text-primary-900 font-medium' : 'text-gray-900'}`}>
                    {email.senderName || email.sender}
                  </span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {email.receivedAt && formatEmailDate(email.receivedAt)}
                </span>
              </div>

              <h4 className={`text-sm truncate mb-1 ${isSelected ? 'text-primary-800' : 'text-gray-700'}`}>
                {email.subject}
              </h4>

              {email.bodyPreview && (
                <p className="text-xs text-gray-500 truncate">
                  {email.bodyPreview}
                </p>
              )}

              {/* Indicators */}
              <div className="flex items-center gap-2 mt-2">
                {email.hasAttachments && (
                  <span className="text-gray-400" title={`${email.attachmentCount} attachment(s)`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </span>
                )}
                {email.importance === 2 && (
                  <span className="text-red-500" title="High importance">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
