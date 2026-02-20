import React, { useState, useEffect, useRef } from 'react'
import { TagBadge } from './TagBadge'

interface Tag {
  id: string
  name: string
  color: string
}

interface TagSelectorProps {
  selectedTags: Tag[]
  onChange: (tags: Tag[]) => void
  placeholder?: string
}

const TAG_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
  '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7'
]

export function TagSelector({ selectedTags, onChange, placeholder = 'Select tags...' }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const [isCreating, setIsCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTags()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowQuickAdd(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadTags() {
    try {
      const tags = await window.electronAPI.tags.getAll()
      setAllTags(tags as Tag[])
    } catch (error) {
      console.error('Error loading tags:', error)
    }
  }

  const filteredTags = allTags.filter(
    tag =>
      !selectedTags.find(t => t.id === tag.id) &&
      tag.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectTag = (tag: Tag) => {
    onChange([...selectedTags, tag])
    setSearch('')
  }

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter(t => t.id !== tagId))
  }

  const handleQuickAdd = async () => {
    if (!newTagName.trim()) return

    setIsCreating(true)
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
      const result = await window.electronAPI.tags.create(
        { name: newTagName.trim(), color: newTagColor },
        user.id
      )
      if (result.success && result.tag) {
        const newTag = result.tag as Tag
        setAllTags([...allTags, newTag])
        onChange([...selectedTags, newTag])
        setNewTagName('')
        setNewTagColor('#3B82F6')
        setShowQuickAdd(false)
      }
    } catch (error) {
      console.error('Error creating tag:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="min-h-[42px] p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {selectedTags.map(tag => (
            <TagBadge
              key={tag.id}
              tag={tag}
              onRemove={() => handleRemoveTag(tag.id)}
            />
          ))}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedTags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[100px] outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-72 overflow-hidden">
          {/* Quick Add Section */}
          {showQuickAdd ? (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name..."
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleQuickAdd()
                    }
                    if (e.key === 'Escape') {
                      setShowQuickAdd(false)
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-1 mb-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`w-5 h-5 rounded-full transition-transform ${newTagColor === color ? 'ring-2 ring-offset-1 ring-primary-500 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  disabled={isCreating || !newTagName.trim()}
                  className="flex-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Quick Add New Tag
              </button>
            </div>
          )}

          {/* Tags List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredTags.length > 0 ? (
              <ul className="py-1">
                {filteredTags.map(tag => (
                  <li
                    key={tag.id}
                    onClick={() => handleSelectTag(tag)}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{tag.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                {search.trim() ? `No tags matching "${search}"` : 'No tags available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
