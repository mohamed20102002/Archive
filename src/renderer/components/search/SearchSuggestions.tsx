/**
 * Search Suggestions Component
 *
 * Provides autocomplete suggestions as users type their search query.
 * Shows recent searches, matching topics, letters, records, and tags.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'

interface SearchSuggestion {
  text: string
  type: 'recent' | 'topic' | 'letter' | 'record' | 'tag'
  count?: number
}

interface SearchSuggestionsProps {
  query: string
  onSelect: (suggestion: string) => void
  onSearch: (query: string) => void
  visible: boolean
  onClose: () => void
  inputRef?: React.RefObject<HTMLInputElement>
}

const suggestionIcons: Record<string, React.ReactNode> = {
  recent: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  topic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  letter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  record: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  tag: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  )
}

const suggestionColors: Record<string, string> = {
  recent: 'text-gray-500 dark:text-gray-400',
  topic: 'text-blue-500 dark:text-blue-400',
  letter: 'text-green-500 dark:text-green-400',
  record: 'text-purple-500 dark:text-purple-400',
  tag: 'text-amber-500 dark:text-amber-400'
}

export function SearchSuggestions({
  query,
  onSelect,
  onSearch,
  visible,
  onClose,
  inputRef
}: SearchSuggestionsProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!user?.id) return

    setLoading(true)
    try {
      const results = await window.electronAPI.advancedSearch.suggestions(
        searchQuery,
        user.id,
        10
      )
      setSuggestions(results as SearchSuggestion[])
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Debounced fetch
  useEffect(() => {
    if (!visible) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
    }, 150)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, visible, fetchSuggestions])

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [suggestions])

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible || !inputRef?.current) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        onSelect(suggestions[selectedIndex].text)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    const input = inputRef.current
    input.addEventListener('keydown', handleKeyDown)

    return () => {
      input.removeEventListener('keydown', handleKeyDown)
    }
  }, [visible, suggestions, selectedIndex, onSelect, onClose, inputRef])

  // Close on click outside
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        inputRef?.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [visible, onClose, inputRef])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {loading && suggestions.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {t('common.loading')}...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {query.length > 0
            ? t('search.noSuggestions', 'No suggestions found')
            : t('search.recentSearches', 'Start typing to search...')}
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.type}-${suggestion.text}-${index}`}>
              <button
                type="button"
                onClick={() => onSelect(suggestion.text)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  w-full px-4 py-2 flex items-center gap-3 text-left text-sm
                  transition-colors
                  ${selectedIndex === index
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
              >
                <span className={suggestionColors[suggestion.type]}>
                  {suggestionIcons[suggestion.type]}
                </span>
                <span className="flex-1 text-gray-900 dark:text-gray-100 truncate">
                  {suggestion.text}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {suggestion.type === 'recent'
                    ? t('search.recent', 'Recent')
                    : suggestion.count
                      ? `${suggestion.count}`
                      : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Search tip */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('search.tips', 'Tip: Use AND, OR, NOT, or "quotes" for exact phrases')}
        </p>
      </div>
    </div>
  )
}

export default SearchSuggestions
