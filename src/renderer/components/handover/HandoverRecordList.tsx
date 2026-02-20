import React from 'react'
import { useSettings } from '../../context/SettingsContext'
import type { HandoverRecord } from '../../types'

type ViewMode = 'card' | 'table'

interface HandoverRecordListProps {
  records: HandoverRecord[]
  excludedIds: Set<string>
  onToggleExclude: (recordId: string) => void
  viewMode: ViewMode
}

const typeIcons: Record<string, string> = {
  note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  event: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  decision: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
}

const typeColors: Record<string, string> = {
  note: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  email: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  document: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
  event: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  decision: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
}

export function HandoverRecordList({
  records,
  excludedIds,
  onToggleExclude,
  viewMode
}: HandoverRecordListProps) {
  const { formatDate } = useSettings()
  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No records found</h3>
        <p className="text-gray-500 dark:text-gray-400">No records were created or updated during this week</p>
      </div>
    )
  }

  if (viewMode === 'table') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topic</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((record) => {
              const isExcluded = excludedIds.has(record.record_id)
              const typeColor = typeColors[record.type] || typeColors.note
              return (
                <tr key={record.record_id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isExcluded ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => onToggleExclude(record.record_id)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${typeColor}`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium text-gray-900 dark:text-gray-100 ${isExcluded ? 'line-through' : ''}`}>
                      {record.title}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {record.topic_title}
                      {record.subcategory_title && (
                        <span className="text-indigo-600 dark:text-indigo-400"> / {record.subcategory_title}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{record.editor}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(record.timestamp, 'withTime')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const isExcluded = excludedIds.has(record.record_id)
        const typeIcon = typeIcons[record.type] || typeIcons.note
        const typeColor = typeColors[record.type] || typeColors.note

        return (
          <div
            key={record.record_id}
            className={`card p-4 transition-opacity ${isExcluded ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <label className="flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => onToggleExclude(record.record_id)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                />
              </label>

              {/* Type Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColor}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcon} />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-gray-900 dark:text-gray-100 ${isExcluded ? 'line-through' : ''}`}>
                  {record.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {record.topic_title}
                    {record.subcategory_title && (
                      <span className="text-indigo-600 dark:text-indigo-400">/ {record.subcategory_title}</span>
                    )}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {record.editor}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>
                    {formatDate(record.timestamp, 'withTime')}
                  </span>
                </div>
                {record.content && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {record.content}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
