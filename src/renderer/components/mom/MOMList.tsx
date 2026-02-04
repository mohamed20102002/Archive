import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../common/Modal'
import { MOMCard } from './MOMCard'
import { MOMForm } from './MOMForm'
import { MOMDetail } from './MOMDetail'
import type { Mom, MomLocation, MomStats, MomFilters, Topic, CreateMomData } from '../../types'

type TabMode = 'open' | 'closed'
type ViewMode = 'card' | 'table'

export function MOMList() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedMomId, setHighlightedMomId] = useState<string | null>(null)

  // Data state
  const [moms, setMoms] = useState<Mom[]>([])
  const [stats, setStats] = useState<MomStats | null>(null)
  const [locations, setLocations] = useState<MomLocation[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [tabMode, setTabMode] = useState<TabMode>('open')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedMom, setSelectedMom] = useState<Mom | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const buildFilters = useCallback((): MomFilters => {
    const filters: MomFilters = { status: tabMode }
    if (searchQuery.trim()) filters.query = searchQuery.trim()
    if (filterLocation) filters.location_id = filterLocation
    if (filterTopic) filters.topic_id = filterTopic
    if (filterDateFrom) filters.date_from = filterDateFrom
    if (filterDateTo) filters.date_to = filterDateTo
    return filters
  }, [tabMode, searchQuery, filterLocation, filterTopic, filterDateFrom, filterDateTo])

  const loadMoms = useCallback(async () => {
    try {
      const filters = buildFilters()
      const result = await window.electronAPI.moms.getAll(filters)
      setMoms(result as Mom[])
    } catch (err) {
      console.error('Error loading MOMs:', err)
    } finally {
      setLoading(false)
    }
  }, [buildFilters])

  const loadStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.moms.getStats()
      setStats(result as MomStats)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }, [])

  const loadFilters = useCallback(async () => {
    try {
      const [locs, allTopics] = await Promise.all([
        window.electronAPI.momLocations.getAll(),
        window.electronAPI.topics.getAll()
      ])
      setLocations(locs as MomLocation[])
      setTopics((allTopics as Topic[]).filter(t => !t.deleted_at))
    } catch (err) {
      console.error('Error loading filter data:', err)
    }
  }, [])

  useEffect(() => {
    loadFilters()
    loadStats()
  }, [loadFilters, loadStats])

  useEffect(() => {
    setLoading(true)
    loadMoms()
  }, [loadMoms])

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadMoms()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  // Handle ?momId= param for cross-link navigation
  useEffect(() => {
    const momId = searchParams.get('momId')
    if (!momId || loading || moms.length === 0) return

    setHighlightedMomId(momId)
    setSearchParams({}, { replace: true })

    // Scroll to highlighted card
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-mom-id="${momId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    const timer = setTimeout(() => setHighlightedMomId(null), 4000)
    return () => clearTimeout(timer)
  }, [loading, moms, searchParams])

  const handleCreateMom = async (data: CreateMomData) => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.create(data, user.id)
      if (result.success) {
        const newMom = result.mom as Mom
        setShowCreateModal(false)
        loadMoms()
        loadStats()

        // Auto-open file upload dialog after creation
        if (newMom) {
          setSelectedMom(newMom)
        }
      } else {
        alert(result.error || 'Failed to create MOM')
      }
    } catch (err) {
      console.error('Error creating MOM:', err)
    }
  }

  const handleMomUpdated = () => {
    loadMoms()
    loadStats()
    // Refresh selected mom
    if (selectedMom) {
      window.electronAPI.moms.getById(selectedMom.id).then((result) => {
        if (result) setSelectedMom(result as Mom)
      })
    }
  }

  const hasActiveFilters = filterLocation || filterTopic || filterDateFrom || filterDateTo || searchQuery.trim()

  const clearFilters = () => {
    setSearchQuery('')
    setFilterLocation('')
    setFilterTopic('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light border-b border-gray-200">
        {/* Title row */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Minutes of Meeting</h1>
              <p className="text-sm text-gray-500 mt-1">Manage meeting minutes, actions, and follow-ups</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New MOM
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-green-500 uppercase font-medium">Open</p>
                <p className="text-xl font-bold text-green-700">{stats.open}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase font-medium">Closed</p>
                <p className="text-xl font-bold text-gray-700">{stats.closed}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-red-500 uppercase font-medium">Overdue Actions</p>
                <p className={`text-xl font-bold ${stats.overdueActions > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {stats.overdueActions}
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
              Open
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{stats.open}</span>}
            </button>
            <button
              onClick={() => setTabMode('closed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'closed'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Closed
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{stats.closed}</span>}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-white border-t border-gray-100 flex flex-wrap items-center gap-3">
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

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search MOMs..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Location filter */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Locations</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

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

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="From"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="To"
            />
          </div>

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
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : moms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {hasActiveFilters
                ? 'No MOMs match your filters'
                : tabMode === 'open'
                  ? 'No open MOMs'
                  : 'No closed MOMs'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : tabMode === 'open'
                  ? 'Create a new MOM to start tracking meetings'
                  : 'Closed MOMs will appear here'}
            </p>
            {!hasActiveFilters && tabMode === 'open' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create First MOM
              </button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {moms.map((mom) => (
              <MOMCard
                key={mom.id}
                mom={mom}
                onClick={() => setSelectedMom(mom)}
                highlighted={highlightedMomId === mom.id}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MOM ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meeting Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {moms.map((mom) => {
                  const actionTotal = mom.action_total || 0
                  const actionResolved = mom.action_resolved || 0
                  const actionOverdue = mom.action_overdue || 0
                  const isOpen = mom.status === 'open'
                  return (
                    <tr
                      key={mom.id}
                      data-mom-id={mom.id}
                      onClick={() => setSelectedMom(mom)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors duration-700 ${highlightedMomId === mom.id ? 'bg-primary-50 ring-2 ring-primary-300 ring-inset' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-600">
                          {mom.mom_id || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900 line-clamp-1">{mom.title}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {mom.meeting_date ? new Date(mom.meeting_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {mom.location_name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {mom.topic_count || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-600">{actionResolved}/{actionTotal}</span>
                          {actionOverdue > 0 && (
                            <span className="text-red-600 font-medium">({actionOverdue} overdue)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {mom.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          title="New MOM"
          onClose={() => setShowCreateModal(false)}
          isOpen={showCreateModal}
          size="lg"
        >
          <MOMForm
            onSubmit={(data) => handleCreateMom(data as CreateMomData)}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedMom && (
        <Modal
          title="MOM Details"
          onClose={() => setSelectedMom(null)}
          isOpen={!!selectedMom}
          size="lg"
        >
          <MOMDetail
            mom={selectedMom}
            onClose={() => setSelectedMom(null)}
            onUpdated={handleMomUpdated}
          />
        </Modal>
      )}
    </div>
  )
}
