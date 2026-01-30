import React from 'react'
import type { SecureReference } from '../../types'

const categoryColors: Record<string, string> = {
  General: 'bg-gray-100 text-gray-600',
  Policy: 'bg-red-100 text-red-700',
  Procedure: 'bg-blue-100 text-blue-700',
  Template: 'bg-green-100 text-green-700',
  Guide: 'bg-purple-100 text-purple-700',
  Other: 'bg-orange-100 text-orange-700'
}

interface ReferenceCardProps {
  reference: SecureReference
  onClick: () => void
}

export function ReferenceCard({ reference, onClick }: ReferenceCardProps) {
  const colorClass = categoryColors[reference.category] || categoryColors.General

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 truncate flex-1">{reference.name}</h3>
        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {reference.category}
        </span>
      </div>

      {/* Description */}
      {reference.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{reference.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span>{reference.file_count || 0} file{(reference.file_count || 0) !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(reference.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
