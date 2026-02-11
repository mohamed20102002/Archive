import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { Authority, AuthorityType } from '../../types'
import { Modal } from '../common/Modal'

type ViewMode = 'card' | 'table'

export function AuthorityManager() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<AuthorityType | ''>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAuthority, setEditingAuthority] = useState<Authority | null>(null)

  const loadAuthorities = useCallback(async () => {
    setLoading(true)
    try {
      let result
      if (searchQuery) {
        result = await window.electronAPI.authorities.search(searchQuery)
      } else if (filterType) {
        result = await window.electronAPI.authorities.getByType(filterType)
      } else {
        result = await window.electronAPI.authorities.getAll()
      }
      setAuthorities(result as Authority[])
    } catch (error) {
      console.error('Error loading authorities:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filterType])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadAuthorities()
    }, 300)
    return () => clearTimeout(debounce)
  }, [loadAuthorities])

  const handleCreate = async (data: any) => {
    if (!user) return

    try {
      const result = await window.electronAPI.authorities.create(data, user.id)
      if (result.success) {
        setShowCreateModal(false)
        loadAuthorities()
      } else {
        toast.error('Error', result.error || 'Failed to create authority')
      }
    } catch (error) {
      console.error('Error creating authority:', error)
    }
  }

  const handleUpdate = async (id: string, data: any) => {
    if (!user) return

    console.log('[AuthorityManager] handleUpdate called with:', { id, data })

    try {
      const result = await window.electronAPI.authorities.update(id, data, user.id)
      console.log('[AuthorityManager] update result:', result)
      if (result.success) {
        setEditingAuthority(null)
        loadAuthorities()
      } else {
        toast.error('Error', result.error || 'Failed to update authority')
      }
    } catch (error) {
      console.error('Error updating authority:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Authority',
      message: 'Are you sure you want to delete this authority?',
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.authorities.delete(id, user.id)
      if (result.success) {
        loadAuthorities()
      } else {
        toast.error('Error', result.error || 'Failed to delete authority')
      }
    } catch (error) {
      console.error('Error deleting authority:', error)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search authorities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as AuthorityType | '')}
          className="input w-48"
        >
          <option value="">All Types</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
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
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          Add Authority
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : authorities.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No authorities found</h3>
          <p className="text-gray-500 mb-4">Add organizations you communicate with</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Add Authority
          </button>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {authorities.map((auth) => (
            <div key={auth.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{auth.name}</h3>
                  {auth.short_name && (
                    <p className="text-sm text-gray-500">{auth.short_name}</p>
                  )}
                </div>
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${auth.is_internal ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                  {auth.is_internal ? 'Internal' : 'External'}
                </span>
              </div>

              {auth.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="line-clamp-2">{auth.address}</span>
                </div>
              )}

              {auth.contact_email && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">{auth.contact_email}</span>
                </div>
              )}

              {auth.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{auth.contact_phone}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  {auth.letter_count || 0} letter{auth.letter_count !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingAuthority(auth)}
                    className="text-gray-400 hover:text-primary-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(auth.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Short Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Letters</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {authorities.map((auth) => (
                <tr key={auth.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{auth.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{auth.short_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${auth.is_internal ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      {auth.is_internal ? 'Internal' : 'External'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{auth.contact_email || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{auth.contact_phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{auth.letter_count || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingAuthority(auth)}
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(auth.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Authority"
      >
        <AuthorityForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingAuthority}
        onClose={() => setEditingAuthority(null)}
        title="Edit Authority"
      >
        {editingAuthority && (
          <AuthorityForm
            authority={editingAuthority}
            onSubmit={(data) => handleUpdate(editingAuthority.id, data)}
            onCancel={() => setEditingAuthority(null)}
          />
        )}
      </Modal>
    </div>
  )
}

// Authority Form Component
interface AuthorityFormProps {
  authority?: Authority
  onSubmit: (data: any) => void
  onCancel: () => void
}

function AuthorityForm({ authority, onSubmit, onCancel }: AuthorityFormProps) {
  const [name, setName] = useState(authority?.name || '')
  const [shortName, setShortName] = useState(authority?.short_name || '')
  const [isInternal, setIsInternal] = useState(authority?.is_internal ?? false)
  const [address, setAddress] = useState(authority?.address || '')
  const [email, setEmail] = useState(authority?.contact_email || '')
  const [phone, setPhone] = useState(authority?.contact_phone || '')
  const [notes, setNotes] = useState(authority?.notes || '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync state when authority prop changes (for editing)
  useEffect(() => {
    console.log('[AuthorityForm] authority prop:', authority)
    console.log('[AuthorityForm] authority.is_internal:', authority?.is_internal, 'type:', typeof authority?.is_internal)
    if (authority) {
      setName(authority.name || '')
      setShortName(authority.short_name || '')
      setIsInternal(authority.is_internal ?? false)
      setAddress(authority.address || '')
      setEmail(authority.contact_email || '')
      setPhone(authority.contact_phone || '')
      setNotes(authority.notes || '')
    }
  }, [authority])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const submitData = {
      name: name.trim(),
      short_name: shortName.trim() || undefined,
      type: isInternal ? 'internal' : 'external',
      is_internal: isInternal,
      address: address.trim() || undefined,
      contact_email: email.trim() || undefined,
      contact_phone: phone.trim() || undefined,
      notes: notes.trim() || undefined
    }
    console.log('[AuthorityForm] handleSubmit - isInternal state:', isInternal)
    console.log('[AuthorityForm] handleSubmit - submitting data:', submitData)
    onSubmit(submitData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
            placeholder="Organization name"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short Name
          </label>
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="input w-full"
            placeholder="e.g., ACME"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Organization Type <span className="text-red-500">*</span>
        </label>
        <select
          value={isInternal ? 'internal' : 'external'}
          onChange={(e) => setIsInternal(e.target.value === 'internal')}
          className="input w-full"
        >
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {isInternal
            ? 'Internal organizations are used for internal correspondence'
            : 'External organizations are used for external correspondence with contacts'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Full address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            placeholder="contact@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input w-full"
            placeholder="+1 234 567 890"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Additional notes"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {authority ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
