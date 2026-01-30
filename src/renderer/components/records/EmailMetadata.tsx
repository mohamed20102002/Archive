import React from 'react'
import { format } from 'date-fns'
import type { Email } from '../../types'

interface EmailMetadataProps {
  email: Email
  showFull?: boolean
}

export function EmailMetadata({ email, showFull = false }: EmailMetadataProps) {
  const parseRecipients = (recipients: string): string[] => {
    try {
      return JSON.parse(recipients)
    } catch {
      return recipients.split(',').map(r => r.trim())
    }
  }

  return (
    <div className="space-y-4">
      {/* Subject */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900">{email.subject}</h4>
      </div>

      {/* From/To */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">From</label>
          <div className="mt-1">
            <span className="font-medium text-gray-900">
              {email.sender_name || email.sender}
            </span>
            {email.sender_name && (
              <span className="text-sm text-gray-500 ml-1">&lt;{email.sender}&gt;</span>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</label>
          <div className="mt-1 text-gray-900">
            {email.sent_at
              ? format(new Date(email.sent_at), 'MMM d, yyyy h:mm a')
              : email.received_at
                ? format(new Date(email.received_at), 'MMM d, yyyy h:mm a')
                : 'Unknown'
            }
          </div>
        </div>
      </div>

      {/* To */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">To</label>
        <div className="mt-1 text-gray-900">
          {parseRecipients(email.recipients).join(', ')}
        </div>
      </div>

      {/* CC */}
      {email.cc && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">CC</label>
          <div className="mt-1 text-gray-900">
            {parseRecipients(email.cc).join(', ')}
          </div>
        </div>
      )}

      {/* Attachments */}
      {email.has_attachments && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Attachments ({email.attachment_count})
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {email.attachment_names?.split(',').map((name, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>{name.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Details */}
      {showFull && (
        <>
          {/* Importance */}
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Importance</label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  email.importance === 'high'
                    ? 'bg-red-100 text-red-700'
                    : email.importance === 'low'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-100 text-blue-700'
                }`}>
                  {email.importance.charAt(0).toUpperCase() + email.importance.slice(1)}
                </span>
              </div>
            </div>

            {email.file_size && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Size</label>
                <div className="mt-1 text-gray-900">
                  {formatFileSize(email.file_size)}
                </div>
              </div>
            )}
          </div>

          {/* Folder Path */}
          {email.folder_path && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Original Folder</label>
              <div className="mt-1 text-gray-600 text-sm font-mono">
                {email.folder_path}
              </div>
            </div>
          )}

          {/* Archive Info */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>Archived on {format(new Date(email.archived_at), 'MMM d, yyyy h:mm a')}</span>
            </div>

            {email.checksum && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-mono">SHA-256: {email.checksum.substring(0, 16)}...</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
