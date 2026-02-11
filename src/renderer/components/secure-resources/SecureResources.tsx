import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Modal } from '../common/Modal'
import { CredentialCard } from './CredentialCard'
import { CredentialForm } from './CredentialForm'
import { CredentialDetail } from './CredentialDetail'
import { ReferenceCard } from './ReferenceCard'
import { ReferenceForm } from './ReferenceForm'
import { ReferenceDetail } from './ReferenceDetail'
import type {
  Credential,
  SecureReference,
  CredentialCategory,
  ReferenceCategory,
  CreateCredentialData,
  CreateReferenceData,
  SecureResourceStats
} from '../../types'

type TabMode = 'credentials' | 'references'

const CREDENTIAL_CATEGORIES: CredentialCategory[] = ['Software', 'Desktop', 'Server', 'Network', 'Other']
const REFERENCE_CATEGORIES: ReferenceCategory[] = ['General', 'Policy', 'Procedure', 'Template', 'Guide', 'Other']

export function SecureResources() {
  const { user } = useAuth()
  const toast = useToast()

  // Data state
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [references, setReferences] = useState<SecureReference[]>([])
  const [stats, setStats] = useState<SecureResourceStats | null>(null)
  const [loading, setLoading] = useState(true)

  // UI state
  const [tabMode, setTabMode] = useState<TabMode>('credentials')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null)
  const [selectedReference, setSelectedReference] = useState<SecureReference | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const loadCredentials = useCallback(async () => {
    try {
      const filters: { query?: string; category?: string } = {}
      if (searchQuery.trim()) filters.query = searchQuery.trim()
      if (filterCategory) filters.category = filterCategory
      const result = await window.electronAPI.credentials.getAll(filters)
      setCredentials(result as Credential[])
    } catch (err) {
      console.error('Error loading credentials:', err)
    }
  }, [searchQuery, filterCategory])

  const loadReferences = useCallback(async () => {
    try {
      const filters: { query?: string; category?: string } = {}
      if (searchQuery.trim()) filters.query = searchQuery.trim()
      if (filterCategory) filters.category = filterCategory
      const result = await window.electronAPI.secureReferences.getAll(filters)
      setReferences(result as SecureReference[])
    } catch (err) {
      console.error('Error loading references:', err)
    }
  }, [searchQuery, filterCategory])

  const loadStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.secureReferences.getStats()
      setStats(result as SecureResourceStats)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }, [])

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

  const hasActiveFilters = filterCategory || searchQuery.trim()
  const clearFilters = () => {
    setSearchQuery('')
    setFilterCategory('')
  }

  const categories = tabMode === 'credentials' ? CREDENTIAL_CATEGORIES : REFERENCE_CATEGORIES

  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light border-b border-gray-200">
        {/* Title row */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Secure Resources</h1>
              <p className="text-sm text-gray-500 mt-1">Manage credentials and reference documents securely</p>
            </div>
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

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase font-medium">Credentials</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalCredentials}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase font-medium">References</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalReferences}</p>
              </div>
              {tabMode === 'credentials' ? (
                <>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-blue-500 uppercase font-medium">Software</p>
                    <p className="text-xl font-bold text-blue-700">{stats.credentialsByCategory.Software || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-green-500 uppercase font-medium">Server</p>
                    <p className="text-xl font-bold text-green-700">{stats.credentialsByCategory.Server || 0}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-red-500 uppercase font-medium">Policies</p>
                    <p className="text-xl font-bold text-red-700">{stats.referencesByCategory.Policy || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-blue-500 uppercase font-medium">Procedures</p>
                    <p className="text-xl font-bold text-blue-700">{stats.referencesByCategory.Procedure || 0}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 -mb-4">
            <button
              onClick={() => setTabMode('credentials')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'credentials'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Credentials
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{stats.totalCredentials}</span>}
            </button>
            <button
              onClick={() => setTabMode('references')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabMode === 'references'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              References
              {stats && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{stats.totalReferences}</span>}
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
              placeholder={tabMode === 'credentials' ? 'Search credentials...' : 'Search references...'}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
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
        ) : tabMode === 'credentials' ? (
          credentials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {hasActiveFilters ? 'No credentials match your filters' : 'No credentials yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
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
              {credentials.map((credential) => (
                <CredentialCard
                  key={credential.id}
                  credential={credential}
                  onClick={() => setSelectedCredential(credential)}
                />
              ))}
            </div>
          )
        ) : (
          references.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {hasActiveFilters ? 'No references match your filters' : 'No references yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
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
              {references.map((reference) => (
                <ReferenceCard
                  key={reference.id}
                  reference={reference}
                  onClick={() => setSelectedReference(reference)}
                />
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
