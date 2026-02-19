import React, { useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { PinButton } from '../common/PinButton'
import type { Mom } from '../../types'

interface MOMCardProps {
  mom: Mom
  onClick: () => void
  highlighted?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

export function MOMCard({ mom, onClick, highlighted, isPinned = false, onTogglePin }: MOMCardProps) {
  const [copied, setCopied] = useState(false)
  const { formatDate } = useSettings()

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(mom.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const isOpen = mom.status === 'open'
  const borderColor = isOpen ? 'border-l-green-500' : 'border-l-gray-400'
  const actionTotal = mom.action_total || 0
  const actionResolved = mom.action_resolved || 0
  const actionOverdue = mom.action_overdue || 0

  return (
    <div
      data-mom-id={mom.id}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${borderColor} p-4 hover:shadow-md transition-all duration-700 cursor-pointer group ${highlighted ? 'ring-2 ring-primary-400 bg-primary-50/50' : ''} ${isPinned ? 'ring-2 ring-amber-200 bg-amber-50/30' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isPinned && (
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            )}
            {mom.mom_id && (
              <span className="inline-flex px-2 py-0.5 text-xs font-mono font-medium rounded bg-gray-100 text-gray-700 flex-shrink-0">
                {mom.mom_id}
              </span>
            )}
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
              isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {mom.status}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{mom.title}</h3>
        </div>
        {onTogglePin && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <PinButton isPinned={isPinned} onToggle={onTogglePin} />
          </span>
        )}
      </div>

      {/* Meeting date & location */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-gray-500">
        {mom.meeting_date && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(mom.meeting_date)}
          </span>
        )}
        {mom.location_name && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {mom.location_name}
          </span>
        )}
      </div>

      {/* Action summary */}
      {actionTotal > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-600">
            {actionResolved}/{actionTotal} resolved
          </span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${actionTotal > 0 ? (actionResolved / actionTotal) * 100 : 0}%` }}
            />
          </div>
          {actionOverdue > 0 && (
            <span className="text-xs font-medium text-red-600">
              {actionOverdue} overdue
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{mom.creator_name || 'Unknown'}</span>
        <div className="flex items-center gap-2">
          {(mom.topic_count || 0) > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {mom.topic_count}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-gray-400">{mom.id.slice(0, 8)}</span>
            <button
              onClick={handleCopyId}
              className="relative p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy MOM ID"
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
}
