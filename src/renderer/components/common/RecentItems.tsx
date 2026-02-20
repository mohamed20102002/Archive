/**
 * Recent Items & Favorites Component
 *
 * Tracks and displays recently viewed items and user favorites.
 * Stores data in localStorage for persistence.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { formatRelativeTime } from '../../utils/formatters'

export type RecentItemType = 'topic' | 'letter' | 'mom' | 'issue' | 'record'

export interface RecentItem {
  id: string
  type: RecentItemType
  title: string
  subtitle?: string
  viewedAt: string
  isFavorite?: boolean
}

const STORAGE_KEY_PREFIX = 'recent_views_'
const FAVORITES_KEY_PREFIX = 'favorites_'
const MAX_RECENT_ITEMS = 20

// Icons for item types
const typeIcons: Record<RecentItemType, React.ReactNode> = {
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
  mom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  issue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  record: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

const typeColors: Record<RecentItemType, string> = {
  topic: 'text-blue-500 dark:text-blue-400',
  letter: 'text-green-500 dark:text-green-400',
  mom: 'text-yellow-500 dark:text-yellow-400',
  issue: 'text-red-500 dark:text-red-400',
  record: 'text-purple-500 dark:text-purple-400'
}

/**
 * Hook for managing recent items
 */
export function useRecentItems() {
  const { user } = useAuth()

  const getStorageKey = useCallback(() => {
    return user?.id ? `${STORAGE_KEY_PREFIX}${user.id}` : null
  }, [user?.id])

  const getFavoritesKey = useCallback(() => {
    return user?.id ? `${FAVORITES_KEY_PREFIX}${user.id}` : null
  }, [user?.id])

  const getRecentItems = useCallback((): RecentItem[] => {
    const key = getStorageKey()
    if (!key) return []

    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [getStorageKey])

  const getFavorites = useCallback((): string[] => {
    const key = getFavoritesKey()
    if (!key) return []

    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [getFavoritesKey])

  const addRecentItem = useCallback((item: Omit<RecentItem, 'viewedAt' | 'isFavorite'>) => {
    const key = getStorageKey()
    if (!key) return

    const items = getRecentItems()
    const favorites = getFavorites()

    // Remove existing entry for same item
    const filtered = items.filter(i => !(i.id === item.id && i.type === item.type))

    // Add new item at the beginning
    const newItem: RecentItem = {
      ...item,
      viewedAt: new Date().toISOString(),
      isFavorite: favorites.includes(`${item.type}:${item.id}`)
    }

    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS)

    try {
      localStorage.setItem(key, JSON.stringify(updated))
    } catch (error) {
      console.error('Error saving recent item:', error)
    }
  }, [getStorageKey, getRecentItems, getFavorites])

  const toggleFavorite = useCallback((type: RecentItemType, id: string): boolean => {
    const favKey = getFavoritesKey()
    const recentKey = getStorageKey()
    if (!favKey || !recentKey) return false

    const favorites = getFavorites()
    const itemKey = `${type}:${id}`
    const isFavorite = favorites.includes(itemKey)

    let newFavorites: string[]
    if (isFavorite) {
      newFavorites = favorites.filter(f => f !== itemKey)
    } else {
      newFavorites = [...favorites, itemKey]
    }

    try {
      localStorage.setItem(favKey, JSON.stringify(newFavorites))

      // Update recent items
      const items = getRecentItems()
      const updated = items.map(item => {
        if (item.id === id && item.type === type) {
          return { ...item, isFavorite: !isFavorite }
        }
        return item
      })
      localStorage.setItem(recentKey, JSON.stringify(updated))

      return !isFavorite
    } catch (error) {
      console.error('Error toggling favorite:', error)
      return isFavorite
    }
  }, [getFavoritesKey, getStorageKey, getFavorites, getRecentItems])

  const clearRecentItems = useCallback(() => {
    const key = getStorageKey()
    if (key) {
      localStorage.removeItem(key)
    }
  }, [getStorageKey])

  const isFavorite = useCallback((type: RecentItemType, id: string): boolean => {
    const favorites = getFavorites()
    return favorites.includes(`${type}:${id}`)
  }, [getFavorites])

  return {
    getRecentItems,
    getFavorites,
    addRecentItem,
    toggleFavorite,
    clearRecentItems,
    isFavorite
  }
}

/**
 * Recent Items Panel Component
 */
interface RecentItemsPanelProps {
  limit?: number
  showFavoritesOnly?: boolean
  onItemClick?: (item: RecentItem) => void
  className?: string
}

export function RecentItemsPanel({
  limit = 10,
  showFavoritesOnly = false,
  onItemClick,
  className = ''
}: RecentItemsPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRecentItems, toggleFavorite, clearRecentItems } = useRecentItems()
  const [items, setItems] = useState<RecentItem[]>([])

  useEffect(() => {
    const allItems = getRecentItems()
    const filtered = showFavoritesOnly
      ? allItems.filter(item => item.isFavorite)
      : allItems
    setItems(filtered.slice(0, limit))
  }, [getRecentItems, limit, showFavoritesOnly])

  const handleClick = (item: RecentItem) => {
    if (onItemClick) {
      onItemClick(item)
      return
    }

    // Default navigation
    switch (item.type) {
      case 'topic':
        navigate(`/topics/${item.id}`)
        break
      case 'letter':
        navigate('/letters', { state: { highlightId: item.id } })
        break
      case 'mom':
        navigate('/mom', { state: { highlightId: item.id } })
        break
      case 'issue':
        navigate('/issues', { state: { highlightId: item.id } })
        break
      case 'record':
        // Records are within topics, might need topic ID
        navigate('/topics')
        break
    }
  }

  const handleToggleFavorite = (e: React.MouseEvent, item: RecentItem) => {
    e.stopPropagation()
    const newState = toggleFavorite(item.type, item.id)

    setItems(prev => prev.map(i => {
      if (i.id === item.id && i.type === item.type) {
        return { ...i, isFavorite: newState }
      }
      return i
    }).filter(i => !showFavoritesOnly || i.isFavorite))
  }

  if (items.length === 0) {
    return (
      <div className={`text-center text-sm text-gray-500 dark:text-gray-400 py-4 ${className}`}>
        {showFavoritesOnly
          ? t('recent.noFavorites', 'No favorites yet')
          : t('recent.noRecent', 'No recent items')
        }
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {showFavoritesOnly
            ? t('recent.favorites', 'Favorites')
            : t('recent.recentItems', 'Recent Items')
          }
        </h3>
        {!showFavoritesOnly && (
          <button
            onClick={clearRecentItems}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {t('common.clearAll', 'Clear all')}
          </button>
        )}
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={`${item.type}-${item.id}`}
            onClick={() => handleClick(item)}
            className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group"
          >
            <span className={typeColors[item.type]}>
              {typeIcons[item.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                {item.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatRelativeTime(item.viewedAt)}
              </p>
            </div>
            <button
              onClick={(e) => handleToggleFavorite(e, item)}
              className={`p-1 transition-colors ${
                item.isFavorite
                  ? 'text-yellow-500'
                  : 'text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100'
              }`}
            >
              <svg
                className="w-4 h-4"
                fill={item.isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Compact Recent Items for sidebar
 */
export function RecentItemsCompact({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRecentItems } = useRecentItems()
  const [items, setItems] = useState<RecentItem[]>([])

  useEffect(() => {
    setItems(getRecentItems().slice(0, limit))
  }, [getRecentItems, limit])

  if (items.length === 0) return null

  return (
    <div className="py-2">
      <p className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {t('recent.recent', 'Recent')}
      </p>
      {items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          onClick={() => {
            switch (item.type) {
              case 'topic':
                navigate(`/topics/${item.id}`)
                break
              default:
                navigate(`/${item.type}s`)
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
        >
          <span className={typeColors[item.type]}>
            {typeIcons[item.type]}
          </span>
          <span className="truncate">{item.title}</span>
        </button>
      ))}
    </div>
  )
}

export default RecentItemsPanel
