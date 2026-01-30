import React from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { Topic } from '../../types'

interface TopicCardProps {
  topic: Topic
  onEdit: () => void
  onDelete: () => void
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-700',
  closed: 'bg-red-100 text-red-700'
}

const priorityColors: Record<string, string> = {
  low: 'text-gray-400',
  normal: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500'
}

const priorityIcons: Record<string, React.ReactNode> = {
  low: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 20l-8-8h16l-8 8z" />
    </svg>
  ),
  normal: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 12h16M4 12l4-4m-4 4l4 4" />
    </svg>
  ),
  high: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 4l8 8H4l8-8z" />
    </svg>
  ),
  urgent: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l8 8H4l8-8zm0 8l8 8H4l8-8z" />
    </svg>
  )
}

export function TopicCard({ topic, onEdit, onDelete }: TopicCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/topics/${topic.id}`)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      onClick={handleClick}
      className="card-hover cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[topic.status] || statusColors.active}`}>
            {topic.status}
          </span>
          <span className={priorityColors[topic.priority] || priorityColors.normal} title={`${topic.priority} priority`}>
            {priorityIcons[topic.priority] || priorityIcons.normal}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEdit}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Edit topic"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"
            title="Delete topic"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {topic.title}
      </h3>

      {/* Description */}
      {topic.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {topic.description}
        </p>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {/* Record Count */}
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{topic.record_count || 0}</span>
          </div>
        </div>

        {/* Last Activity */}
        <div className="text-xs text-gray-400">
          {topic.last_activity
            ? `Updated ${formatDistanceToNow(new Date(topic.last_activity), { addSuffix: true })}`
            : `Created ${formatDistanceToNow(new Date(topic.created_at), { addSuffix: true })}`
          }
        </div>
      </div>
    </div>
  )
}
