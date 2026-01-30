import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns'
import { RecordCard } from './RecordCard'
import { RecordForm } from './RecordForm'
import { SubcategoryManager } from './SubcategoryManager'
import { useTopic } from '../../hooks/useTopics'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { Record, Subcategory } from '../../types'

type RecordTypeFilter = 'all' | 'note' | 'email' | 'document' | 'event' | 'decision'
type SubcategoryFilter = 'all' | 'general' | string // 'all' for all, 'general' for no subcategory, or subcategory id
type ViewMode = 'timeline' | 'table'

function groupRecordsByDate(records: Record[]): Map<string, Record[]> {
  const groups = new Map<string, Record[]>()

  records.forEach(record => {
    const date = parseISO(record.created_at)
    let key: string

    if (isToday(date)) {
      key = 'Today'
    } else if (isYesterday(date)) {
      key = 'Yesterday'
    } else if (isThisWeek(date)) {
      key = format(date, 'EEEE') // Day name
    } else {
      key = format(date, 'MMMM d, yyyy')
    }

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(record)
  })

  return groups
}

export function Timeline() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const { topic, isLoading: topicLoading } = useTopic(topicId)
  const { user } = useAuth()
  const { success, error } = useToast()

  const [records, setRecords] = useState<Record[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Record | null>(null)
  const [filterType, setFilterType] = useState<RecordTypeFilter>('all')
  const [filterSubcategory, setFilterSubcategory] = useState<SubcategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSubcategoryManager, setShowSubcategoryManager] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')

  const loadSubcategories = async () => {
    if (!topicId) return
    try {
      const data = await window.electronAPI.subcategories.getByTopic(topicId)
      setSubcategories(data as Subcategory[])
    } catch (err) {
      console.error('Error loading subcategories:', err)
    }
  }

  const loadRecords = async () => {
    if (!topicId) return

    setIsLoading(true)
    try {
      // Pass subcategory filter to backend if not 'all'
      let subcategoryId: string | null | undefined = undefined
      if (filterSubcategory === 'general') {
        subcategoryId = null
      } else if (filterSubcategory !== 'all') {
        subcategoryId = filterSubcategory
      }

      const data = await window.electronAPI.records.getByTopic(topicId, subcategoryId)
      setRecords(data as Record[])
    } catch (err) {
      console.error('Error loading records:', err)
      error('Failed to load records')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSubcategories()
  }, [topicId])

  useEffect(() => {
    loadRecords()
  }, [topicId, filterSubcategory])

  const filteredRecords = records.filter(record => {
    if (filterType !== 'all' && record.type !== filterType) {
      return false
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        record.title.toLowerCase().includes(query) ||
        record.content?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const groupedRecords = groupRecordsByDate(filteredRecords)

  const handleCreate = async (data: { type: string; title: string; content?: string; subcategory_id?: string }): Promise<{ recordId?: string }> => {
    if (!user || !topicId) return {}

    // Use the selected subcategory filter as default if not 'all' or 'general'
    let subcategoryId = data.subcategory_id
    if (subcategoryId === undefined && filterSubcategory !== 'all' && filterSubcategory !== 'general') {
      subcategoryId = filterSubcategory
    }

    const result = await window.electronAPI.records.create(
      { ...data, topic_id: topicId, subcategory_id: subcategoryId },
      user.id
    )

    if (result.success) {
      success('Record created', `"${data.title}" has been added to the timeline`)
      setShowForm(false)
      loadRecords()
      return { recordId: (result.record as any)?.id }
    } else {
      error('Failed to create record', result.error)
      throw new Error(result.error)
    }
  }

  const handleUpdate = async (data: { type: string; title: string; content?: string; subcategory_id?: string }): Promise<{ recordId?: string }> => {
    if (!user || !editingRecord) return {}

    const result = await window.electronAPI.records.update(
      editingRecord.id,
      {
        type: data.type,
        title: data.title,
        content: data.content,
        subcategory_id: data.subcategory_id === '' ? null : data.subcategory_id
      },
      user.id
    )

    if (result.success) {
      success('Record updated')
      setEditingRecord(null)
      loadRecords()
      loadSubcategories() // Refresh subcategory counts
      return { recordId: editingRecord.id }
    } else {
      error('Failed to update record', result.error)
      throw new Error(result.error)
    }
  }

  const handleDelete = async (record: Record) => {
    if (!user) return

    if (!confirm(`Are you sure you want to delete "${record.title}"?`)) {
      return
    }

    const result = await window.electronAPI.records.delete(record.id, user.id)

    if (result.success) {
      success('Record deleted')
      loadRecords()
    } else {
      error('Failed to delete record', result.error)
    }
  }

  const handleOpenEmail = async (emailId: string) => {
    try {
      const result = await window.electronAPI.emails.openFile(emailId)
      if (!result.success) {
        error('Failed to open email', result.error)
      }
    } catch (err: any) {
      error('Failed to open email', err.message)
    }
  }

  if (topicLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Topic not found</h3>
        <button onClick={() => navigate('/topics')} className="btn-primary">
          Back to Topics
        </button>
      </div>
    )
  }

  return (
    <div className="-m-6 flex flex-col h-[calc(100vh-4rem)]">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-archive-light px-6 pt-6 pb-4 space-y-4 border-b border-gray-200">
        {/* Topic Header */}
        <div className="flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate('/topics')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Topics
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
            {topic.description && (
              <p className="text-gray-600 mt-1">{topic.description}</p>
            )}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Record
          </button>
        </div>

        {/* Subcategory Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 p-1">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setFilterSubcategory('all')}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                filterSubcategory === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setFilterSubcategory('general')}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                filterSubcategory === 'general'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              General
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setFilterSubcategory(sub.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-2 ${
                  filterSubcategory === sub.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {sub.title}
                {sub.record_count !== undefined && sub.record_count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    filterSubcategory === sub.id
                      ? 'bg-primary-200 text-primary-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {sub.record_count}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowSubcategoryManager(true)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-1"
              title="Manage Subcategories"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="hidden sm:inline">Manage</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records..."
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

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as RecordTypeFilter)}
            className="input w-auto"
          >
            <option value="all">All Types</option>
            <option value="note">Notes</option>
            <option value="email">Emails</option>
            <option value="document">Documents</option>
            <option value="event">Events</option>
            <option value="decision">Decisions</option>
          </select>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 ${viewMode === 'timeline' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Timeline View"
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
      </div>

      {/* Scrollable Timeline Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
      {filteredRecords.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No records found</h3>
          <p className="text-gray-500">
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first record to start building the timeline'}
          </p>
          {!searchQuery && filterType === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4"
            >
              Add Record
            </button>
          )}
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="space-y-8">
          {Array.from(groupedRecords.entries()).map(([date, dateRecords]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                {date}
              </h3>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                {/* Records */}
                <div className="space-y-4">
                  {dateRecords.map((record) => (
                    <RecordCard
                      key={record.id}
                      record={record}
                      onEdit={() => setEditingRecord(record)}
                      onDelete={() => handleDelete(record)}
                      onOpenEmail={handleOpenEmail}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcategory</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Editor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((record) => {
                const typeIcons: Record<string, { icon: string; color: string }> = {
                  note: { icon: '📝', color: 'bg-blue-100 text-blue-700' },
                  email: { icon: '✉️', color: 'bg-purple-100 text-purple-700' },
                  document: { icon: '📄', color: 'bg-green-100 text-green-700' },
                  event: { icon: '📅', color: 'bg-orange-100 text-orange-700' },
                  decision: { icon: '⚖️', color: 'bg-red-100 text-red-700' }
                }
                const typeInfo = typeIcons[record.type] || typeIcons.note
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${typeInfo.color}`}>
                        {typeInfo.icon} {record.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{record.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                        {record.content || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {record.subcategory_title || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{record.creator_name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {format(parseISO(record.created_at), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {record.type === 'email' && record.email_id && (
                          <button
                            onClick={() => handleOpenEmail(record.email_id!)}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Open Email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setEditingRecord(record)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(record)}
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

      {/* Record Form Modal */}
      {(showForm || editingRecord) && (
        <RecordForm
          record={editingRecord || undefined}
          topicId={topicId}
          subcategories={subcategories}
          defaultSubcategoryId={
            filterSubcategory !== 'all' && filterSubcategory !== 'general'
              ? filterSubcategory
              : undefined
          }
          onSubmit={editingRecord ? handleUpdate : handleCreate}
          onClose={() => {
            setShowForm(false)
            setEditingRecord(null)
          }}
        />
      )}

      {/* Subcategory Manager Modal */}
      {showSubcategoryManager && topicId && (
        <SubcategoryManager
          topicId={topicId}
          subcategories={subcategories}
          onClose={() => setShowSubcategoryManager(false)}
          onUpdate={loadSubcategories}
        />
      )}
    </div>
  )
}
