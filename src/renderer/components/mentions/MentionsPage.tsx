import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MentionCard } from './MentionCard'
import { notifyMentionDataChanged } from './MentionsBadge'
import type { Mention, MentionStatus, MentionEntityType, MentionCounts } from '../../types'

type TabType = 'pending' | 'acknowledged' | 'archived' | 'sent'

const tabs: { id: TabType; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'archived', label: 'Archived' },
  { id: 'sent', label: 'Sent by Me' }
]

const entityTypeFilters: { value: MentionEntityType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'record', label: 'Records' },
  { value: 'mom', label: 'MOMs' },
  { value: 'letter', label: 'Letters' },
  { value: 'issue', label: 'Issues' }
]

export function MentionsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [mentions, setMentions] = useState<Mention[]>([])
  const [counts, setCounts] = useState<MentionCounts>({ pending: 0, acknowledged: 0, archived: 0, sent: 0 })
  const [entityTypeFilter, setEntityTypeFilter] = useState<MentionEntityType | ''>('')
  const [isLoading, setIsLoading] = useState(true)

  const loadMentions = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const filters = entityTypeFilter ? { entity_type: entityTypeFilter } : {}

      let result: Mention[]
      if (activeTab === 'sent') {
        result = await window.electronAPI.mentions.getSentByUser(user.id, filters)
      } else {
        const statusFilters = { ...filters, status: activeTab as MentionStatus }
        result = await window.electronAPI.mentions.getForUser(user.id, statusFilters)
      }

      setMentions(result as Mention[])
    } catch (error) {
      console.error('Error loading mentions:', error)
      setMentions([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, activeTab, entityTypeFilter])

  const loadCounts = useCallback(async () => {
    if (!user?.id) return
    try {
      const result = await window.electronAPI.mentions.getCounts(user.id)
      setCounts(result)
    } catch (error) {
      console.error('Error loading mention counts:', error)
    }
  }, [user?.id])

  useEffect(() => {
    loadMentions()
    loadCounts()
  }, [loadMentions, loadCounts])

  useEffect(() => {
    const handleDataChanged = () => {
      loadMentions()
      loadCounts()
    }
    window.addEventListener('mention-data-changed', handleDataChanged)
    return () => window.removeEventListener('mention-data-changed', handleDataChanged)
  }, [loadMentions, loadCounts])

  const handleRefresh = () => {
    loadMentions()
    loadCounts()
    notifyMentionDataChanged()
  }

  const getTabCount = (tabId: TabType) => {
    switch (tabId) {
      case 'pending':
        return counts.pending
      case 'acknowledged':
        return counts.acknowledged
      case 'archived':
        return counts.archived
      case 'sent':
        return counts.sent
      default:
        return 0
    }
  }

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'pending':
        return 'No pending mentions. When someone mentions you, it will appear here.'
      case 'acknowledged':
        return 'No acknowledged mentions. Mentions you acknowledge will appear here.'
      case 'archived':
        return 'No archived mentions. Acknowledged mentions you archive will appear here.'
      case 'sent':
        return 'No sent mentions. Mentions you create will appear here.'
      default:
        return 'No mentions found.'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mentions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage your mentions across all entities
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const count = getTabCount(tab.id)
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    isActive
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="entity-filter" className="text-sm text-gray-600 dark:text-gray-400">
            Filter by type:
          </label>
          <select
            id="entity-filter"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value as MentionEntityType | '')}
            className="input-field py-1.5 text-sm"
          >
            {entityTypeFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : mentions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No mentions</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
            {getEmptyMessage()}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {mentions.map((mention) => (
            <MentionCard
              key={mention.id}
              mention={mention}
              onRefresh={handleRefresh}
              showActions={activeTab !== 'archived'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default MentionsPage
