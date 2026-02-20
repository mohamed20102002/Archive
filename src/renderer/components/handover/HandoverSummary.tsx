import React from 'react'

interface HandoverSummaryProps {
  recordCount: number
  editors: string[]
  topics: Array<{ id: string; title: string }>
}

export function HandoverSummary({ recordCount, editors, topics }: HandoverSummaryProps) {
  return (
    <div className="space-y-3 mb-4">
      {/* Summary Cards - More compact */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{recordCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Records</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{editors.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Editors</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{topics.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Topics</div>
        </div>
      </div>

      {/* Details - Single line format */}
      <div className="card p-3 space-y-1 text-sm">
        {editors.length > 0 && (
          <div className="truncate">
            <span className="font-medium text-gray-700 dark:text-gray-300">Editors: </span>
            <span className="text-gray-600 dark:text-gray-400">{editors.join(', ')}</span>
          </div>
        )}
        {topics.length > 0 && (
          <div className="truncate">
            <span className="font-medium text-gray-700 dark:text-gray-300">Topics: </span>
            <span className="text-gray-600 dark:text-gray-400">{topics.map(t => t.title).join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
