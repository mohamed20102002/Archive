/**
 * Search History Component
 *
 * Displays recent searches with ability to re-run or delete them.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { formatRelativeTime } from '../../utils/formatters'

interface SearchHistoryEntry {
  id: string
  user_id: string
  query: string
  filters: string
  result_count: number
  searched_at: string
}

interface SearchHistoryProps {
  onSelect: (query: string, filters?: object) => void
  limit?: number
  showClear?: boolean
  className?: string
}

export function SearchHistory({
  onSelect,
  limit = 10,
  showClear = true,
  className = ''
}: SearchHistoryProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [history, setHistory] = useState<SearchHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const results = await window.electronAPI.advancedSearch.history(user.id, limit)
      setHistory(results as SearchHistoryEntry[])
    } catch (error) {
      console.error('Error fetching search history:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, limit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleClearHistory = async () => {
    if (!user?.id) return

    try {
      await window.electronAPI.advancedSearch.clearHistory(user.id)
      setHistory([])
    } catch (error) {
      console.error('Error clearing search history:', error)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!user?.id) return

    try {
      await window.electronAPI.advancedSearch.deleteHistoryEntry(id, user.id)
      setHistory(prev => prev.filter(h => h.id !== id))
    } catch (error) {
      console.error('Error deleting history entry:', error)
    }
  }

  const handleSelect = (entry: SearchHistoryEntry) => {
    let filters = {}
    try {
      filters = JSON.parse(entry.filters)
    } catch {
      // Invalid JSON
    }
    onSelect(entry.query, filters)
  }

  if (loading && history.length === 0) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        {t('common.loading')}...
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        {t('search.noHistory', 'No search history yet')}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('search.recentSearches', 'Recent Searches')}
        </h3>
        {showClear && (
          <button
            onClick={handleClearHistory}
            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            {t('common.clearAll', 'Clear all')}
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {history.map((entry) => (
          <li
            key={entry.id}
            className="group flex items-center gap-2 text-sm"
          >
            <button
              onClick={() => handleSelect(entry)}
              className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">
                {entry.query}
              </span>
              <span className="text-xs text-gray-400">
                {entry.result_count} {t('search.results', 'results')}
              </span>
            </button>
            <button
              onClick={() => handleDeleteEntry(entry.id)}
              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('common.delete', 'Delete')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Compact search history for dropdown/popover
 */
export function SearchHistoryCompact({
  onSelect,
  limit = 5
}: {
  onSelect: (query: string) => void
  limit?: number
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [history, setHistory] = useState<SearchHistoryEntry[]>([])

  useEffect(() => {
    if (!user?.id) return

    window.electronAPI.advancedSearch.history(user.id, limit)
      .then(results => setHistory(results as SearchHistoryEntry[]))
      .catch(console.error)
  }, [user?.id, limit])

  if (history.length === 0) return null

  return (
    <div className="py-2">
      <p className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {t('search.recent', 'Recent')}
      </p>
      {history.map((entry) => (
        <button
          key={entry.id}
          onClick={() => onSelect(entry.query)}
          className="w-full px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
        >
          {entry.query}
        </button>
      ))}
    </div>
  )
}

export default SearchHistory
