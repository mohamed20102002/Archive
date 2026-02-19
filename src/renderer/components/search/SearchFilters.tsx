import React, { useState, useEffect } from 'react'

interface SearchFilters {
  query: string
  types: string[]
  status: string[]
  dateFrom: string
  dateTo: string
  createdBy: string
  topicId: string
  tagIds: string[]
  importance: string
}

interface SearchFiltersProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onSearch: () => void
  onReset: () => void
}

interface Topic {
  id: string
  title: string
}

interface User {
  id: string
  display_name: string
}

interface Tag {
  id: string
  name: string
  color: string
}

export function SearchFiltersPanel({ filters, onChange, onSearch, onReset }: SearchFiltersProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    loadFilterOptions()
  }, [])

  async function loadFilterOptions() {
    try {
      const [topicsResult, usersData, tagsData] = await Promise.all([
        window.electronAPI.topics.getAll({}),
        window.electronAPI.auth.getAllUsers(),
        window.electronAPI.tags.getAll()
      ])
      const topicsData = (topicsResult as { data: Topic[] }).data || topicsResult
      setTopics(topicsData as Topic[])
      setUsers(usersData as User[])
      setTags(tagsData as Tag[])
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const entityTypes = [
    { value: 'topic', label: 'Topics' },
    { value: 'record', label: 'Records' },
    { value: 'letter', label: 'Letters' },
    { value: 'mom', label: 'MOMs' },
    { value: 'issue', label: 'Issues' },
    { value: 'secure_reference', label: 'Secure Resources' }
  ]

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' }
  ]

  const importanceOptions = [
    { value: '', label: 'Any' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ]

  const handleTypeToggle = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type]
    onChange({ ...filters, types: newTypes })
  }

  const handleStatusToggle = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status]
    onChange({ ...filters, status: newStatus })
  }

  const handleTagToggle = (tagId: string) => {
    const newTags = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter(t => t !== tagId)
      : [...filters.tagIds, tagId]
    onChange({ ...filters, tagIds: newTags })
  }

  return (
    <div className="space-y-6">
      {/* Search Query */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Search Query
        </label>
        <input
          type="text"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="Enter search terms..."
          className="input w-full"
        />
      </div>

      {/* Entity Types */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Entity Types
        </label>
        <div className="flex flex-wrap gap-2">
          {entityTypes.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleTypeToggle(type.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.types.includes(type.value)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            From Date
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            To Date
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="input w-full"
          />
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(status => (
            <button
              key={status.value}
              type="button"
              onClick={() => handleStatusToggle(status.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.status.includes(status.value)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Topic
        </label>
        <select
          value={filters.topicId}
          onChange={(e) => onChange({ ...filters, topicId: e.target.value })}
          className="input w-full"
        >
          <option value="">All Topics</option>
          {topics.map(topic => (
            <option key={topic.id} value={topic.id}>{topic.title}</option>
          ))}
        </select>
      </div>

      {/* Created By */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Created By
        </label>
        <select
          value={filters.createdBy}
          onChange={(e) => onChange({ ...filters, createdBy: e.target.value })}
          className="input w-full"
        >
          <option value="">Anyone</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.display_name}</option>
          ))}
        </select>
      </div>

      {/* Importance (for issues) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Importance
        </label>
        <select
          value={filters.importance}
          onChange={(e) => onChange({ ...filters, importance: e.target.value })}
          className="input w-full"
        >
          {importanceOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  filters.tagIds.includes(tag.id)
                    ? 'ring-2 ring-offset-2 ring-primary-500'
                    : ''
                }`}
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onSearch} className="btn btn-primary flex-1">
          Search
        </button>
        <button onClick={onReset} className="btn btn-secondary">
          Reset
        </button>
      </div>
    </div>
  )
}
