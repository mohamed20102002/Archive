import React from 'react'
import type { SecureReference } from '../../types'

const categoryColors: Record<string, string> = {
  General: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  Policy: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  Procedure: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  Template: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  Guide: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  Other: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
}

const colorClasses: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500'
}

interface ReferenceCardProps {
  reference: SecureReference
  onClick: () => void
  highlighted?: boolean
}

export function ReferenceCard({ reference, onClick, highlighted }: ReferenceCardProps) {
  const catColorClass = categoryColors[reference.category] || categoryColors.General

  return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer h-[140px] flex flex-col ${
        highlighted
          ? 'border-primary-400 ring-2 ring-primary-300 animate-pulse shadow-lg'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* Color indicator - left border */}
      {reference.color && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClasses[reference.color]}`} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Admin-only lock icon */}
          {reference.admin_only && (
            <div className="flex-shrink-0" title="Admin Only">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{reference.name}</h3>
        </div>
        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${catColorClass}`}>
          {reference.category}
        </span>
      </div>

      {/* Description - fixed height area */}
      <div className="flex-1 min-h-0 mb-2">
        {reference.description ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{reference.description}</p>
        ) : (
          <p className="text-xs text-gray-300 dark:text-gray-600 italic">No description</p>
        )}
      </div>

      {/* Footer - always at bottom */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span>{reference.file_count || 0} file{(reference.file_count || 0) !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(reference.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
