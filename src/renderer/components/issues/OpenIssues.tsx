import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../common/Modal'
import { IssueCard } from './IssueCard'
import { IssueForm } from './IssueForm'
import { IssueDetail } from './IssueDetail'
import { notifyReminderDataChanged } from '../reminders/ReminderBadge'
import type { Issue, Topic, IssueImportance, IssueFilters, CreateIssueData } from '../../types'

type TabMode = 'open' | 'completed'

interface IssueStats {
  totalOpen: number
  totalCompleted: number
  byImportance: Record<string, number>
  overdueReminders: number
}

export function OpenIssues() {
  const { user } = useAuth()

  // Data state
  const [issues, setIssues] = useState<Issue[]>([])
  const [stats, setStats] = useState<IssueStats | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [tabMode, setTabMode] = useState<TabMode>('open')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterImportance, setFilterImportance] = useState<IssueImportance | ''>('')
  const [filterHasReminder, setFilterHasReminder] = useState<'' | 'yes' | 'no'>('')

  const buildFilters = useCallback((): IssueFilters => {
    const filters: IssueFilters = {}
    if (searchQuery.trim()) filters.query = searchQuery.trim()
    if (filterTopic) filters.topic_id = filterTopic
    if (filterImportance) filters.importance = filterImportance
    if (filterHasReminder === 'yes') filters.has_reminder = true
    else if (filterHasReminder === 'no') filters.has_reminder = false
    return filters
  }, [searchQuery, filterTopic, filterImportance, filterHasReminder])

  const loadIssues = useCallback(async () => {
    try {
      const filters = buildFilters()
      const result = tabMode === 'open'
        ? await window.electronAPI.issues.getOpen(filters)
        : await window.electronAPI.issues.getCompleted(filters)
      setIssues(result as Issue[])
    } catch (err) {
      console.error('Error loading issues:', err)
    } finally {
      setLoading(false)
    }
  }, [tabMode, buildFilters])

  const loadStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.issues.getStats()
      setStats(result as IssueStats)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }, [])

  const loadTopics = useCallback(async () => {
    try {
      const result = await window.electronAPI.topics.getAll()
      setTopics((result as Topic[]).filter(t => !t.deleted_at))
    } catch (err) {
      console.error('Error loading topics:', err)
    }
  }, [])

  useEffect(() => {
    loadTopics()
    loadStats()
  }, [loadTopics, loadStats])

  useEffect(() => {
    setLoading(true)
    loadIssues()
  }, [loadIssues])

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadIssues()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleCreateIssue = async (data: CreateIssueData) => {
    if (!user) return
    try {
      const result = await window.electronAPI.issues.create(data, user.id)
      if (result.success) {
        setShowCreateModal(false)
        loadIssues()
        loadStats()
        notifyReminderDataChanged()
      } else {
        alert(result.error || 'Failed to create issue')
      }
    } catch (err) {
      console.error('Error creating issue:', err)
    }
  }

  const handleIssueUpdated = () => {
    loadIssues()
    loadStats()
    notifyReminderDataChanged()
    // Refresh the selected issue
    if (selectedIssue) {
      window.electronAPI.issues.getById(selectedIssue.id).then((result) => {
        if (result) setSelectedIssue(result as Issue)
      })
    }
  }

  const hasActiveFilters = filterTopic || filterImportance || filterHasReminder || searchQuery.trim()

  const clearFilters = () => {
    setSearchQuery('')
    setFilterTopic('')
    setFilterImportance('')
    setFilterHasReminder('')
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light border-b border-gray-200">
        {/* Title row */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Open Issues</h1>
              <p className="text-sm text-gray-500 mt-1">Track events, problems, and tasks requiring follow-up</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Issue
            </button>
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase font-medium">Open</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalOpen}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-red-500 uppercase font-medium">Critical</p>
                <p className="text-xl font-bold text-red-700">{stats.byImportance.critical || 0}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-orange-500 uppercase font-medium">High</p>
                <p className="text-xl font-bold text-orange-700">{stats.byImportance.high || 0}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase font-medium">Overdue Reminders</p>
                <p className={`text-xl font-bold ${stats.overdueReminders > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {stats.overdueReminders}
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 -mb-4">
            <button
              onClick={() => setTabMode('open')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'open'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Open Issues
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{stats.totalOpen}</span>}
            </button>
            <button
              onClick={() => setTabMode('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'completed'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{stats.totalCompleted}</span>}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-white border-t border-gray-100 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Topic filter */}
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Topics</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>

          {/* Importance filter */}
          <select
            value={filterImportance}
            onChange={(e) => setFilterImportance(e.target.value as IssueImportance | '')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Importance</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Reminder filter */}
          <select
            value={filterHasReminder}
            onChange={(e) => setFilterHasReminder(e.target.value as '' | 'yes' | 'no')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Reminders: Any</option>
            <option value="yes">Has Reminder</option>
            <option value="no">No Reminder</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {hasActiveFilters
                ? 'No issues match your filters'
                : tabMode === 'open'
                  ? 'No open issues'
                  : 'No completed issues'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {hasActiveFilters
                ? 'Try adjusting your filters to find what you\'re looking for'
                : tabMode === 'open'
                  ? 'Create a new issue to start tracking'
                  : 'Completed issues will appear here'}
            </p>
            {!hasActiveFilters && tabMode === 'open' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create First Issue
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClick={() => setSelectedIssue(issue)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          title="New Issue"
          onClose={() => setShowCreateModal(false)}
          isOpen={showCreateModal}
          size="lg"
        >
          <IssueForm
            onSubmit={(data) => handleCreateIssue(data as CreateIssueData)}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedIssue && (
        <Modal
          title="Issue Details"
          onClose={() => setSelectedIssue(null)}
          isOpen={!!selectedIssue}
          size="lg"
        >
          <IssueDetail
            issue={selectedIssue}
            onClose={() => setSelectedIssue(null)}
            onUpdated={handleIssueUpdated}
          />
        </Modal>
      )}
    </div>
  )
}
