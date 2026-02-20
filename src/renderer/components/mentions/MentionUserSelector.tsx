import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { MentionWithNote, MentionEntityType } from '../../types'

interface MentionUserSelectorProps {
  selectedMentions: MentionWithNote[]
  onChange: (mentions: MentionWithNote[]) => void
  entityType: MentionEntityType
  disabled?: boolean
}

interface UserOption {
  id: string
  display_name: string
  username: string
}

export function MentionUserSelector({
  selectedMentions,
  onChange,
  entityType,
  disabled = false
}: MentionUserSelectorProps) {
  const { user: currentUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  const searchUsers = useCallback(async (query: string) => {
    setIsSearching(true)
    try {
      const results = await window.electronAPI.mentions.searchUsers(query)
      // Filter out current user and already selected users
      const filtered = results.filter(
        u => u.id !== currentUser?.id && !selectedMentions.some(m => m.user.id === u.id)
      )
      setSearchResults(filtered)
    } catch (error) {
      console.error('Error searching users:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [currentUser?.id, selectedMentions])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length >= 0) {
      searchTimeoutRef.current = setTimeout(() => {
        searchUsers(searchQuery)
      }, 300)
    } else {
      setSearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, searchUsers])

  const handleSelectUser = (user: UserOption) => {
    const newMention: MentionWithNote = {
      user,
      note: ''
    }
    onChange([...selectedMentions, newMention])
    setSearchQuery('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleRemoveUser = (userId: string) => {
    onChange(selectedMentions.filter(m => m.user.id !== userId))
  }

  const handleNoteChange = (index: number, note: string) => {
    const updated = [...selectedMentions]
    updated[index] = { ...updated[index], note }
    onChange(updated)
  }

  const handleStartEditNote = (index: number) => {
    setEditingNoteIndex(index)
    setNoteValue(selectedMentions[index].note)
  }

  const handleSaveNote = () => {
    if (editingNoteIndex !== null) {
      handleNoteChange(editingNoteIndex, noteValue)
      setEditingNoteIndex(null)
      setNoteValue('')
    }
  }

  const handleCancelEditNote = () => {
    setEditingNoteIndex(null)
    setNoteValue('')
  }

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => {
              setShowDropdown(true)
              if (!searchQuery) searchUsers('')
            }}
            placeholder="Search users to mention..."
            disabled={disabled}
            className="input-field w-full pl-10 pr-4 py-2"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {isSearching && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {user.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.display_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    @{user.username}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {showDropdown && searchResults.length === 0 && !isSearching && searchQuery && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No users found
          </div>
        )}
      </div>

      {/* Selected users */}
      {selectedMentions.length > 0 && (
        <div className="space-y-2">
          {selectedMentions.map((mention, index) => (
            <div
              key={mention.user.id}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {mention.user.display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {mention.user.display_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      @{mention.user.username}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUser(mention.user.id)}
                  disabled={disabled}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove mention"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Note section */}
              {editingNoteIndex === index ? (
                <div className="mt-3">
                  <textarea
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    placeholder="Add a note for this mention..."
                    rows={2}
                    className="input-field w-full text-sm resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleCancelEditNote}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  {mention.note ? (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        "{mention.note}"
                      </p>
                      <button
                        type="button"
                        onClick={() => handleStartEditNote(index)}
                        disabled={disabled}
                        className="text-xs text-blue-500 hover:text-blue-600 whitespace-nowrap"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEditNote(index)}
                      disabled={disabled}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      + Add note
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {selectedMentions.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Mentioned users will be notified when this {entityType} is saved.
        </p>
      )}
    </div>
  )
}
