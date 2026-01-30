import React from 'react'
import { Letter, LetterType, LetterStatus, LetterPriority } from '../../types'

interface LetterCardProps {
  letter: Letter
  onClick: () => void
}

export function LetterCard({ letter, onClick }: LetterCardProps) {
  const getStatusColor = (status: LetterStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'replied': return 'bg-green-100 text-green-800 border-green-200'
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'archived': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: LetterPriority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'normal': return 'text-gray-600'
      case 'low': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getPriorityIcon = (priority: LetterPriority) => {
    if (priority === 'urgent' || priority === 'high') {
      return (
        <svg className={`w-4 h-4 ${getPriorityColor(priority)}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
        </svg>
      )
    }
    return null
  }

  const getTypeIcon = (type: LetterType) => {
    switch (type) {
      case 'incoming':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'outgoing':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )
      case 'internal':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        )
    }
  }

  const isOverdue = letter.due_date && new Date(letter.due_date) < new Date() && letter.status !== 'replied' && letter.status !== 'closed'

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'} p-4 hover:shadow-md transition-shadow cursor-pointer`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getTypeIcon(letter.letter_type)}
          <span className="text-sm font-medium text-gray-600 capitalize">{letter.letter_type}</span>
        </div>
        <div className="flex items-center gap-2">
          {getPriorityIcon(letter.priority)}
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(letter.status)}`}>
            {letter.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Reference Number */}
      {(letter.reference_number || letter.incoming_number || letter.outgoing_number) && (
        <div className="mb-2">
          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {letter.reference_number || letter.incoming_number || letter.outgoing_number}
          </span>
        </div>
      )}

      {/* Subject */}
      <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">{letter.subject}</h3>

      {/* Summary */}
      {letter.summary && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{letter.summary}</p>
      )}

      {/* Metadata */}
      <div className="space-y-2 text-sm">
        {/* Authority */}
        {(letter.authority_name || letter.authority_short_name) && (
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>{letter.authority_short_name || letter.authority_name}</span>
          </div>
        )}

        {/* Topic */}
        {letter.topic_title && (
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>{letter.topic_title}</span>
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center justify-between text-gray-500">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{letter.letter_date ? new Date(letter.letter_date).toLocaleDateString() : 'No date'}</span>
          </div>
          {letter.due_date && (
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Due: {new Date(letter.due_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Counts */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        {letter.attachment_count !== undefined && letter.attachment_count > 0 && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>{letter.attachment_count} attachment{letter.attachment_count !== 1 ? 's' : ''}</span>
          </div>
        )}
        {letter.draft_count !== undefined && letter.draft_count > 0 && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{letter.draft_count} draft{letter.draft_count !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
