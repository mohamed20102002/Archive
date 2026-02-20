import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useUndoRedo } from '../../context/UndoRedoContext'
import { Modal } from '../common/Modal'
import { IssueCard } from './IssueCard'
import { IssueForm } from './IssueForm'
import { IssueDetail } from './IssueDetail'
import { IssuesSummaryModal } from './IssuesSummaryModal'
import { ExportButton } from '../common/ExportButton'
import { notifyReminderDataChanged } from '../reminders/ReminderBadge'
import { notifyMentionDataChanged } from '../mentions'
import type { Issue, Topic, IssueImportance, IssueFilters, CreateIssueData } from '../../types'

type TabMode = 'open' | 'completed'

interface IssueStats {
  totalOpen: number
  totalCompleted: number
  byImportance: Record<string, number>
  overdueReminders: number
}

const PAGE_SIZE = 30

export function OpenIssues() {
  const { user } = useAuth()
  const toast = useToast()
  const { recordOperation } = useUndoRedo()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const processedIssueId = useRef<string | null>(null)
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null)
  const highlightedCardRef = useRef<HTMLDivElement>(null)

  // Data state
  const [issues, setIssues] = useState<Issue[]>([])
  const [stats, setStats] = useState<IssueStats | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0) // Force card remount to refetch tags

  // UI state
  const [tabMode, setTabMode] = useState<TabMode>('open')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  // Pins
  const [pinStatuses, setPinStatuses] = useState<Record<string, boolean>>({})

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterImportance, setFilterImportance] = useState<IssueImportance | ''>('')
  const [filterHasReminder, setFilterHasReminder] = useState<'' | 'yes' | 'no'>('')

  // Handle issueId from URL params (e.g., /issues?issueId=xxx)
  useEffect(() => {
    const issueId = searchParams.get('issueId')
    if (issueId && issueId !== processedIssueId.current && !loading) {
      processedIssueId.current = issueId

      const handleIssueNavigation = async () => {
        // Fetch the issue to check its status
        const issue = await window.electronAPI.issues.getById(issueId) as Issue | null
        if (!issue) {
          setSearchParams({}, { replace: true })
          return
        }

        // Check if we need to switch tabs
        const issueTab = issue.status === 'completed' ? 'completed' : 'open'
        if (issueTab !== tabMode) {
          setTabMode(issueTab)
          // Wait for tab switch and data reload
          setTimeout(() => {
            setHighlightedIssueId(issueId)
            setSearchParams({}, { replace: true })
            setTimeout(() => setHighlightedIssueId(null), 5000)
          }, 500)
        } else {
          // Same tab, just highlight
          setHighlightedIssueId(issueId)
          setSearchParams({}, { replace: true })
          setTimeout(() => setHighlightedIssueId(null), 5000)
        }
      }

      handleIssueNavigation()
    }
  }, [searchParams, setSearchParams, loading, tabMode])

  // Scroll to highlighted card when it appears
  useEffect(() => {
    if (highlightedIssueId && !loading) {
      // Small delay to ensure the card is rendered
      const scrollTimer = setTimeout(() => {
        if (highlightedCardRef.current) {
          highlightedCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return () => clearTimeout(scrollTimer)
    }
  }, [highlightedIssueId, issues, loading])

  // Handle search highlight from global search
  useEffect(() => {
    const state = location.state as any
    if (state?.highlightType === 'issue' && state?.highlightId && !loading) {
      const issueId = state.highlightId

      const handleSearchHighlight = async () => {
        // Fetch the issue to check its status
        const issue = await window.electronAPI.issues.getById(issueId) as Issue | null
        if (!issue) {
          window.history.replaceState({}, document.title)
          return
        }

        // Check if we need to switch tabs
        const issueTab = issue.status === 'completed' ? 'completed' : 'open'
        if (issueTab !== tabMode) {
          setTabMode(issueTab)
          // Wait for tab switch and data reload
          setTimeout(() => {
            setHighlightedIssueId(issueId)
            setTimeout(() => setHighlightedIssueId(null), 5000)
          }, 500)
        } else {
          // Same tab, just highlight
          setHighlightedIssueId(issueId)
          setTimeout(() => setHighlightedIssueId(null), 5000)
        }

        // Clear the location state
        window.history.replaceState({}, document.title)
      }

      handleSearchHighlight()
    }
  }, [location.state, loading, tabMode])

  // Handle highlight from URL query param (e.g., from mentions)
  useEffect(() => {
    const highlightId = searchParams.get('highlightId')
    if (!highlightId || loading) return

    const handleHighlightFromUrl = async () => {
      // Fetch the issue to check its status
      const issue = await window.electronAPI.issues.getById(highlightId) as Issue | null
      if (!issue) {
        setSearchParams({}, { replace: true })
        return
      }

      // Check if we need to switch tabs
      const issueTab = issue.status === 'completed' ? 'completed' : 'open'
      if (issueTab !== tabMode) {
        setTabMode(issueTab)
        // Wait for tab switch and data reload
        setTimeout(() => {
          setHighlightedIssueId(highlightId)
          setSearchParams({}, { replace: true })
          setTimeout(() => setHighlightedIssueId(null), 5000)
        }, 500)
      } else {
        // Same tab, just highlight
        setHighlightedIssueId(highlightId)
        setSearchParams({}, { replace: true })
        setTimeout(() => setHighlightedIssueId(null), 5000)
      }
    }

    handleHighlightFromUrl()
  }, [searchParams, loading, tabMode])

  const buildFilters = useCallback((currentOffset = 0): IssueFilters => {
    const filters: IssueFilters = {}
    if (searchQuery.trim()) filters.query = searchQuery.trim()
    if (filterTopic) filters.topic_id = filterTopic
    if (filterImportance) filters.importance = filterImportance
    if (filterHasReminder === 'yes') filters.has_reminder = true
    else if (filterHasReminder === 'no') filters.has_reminder = false
    filters.limit = PAGE_SIZE
    filters.offset = currentOffset
    return filters
  }, [searchQuery, filterTopic, filterImportance, filterHasReminder])

  const loadIssues = useCallback(async (loadMore = false, currentLength = 0) => {
    try {
      if (loadMore) {
        setIsLoadingMore(true)
      }

      const currentOffset = loadMore ? currentLength : 0
      const filters = buildFilters(currentOffset)
      const result = tabMode === 'open'
        ? await window.electronAPI.issues.getOpen(filters) as { data: Issue[]; total: number; hasMore: boolean }
        : await window.electronAPI.issues.getCompleted(filters) as { data: Issue[]; total: number; hasMore: boolean }

      setIssues(prev => loadMore ? [...prev, ...result.data] : result.data)
      setHasMore(result.hasMore)
      setTotalCount(result.total)
    } catch (err) {
      console.error('Error loading issues:', err)
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
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
      const result = await window.electronAPI.topics.getAll({}) as { data: Topic[] }
      const topicsData = result.data || result
      setTopics((topicsData as Topic[]).filter(t => !t.deleted_at))
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

  // Load pin statuses when issues change
  useEffect(() => {
    const loadPinStatuses = async () => {
      if (!user || issues.length === 0) return
      try {
        const issueIds = issues.map(i => i.id)
        const statuses = await window.electronAPI.pins.getPinStatuses('issue', issueIds, user.id)
        setPinStatuses(statuses as Record<string, boolean>)
      } catch (err) {
        console.error('Error loading pin statuses:', err)
      }
    }
    loadPinStatuses()
  }, [issues, user])

  const handleTogglePin = useCallback(async (issueId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.pins.toggle('issue', issueId, user.id)
      setPinStatuses(prev => ({ ...prev, [issueId]: result.pinned }))
    } catch (err) {
      console.error('Error toggling pin:', err)
    }
  }, [user])

  // Sort issues with pinned first
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const aPinned = pinStatuses[a.id] || false
      const bPinned = pinStatuses[b.id] || false
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return 0
    })
  }, [issues, pinStatuses])

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadIssues()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleCreateIssue = async (data: CreateIssueData & { mentions?: any[] }) => {
    if (!user) return
    try {
      const result = await window.electronAPI.issues.create(data, user.id)
      if (result.success) {
        const createdIssue = result.issue as Issue

        // Create mentions if any
        if (data.mentions && data.mentions.length > 0) {
          await window.electronAPI.mentions.createBulk(
            data.mentions.map((m: any) => ({
              entity_type: 'issue' as const,
              entity_id: createdIssue.id,
              mentioned_user_id: m.user.id,
              note: m.note || undefined
            })),
            user.id
          )
          notifyMentionDataChanged()
        }

        // Record operation for undo/redo
        recordOperation({
          operation: 'create',
          entityType: 'issue',
          entityId: createdIssue.id,
          description: `Create issue "${createdIssue.title}"`,
          beforeState: null,
          afterState: {
            entityType: 'issue',
            entityId: createdIssue.id,
            data: createdIssue as unknown as globalThis.Record<string, unknown>
          },
          userId: user.id
        })

        setShowCreateModal(false)
        setRefreshKey(k => k + 1) // Force cards to refetch tags
        loadIssues()
        loadStats()
        notifyReminderDataChanged()
      } else {
        toast.error('Error', result.error || 'Failed to create issue')
      }
    } catch (err) {
      console.error('Error creating issue:', err)
    }
  }

  const handleIssueUpdated = () => {
    setRefreshKey(k => k + 1) // Force cards to refetch tags
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
      <div className="sticky top-0 z-10 bg-archive-light dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {/* Title row */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Open Issues</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track events, problems, and tasks requiring follow-up</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSummaryModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title="View quick summary of all open issues with their latest updates"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Quick Summary
              </button>
              <ExportButton exportType="issues" />
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
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Open</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalOpen}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-red-500 uppercase font-medium">Critical</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-400">{stats.byImportance.critical || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-orange-500 uppercase font-medium">High</p>
                <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{stats.byImportance.high || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Overdue Reminders</p>
                <p className={`text-xl font-bold ${stats.overdueReminders > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {stats.overdueReminders}
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 -mb-4">
            <button
              onClick={() => setTabMode('open')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'open'
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Open Issues
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{stats.totalOpen}</span>}
            </button>
            <button
              onClick={() => setTabMode('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'completed'
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Completed
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{stats.totalCompleted}</span>}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues..."
              className="input pl-9 pr-3 py-1.5 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Topic filter */}
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="input w-auto px-3 py-1.5 text-sm"
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
            className="input w-auto px-3 py-1.5 text-sm"
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
            className="input w-auto px-3 py-1.5 text-sm"
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedIssues.map((issue) => (
                <div
                  key={`${issue.id}-${refreshKey}`}
                  ref={issue.id === highlightedIssueId ? highlightedCardRef : undefined}
                  className="h-full"
                >
                  <IssueCard
                    issue={issue}
                    onClick={() => setSelectedIssue(issue)}
                    highlighted={issue.id === highlightedIssueId}
                    isPinned={pinStatuses[issue.id] || false}
                    onTogglePin={() => handleTogglePin(issue.id)}
                  />
                </div>
              ))}
            </div>
            {!hasActiveFilters && (hasMore || issues.length > PAGE_SIZE) && (
              <div className="flex justify-center gap-3 mt-6">
                {hasMore && (
                  <button
                    onClick={() => loadIssues(true, issues.length)}
                    disabled={isLoadingMore}
                    className="px-6 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      `Load More (${issues.length} of ${totalCount})`
                    )}
                  </button>
                )}
                {issues.length > PAGE_SIZE && (
                  <button
                    onClick={() => loadIssues(false)}
                    className="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Show Less
                  </button>
                )}
              </div>
            )}
          </>
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

      {/* Summary Modal */}
      <IssuesSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onViewIssue={(issue) => {
          setShowSummaryModal(false)
          setSelectedIssue(issue)
        }}
      />
    </div>
  )
}
