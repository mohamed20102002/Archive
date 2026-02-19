import React, { useState, useEffect, useRef } from 'react'
import { TagBadge, TagList } from './TagBadge'

interface Tag {
  id: string
  name: string
  color: string
}

interface TagSelectorProps {
  selectedTags: Tag[]
  onChange: (tags: Tag[]) => void
  placeholder?: string
  allowCreate?: boolean
}

export function TagSelector({ selectedTags, onChange, placeholder = 'Select tags...', allowCreate = true }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newTagColor, setNewTagColor] = useState('#6B7280')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTags()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
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

  const handleCreateTag = async () => {
    if (!search.trim()) return

    setIsCreating(true)
    try {
      // Get user ID from local storage
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
      const result = await window.electronAPI.tags.create(
        { name: search.trim(), color: newTagColor },
        user.id
      )
      if (result.success && result.tag) {
        const newTag = result.tag as Tag
        setAllTags([...allTags, newTag])
        onChange([...selectedTags, newTag])
        setSearch('')
        setNewTagColor('#6B7280')
      }
    } catch (error) {
      console.error('Error creating tag:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const tagColors = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'
  ]

  return (
    <div ref={containerRef} className="relative">
      <div
        className="min-h-[42px] p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-wrap gap-1">
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
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredTags.length > 0 ? (
            <ul className="py-1">
              {filteredTags.map(tag => (
                <li
                  key={tag.id}
                  onClick={() => handleSelectTag(tag)}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{tag.name}</span>
                </li>
              ))}
            </ul>
          ) : search.trim() && allowCreate ? (
            <div className="p-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Create new tag "{search}"
              </p>
              <div className="flex items-center gap-2 mb-2">
                {tagColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full ${newTagColor === color ? 'ring-2 ring-offset-2 ring-primary-500' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={isCreating}
                className="btn btn-primary btn-sm w-full"
              >
                {isCreating ? 'Creating...' : 'Create Tag'}
              </button>
            </div>
          ) : (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              No tags found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
