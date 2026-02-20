import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Modal } from '../common/Modal'
import { CredentialCard } from './CredentialCard'
import { CredentialForm } from './CredentialForm'
import { CredentialDetail } from './CredentialDetail'
import { ReferenceCard } from './ReferenceCard'
import { ReferenceForm } from './ReferenceForm'
import { ReferenceDetail } from './ReferenceDetail'
import { CategoryManager } from './CategoryManager'
import type {
  Credential,
  SecureReference,
  ResourceCategory,
  CreateCredentialData,
  CreateReferenceData,
  SecureResourceStats
} from '../../types'

type TabMode = 'credentials' | 'references'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'color'

const DEFAULT_CREDENTIAL_CATEGORIES = ['Software', 'Desktop', 'Server', 'Network', 'Other']
const DEFAULT_REFERENCE_CATEGORIES = ['General', 'Policy', 'Procedure', 'Template', 'Guide', 'Other']

// Color sort order (references with no color go last)
const COLOR_ORDER: Record<string, number> = {
  red: 1,
  orange: 2,
  yellow: 3,
  green: 4,
  blue: 5,
  purple: 6
}

export function SecureResources() {
  const { user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  // Data state
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [references, setReferences] = useState<SecureReference[]>([])
  const [stats, setStats] = useState<SecureResourceStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Categories state
  const [credentialCategories, setCredentialCategories] = useState<string[]>(DEFAULT_CREDENTIAL_CATEGORIES)
  const [referenceCategories, setReferenceCategories] = useState<string[]>(DEFAULT_REFERENCE_CATEGORIES)

  // UI state
  const [tabMode, setTabMode] = useState<TabMode>('credentials')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null)
  const [selectedReference, setSelectedReference] = useState<SecureReference | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')

  // Computed filter state (defined early for use in effects)
  const hasActiveFilters = filterCategory || searchQuery.trim()

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const credCats = await window.electronAPI.categories.getByType('credential')
      if (credCats && Array.isArray(credCats) && credCats.length > 0) {
        setCredentialCategories((credCats as ResourceCategory[]).map(c => c.name))
      }
      const refCats = await window.electronAPI.categories.getByType('reference')
      if (refCats && Array.isArray(refCats) && refCats.length > 0) {
        setReferenceCategories((refCats as ResourceCategory[]).map(c => c.name))
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const loadCredentials = useCallback(async () => {
    try {
      const filters: { query?: string; category?: string; isAdmin?: boolean } = { isAdmin }
      if (searchQuery.trim()) filters.query = searchQuery.trim()
      if (filterCategory) filters.category = filterCategory
      const result = await window.electronAPI.credentials.getAll(filters)
      setCredentials(result as Credential[])
    } catch (err) {
      console.error('Error loading credentials:', err)
    }
  }, [searchQuery, filterCategory, isAdmin])

  const loadReferences = useCallback(async () => {
    try {
      const filters: { query?: string; category?: string; isAdmin?: boolean } = { isAdmin }
      if (searchQuery.trim()) filters.query = searchQuery.trim()
      if (filterCategory) filters.category = filterCategory
      const result = await window.electronAPI.secureReferences.getAll(filters)
      setReferences(result as SecureReference[])
    } catch (err) {
      console.error('Error loading references:', err)
    }
  }, [searchQuery, filterCategory, isAdmin])

  const loadStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.secureReferences.getStats(isAdmin)
      setStats(result as SecureResourceStats)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }, [isAdmin])

  const loadData = useCallback(async () => {
    setLoading(true)
    if (tabMode === 'credentials') {
      await loadCredentials()
    } else {
      await loadReferences()
    }
    setLoading(false)
  }, [tabMode, loadCredentials, loadReferences])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadData()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  // Reset category filter when switching tabs
  useEffect(() => {
    setFilterCategory('')
    setSearchQuery('')
  }, [tabMode])

  // Handle search highlight from global search
  useEffect(() => {
    const state = location.state as any
    if ((state?.highlightType === 'credential' || state?.highlightType === 'secure_reference') && state?.highlightId && !loading) {
      const itemId = state.highlightId
      const itemType = state.highlightType

      const handleResourceHighlight = async () => {
        // Verify the item exists
        let item = null
        if (itemType === 'credential') {
          item = await window.electronAPI.credentials.getById(itemId)
        } else {
          item = await window.electronAPI.secureReferences.getById(itemId)
        }

        if (!item) {
          window.history.replaceState({}, document.title)
          return
        }

        // Determine if we need to switch tabs
        const needsTabSwitch = (itemType === 'credential' && tabMode !== 'credentials') ||
                               (itemType === 'secure_reference' && tabMode !== 'references')

        // Clear filters to ensure visibility
        if (hasActiveFilters) {
          setSearchQuery('')
          setFilterCategory('')
        }

        // Switch to the correct tab if needed
        if (needsTabSwitch) {
          if (itemType === 'credential') {
            setTabMode('credentials')
          } else {
            setTabMode('references')
          }
        }

        // Wait for tab switch/filter clear and data reload
        setTimeout(() => {
          setHighlightedId(itemId)

          // Scroll to the item
          setTimeout(() => {
            const element = document.getElementById(`resource-${itemId}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 100)

          // Clear highlight after 5 seconds
          setTimeout(() => setHighlightedId(null), 5000)
        }, needsTabSwitch || hasActiveFilters ? 500 : 100)

        // Clear the location state
        window.history.replaceState({}, document.title)
      }

      handleResourceHighlight()
    }
  }, [location.state, loading, tabMode, hasActiveFilters])

  const handleCreateCredential = async (data: CreateCredentialData) => {
    if (!user) return
    try {
      const result = await window.electronAPI.credentials.create(data, user.id)
      if (result.success) {
        setShowCreateModal(false)
        loadCredentials()
        loadStats()
      } else {
        toast.error('Error', result.error || 'Failed to create credential')
      }
    } catch (err) {
      console.error('Error creating credential:', err)
    }
  }

  const handleCreateReference = async (data: CreateReferenceData) => {
    if (!user) return
    try {
      const result = await window.electronAPI.secureReferences.create(data, user.id)
      if (result.success) {
        setShowCreateModal(false)
        loadReferences()
        loadStats()
      } else {
        toast.error('Error', result.error || 'Failed to create reference')
      }
    } catch (err) {
      console.error('Error creating reference:', err)
    }
  }

  const handleDataUpdated = () => {
    loadData()
    loadStats()
    // Refresh selected items
    if (selectedCredential) {
      window.electronAPI.credentials.getById(selectedCredential.id).then((result) => {
        if (result) setSelectedCredential(result as Credential)
        else setSelectedCredential(null)
      })
    }
    if (selectedReference) {
      window.electronAPI.secureReferences.getById(selectedReference.id).then((result) => {
        if (result) setSelectedReference(result as SecureReference)
        else setSelectedReference(null)
      })
    }
  }

  const handleCategoriesUpdated = () => {
    loadCategories()
    loadData()
    loadStats()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterCategory('')
  }

  const categories = tabMode === 'credentials' ? credentialCategories : referenceCategories

  // Sort references
  const sortedReferences = [...references].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'date-asc':
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      case 'name-asc':
        return a.name.localeCompare(b.name)
      case 'name-desc':
        return b.name.localeCompare(a.name)
      case 'color':
        const colorA = a.color ? COLOR_ORDER[a.color] || 99 : 99
        const colorB = b.color ? COLOR_ORDER[b.color] || 99 : 99
        if (colorA !== colorB) return colorA - colorB
        return a.name.localeCompare(b.name) // Secondary sort by name
      default:
        return 0
    }
  })

  // Sort credentials
  const sortedCredentials = [...credentials].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'date-asc':
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      case 'name-asc':
        return a.name.localeCompare(b.name)
      case 'name-desc':
        return b.name.localeCompare(a.name)
      case 'color':
        // Credentials don't have colors, so sort by name
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {/* Title row */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Secure Resources</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage credentials and reference documents securely</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Category Manager Button (Admin only) */}
              {isAdmin && (
                <button
                  onClick={() => setShowCategoryManager(true)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Manage Categories"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {tabMode === 'credentials' ? 'New Credential' : 'New Reference'}
              </button>
            </div>
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Credentials</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalCredentials}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">References</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalReferences}</p>
              </div>
              {tabMode === 'credentials' ? (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-medium">Software</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.credentialsByCategory.Software || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs text-green-500 dark:text-green-400 uppercase font-medium">Server</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{stats.credentialsByCategory.Server || 0}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs text-red-500 dark:text-red-400 uppercase font-medium">Policies</p>
                    <p className="text-xl font-bold text-red-700 dark:text-red-400">{stats.referencesByCategory.Policy || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-medium">Procedures</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.referencesByCategory.Procedure || 0}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 -mb-4">
            <button
              onClick={() => setTabMode('credentials')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'credentials'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Credentials
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{stats.totalCredentials}</span>}
            </button>
            <button
              onClick={() => setTabMode('references')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'references'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              References
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{stats.totalReferences}</span>}
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
              placeholder={tabMode === 'credentials' ? 'Search credentials...' : 'Search references...'}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            {tabMode === 'references' && <option value="color">By Color</option>}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
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
        ) : tabMode === 'credentials' ? (
          credentials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                {hasActiveFilters ? 'No credentials match your filters' : 'No credentials yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters to find what you\'re looking for'
                  : 'Store system usernames and passwords securely'}
              </p>
              {!hasActiveFilters && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Credential
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCredentials.map((credential) => (
                <div key={credential.id} id={`resource-${credential.id}`}>
                  <CredentialCard
                    credential={credential}
                    onClick={() => setSelectedCredential(credential)}
                    highlighted={highlightedId === credential.id}
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          references.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                {hasActiveFilters ? 'No references match your filters' : 'No references yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters to find what you\'re looking for'
                  : 'Create named collections for policies, procedures, and other documents'}
              </p>
              {!hasActiveFilters && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Reference
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedReferences.map((reference) => (
                <div key={reference.id} id={`resource-${reference.id}`}>
                  <ReferenceCard
                    reference={reference}
                    onClick={() => setSelectedReference(reference)}
                    highlighted={highlightedId === reference.id}
                  />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Credential Modal */}
      {showCreateModal && tabMode === 'credentials' && (
        <Modal
          title="New Credential"
          onClose={() => setShowCreateModal(false)}
          isOpen={showCreateModal}
          size="lg"
        >
          <CredentialForm
            onSubmit={(data) => handleCreateCredential(data as CreateCredentialData)}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Create Reference Modal */}
      {showCreateModal && tabMode === 'references' && (
        <Modal
          title="New Reference"
          onClose={() => setShowCreateModal(false)}
          isOpen={showCreateModal}
          size="lg"
        >
          <ReferenceForm
            onSubmit={(data) => handleCreateReference(data as CreateReferenceData)}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <Modal
          title={`Manage ${tabMode === 'credentials' ? 'Credential' : 'Reference'} Categories`}
          onClose={() => setShowCategoryManager(false)}
          isOpen={showCategoryManager}
          size="md"
        >
          <CategoryManager
            type={tabMode === 'credentials' ? 'credential' : 'reference'}
            onClose={() => setShowCategoryManager(false)}
            onCategoriesUpdated={handleCategoriesUpdated}
          />
        </Modal>
      )}

      {/* Credential Detail Modal */}
      {selectedCredential && (
        <Modal
          title="Credential Details"
          onClose={() => setSelectedCredential(null)}
          isOpen={!!selectedCredential}
          size="lg"
        >
          <CredentialDetail
            credential={selectedCredential}
            onClose={() => setSelectedCredential(null)}
            onUpdated={handleDataUpdated}
          />
        </Modal>
      )}

      {/* Reference Detail Modal */}
      {selectedReference && (
        <Modal
          title="Reference Details"
          onClose={() => setSelectedReference(null)}
          isOpen={!!selectedReference}
          size="lg"
        >
          <ReferenceDetail
            reference={selectedReference}
            onClose={() => setSelectedReference(null)}
            onUpdated={handleDataUpdated}
          />
        </Modal>
      )}
    </div>
  )
}
