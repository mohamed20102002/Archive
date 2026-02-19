import React from 'react'

interface Tag {
  id: string
  name: string
  color: string
}

interface TagBadgeProps {
  tag: Tag
  size?: 'sm' | 'md'
  onRemove?: () => void
  onClick?: () => void
}

export function TagBadge({ tag, size = 'sm', onRemove, onClick }: TagBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color
      }}
      onClick={onClick}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-1 hover:opacity-70"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}

interface TagListProps {
  tags: Tag[]
  size?: 'sm' | 'md'
  onRemove?: (tagId: string) => void
  maxDisplay?: number
}

export function TagList({ tags, size = 'sm', onRemove, maxDisplay }: TagListProps) {
  const displayTags = maxDisplay ? tags.slice(0, maxDisplay) : tags
  const remaining = maxDisplay ? tags.length - maxDisplay : 0

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map(tag => (
        <TagBadge
          key={tag.id}
          tag={tag}
          size={size}
          onRemove={onRemove ? () => onRemove(tag.id) : undefined}
        />
      ))}
      {remaining > 0 && (
        <span className={`inline-flex items-center ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
          +{remaining} more
        </span>
      )}
    </div>
  )
}
