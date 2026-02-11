import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { Letter, LetterType, LetterStatus, LetterPriority, Topic, Authority, LetterReference, ReferenceType } from '../../types'
import { LetterCard } from './LetterCard'
import { LetterForm } from './LetterForm'
import { LetterDetail } from './LetterDetail'
import { AuthorityManager } from './AuthorityManager'
import { ContactManager } from './ContactManager'
import { Modal } from '../common/Modal'

interface PendingReference {
  targetLetter: Letter
  referenceType: ReferenceType
  notes: string
}

type ViewMode = 'card' | 'table'
type TabMode = 'all' | 'pending' | 'overdue' | 'authorities' | 'contacts'

export function LetterList() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedLetterId, setHighlightedLetterId] = useState<string | null>(null)
  const [letters, setLetters] = useState<Letter[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [tabMode, setTabMode] = useState<TabMode>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null)
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null)
  const [editingReferences, setEditingReferences] = useState<LetterReference[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<LetterType | ''>('')
  const [filterStatus, setFilterStatus] = useState<LetterStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<LetterPriority | ''>('')
  const [filterAuthority, setFilterAuthority] = useState<string>('')
  const [filterTopic, setFilterTopic] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [lettersResult, topicsResult, authoritiesResult] = await Promise.all([
        tabMode === 'pending'
          ? window.electronAPI.letters.getPending()
          : tabMode === 'overdue'
          ? window.electronAPI.letters.getOverdue()
          : window.electronAPI.letters.getAll(),
        window.electronAPI.topics.getAll(),
        window.electronAPI.authorities.getAll()
      ])
      // Ensure results are always arrays
      setLetters(Array.isArray(lettersResult) ? lettersResult as Letter[] : [])
      setTopics(Array.isArray(topicsResult) ? topicsResult as Topic[] : [])
      setAuthorities(Array.isArray(authoritiesResult) ? authoritiesResult as Authority[] : [])
    } catch (error) {
      console.error('Error loading letters:', error)
      setLetters([])
      setTopics([])
      setAuthorities([])
    } finally {
      setLoading(false)
    }
  }, [tabMode])

  useEffect(() => {
    if (tabMode !== 'authorities') {
      loadData()
    }
  }, [loadData, tabMode])

  const handleSearch = async () => {
    if (!searchQuery && !filterType && !filterStatus && !filterPriority && !filterAuthority && !filterTopic) {
      loadData()
      return
    }

    setLoading(true)
    try {
      const results = await window.electronAPI.letters.search({
        query: searchQuery || undefined,
        letter_type: filterType || undefined,
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        authority_id: filterAuthority || undefined,
        topic_id: filterTopic || undefined
      })
      // Search returns { letters, total } - extract letters array
      if (results && typeof results === 'object' && 'letters' in results) {
        setLetters(Array.isArray(results.letters) ? results.letters as Letter[] : [])
      } else {
        // Fallback for direct array result
        setLetters(Array.isArray(results) ? results as Letter[] : [])
      }
    } catch (error) {
      console.error('Error searching letters:', error)
      setLetters([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (tabMode === 'all') {
        handleSearch()
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, filterType, filterStatus, filterPriority, filterAuthority, filterTopic])

  // Handle ?letterId= param for cross-link navigation
  useEffect(() => {
    const letterId = searchParams.get('letterId')
    if (!letterId || loading || letters.length === 0) return

    setHighlightedLetterId(letterId)
    setSearchParams({}, { replace: true })

    // Scroll to highlighted card
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-letter-id="${letterId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    const timer = setTimeout(() => setHighlightedLetterId(null), 4000)
    return () => clearTimeout(timer)
  }, [loading, letters, searchParams])

  const handleCreateLetter = async (data: any, references: PendingReference[]) => {
    if (!user) return

    try {
      // Extract files data before creating letter
      const filesData = data.files as { filename: string; buffer: string; size: number }[] | undefined
      delete data.files

      const result = await window.electronAPI.letters.create(data, user.id)
      if (result.success && result.letter) {
        // Upload multiple files if attached
        if (filesData && filesData.length > 0) {
          for (const file of filesData) {
            await window.electronAPI.letterAttachments.add(result.letter.id, file.buffer, file.filename, user.id)
          }
        }

        // Create references if any
        if (references.length > 0) {
          for (const ref of references) {
            await window.electronAPI.letterReferences.create({
              source_letter_id: result.letter.id,
              target_letter_id: ref.targetLetter.id,
              reference_type: ref.referenceType,
              notes: ref.notes || undefined
            }, user.id)
          }
        }
        setShowCreateModal(false)
        loadData()
      } else {
        toast.error('Error', result.error || 'Failed to create letter')
      }
    } catch (error) {
      console.error('Error creating letter:', error)
      toast.error('Error', 'Failed to create letter')
    }
  }

  const handleUpdateLetter = async (id: string, data: any, references: PendingReference[]) => {
    if (!user) return

    try {
      // Extract files data before updating letter
      const filesData = data.files as { filename: string; buffer: string; size: number }[] | undefined
      delete data.files

      const result = await window.electronAPI.letters.update(id, data, user.id)
      if (result.success) {
        // Upload new files if attached
        if (filesData && filesData.length > 0) {
          for (const file of filesData) {
            await window.electronAPI.letterAttachments.add(id, file.buffer, file.filename, user.id)
          }
        }

        // Create new references if any
        if (references.length > 0) {
          for (const ref of references) {
            await window.electronAPI.letterReferences.create({
              source_letter_id: id,
              target_letter_id: ref.targetLetter.id,
              reference_type: ref.referenceType,
              notes: ref.notes || undefined
            }, user.id)
          }
        }
        setEditingLetter(null)
        setEditingReferences([])
        loadData()
        if (selectedLetter?.id === id) {
          const updated = await window.electronAPI.letters.getById(id)
          setSelectedLetter(updated as Letter)
        }
      } else {
        toast.error('Error', result.error || 'Failed to update letter')
      }
    } catch (error) {
      console.error('Error updating letter:', error)
      toast.error('Error', 'Failed to update letter')
    }
  }

  // Load references when editing a letter
  const handleEditLetter = async (letter: Letter) => {
    setEditingLetter(letter)
    try {
      const refs = await window.electronAPI.letterReferences.getAll(letter.id)
      const refsData = refs as { from: LetterReference[], to: LetterReference[] }
      setEditingReferences(Array.isArray(refsData?.from) ? refsData.from : [])
    } catch (error) {
      console.error('Error loading references:', error)
      setEditingReferences([])
    }
  }

  const handleDeleteLetter = async (id: string) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Letter',
      message: 'Are you sure you want to delete this letter?',
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.letters.delete(id, user.id)
      if (result.success) {
        setSelectedLetter(null)
        loadData()
      } else {
        toast.error('Error', result.error || 'Failed to delete letter')
      }
    } catch (error) {
      console.error('Error deleting letter:', error)
      toast.error('Error', 'Failed to delete letter')
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterType('')
    setFilterStatus('')
    setFilterPriority('')
    setFilterAuthority('')
    setFilterTopic('')
  }

  const getStatusColor = (status: LetterStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'replied': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      case 'archived': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: LetterPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-gray-100 text-gray-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: LetterType) => {
    switch (type) {
      case 'incoming':
        return (
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'outgoing':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )
      case 'internal':
        return (
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        )
    }
  }

  if (tabMode === 'authorities') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="sticky top-0 z-10 bg-archive-light border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Letters</h2>
                <p className="text-gray-500 mt-1">Manage official correspondence and authorities</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              {(['all', 'pending', 'overdue', 'authorities', 'contacts'] as TabMode[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabMode(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tabMode === tab
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'all' ? 'All Letters' :
                   tab === 'pending' ? 'Pending' :
                   tab === 'overdue' ? 'Overdue' :
                   tab === 'authorities' ? 'Authorities' : 'Contacts'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <AuthorityManager />
      </div>
    )
  }

  if (tabMode === 'contacts') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="sticky top-0 z-10 bg-archive-light border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Letters</h2>
                <p className="text-gray-500 mt-1">Manage official correspondence and contacts</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              {(['all', 'pending', 'overdue', 'authorities', 'contacts'] as TabMode[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabMode(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tabMode === tab
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'all' ? 'All Letters' :
                   tab === 'pending' ? 'Pending' :
                   tab === 'overdue' ? 'Overdue' :
                   tab === 'authorities' ? 'Authorities' : 'Contacts'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ContactManager />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Letters</h2>
              <p className="text-gray-500 mt-1">
                {tabMode === 'pending' ? 'Letters awaiting response' :
                 tabMode === 'overdue' ? 'Overdue letters' :
                 `${letters.length} letter${letters.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded ${viewMode === 'card' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Card view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded ${viewMode === 'table' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Table view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Letter
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {(['all', 'pending', 'overdue', 'authorities', 'contacts'] as TabMode[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabMode(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tabMode === tab
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab === 'all' ? 'All Letters' :
                 tab === 'pending' ? 'Pending' :
                 tab === 'overdue' ? 'Overdue' :
                 tab === 'authorities' ? 'Authorities' : 'Contacts'}
              </button>
            ))}
          </div>

          {/* Filters (only for 'all' tab) */}
          {tabMode === 'all' && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search letters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as LetterType | '')}
                  className="input w-40"
                >
                  <option value="">All Types</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                  <option value="internal">Internal</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as LetterStatus | '')}
                  className="input w-40"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="replied">Replied</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex gap-3">
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as LetterPriority | '')}
                  className="input w-40"
                >
                  <option value="">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={filterAuthority}
                  onChange={(e) => setFilterAuthority(e.target.value)}
                  className="input min-w-64 max-w-md"
                >
                  <option value="">All Authorities</option>
                  {authorities.map((auth) => (
                    <option key={auth.id} value={auth.id}>{auth.name}</option>
                  ))}
                </select>
                <select
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  className="input w-48"
                >
                  <option value="">All Topics</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.title}</option>
                  ))}
                </select>
                {(searchQuery || filterType || filterStatus || filterPriority || filterAuthority || filterTopic) && (
                  <button onClick={clearFilters} className="btn-secondary text-sm">
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : letters.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No letters found</h3>
            <p className="text-gray-500 mb-4">
              {tabMode === 'pending' ? 'No pending letters' :
               tabMode === 'overdue' ? 'No overdue letters' :
               'Get started by creating your first letter'}
            </p>
            {tabMode === 'all' && (
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                Create Letter
              </button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {letters.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                onClick={() => setSelectedLetter(letter)}
                highlighted={highlightedLetterId === letter.id}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Authority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {letters.map((letter) => (
                  <tr
                    key={letter.id}
                    data-letter-id={letter.id}
                    onClick={() => setSelectedLetter(letter)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors duration-700 ${highlightedLetterId === letter.id ? 'bg-primary-50 ring-2 ring-primary-300 ring-inset' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(letter.letter_type)}
                        <span className="text-sm capitalize">{letter.letter_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-600">
                        {letter.reference_number || letter.incoming_number || letter.outgoing_number || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900 line-clamp-1">{letter.subject}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {letter.authority_short_name || letter.authority_name || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{letter.topic_title || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(letter.status)}`}>
                        {letter.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(letter.priority)}`}>
                        {letter.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {letter.letter_date ? new Date(letter.letter_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {letter.due_date ? new Date(letter.due_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Letter"
        size="lg"
      >
        <LetterForm
          topics={topics}
          authorities={authorities}
          onSubmit={handleCreateLetter}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingLetter}
        onClose={() => {
          setEditingLetter(null)
          setEditingReferences([])
        }}
        title="Edit Letter"
        size="lg"
      >
        {editingLetter && (
          <LetterForm
            letter={editingLetter}
            topics={topics}
            authorities={authorities}
            existingReferences={editingReferences}
            onSubmit={(data, references) => handleUpdateLetter(editingLetter.id, data, references)}
            onCancel={() => {
              setEditingLetter(null)
              setEditingReferences([])
            }}
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedLetter}
        onClose={() => setSelectedLetter(null)}
        title="Letter Details"
        size="xl"
      >
        {selectedLetter && (
          <LetterDetail
            letter={selectedLetter}
            onEdit={() => {
              handleEditLetter(selectedLetter)
              setSelectedLetter(null)
            }}
            onDelete={() => handleDeleteLetter(selectedLetter.id)}
            onClose={() => setSelectedLetter(null)}
            onRefresh={async () => {
              const updated = await window.electronAPI.letters.getById(selectedLetter.id)
              setSelectedLetter(updated as Letter)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
