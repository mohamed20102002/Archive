import React from 'react'

interface HandoverSummaryProps {
  recordCount: number
  editors: string[]
  topics: Array<{ id: string; title: string }>
}

export function HandoverSummary({ recordCount, editors, topics }: HandoverSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{recordCount}</div>
          <div className="text-sm text-gray-500">Records</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{editors.length}</div>
          <div className="text-sm text-gray-500">Editors</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{topics.length}</div>
          <div className="text-sm text-gray-500">Topics</div>
        </div>
      </div>

      {/* Details */}
      <div className="card p-4 space-y-3">
        {editors.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700">Editors: </span>
            <span className="text-sm text-gray-600">{editors.join(', ')}</span>
          </div>
        )}
        {topics.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700">Topics: </span>
            <span className="text-sm text-gray-600">
              {topics.map(t => t.title).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
