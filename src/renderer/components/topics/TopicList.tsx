import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopicCard } from './TopicCard'
import { TopicForm } from './TopicForm'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useUndoRedo } from '../../context/UndoRedoContext'
import { onDataTypeChanged } from '../../utils/dataEvents'
import { ExportButton } from '../common/ExportButton'
import type { Topic } from '../../types'

type FilterStatus = 'all' | 'active' | 'archived' | 'closed'
type SortOption = 'updated' | 'created' | 'title' | 'priority'
type ViewMode = 'card' | 'table'

const PAGE_SIZE = 30

export function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [filteredTopics, setFilteredTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortOption>('updated')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [pinStatuses, setPinStatuses] = useState<Record<string, boolean>>({})
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const { success, error } = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const { recordOperation } = useUndoRedo()
  const navigate = useNavigate()

  const loadTopics = async (loadMore = false, currentLength = 0) => {
    try {
      if (loadMore) {
        setIsLoadingMore(true)
      }

      const offset = loadMore ? currentLength : 0
      const result = await window.electronAPI.topics.getAll({
        limit: PAGE_SIZE,
        offset
      }) as { data: Topic[]; total: number; hasMore: boolean }

      setTopics(prev => loadMore ? [...prev, ...result.data] : result.data)
      setHasMore(result.hasMore)
      setTotalCount(result.total)

      // Load pin statuses for new topics
      if (user && result.data.length > 0) {
        const topicIds = result.data.map(t => t.id)
        const statuses = await window.electronAPI.pins.getPinStatuses('topic', topicIds, user.id)
        setPinStatuses(prev => loadMore ? { ...prev, ...statuses } : statuses)
      }
    } catch (err) {
      console.error('Error loading topics:', err)
      error('Failed to load topics')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const handleTogglePin = useCallback(async (topicId: string) => {
    if (!user) return

    const result = await window.electronAPI.pins.toggle('topic', topicId, user.id)
    if (result.success) {
      setPinStatuses(prev => ({ ...prev, [topicId]: result.pinned }))
    }
  }, [user])

  useEffect(() => {
    loadTopics()
  }, [])

  // Listen for data changes (record create/delete affects topic record counts)
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    let lastEventTime = 0

    const unsubscribe = onDataTypeChanged(['record', 'topic', 'all'], () => {
      const now = Date.now()
      // Debounce: ignore events within 500ms of each other
      if (now - lastEventTime < 500) {
        return
      }
      lastEventTime = now

      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        loadTopics()
      }, 300)
    })

    return () => {
      unsubscribe()
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [])

  useEffect(() => {
    let result = [...topics]

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      )
    }

    // Sort
    result.sort((a, b) => {
      // Pinned items always come first
      const aPinned = pinStatuses[a.id] ? 1 : 0
      const bPinned = pinStatuses[b.id] ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned

      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'priority': {
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
          return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
                 (priorityOrder[b.priority as keyof typeof priorityOrder] || 2)
        }
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

    setFilteredTopics(result)
  }, [topics, searchQuery, filterStatus, sortBy, pinStatuses])

  const handleCreate = async (data: { title: string; description?: string; priority?: string }) => {
    if (!user) return

    const result = await window.electronAPI.topics.create(data, user.id)
    if (result.success) {
      const createdTopic = result.topic as Topic

      // Record operation for undo/redo
      recordOperation({
        operation: 'create',
        entityType: 'topic',
        entityId: createdTopic.id,
        description: `Create topic "${data.title}"`,
        beforeState: null,
        afterState: {
          entityType: 'topic',
          entityId: createdTopic.id,
          data: createdTopic as unknown as globalThis.Record<string, unknown>
        },
        userId: user.id
      })

      success('Topic created', `"${data.title}" has been created`)
      setShowForm(false)
      loadTopics()
    } else {
      error('Failed to create topic', result.error)
    }
  }

  const handleUpdate = async (data: { title: string; description?: string; priority?: string }) => {
    if (!user || !editingTopic) return

    // Capture before state for undo
    const beforeData = await window.electronAPI.history.getEntity('topic', editingTopic.id)

    const result = await window.electronAPI.topics.update(editingTopic.id, data, user.id)
    if (result.success) {
      // Capture after state for undo/redo
      const afterData = await window.electronAPI.history.getEntity('topic', editingTopic.id)

      // Record operation for undo/redo
      if (beforeData) {
        recordOperation({
          operation: 'update',
          entityType: 'topic',
          entityId: editingTopic.id,
          description: `Update topic "${data.title}"`,
          beforeState: {
            entityType: 'topic',
            entityId: editingTopic.id,
            data: beforeData
          },
          afterState: afterData ? {
            entityType: 'topic',
            entityId: editingTopic.id,
            data: afterData
          } : null,
          userId: user.id
        })
      }

      success('Topic updated', `"${data.title}" has been updated`)
      setEditingTopic(null)
      loadTopics()
    } else {
      error('Failed to update topic', result.error)
    }
  }

  const handleDelete = async (topic: Topic) => {
    if (!user) return

    const confirmed = await confirm({
      title: 'Delete Topic',
      message: `Are you sure you want to delete "${topic.title}"? This will also delete all associated records.`,
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    // Capture before state for undo
    const beforeData = await window.electronAPI.history.getEntity('topic', topic.id)

    const result = await window.electronAPI.topics.delete(topic.id, user.id)
    if (result.success) {
      // Record operation for undo/redo
      if (beforeData) {
        recordOperation({
          operation: 'delete',
          entityType: 'topic',
          entityId: topic.id,
          description: `Delete topic "${topic.title}"`,
          beforeState: {
            entityType: 'topic',
            entityId: topic.id,
            data: beforeData
          },
          afterState: null,
          userId: user.id
        })
      }

      success('Topic deleted', `"${topic.title}" has been deleted`)
      loadTopics()
    } else {
      error('Failed to delete topic', result.error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Actions */}
      <div className="sticky top-0 z-10 bg-archive-light px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="input pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="input w-auto"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="closed">Closed</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input w-auto"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="title">Title</option>
              <option value="priority">Priority</option>
            </select>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Card View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Table View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <ExportButton exportType="topics" />
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Topic
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Topics Grid */}
      <div className="flex-1 overflow-auto px-6 py-6">
      {filteredTopics.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No topics found</h3>
          <p className="text-gray-500">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first topic to get started'}
          </p>
          {!searchQuery && filterStatus === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4"
            >
              Create Topic
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isPinned={pinStatuses[topic.id] || false}
                onEdit={() => setEditingTopic(topic)}
                onDelete={() => handleDelete(topic)}
                onTogglePin={() => handleTogglePin(topic.id)}
              />
            ))}
          </div>
          {!searchQuery && filterStatus === 'all' && (hasMore || topics.length > PAGE_SIZE) && (
            <div className="flex justify-center gap-3 mt-6">
              {hasMore && (
                <button
                  onClick={() => loadTopics(true, topics.length)}
                  disabled={isLoadingMore}
                  className="px-6 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    `Load More (${topics.length} of ${totalCount})`
                  )}
                </button>
              )}
              {topics.length > PAGE_SIZE && (
                <button
                  onClick={() => loadTopics(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Show Less
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTopics.map((topic) => {
                const priorityColors: Record<string, string> = {
                  low: 'bg-gray-100 text-gray-600',
                  normal: 'bg-blue-100 text-blue-700',
                  high: 'bg-orange-100 text-orange-700',
                  urgent: 'bg-red-100 text-red-700'
                }
                const statusColors: Record<string, string> = {
                  active: 'bg-green-100 text-green-700',
                  archived: 'bg-gray-100 text-gray-600',
                  closed: 'bg-red-100 text-red-700'
                }
                return (
                  <tr
                    key={topic.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/topics/${topic.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{topic.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                        {topic.description || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[topic.priority] || priorityColors.normal}`}>
                        {topic.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[topic.status] || statusColors.active}`}>
                        {topic.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{topic.record_count || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {new Date(topic.updated_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingTopic(topic)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(topic)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Topic Form Modal */}
      {(showForm || editingTopic) && (
        <TopicForm
          topic={editingTopic || undefined}
          onSubmit={editingTopic ? handleUpdate : handleCreate}
          onClose={() => {
            setShowForm(false)
            setEditingTopic(null)
          }}
        />
      )}
    </div>
  )
}
