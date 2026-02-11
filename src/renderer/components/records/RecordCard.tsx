import React, { useState, useEffect, memo } from 'react'
import { format } from 'date-fns'
import type { Record, RecordAttachment } from '../../types'

interface RecordCardProps {
  record: Record
  highlighted?: boolean
  onEdit: () => void
  onDelete: () => void
  onOpenEmail?: (emailId: string) => void
}

const typeIcons: globalThis.Record<string, React.ReactNode> = {
  note: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  event: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  decision: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const typeColors: globalThis.Record<string, string> = {
  note: 'bg-gray-100 text-gray-600',
  email: 'bg-blue-100 text-blue-600',
  document: 'bg-purple-100 text-purple-600',
  event: 'bg-green-100 text-green-600',
  decision: 'bg-orange-100 text-orange-600'
}

const typeDotColors: globalThis.Record<string, string> = {
  note: 'bg-gray-400',
  email: 'bg-blue-500',
  document: 'bg-purple-500',
  event: 'bg-green-500',
  decision: 'bg-orange-500'
}

// Helper to parse types (stored as comma-separated string)
const parseTypes = (typeStr: string): string[] => typeStr.split(',').filter(Boolean)

export const RecordCard = memo(function RecordCard({ record, highlighted, onEdit, onDelete, onOpenEmail }: RecordCardProps) {
  // Parse multiple types
  const types = parseTypes(record.type)
  const primaryType = types[0] || 'note'
  const [copied, setCopied] = useState(false)
  const [attachments, setAttachments] = useState<RecordAttachment[]>([])
  const [showAttachments, setShowAttachments] = useState(false)

  // Load attachments for all records
  useEffect(() => {
    window.electronAPI.recordAttachments.getByRecord(record.id).then(atts => {
      setAttachments(atts as RecordAttachment[])
    })
  }, [record.id])

  const handleOpenAttachment = async (attachmentId: string) => {
    const result = await window.electronAPI.recordAttachments.open(attachmentId)
    if (!result.success) {
      console.error('Failed to open attachment:', result.error)
    }
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(record.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy ID:', err)
    }
  }

  return (
    <div className="relative pl-10 group" data-record-id={record.id}>
      {/* Timeline dot - uses primary type color */}
      <div className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white shadow ${typeDotColors[primaryType] || typeDotColors.note}`} />

      {/* Card */}
      <div className={`card-hover transition-colors duration-700 ${highlighted ? 'ring-2 ring-primary-400 bg-primary-50/50' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Show all type badges */}
            {types.map((t) => (
              <span key={t} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${typeColors[t] || typeColors.note}`}>
                {typeIcons[t] || typeIcons.note}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
            {record.subcategory_title && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {record.subcategory_title}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {format(new Date(record.created_at), 'h:mm a')}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="Edit record"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"
              title="Delete record"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="font-medium text-gray-900 mb-1">{record.title}</h4>

        {/* Content */}
        {record.content && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
            {record.content}
          </p>
        )}

        {/* Email indicator with Open button - shown when email type is included */}
        {types.includes('email') && record.email_id && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Archived email attached</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => window.electronAPI.emails.showInFolder(record.email_id!)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                  title="Open email folder"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => onOpenEmail?.(record.email_id!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File attachments */}
        {attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className="flex items-center justify-between w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>{attachments.length} attachment{attachments.length !== 1 ? 's' : ''}</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${showAttachments ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAttachments && (
              <div className="mt-2 space-y-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate">{att.filename}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">({formatFileSize(att.file_size)})</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => window.electronAPI.recordAttachments.showInFolder(att.id)}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                        title="Open folder"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleOpenAttachment(att.id)}
                        className="p-1.5 rounded hover:bg-purple-100 text-purple-600 transition-colors"
                        title="Open file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>
            By {record.creator_name || 'Unknown'} &middot; {format(new Date(record.created_at), 'MMM d, yyyy')}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-gray-400">{record.id.slice(0, 8)}</span>
            <button
              onClick={(e) => handleCopyId(e)}
              className="relative p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy record ID"
            >
              {copied ? (
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
})
